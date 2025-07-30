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
import SmartFeaturedCategories from '@/components/SmartFeaturedCategories';
import WishlistPopup from '@/components/WishlistPopup';

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
    verification_status?: string;
  };
  quality?: string;
}

interface Filters {
  category: string;
  priceRange: { min: number; max: number | null };
  ratingRange: { min: number; max: number } | null;
  minReviews: number;
  sortBy: string;
}

const RATING_RANGES = [
  { label: '5 stars', min: 5, max: 5 },
  { label: '4–4.9 stars', min: 4, max: 4.99 },
  { label: '3–3.9 stars', min: 3, max: 3.99 },
  { label: '2–2.9 stars', min: 2, max: 2.99 },
  { label: '1–1.9 stars', min: 1, max: 1.99 },
  { label: '0–0.9 stars', min: 0, max: 0.99 },
];

const MIN_REVIEWS_OPTIONS = [0, 5, 10, 20, 50];

function ProductsHero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-red-50 to-red-100 py-16 mb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Discover Ethiopian Fashion
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore our curated collection of traditional and modern Ethiopian fashion, 
            handcrafted with love and cultural authenticity.
          </p>
        </div>
      </div>
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-12">
        <div className="w-64 h-64 bg-red-200 rounded-full opacity-20 blur-3xl"></div>
      </div>
      <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12">
        <div className="w-64 h-64 bg-yellow-200 rounded-full opacity-20 blur-3xl"></div>
      </div>
    </div>
  );
}

function FeaturedCategories({ setFilters }: { setFilters: (fn: (prev: Filters) => Filters) => void }) {
  return <SmartFeaturedCategories setFilters={setFilters} />;
}

function ProductsContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(100);
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set());
  const [isLikeLoading, setIsLikeLoading] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get('search') || '';
  const router = useRouter();
  const categoryParam = searchParams?.get('category');
  const [priceRange, setPriceRange] = useState<{ min: number; max: number | null }>({ min: 0, max: null });
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobilePopup, setShowMobilePopup] = useState(false);
  const [showWishlistPopup, setShowWishlistPopup] = useState(false);
  const [selectedProductForWishlist, setSelectedProductForWishlist] = useState<{id: string, title: string} | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowMobilePopup(true);
    }
  }, []);
  
  const supabase = createClientComponent();

  const [filters, setFilters] = useState<Filters>({
    category: 'all',
    priceRange: { min: 0, max: null },
    ratingRange: null,
    minReviews: 0,
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
        
        // Fetch custom categories first
        const { data: customCategoriesData, error: customCategoriesError } = await supabase
          .from('custom_categories')
          .select('name')
          .eq('is_active', true)
          .order('name');
        
        const customCategories = customCategoriesError ? [] : (customCategoriesData?.map(cat => cat.name) || []);
        
        const { data: productsData, error: productsError } = await supabase
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
            users!inner (
              id,
              store_settings,
              is_verified,
              verification_status
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
          .eq('is_active', true)
          .eq('users.is_verified', true)
          .neq('users.verification_status', 'needs_reconsideration')
          .order('created_at', { ascending: false });

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
            })) || []
          };
        }) || [];

        // Apply category filter
        if (filters.category !== 'all') {
          processedProducts = processedProducts.filter(
            product => product.category.toLowerCase() === filters.category
          );
        }

        // Apply price range filter
        if (filters.priceRange.min > 0 || filters.priceRange.max !== null) {
          processedProducts = processedProducts.filter(product => {
            const price = product.flash_sale_price || product.price;
            const minPrice = filters.priceRange.min || 0;
            const maxPrice = filters.priceRange.max || Infinity;
            return price >= minPrice && price <= maxPrice;
          });
        }

        // Apply rating range and min reviews filter if set
        if (filters.ratingRange && filters.ratingRange.min !== undefined && filters.ratingRange.max !== undefined) {
          processedProducts = processedProducts.filter(product => {
            const avg = product.average_rating || 0;
            const count = product.ratings?.length || 0;
            return avg >= filters.ratingRange!.min && avg <= filters.ratingRange!.max && count >= filters.minReviews;
          });
        } else if (filters.minReviews > 0) {
          processedProducts = processedProducts.filter(product => (product.ratings?.length || 0) >= filters.minReviews);
        }

        // Apply sorting
        switch (filters.sortBy) {
          case 'price-low':
            processedProducts.sort((a, b) => {
              const priceA = a.flash_sale_price || a.price;
              const priceB = b.flash_sale_price || b.price;
              return priceA - priceB;
            });
            break;
          case 'price-high':
            processedProducts.sort((a, b) => {
              const priceA = a.flash_sale_price || a.price;
              const priceB = b.flash_sale_price || b.price;
              return priceB - priceA;
            });
            break;
          case 'most-liked':
            processedProducts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
            break;
          case 'best-rated':
            processedProducts.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
            break;
          case 'newest':
          default:
            processedProducts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            break;
        }
        
        setProducts(processedProducts);
        
        // Extract unique categories and include custom categories
        const uniqueCategories = Array.from(
          new Set(productsData?.map(product => product.category).filter(Boolean))
        );
        
        // Combine product categories with custom categories, removing duplicates
        const allCategories = Array.from(new Set([...uniqueCategories, ...customCategories]));
        setCategories(['all', ...allCategories]);

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
    fetchUserLikes();
  }, [filters]);

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handle order/buy functionality
  const handleBuy = (productId: string) => {
    router.push(`/products/${productId}?action=buy`);
  };

  // Get current products for pagination (products are already filtered)
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
        // Unlike the product - only remove from likes table
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
        // Check if product is already in wishlist
        const { data: wishlistItem } = await supabase
          .from('wishlist')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('product_id', productId)
          .single();

        if (wishlistItem) {
          // Product is in wishlist, just add to likes
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
        } else {
          // Product not in wishlist, show popup
          const product = products.find(p => p.id === productId);
          if (product) {
            setSelectedProductForWishlist({ id: productId, title: product.title });
            setShowWishlistPopup(true);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update favorites');
    } finally {
      setIsLikeLoading(prev => ({ ...prev, [productId]: false }));
    }
  };

  return (
    <>
      {showMobilePopup && (
        <div className="fixed top-0 left-0 w-full z-[9999] flex justify-center items-center px-2 py-3 bg-yellow-100 border-b border-yellow-300 shadow-lg animate-fadeIn">
          <div className="flex flex-col items-center gap-2 w-full max-w-md mx-auto">
            <span className="text-sm font-semibold text-yellow-800 text-center">
              For better interaction and smooth experience, we recommend using a computer or laptop until the mobile version is fixed.<br/>
              <span className="block mt-1 text-xs font-normal text-yellow-700">የተሻለ ተግባራዊነት እና ምቹ አገልግሎት ለማግኘት እስከ mobile እትክክል እስኪሻሽ ድረስ ኮምፒውተር/ላፕቶፕ መጠቀም ይመከራል።</span>
            </span>
            <button
              className="mt-2 px-4 py-1.5 rounded bg-yellow-300 text-yellow-900 font-medium hover:bg-yellow-400 transition"
              onClick={() => setShowMobilePopup(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Wishlist Popup */}
      {selectedProductForWishlist && (
        <WishlistPopup
          isOpen={showWishlistPopup}
          onClose={() => {
            setShowWishlistPopup(false);
            setSelectedProductForWishlist(null);
          }}
          productId={selectedProductForWishlist.id}
          productTitle={selectedProductForWishlist.title}
          onSuccess={() => {
            // Update the UI to reflect the like
            const productId = selectedProductForWishlist.id;
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
          }}
        />
      )}
      <div className="min-h-screen bg-gray-50">
        <ProductsHero />

        {/* Mobile Filter Button */}
        <div className="md:hidden sticky top-0 z-50 bg-white shadow-sm px-4 py-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters & Sort
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

              {/* Make only the filter content scrollable, not the whole drawer */}
              <div className="flex-1 py-6 px-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 56px - 64px)' }}>
                {/* Sort Options */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Sort By</h3>
                  <select 
                    value={filters.sortBy}
                    onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="most-liked">Most Popular</option>
                    <option value="best-rated">Best Rated</option>
                  </select>
                </div>

                {/* Price Range */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Price Range</h3>
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

                {/* Categories */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Categories</h3>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto">
                    {categories.map((category) => (
                      <label key={category} className="flex items-center">
                        <input
                          type="radio"
                          name="category"
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                          checked={filters.category === category.toLowerCase()}
                          onChange={() => {
                            setFilters(prev => ({ 
                              ...prev, 
                              category: category.toLowerCase() 
                            }));
                            setShowFilters(false);
                          }}
                        />
                        <span className="ml-3 text-sm text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rating Range Filter */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Rating</h3>
                  <div className="space-y-3">
                    {RATING_RANGES.map((range) => (
                      <label key={range.label} className="flex items-center">
                        <input
                          type="radio"
                          name="ratingRange"
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                          checked={filters.ratingRange?.min === range.min && filters.ratingRange?.max === range.max}
                          onChange={() => setFilters(prev => ({ ...prev, ratingRange: { min: range.min, max: range.max } }))}
                        />
                        <span className="ml-3 text-sm text-gray-700">{range.label}</span>
                      </label>
                    ))}
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="ratingRange"
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                        checked={!filters.ratingRange}
                        onChange={() => setFilters(prev => ({ ...prev, ratingRange: null }))}
                      />
                      <span className="ml-3 text-sm text-gray-700">Any rating</span>
                    </label>
                  </div>
                </div>

                {/* Minimum Reviews Filter */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Minimum Reviews</h3>
                  <select
                    value={filters.minReviews}
                    onChange={e => setFilters(prev => ({ ...prev, minReviews: Number(e.target.value) }))}
                    className="w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    {MIN_REVIEWS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt === 0 ? 'Any' : `At least ${opt}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 px-4 py-6 flex flex-col gap-2">
                <button
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                  onClick={() => setShowFilters(false)}
                >
                  Apply Filters
                </button>
                <button
                  className="w-full bg-gray-100 text-red-600 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors border border-red-200"
                  onClick={() => {
                    setFilters({
                      category: 'all',
                      priceRange: { min: 0, max: null },
                      ratingRange: null,
                      minReviews: 0,
                      sortBy: 'newest'
                    });
                    setShowFilters(false);
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Pass setFilters to FeaturedCategories */}
          <FeaturedCategories setFilters={setFilters} />

          <div className="flex flex-col md:flex-row gap-8">
            {/* Desktop Sidebar Filters - Update the styling */}
            <div className="hidden md:block w-64 flex-shrink-0">
              <div className="sticky top-32 bg-white rounded-2xl shadow-sm p-6 space-y-8 border border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                  <button
                    onClick={() => setFilters({
                      category: 'all',
                      priceRange: { min: 0, max: null },
                      ratingRange: null,
                      minReviews: 0,
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
                    {categories.map((category) => (
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

                {/* Rating Range Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Rating</h3>
                  <div className="space-y-3">
                    {RATING_RANGES.map((range) => (
                      <label key={range.label} className="flex items-center">
                        <input
                          type="radio"
                          name="ratingRange"
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                          checked={filters.ratingRange?.min === range.min && filters.ratingRange?.max === range.max}
                          onChange={() => setFilters(prev => ({ ...prev, ratingRange: { min: range.min, max: range.max } }))}
                        />
                        <span className="ml-3 text-sm text-gray-700">{range.label}</span>
                      </label>
                    ))}
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="ratingRange"
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                        checked={!filters.ratingRange}
                        onChange={() => setFilters(prev => ({ ...prev, ratingRange: null }))}
                      />
                      <span className="ml-3 text-sm text-gray-700">Any rating</span>
                    </label>
                  </div>
                </div>

                {/* Minimum Reviews Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Minimum Reviews</h3>
                  <select
                    value={filters.minReviews}
                    onChange={e => setFilters(prev => ({ ...prev, minReviews: Number(e.target.value) }))}
                    className="w-full pl-3 pr-10 py-2 text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    {MIN_REVIEWS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt === 0 ? 'Any' : `At least ${opt}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Main Content - Update the styling */}
            <div className="flex-1">
              {/* Sort Options - Update the styling */}
              <div className="flex flex-col sm:flex-row items-center justify-between mb-8 bg-white p-4 rounded-xl shadow-sm">
                <p className="text-gray-500 mb-4 sm:mb-0">
                  Showing <span className="font-medium text-gray-900">{products.length}</span> total results
                  {products.length > productsPerPage && (
                    <span className="text-gray-400"> (Page {currentPage} of {Math.ceil(products.length / productsPerPage)})</span>
                  )}
                </p>
                <div className="flex items-center gap-4">
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
              </div>

              {/* Products Grid - Update the card styling */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {paginatedProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className="group relative bg-white rounded-2xl shadow-sm overflow-hidden transform hover:-translate-y-1 transition-all duration-300 hover:shadow-xl"
                    >
                      <Link href={`/products/${product.id}`}>
                        <div className="relative w-full pt-[100%] bg-gray-200">
                          {product.product_images && product.product_images.length > 0 ? (
                            <Image
                              src={product.product_images[0].image_url}
                              alt={product.title}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                              className="absolute inset-0 w-full h-full object-cover object-center group-hover:opacity-75 transition-opacity"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/placeholder.png';
                              }}
                              priority={false}
                              quality={75}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <svg
                                className="w-12 h-12 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                          )}
                          
                          <div className="absolute top-2 right-2 z-10">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                              ${product.quality === 'new' ? 'bg-green-100 text-green-800' : 
                                product.quality === 'used' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-blue-100 text-blue-800'}`}>
                              {product.quality || 'New'}
                            </span>
                          </div>
                          
                          <div className="absolute top-3 left-0 z-10">
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-white/90 text-gray-800 shadow-sm">
                              {product.category}
                            </span>
                          </div>
                          
                          {product.flash_sale_price && (
                            <div className="absolute bottom-6 right-4 z-10">
                              <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                                SALE
                              </div>
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                            {product.title}
                          </h3>
                          <div className="mt-2 flex items-center justify-between">
                            <div>
                              {product.flash_sale_price ? (
                                <div className="flex flex-col">
                                  <span className="text-lg font-bold text-red-600">
                                    ETB {product.flash_sale_price}
                                  </span>
                                  <span className="text-sm text-gray-500 line-through">
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
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-xs text-gray-500">
                                {product.users.store_settings.name}
                              </span>
                              {product.users?.verification_status === 'verified' && (
                                <div className="relative group">
                                  <svg 
                                    className="w-3.5 h-3.5 text-blue-500" 
                                    viewBox="0 0 20 20" 
                                    fill="currentColor"
                                    aria-label="Verified Seller"
                                  >
                                    <path 
                                      fillRule="evenodd" 
                                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                                      clipRule="evenodd" 
                                    />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    Verified Seller
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <span className="ml-2 text-xs text-gray-500">({product.ratings?.length || 0} reviews)</span>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination - Update the styling */}
              {products.length > productsPerPage && (
                <div className="mt-12">
                  <nav className="flex justify-center space-x-2" aria-label="Pagination">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    
                    {(() => {
                      const totalPages = Math.ceil(products.length / productsPerPage);
                      const maxVisiblePages = 7;
                      const pages = [];
                      
                      if (totalPages <= maxVisiblePages) {
                        // Show all pages if total is small
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Show smart pagination with ellipsis
                        if (currentPage <= 4) {
                          // Near the beginning
                          for (let i = 1; i <= 5; i++) {
                            pages.push(i);
                          }
                          pages.push('...');
                          pages.push(totalPages);
                        } else if (currentPage >= totalPages - 3) {
                          // Near the end
                          pages.push(1);
                          pages.push('...');
                          for (let i = totalPages - 4; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // In the middle
                          pages.push(1);
                          pages.push('...');
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                            pages.push(i);
                          }
                          pages.push('...');
                          pages.push(totalPages);
                        }
                      }
                      
                      return pages.map((page, index) => (
                        <button
                          key={index}
                          onClick={() => typeof page === 'number' ? paginate(page) : null}
                          disabled={typeof page !== 'number'}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                            currentPage === page
                              ? 'z-10 bg-red-600 text-white shadow-md'
                              : typeof page === 'number'
                              ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-red-300'
                              : 'bg-white border border-gray-200 text-gray-400 cursor-default'
                          }`}
                        >
                          {page}
                        </button>
                      ));
                    })()}
                    
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === Math.ceil(products.length / productsPerPage)}
                      className="relative inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </nav>
                  
                  {/* Page info */}
                  <div className="mt-4 text-center text-sm text-gray-500">
                    Showing {indexOfFirstProduct + 1} to {Math.min(indexOfLastProduct, products.length)} of {products.length} products
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <ProductsContent />
    </Suspense>
  );
} 