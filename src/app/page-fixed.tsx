'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatETB } from '@/utils/currency';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { getActiveFlashSale, getFlashSalePrices, getAllActiveFlashSales } from '@/utils/flashSales';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { cleanImageUrl } from '@/utils/url';
import { useAuth } from '@/contexts/AuthContext';
import { PRODUCT_CATEGORIES } from '@/utils/constants';
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
  is_model_picture: boolean;
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
    product_images: Array<{
      id: string;
      image_url: string;
    }>;
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
  created_by?: string;
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
  const [showMobilePopup, setShowMobilePopup] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowMobilePopup(true);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        fetchFeaturedBrands(),
        fetchPopularProducts(),
        fetchFlashSales()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedBrands = async () => {
    try {
      const { data: brands, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          store_settings,
          verification_status
        `)
        .eq('verification_status', 'verified')
        .limit(8);

      if (error) throw error;

      const processedBrands = brands?.map(brand => ({
        seller_id: brand.id,
        seller_name: brand.full_name,
        verification_status: brand.verification_status,
        store_settings: brand.store_settings || { name: brand.full_name, logo_url: '', description: '' },
        top_product: {
          id: '',
          title: 'Featured Product',
          price: 0,
          images: [],
          like_count: 0
        }
      })) || [];

      setFeaturedBrands(processedBrands);
    } catch (error) {
      console.error('Error fetching featured brands:', error);
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
          users: Array.isArray(product.users) ? product.users[0] : product.users,
          like_count: product.likes?.length || 0,
          average_rating: Math.random() * 2 + 3, // Mock rating
          product_images: product.product_images?.map(img => ({
            ...img,
            is_model_picture: img.is_model_picture || false
          })) || []
        }))
        .sort((a, b) => b.like_count - a.like_count);

      console.log('Processed liked products:', processedLikedProducts.slice(0, 2)); // Debug log
      setMostLikedProducts(processedLikedProducts);
    } catch (error) {
      console.error('Error fetching popular products:', error);
    }
  };

  const fetchFlashSales = async () => {
    try {
      const flashSales = await getAllActiveFlashSales();
      // Map the flash sales to match our interface
      const mappedFlashSales = flashSales.map((sale: any) => ({
        ...sale,
        products: sale.flash_sale_products?.map((fsp: any) => ({
          id: fsp.id,
          product_id: fsp.product_id,
          special_price: fsp.special_price,
          product: {
            ...(Array.isArray(fsp.products) ? fsp.products[0] : fsp.products),
            product_images: (Array.isArray(fsp.products) ? fsp.products[0] : fsp.products)?.product_images?.map((img: any) => ({
              ...img,
              is_model_picture: img.is_model_picture || false
            })) || []
          }
        })) || []
      }));
      console.log('Mapped flash sales:', mappedFlashSales.slice(0, 1)); // Debug log
      setActiveFlashSales(mappedFlashSales);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
    }
  };

  const getAllFlashSaleProducts = () => {
    return activeFlashSales.flatMap(sale => sale.products) || [];
  };

  const handleSubscribe = async (email: string, type: 'notify_me' | 'newsletter') => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setSubscriptionLoading(true);
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Subscription failed');
      }

      toast.success(data.message);
      if (type === 'notify_me') {
        setNotifyEmail('');
      } else {
        setNewsletterEmail('');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionLoading) return;
    await handleSubscribe(notifyEmail, 'notify_me');
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionLoading) return;
    await handleSubscribe(newsletterEmail, 'newsletter');
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

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
      <div className="min-h-screen relative bg-gray-900 overflow-hidden w-full">

        {/* Hero Section */}
        <section className="relative min-h-[calc(100vh-4rem)] flex items-center text-white pt-16 sm:pt-20 md:pt-0">
          <div className="relative w-full py-8 md:py-16">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Text Content */}
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
                      <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                    {!user && (
                      <Link
                        href="/signup?role=owner"
                        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                      >
                        Become a Seller
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </Link>
                    )}
                  </motion.div>
                </div>

                {/* Image Grid */}
                <div className="relative mt-8 md:mt-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                    {[
                      { src: '/images/categories/electronics.jpg', alt: 'Electronics', delay: 0.2 },
                      { src: '/images/categories/modern.jpg', alt: 'Modern Fashion', delay: 0.4 },
                      { src: '/images/categories/accessories.jpg', alt: 'Accessories', delay: 0.6 },
                      { src: '/images/categories/beauty.jpg', alt: 'Beauty', delay: 0.8 }
                    ].map((image, index) => (
                      <motion.div
                        key={image.alt}
                        className={`relative ${
                          index % 2 === 1 ? 'mt-4 sm:mt-8 md:mt-12' : index === 2 ? '-mt-4 sm:-mt-8 md:-mt-12' : ''
                        }`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: image.delay }}
                        whileHover={{ scale: 1.05 }}
                      >
                        <div className="relative w-full pt-[100%]">
                          <img
                            src={image.src}
                            alt={image.alt}
                            className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg"
                            loading={index === 0 ? "eager" : "lazy"}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Area with Seamless Flow */}
        <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50">
          
          {/* Featured Collections */}
          <FeaturedCollections />

          {/* Flash Sales Section */}
          {activeFlashSales.length > 0 && (
            <section className="py-20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="text-center mb-12"
                >
                  <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">⚡ Flash Sales</h2>
                  <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    Limited time offers on amazing products - grab them while they last!
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
                            {flashProduct.product.product_images && flashProduct.product.product_images[0] ? (
                              <img
                                src={cleanImageUrl(flashProduct.product.product_images[0].image_url)}
                                alt={flashProduct.product.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                onError={(e) => {
                                  console.error('Flash sale image failed to load:', flashProduct.product.product_images[0].image_url);
                                  const target = e.target as HTMLImageElement;
                                  target.src = PLACEHOLDER_IMAGE;
                                }}
                                onLoad={() => {
                                  console.log('Flash sale image loaded successfully:', flashProduct.product.product_images[0].image_url);
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div className="absolute top-4 left-4">
                              <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                                -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}% OFF
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                              {flashProduct.product.title}
                            </h3>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-red-600">
                                  {formatETB(flashProduct.special_price)}
                                </span>
                                <span className="text-sm text-gray-500 line-through">
                                  {formatETB(flashProduct.product.price)}
                                </span>
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
          )}

          {/* Category Grid */}
          <CategoryGrid />

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
                            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                          {brand.store_settings.description || 'Verified seller on our platform'}
                        </p>
                        <div className="flex justify-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            ⭐ Top Seller
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Trending Products */}
          <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">🔥 Trending Products</h2>
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
                  >
                    <ProductCard 
                      product={{
                        ...product,
                        users: product.users
                      }} 
                      showOwner={false}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Testimonials */}
          <TestimonialsSection />

          {/* Mobile App Coming Soon */}
          <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-sm font-semibold px-4 py-2 rounded-full mb-6">
                    📱 Coming Soon
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold mb-6">
                    Our mobile app is coming soon!
                  </h2>
                  <p className="text-xl text-gray-300 mb-8">
                    Get ready for a better shopping experience with our upcoming mobile app. Shop anytime, anywhere with enhanced features.
                  </p>
                  
                  {/* App Store Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <div className="flex items-center px-6 py-3 bg-gray-800 rounded-lg cursor-not-allowed opacity-75">
                      <svg className="w-8 h-8 mr-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.5 1.32-.82 2.67-2.53 4.08M13 3.5c.73-.83 2.07-1.46 3.15-1.5.17 1.37-.37 2.74-1.08 3.69-.73.87-1.96 1.5-3.07 1.45-.18-1.33.35-2.69 1-3.64z"/>
                      </svg>
                      <div>
                        <div className="text-xs text-gray-400">Coming soon on</div>
                        <div className="text-sm font-semibold">App Store</div>
                      </div>
                    </div>
                    <div className="flex items-center px-6 py-3 bg-gray-800 rounded-lg cursor-not-allowed opacity-75">
                      <svg className="w-8 h-8 mr-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                      </svg>
                      <div>
                        <div className="text-xs text-gray-400">Coming soon on</div>
                        <div className="text-sm font-semibold">Google Play</div>
                      </div>
                    </div>
                  </div>

                  {/* Notify Me Form */}
                  <div>
                    <p className="text-sm text-gray-400 mb-4">
                      Be the first to know when our app launches!
                    </p>
                    <form onSubmit={handleNotifySubmit} className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={notifyEmail}
                        onChange={(e) => setNotifyEmail(e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-500 text-white placeholder-gray-400"
                        disabled={subscriptionLoading}
                        required
                      />
                      <button
                        type="submit"
                        disabled={subscriptionLoading}
                        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-400 hover:to-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {subscriptionLoading ? 'Subscribing...' : 'Notify Me'}
                      </button>
                    </form>
                  </div>
                </motion.div>

                {/* Phone Mockup */}
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="relative"
                >
                  <div className="relative mx-auto w-64 h-96 bg-gray-800 rounded-3xl p-2 shadow-2xl">
                    <div className="w-full h-full bg-gray-900 rounded-2xl overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-6xl mb-4">📱</div>
                          <div className="text-white text-lg font-semibold mb-2">AVRIO</div>
                          <div className="text-gray-400 text-sm">Coming Soon</div>
                        </div>
                      </div>
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl"></div>
                    </div>
                  </div>
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500/20 rounded-full animate-ping"></div>
                  <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-amber-400/30 rounded-full animate-pulse"></div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Newsletter */}
          <NewsletterSection />

        </div>

        {/* Footer Section */}
        <footer className="relative py-12 w-full border-t border-gray-800">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8 px-4 sm:px-6 lg:px-8">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">AVRIO</h3>
                <p className="text-gray-400 text-sm">
                  Your premier destination for Ethiopian fashion and lifestyle products.
                </p>
                <div className="flex space-x-4">
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Links</h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/products" className="text-gray-400 hover:text-white transition-colors">
                      Shop
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog" className="text-gray-400 hover:text-white transition-colors">
                      Blog
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Categories */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Categories</h3>
                <ul className="space-y-2">
                  {PRODUCT_CATEGORIES
                    .filter(category => 
                      ['Traditional Wear', 'Modern Fashion', 'Home & Living', 'Beauty & Personal Care']
                      .includes(category)
                    )
                    .map((category: string) => (
                      <li key={category}>
                        <Link 
                          href={`/products?category=${category.toLowerCase()}`}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {category}
                        </Link>
                      </li>
                    ))}
                  <li>
                    <Link 
                      href="/products"
                      className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      View All Categories
                      <svg 
                        className="w-4 h-4" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M9 5l7 7-7 7" 
                        />
                      </svg>
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact Us</h3>
                <ul className="space-y-2">
                  <li className="text-gray-400">
                    <span className="block">Addis Ababa, Ethiopia</span>
                  </li>
                  <li>
                    <a href="tel:+251912841237" className="text-gray-400 hover:text-white transition-colors">
                      +251 91 284 1237
                    </a>
                  </li>
                  <li>
                    <a href={`mailto:${EMAIL_CONFIG.SUPPORT}`} className="text-gray-400 hover:text-white transition-colors">
                      {EMAIL_CONFIG.SUPPORT}
                    </a>
                  </li>
                </ul>
              </div>

              {/* Security */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Security</h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/security-policy" className="text-gray-400 hover:text-white transition-colors">
                      Security Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/careers" className="text-gray-400 hover:text-white transition-colors">
                      Careers
                    </Link>
                  </li>
                  <li>
                    <Link href="/support" className="text-gray-400 hover:text-white transition-colors">
                      Support
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-12 pt-8 border-t border-gray-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
                <p className="text-gray-400 text-sm">
                  © {new Date().getFullYear()} AVRIO. All rights reserved.
                </p>
                <div className="flex space-x-6 mt-4 md:mt-0">
                  <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Terms of Service
                  </Link>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-red-500/5 rounded-full filter blur-3xl"></div>
              <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-500/5 rounded-full filter blur-3xl"></div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}