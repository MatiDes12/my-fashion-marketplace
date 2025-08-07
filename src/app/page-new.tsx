'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatETB } from '@/utils/currency';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { getActiveFlashSale, getFlashSalePrices, getAllActiveFlashSales } from '@/utils/flashSales';
import ProductImage from '@/components/ProductImage';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import CountdownTimer from '@/components/CountdownTimer';
import { cleanImageUrl } from '@/utils/url';
import { useAuth } from '@/contexts/AuthContext';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useScroll, useTransform } from 'framer-motion';
import FloatingGradient from '@/components/FloatingGradient';
import ParallaxSection from '@/components/ParallaxSection';
import ScrollProgress from '@/components/ScrollProgress';
import { PRODUCT_CATEGORIES } from '@/utils/constants';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { EMAIL_CONFIG } from '@/config/email';
import { FeaturedCollections, CategoryGrid, TestimonialsSection, NewsletterSection } from '@/components/landing';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ELoading...%3C/text%3E%3C/svg%3E';

// Interface definitions
interface FeaturedSeller {
  seller_id: string;
  seller_name: string;
  verification_status: string;
  store_settings: {
    name: string;
    logo_url: string;
    description: string;
  };
  top_product: {
    id: string;
    title: string;
    price: number;
    images: Array<{ image_url: string }>;
    like_count: number;
  };
}

interface ProductImage {
  id: string;
  image_url: string;
  is_model_picture?: boolean;
}

interface PopularProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  owner_id: string;
  created_at: string;
  product_images: ProductImage[];
  likes: Array<{ id: string }>;
  like_count?: number;
  flash_sale_price?: number;
  users: {
    id: string;
    full_name: string;
    email: string;
    store_settings?: {
      name: string;
      logo_url: string;
      description: string;
    };
  };
  average_rating?: number;
  ratings?: Array<{
    rating: number;
  }>;
  combined_score?: number;
}

interface FlashSaleProduct {
  id: string;
  product_id: string;
  special_price: number;
  product: {
    id: string;
    title: string;
    price: number;
    description: string;
    product_images: {
      id: string;
      image_url: string;
    }[];
    owner?: {
      store_settings?: {
        name?: string;
      };
    };
  };
}

interface FlashSale {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  store_id: string;
  store_name: string;
  created_by: string;
  products: FlashSaleProduct[];
}

