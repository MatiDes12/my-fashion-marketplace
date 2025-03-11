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

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  owner_id: string;
  delivery_fee: number | null;
  product_images: Array<{ id: string; image_url: string }>;
  owner: ProductOwner;
  like_count: number;
  flash_sale_price?: number;
}

export default function ProductsPage() {
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
  const searchQuery = searchParams.get('search') || '';
  const router = useRouter();
  const categoryParam = searchParams.get('category');
  
  const supabase = createClientComponent();

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First, fetch products with their basic info and relationships
        let query = supabase
          .from('products')
          .select(`
            *,
            users (
              id,
              full_name,
              email,
              store_settings
            ),
            product_images (
              id,
              image_url,
              is_model_picture
            ),
            likes:likes(count)
          `)
          .eq('is_active', true);

        // Apply category filter if not 'all'
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        const { data: productsData, error: productsError } = await query
          .order('created_at', { ascending: false });

        if (productsError) throw productsError;

        // Process products with flash sale prices
        const productIds = productsData?.map(item => item.id) || [];
        const flashSalePrices = await getFlashSalePrices(productIds);

        const processedProducts = productsData?.map(product => ({
          ...product,
          flash_sale_price: flashSalePrices[product.id],
          like_count: product.likes?.[0]?.count || 0,
          product_images: product.product_images?.map(img => ({
            ...img,
            image_url: img.image_url
          }))
        })) || [];
        
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
  }, [selectedCategory, searchQuery]);

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
    <div className="min-h-screen bg-gray-50 pt-32">
      {/* Categories and Filters Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-lg mb-4">Categories</h3>
              <div className="space-y-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    // Optionally update the URL when category changes
                    const newParams = new URLSearchParams(searchParams);
                    if (e.target.value === 'all') {
                      newParams.delete('category');
                    } else {
                      newParams.set('category', e.target.value);
                    }
                    router.push(`/products?${newParams.toString()}`);
                  }}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Filters */}
              <div className="mt-8">
                <h3 className="font-semibold text-lg mb-4">Filters</h3>
                
                {/* Price Range */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-2">Price Range</h4>
                  <div className="space-y-2">
                    <input
                      type="range"
                      className="w-full accent-red-600"
                      min="0"
                      max="1000"
                    />
                    <div className="flex justify-between">
                      <input
                        type="number"
                        placeholder="Min"
                        className="w-20 px-2 py-1 border rounded"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        className="w-20 px-2 py-1 border rounded"
          />
        </div>
                  </div>
                </div>

                {/* Shipping Options */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-2">Shipping</h4>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="text-red-600 rounded" />
                      <span className="ml-2 text-sm">Free Shipping</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="text-red-600 rounded" />
                      <span className="ml-2 text-sm">Express Available</span>
                    </label>
                  </div>
                </div>

                {/* Seller Rating */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-2">Seller Rating</h4>
                  <div className="space-y-2">
                    {[4, 3, 2, 1].map(rating => (
                      <label key={rating} className="flex items-center">
                        <input type="checkbox" className="text-red-600 rounded" />
                        <span className="ml-2 text-sm flex items-center">
                          {Array.from({ length: rating }).map((_, i) => (
                            <svg key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                          ))}
                          <span className="ml-1">& up</span>
                        </span>
                      </label>
                    ))}
            </div>
          </div>
        </div>
          </div>
        </div>
        
          {/* Main Content */}
          <div className="flex-1">
            {/* Search Results Info */}
        {searchQuery && (
              <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                <p className="text-sm text-gray-600">
                  Showing results for "{searchQuery}" ({products.length} products)
            </p>
          </div>
        )}
        
            {/* Products Grid */}
          {loading ? (
              <LoadingSpinner />
          ) : error ? (
              <ErrorMessage message={error} />
          ) : products.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                            stroke="currentColor"
                  aria-hidden="true"
                          >
                            <path 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedCategory !== 'all'
                    ? `No products found in the "${selectedCategory}" category.`
                    : searchQuery
                    ? `No products found matching "${searchQuery}"`
                    : 'There are no products available at the moment.'}
                </p>
                    </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} showOwner />
                ))}
              </div>
            )}
              
              {/* Pagination */}
              {products.length > productsPerPage && (
                <div className="mt-12 flex justify-center">
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {Array.from({ length: Math.ceil(products.length / productsPerPage) }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => paginate(index + 1)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium transition-all duration-300 ${
                          currentPage === index + 1
                            ? 'z-10 bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === Math.ceil(products.length / productsPerPage)}
                      className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
} 