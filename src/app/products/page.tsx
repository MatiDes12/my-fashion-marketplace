'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { cleanImageUrl } from '@/utils/url';
import Link from 'next/link';
import { getFlashSalePrices } from '@/utils/flashSales';
import { Suspense } from 'react';
import LoadingPage from '@/components/LoadingPage';
import { PRODUCT_CATEGORIES } from '@/utils/constants';

interface ProductOwner {
  id: string;
  full_name: string;
  email: string;
  store_settings: {
    name: string;
    description: string;
    logo_url: string;
    [key: string]: any;
  };
}

interface ProductImage {
  id: string;
  image_url: string;
  is_model_picture: boolean;
}

interface FlashSale {
  id: string;
  is_active: boolean;
  start_time: string;
  end_time: string;
  special_price: number;
}

interface FlashSaleProduct {
  id: string;
  flash_sale: FlashSale;
  special_price: number;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  owner_id: string;
  delivery_fee: number | null;
  product_images: ProductImage[];
  owner: ProductOwner;
  like_count: number;
  flash_sale_price?: number;
  average_rating?: number;
  flash_sale_products?: FlashSaleProduct[];
  ratings?: Array<{
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    updated_at: string;
    user: {
      id: string;
      full_name: string;
    };
  }>;
  user_rating?: {
    id: string;
    rating: number;
    comment: string;
  } | null;
  users?: {
    store_settings?: {
      name: string;
    };
  };
}

interface Filters {
  category: string;
  priceRange: { min: number; max: number | null };
  rating: number | null;
  sortBy: string;
}

function ProductsContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(12);
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set());
  const [isLikeLoading, setIsLikeLoading] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get('search') || '';
  const router = useRouter();
  const categoryParam = searchParams?.get('category');
  const [priceRange, setPriceRange] = useState<{ min: number; max: number | null }>({ min: 0, max: null });
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);
  
  const supabase = createClientComponent();

  const [filters, setFilters] = useState<Filters>({
    category: 'all',
    priceRange: { min: 0, max: null },
    rating: null,
    sortBy: 'newest'
  });

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam]);

  useEffect(() => {
    const category = searchParams?.get('category') || 'all';
    setFilters(prev => ({
      ...prev,
      category: category.toLowerCase()
    }));
  }, [searchParams]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let query = supabase
          .from('products')
          .select(`
            *,
            product_images (
              id,
              image_url,
              is_model_picture
            ),
            ratings (
              rating
            ),
            users (
              id,
              full_name,
              email,
              store_settings
            ),
            likes:likes (count),
            flash_sale_products!left (
              special_price,
              flash_sale:flash_sales!inner (
                id,
                start_time,
                end_time,
                is_active
              )
            )
          `)
          .eq('is_active', true);

        // Apply category filter
        if (filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }

        // Apply price range filter
        if (filters.priceRange.min > 0) {
          query = query.gte('price', filters.priceRange.min);
        }
        if (filters.priceRange.max) {
          query = query.lte('price', filters.priceRange.max);
        }

        // Apply sorting - handle most-liked separately
        if (filters.sortBy === 'most-liked') {
          // We'll sort by likes after fetching the data
          query = query.order('created_at', { ascending: false });
        } else {
          switch (filters.sortBy) {
            case 'price-low':
              query = query.order('price', { ascending: true });
              break;
            case 'price-high':
              query = query.order('price', { ascending: false });
              break;
            default: // 'newest'
              query = query.order('created_at', { ascending: false });
          }
        }

        const { data: productsData, error: productsError } = await query;

        if (productsError) throw productsError;

        // Process products and calculate ratings
        let processedProducts = productsData?.map(product => {
          const ratings = product.ratings || [];
          const averageRating = ratings.length > 0
            ? ratings.reduce((acc: number, curr: any) => acc + curr.rating, 0) / ratings.length
            : 0;

          // Get active flash sale price if available
          const now = new Date();
          const activeFlashSale = product.flash_sale_products?.find((fsp: { flash_sale: { is_active: boolean, start_time: string, end_time: string } }) => {
            const flashSale = fsp.flash_sale;
            return flashSale.is_active && 
              new Date(flashSale.start_time) <= now && 
              new Date(flashSale.end_time) >= now;
          });

          return {
          ...product,
            average_rating: averageRating,
          like_count: product.likes?.[0]?.count || 0,
            flash_sale_price: activeFlashSale?.special_price || null,
            product_images: product.product_images?.map((img: any) => ({
            ...img,
              image_url: cleanImageUrl(img.image_url)
            }))
          };
        }) || [];

        // Apply rating filter if set
        if (filters.rating !== null) {
          processedProducts = processedProducts.filter(
            product => {
              const rating = product.average_rating || 0;
              // Use a small epsilon for floating point comparison
              return Math.abs(rating - (filters.rating || 0)) < 0.5;
            }
          );
        }

        // Apply sorting for most-liked and best-rated
        if (filters.sortBy === 'most-liked') {
          processedProducts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        } else if (filters.sortBy === 'best-rated') {
          processedProducts.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        }
        
        setProducts(processedProducts);
        
        // Extract unique categories
          const uniqueCategories = Array.from(
          new Set(productsData?.map(product => product.category).filter(Boolean))
        );
        setCategories(['all', ...uniqueCategories]);

      } catch (error) {
        console.error('Error fetching products:', error);
        setError('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    
    const fetchUserLikes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('product_id')
          .eq('user_id', session.user.id);
          
        if (userLikes) {
          const likedProductIds = new Set(userLikes.map(like => like.product_id));
          setLikedProducts(likedProductIds);
        }
      }
    };
    
    fetchProducts();
  }, [filters]);

  // Get current products for pagination
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const paginatedProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);
  
  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  // Handle like functionality
  const handleLike = async (productId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.error('Please sign in to like products');
      router.push('/login');
      return;
    }
    
    setIsLikeLoading(prev => ({ ...prev, [productId]: true }));
    
    try {
      const isLiked = likedProducts.has(productId);
      
      if (isLiked) {
        // Unlike the product
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', session.user.id)
          .eq('product_id', productId);
          
        setLikedProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        
        // Update product like count in the UI
        setProducts(prev => 
          prev.map(product => 
            product.id === productId 
              ? { 
                  ...product, 
                  like_count: Math.max(0, (product.like_count || 0) - 1) 
                }
              : product
          )
        );
        
        toast.success('Removed from favorites');
      } else {
        // Like the product
        await supabase
          .from('likes')
          .insert({
            user_id: session.user.id,
            product_id: productId
          });
          
        setLikedProducts(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        
        // Update product like count in the UI
        setProducts(prev => 
          prev.map(product => 
            product.id === productId 
              ? { 
                  ...product, 
                  like_count: (product.like_count || 0) + 1 
                }
              : product
          )
        );
        
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update favorites');
    } finally {
      setIsLikeLoading(prev => ({ ...prev, [productId]: false }));
    }
  };
  
  // Handle order/buy functionality
  const handleBuy = (productId: string) => {
    router.push(`/products/${productId}?action=buy`);
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(product => product.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 md:pt-24">
          {/* Mobile Filter Button */}
          <div className="md:hidden mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
          </div>

          {/* Mobile Filter Slide-over */}
          <div 
            className={`fixed inset-0 bg-black bg-opacity-50 z-[60] transition-opacity md:hidden ${
              showFilters ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setShowFilters(false)}
          >
            <div 
              className={`fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-xl transform transition-transform z-[70] ${
                showFilters ? 'translate-x-0' : 'translate-x-full'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className="h-full flex flex-col bg-white shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                  <button
                    className="text-gray-400 hover:text-gray-500"
                    onClick={() => setShowFilters(false)}
                  >
                    <span className="sr-only">Close panel</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 py-6 px-4 overflow-y-auto">
                  {/* Filter Content - Same as desktop */}
                  <div className="space-y-8">
                    {/* Price Range */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-4">Price Range</h3>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                          <input
                            type="number"
                            placeholder="Min"
                            value={filters.priceRange.min || ''}
                            onChange={(e) => setFilters(prev => ({
                              ...prev,
                              priceRange: { ...prev.priceRange, min: Number(e.target.value) }
                            }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={filters.priceRange.max || ''}
                            onChange={(e) => setFilters(prev => ({
                              ...prev,
                              priceRange: { ...prev.priceRange, max: Number(e.target.value) || null }
                            }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
                      </div>
                    </div>

                    {/* Categories */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-4">Categories</h3>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        {PRODUCT_CATEGORIES.map((category) => (
                          <label key={category} className="flex items-center">
                            <input
                              type="radio"
                              name="category"
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                              checked={filters.category === category.toLowerCase()}
                              onChange={() => setFilters(prev => ({ 
                                ...prev, 
                                category: category.toLowerCase() 
                              }))}
                            />
                            <span className="ml-3 text-sm text-gray-700">
                      {category}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Rating Filter */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-4">Rating</h3>
                      <div className="space-y-3">
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <label key={rating} className="flex items-center">
                            <input
                              type="radio"
                              name="rating"
                              className="w-4 h-4 text-red-600 focus:ring-red-500"
                              checked={filters.rating === rating}
                              onChange={() => setFilters(prev => ({ ...prev, rating }))}
                            />
                            <span className="ml-3 flex items-center">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <svg 
                                  key={i} 
                                  className={`h-5 w-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`} 
                                  fill="currentColor" 
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                              ))}
                              <span className="ml-2 text-sm text-gray-500">
                                {rating} star{rating !== 1 ? 's' : ''}
                              </span>
                            </span>
                          </label>
                        ))}
            </div>
          </div>
        </div>
      </div>

                <div className="border-t border-gray-200 px-4 py-6">
            <button
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-md"
                    onClick={() => setShowFilters(false)}
                  >
                    Apply Filters
            </button>
                </div>
              </div>
            </div>
              </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Desktop Sidebar Filters */}
            <div className="hidden md:block w-64 flex-shrink-0">
              <div className="sticky top-32 bg-white rounded-2xl shadow-sm p-6 space-y-8 border border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              <button
                    onClick={() => setFilters({
                      category: 'all',
                      priceRange: { min: 0, max: null },
                      rating: null,
                      sortBy: 'newest'
                    })}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear all
                  </button>
                </div>
                
                {/* Price Range */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Price Range</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.priceRange.min || ''}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          priceRange: { ...prev.priceRange, min: Number(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.priceRange.max || ''}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          priceRange: { ...prev.priceRange, max: Number(e.target.value) || null }
                        }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Categories</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {PRODUCT_CATEGORIES.map((category) => (
                      <label key={category} className="flex items-center">
                        <input
                          type="radio"
                          name="category"
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                          checked={filters.category === category.toLowerCase()}
                          onChange={() => setFilters(prev => ({ 
                            ...prev, 
                            category: category.toLowerCase() 
                          }))}
                        />
                        <span className="ml-3 text-sm text-gray-700">
                {category}
                        </span>
                    </label>
                    ))}
                  </div>
                </div>

                {/* Rating Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Rating</h3>
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <label key={rating} className="flex items-center">
                        <input
                          type="radio"
                          name="rating"
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                          checked={filters.rating === rating}
                          onChange={() => setFilters(prev => ({ ...prev, rating }))}
                        />
                        <span className="ml-3 flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <svg 
                              key={i} 
                              className={`h-5 w-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`} 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                          ))}
                          <span className="ml-2 text-sm text-gray-500">
                            {rating} star{rating !== 1 ? 's' : ''}
                          </span>
                        </span>
                      </label>
            ))}
          </div>
        </div>
          </div>
        </div>
        
          {/* Main Content */}
          <div className="flex-1">
              {/* Sort Options */}
              <div className="flex items-center justify-between mb-8">
                <p className="text-gray-500">
                  Showing <span className="font-medium text-gray-900">{products.length}</span> results
                </p>
                <select 
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                  className="pl-3 pr-10 py-2 text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="most-liked">Most Popular</option>
                  <option value="best-rated">Best Rated</option>
                </select>
          </div>
        
            {/* Products Grid */}
          {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="relative aspect-w-1 aspect-h-1 rounded-2xl bg-gray-200 overflow-hidden"></div>
                      <div className="mt-4 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
            </div>
          ) : error ? (
              <ErrorMessage message={error} />
          ) : products.length === 0 ? (
              <div className="text-center py-12">
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                  <p className="mt-1 text-gray-500">
                    Try adjusting your search or filter criteria
              </p>
            </div>
          ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map((product) => (
                    <div 
                      key={product.id} 
                      className="group relative bg-white rounded-2xl shadow-sm overflow-hidden transform hover:-translate-y-1 transition-all duration-300 hover:shadow-xl"
                    >
                      <Link href={`/products/${product.id}`}>
                        <div className="relative aspect-w-1 aspect-h-1 bg-gray-200">
                          <Image
                            src={product.product_images[0]?.image_url || '/placeholder.png'}
                            alt={product.title}
                            fill
                            className="object-cover object-center group-hover:opacity-75 transition-opacity"
                          />
                          {product.flash_sale_price && (
                            <div className="absolute top-4 right-4">
                              <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                                SALE
                              </div>
                          </div>
                        )}
                      </div>
                        <div className="p-6">
                          <h3 className="text-lg font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                            {product.title}
                          </h3>
                          <div className="mt-2 flex items-center justify-between">
                            <div>
                              {product.flash_sale_price ? (
                                <div className="flex items-baseline">
                                  <span className="text-lg font-bold text-red-600">
                                    ETB {product.flash_sale_price}
                                  </span>
                                  <span className="ml-2 text-xs text-gray-500 line-through">
                                    ETB {product.price}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-gray-900">
                                  ETB {product.price}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center">
                                <svg
                                  className="w-5 h-5 text-yellow-400"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="ml-1 text-sm text-gray-500">
                                  {product.average_rating?.toFixed(1) || '0.0'}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <svg
                                  className="w-5 h-5 text-red-500"
                                  fill="currentColor"
                            viewBox="0 0 20 20" 
                                >
                                  <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                          </svg>
                                <span className="ml-1 text-sm text-gray-500">
                                  {product.like_count}
                                </span>
                    </div>
                        </div>
                      </div>
                          {product.users?.store_settings?.name && (
                            <div className="mt-1">
                              <span className="text-xs text-gray-500">
                                {product.users.store_settings.name}
                              </span>
                        </div>
                          )}
                        </div>
                      </Link>
                  </div>
                ))}
              </div>
            )}
              
              {/* Pagination */}
              {products.length > productsPerPage && (
                <div className="mt-12">
                  <nav className="flex justify-center space-x-2" aria-label="Pagination">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: Math.ceil(products.length / productsPerPage) }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => paginate(index + 1)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          currentPage === index + 1
                            ? 'z-10 bg-red-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === Math.ceil(products.length / productsPerPage)}
                      className="relative inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <ProductsContent />
    </Suspense>
  );
} 