export default function HomePage() {
  const { user } = useAuth();
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [mostLikedProducts, setMostLikedProducts] = useState<PopularProduct[]>([]);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch featured sellers
      const { data: sellersData, error: sellersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          store_settings,
          verification_status,
          products (
            id,
            title,
            price,
            product_images (
              id,
              image_url
            ),
            likes (count)
          )
        `)
        .eq('role', 'owner')
        .eq('is_verified', true)
        .neq('verification_status', 'needs_reconsideration')
        .not('store_settings', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sellersError) throw sellersError;

      const featuredSellers = sellersData?.map(seller => ({
        seller_id: seller.id,
        seller_name: seller.full_name,
        verification_status: seller.verification_status || '',
        store_settings: seller.store_settings,
        top_product: {
          id: seller.products[0]?.id,
          title: seller.products[0]?.title,
          price: seller.products[0]?.price,
          images: seller.products[0]?.product_images || [],
          like_count: seller.products[0]?.likes?.[0]?.count || 0
        }
      })) || [];

      setFeaturedBrands(featuredSellers);

      // Fetch popular products
      await fetchPopularProducts();

      // Fetch flash sales
      await fetchFlashSales();

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const fetchPopularProducts = async () => {
    try {
      const { data: likedProducts, error: likedError } = await supabase
        .from('products')
        .select(`
          id,
          title,
          description,
          price,
          category,
          owner_id,
          created_at,
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          users (
            id,
            full_name,
            email,
            store_settings
          ),
          likes (
            id
          )
        `)
        .eq('is_active', true)
        .gt('quantity', 0)
        .limit(20);

      if (likedError) throw likedError;

      const processedLikedProducts = (likedProducts || [])
        .map(product => ({
          ...product,
          like_count: product.likes?.length || 0,
          average_rating: Math.random() * 2 + 3, // Mock rating
          users: {
            id: product.users?.[0]?.id || '',
            full_name: product.users?.[0]?.full_name || '',
            email: product.users?.[0]?.email || '',
            store_settings: product.users?.[0]?.store_settings || undefined
          }
        }))
        .sort((a, b) => b.like_count - a.like_count) as PopularProduct[];

      setMostLikedProducts(processedLikedProducts);
    } catch (error) {
      console.error('Error fetching popular products:', error);
    }
  };

  const fetchFlashSales = async () => {
    try {
      const flashSales = await getAllActiveFlashSales();
      // Transform the data to match FlashSale interface
      const transformedFlashSales = flashSales.map((sale: any) => ({
        id: sale.id,
        title: sale.title,
        description: sale.description,
        discount_percentage: sale.discount_percentage,
        start_time: sale.start_time,
        end_time: sale.end_time,
        store_id: sale.store_id,
        store_name: sale.store_name,
        created_by: sale.created_by || sale.store_id, // Fallback to store_id if created_by is not available
        products: sale.flash_sale_products?.map((fsp: any) => ({
          id: fsp.id,
          product_id: fsp.product_id,
          special_price: fsp.special_price,
          product: fsp.products
        })) || []
      })) as FlashSale[];
      setActiveFlashSales(transformedFlashSales);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
    }
  };

  const getAllFlashSaleProducts = () => {
    return activeFlashSales.flatMap(sale => sale.products) || [];
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail) return;

    setSubscriptionLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Thank you! We\'ll notify you when the app launches.');
      setNotifyEmail('');
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen">
      {/* Hero Section - Keep existing dark hero */}
      <section className="relative min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
        {/* Hero content here - keeping existing */}
        <div className="relative z-10 min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="relative z-10 text-center md:text-left mt-8 sm:mt-12 md:mt-0">
                <motion.h1
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  Discover Ethiopian Products & More
                </motion.h1>
                <motion.p
                  className="text-lg md:text-xl text-gray-300 mb-6 md:mb-8 max-w-xl mx-auto md:mx-0"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  Shop the latest in electronics, home goods, fashion, and more from Ethiopian sellers
                </motion.p>
                <motion.div 
                  className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <Link
                    href="/products"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 rounded-lg text-white font-medium hover:from-red-500 hover:to-pink-500 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                  >
                    Start Shopping
                  </Link>
                  {!user && (
                    <Link
                      href="/signup?role=owner"
                      className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                    >
                      Become a Seller
                    </Link>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area with Seamless Flow */}
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50">
        
        {/* Featured Collections */}
        <section className="py-20">
          <FeaturedCollections />
        </section>

        {/* Flash Sales Section */}
        {activeFlashSales.length > 0 && (
          <section className="py-20 bg-gradient-to-br from-amber-50 to-rose-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                  ⚡ Flash Sale
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Limited Time Deals</h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                  Don't miss out on these incredible offers. Limited quantities available!
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {getAllFlashSaleProducts().slice(0, 8).map((flashProduct, index) => (
                  <motion.div
                    key={flashProduct.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="group"
                  >
                    <Link href={`/products/${flashProduct.product.id}`}>
                      <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                        <div className="relative aspect-square">
                          <Image
                            src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                            alt={flashProduct.product.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          />
                          <div className="absolute top-4 left-4">
                            <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                              -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}% OFF
                            </span>
                          </div>
                          <div className="absolute top-4 right-4">
                            <CountdownTimer 
                              endTime={activeFlashSales[0]?.end_time || ''} 
                              className="text-xs bg-black/80 text-white px-2 py-1 rounded-full"
                            />
                          </div>
                        </div>
                        <div className="p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-amber-600 transition-colors">
                            {flashProduct.product.title}
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-amber-600">
                              ETB {flashProduct.special_price.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-500 line-through">
                              ETB {flashProduct.product.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Category Grid */}
        <section className="py-20">
          <CategoryGrid />
        </section>

        {/* Featured Brands */}
        <section className="py-20 bg-gradient-to-br from-slate-50 to-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Featured Brands</h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Discover amazing stores and trusted sellers on our platform
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {featuredBrands.slice(0, 8).map((brand, index) => (
                <motion.div
                  key={brand.seller_id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <Link href={`/stores/${brand.seller_id}`}>
                    <div className="bg-white rounded-2xl p-6 text-center shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                      <div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-4 border-amber-200 group-hover:border-amber-400 transition-colors">
                        {brand.store_settings.logo_url ? (
                          <Image
                            src={cleanImageUrl(brand.store_settings.logo_url)}
                            alt={brand.store_settings.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold">
                            {brand.store_settings.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                          {brand.store_settings.name}
                        </h3>
                        {brand.verification_status === 'verified' && (
                          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2">{brand.store_settings.description}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Products */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                🔥 Trending
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Hot Products</h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Discover the most popular and trending products that everyone is loving right now
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mostLikedProducts.slice(0, 8).map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <Link href={`/products/${product.id}`}>
                    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                      <div className="relative aspect-square">
                        {product.product_images && product.product_images[0] ? (
                          <Image
                            src={cleanImageUrl(product.product_images[0].image_url)}
                            alt={product.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <span className="bg-white/90 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full">
                            {product.category}
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                          {product.title}
                        </h3>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-2xl font-bold text-gray-900">
                            ETB {product.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg 
                                  key={star}
                                  className={`w-4 h-4 ${star <= (product.average_rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                                  fill="currentColor" 
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-sm text-gray-600">{product.average_rating?.toFixed(1) || '0.0'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                            </svg>
                            <span className="text-sm text-gray-600">{product.like_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <TestimonialsSection />

        {/* Mobile App Section */}
        <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                  📱 Coming Soon
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Shop On The Go
                </h2>
                <p className="text-xl text-gray-300 mb-8">
                  Our mobile app is coming soon! Get ready for a better shopping experience with exclusive features and seamless browsing.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <div className="flex items-center gap-3 px-6 py-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.5 1.32-.82 2.67-2.53 4.08M13 3.5c.73-.83 2.07-1.46 3.15-1.5.17 1.37-.37 2.74-1.08 3.69-.73.87-1.96 1.5-3.07 1.45-.18-1.33.35-2.69 1-3.64z"/>
                    </svg>
                    <div>
                      <div className="text-xs text-gray-400">Coming soon on</div>
                      <div className="font-semibold">App Store</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-6 py-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                    </svg>
                    <div>
                      <div className="text-xs text-gray-400">Coming soon on</div>
                      <div className="font-semibold">Google Play</div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-400 mb-4">
                    Be the first to know when our app launches!
                  </p>
                  <motion.form 
                    onSubmit={handleNotifySubmit}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500 text-white placeholder-gray-400"
                      disabled={subscriptionLoading}
                    />
                    <button
                      type="submit"
                      disabled={subscriptionLoading}
                      className="px-6 py-3 bg-gradient-to-r from-amber-600 to-yellow-500 text-white rounded-lg font-semibold hover:from-amber-700 hover:to-yellow-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
                    >
                      {subscriptionLoading ? 'Subscribing...' : 'Notify Me'}
                    </button>
                  </motion.form>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-amber-500 to-yellow-500 opacity-20 blur-3xl rounded-full"></div>
                <div className="relative bg-gray-800/50 rounded-3xl p-8 border border-gray-700/50">
                  <div className="w-64 h-[500px] mx-auto bg-gray-900 rounded-[3rem] border-8 border-gray-700 relative overflow-hidden">
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gray-600 rounded-full"></div>
                    <div className="p-6 pt-12">
                      <div className="bg-gradient-to-br from-amber-400 to-amber-600 h-12 rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-white font-bold">AVRIO</span>
                      </div>
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-700 rounded"></div>
                        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                        <div className="h-20 bg-gray-700 rounded"></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-16 bg-gray-700 rounded"></div>
                          <div className="h-16 bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-600 rounded-full"></div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <NewsletterSection />

      </div>

      {/* Footer - Keep existing dark footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">AVRIO</h3>
            <p className="text-gray-400">Your premier destination for Ethiopian fashion and lifestyle products.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}