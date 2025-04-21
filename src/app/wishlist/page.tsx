'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { cleanImageUrl } from '@/utils/url';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  quality?: string;
  product_images: Array<{
    id: string;
    image_url: string;
    is_model_picture: boolean;
  }>;
  owner: {
    id: string;
    store_settings: {
      name: string;
    };
    verification_status: string;
  };
  flash_sale_products?: Array<{
    special_price: number;
    flash_sale: {
      id: string;
      is_active: boolean;
      start_time: string;
      end_time: string;
    };
  }>;
  average_rating: number;
  like_count: number;
  flash_sale_price: number | null;
}

interface DatabaseProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  quality?: string;
  product_images: Array<{
    id: string;
    image_url: string;
    is_model_picture: boolean;
  }>;
  owner: {
    id: string;
    store_settings: {
      name: string;
    };
    verification_status: string;
  };
  flash_sale_products?: Array<{
    special_price: number;
    flash_sale: {
      id: string;
      is_active: boolean;
      start_time: string;
      end_time: string;
    };
  }>;
  ratings?: Array<{ rating: number }>;
  likes?: Array<{ count: number }>;
}

interface LikeWithProduct {
  product_id: string;
  products: DatabaseProduct;
}

export default function WishlistPage() {
  const [likedProducts, setLikedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});
  const supabase = createClientComponent();
  const router = useRouter();

  useEffect(() => {
    fetchLikedProducts();
  }, []);

  const fetchLikedProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login?redirect=/wishlist');
        return;
      }

      const { data: likes, error } = await supabase
        .from('likes')
        .select(`
          product_id,
          products (
            id,
            title,
            description,
            price,
            category,
            quality,
            product_images (
              id,
              image_url,
              is_model_picture
            ),
            owner:users (
              id,
              store_settings,
              verification_status
            ),
            flash_sale_products!left (
              special_price,
              flash_sale:flash_sales!inner (
                id,
                start_time,
                end_time,
                is_active
              )
            ),
            ratings (
              rating
            ),
            likes:likes (count)
          )
        `)
        .eq('user_id', session.user.id);

      if (error) throw error;

      const products = (likes as unknown as LikeWithProduct[])
        ?.map(like => {
          const product = like.products;
          if (!product) return null;

          // Calculate average rating
          const ratings = product.ratings || [];
          const averageRating = ratings.length > 0
            ? ratings.reduce((acc: number, curr) => acc + curr.rating, 0) / ratings.length
            : 0;

          // Get active flash sale price if available
          const now = new Date();
          const activeFlashSale = product.flash_sale_products?.find((fsp) => {
            const flashSale = fsp.flash_sale;
            return flashSale.is_active && 
              new Date(flashSale.start_time) <= now && 
              new Date(flashSale.end_time) >= now;
          });

          const processedProduct: Product = {
            ...product,
            average_rating: averageRating,
            like_count: product.likes?.[0]?.count || 0,
            flash_sale_price: activeFlashSale?.special_price || null,
            product_images: product.product_images?.map(img => ({
              ...img,
              image_url: cleanImageUrl(img.image_url)
            })) || []
          };

          return processedProduct;
        })
        .filter((product): product is Product => product !== null);

      setLikedProducts(products || []);
    } catch (error) {
      console.error('Error fetching liked products:', error);
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWishlist = async (productId: string) => {
    try {
      setIsRemoving(prev => ({ ...prev, [productId]: true }));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', session.user.id)
        .eq('product_id', productId);

      if (error) throw error;

      setLikedProducts(prev => prev.filter(product => product.id !== productId));
      toast.success('Removed from wishlist');
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      toast.error('Failed to remove from wishlist');
    } finally {
      setIsRemoving(prev => ({ ...prev, [productId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            My Wishlist
          </h1>
          <p className="text-xl text-gray-600 font-light">
            {likedProducts.length} item{likedProducts.length !== 1 ? 's' : ''} saved for later
          </p>
        </div>

        {likedProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-lg border border-gray-100">
            <div className="w-32 h-32 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 transform transition-transform hover:scale-110">
              <svg className="w-16 h-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">Your wishlist is empty</h3>
            <p className="mt-2 text-gray-600 max-w-md mx-auto text-lg">
              Discover amazing products and save your favorites here
            </p>
            <Link
              href="/products"
              className="mt-8 inline-flex items-center px-8 py-3 border-2 border-red-600 text-base font-medium rounded-full text-white bg-red-600 hover:bg-red-700 hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-300 transform hover:scale-105"
            >
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {likedProducts.map((product) => (
              <div 
                key={product.id} 
                className="group relative bg-white rounded-3xl shadow-lg overflow-hidden transform hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl border border-gray-100"
              >
                <Link href={`/products/${product.id}`}>
                  <div className="relative w-full pt-[100%] bg-gray-100 overflow-hidden">
                    {product.product_images && product.product_images.length > 0 ? (
                      <Image
                        src={product.product_images[0].image_url}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 
                               (max-width: 1024px) 50vw, 
                               (max-width: 1280px) 33vw,
                               25vw"
                        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.png';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                        <svg
                          className="w-16 h-16 text-gray-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    
                    <div className="absolute top-4 right-4 z-10">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize backdrop-blur-md
                        ${product.quality === 'new' ? 'bg-green-100/90 text-green-800' : 
                          product.quality === 'used' ? 'bg-amber-100/90 text-amber-800' : 
                          'bg-blue-100/90 text-blue-800'}`}>
                        {product.quality || 'New'}
                      </span>
                    </div>
                    
                    <div className="absolute top-4 left-4 z-10">
                      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium bg-white/95 text-gray-800 shadow-sm backdrop-blur-md">
                        {product.category}
                      </span>
                    </div>
                    
                    {product.flash_sale_price && (
                      <div className="absolute bottom-4 right-4 z-10">
                        <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-full animate-pulse shadow-lg">
                          FLASH SALE
                        </div>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 mb-3">
                      {product.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        {product.flash_sale_price ? (
                          <div className="flex flex-col">
                            <span className="text-xl font-bold text-red-600">
                              ETB {product.flash_sale_price.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-400 line-through">
                              ETB {product.price.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xl font-bold text-gray-900">
                            ETB {product.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center bg-gray-50 px-2.5 py-1 rounded-full">
                          <svg
                            className="w-4 h-4 text-yellow-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="ml-1 text-sm font-medium text-gray-600">
                            {product.average_rating?.toFixed(1) || '0.0'}
                          </span>
                        </div>
                        <div className="flex items-center bg-gray-50 px-2.5 py-1 rounded-full">
                          <svg
                            className="w-4 h-4 text-red-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                          </svg>
                          <span className="ml-1 text-sm font-medium text-gray-600">
                            {product.like_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => handleRemoveFromWishlist(product.id)}
                  disabled={isRemoving[product.id]}
                  className="absolute top-4 right-4 z-20 p-2.5 text-red-600 hover:text-white hover:bg-red-600 focus:outline-none bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-300 group/btn"
                >
                  {isRemoving[product.id] ? (
                    <div className="w-5 h-5 border-t-2 border-current rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 