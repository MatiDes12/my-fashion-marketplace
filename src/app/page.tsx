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

// Update the interface for featured sellers
interface FeaturedSeller {
  seller_id: string;
  seller_name: string;
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

// Update the PopularProduct interface
interface PopularProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  owner_id: string;
  created_at: string;
  product_images: Array<{
    id: string;
    image_url: string;
    is_model_picture: boolean;
  }>;
  likes: Array<{ id: string }>;
  like_count: number;
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
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();
  const router = useRouter();
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);

  const subscriptionTiers = [
    {
      name: 'Basic',
      price: formatETB(500),
      period: 'month',
      description: 'Perfect for small Ethiopian boutiques',
      features: [
        'List up to 20 products',
        'Basic Amharic & English AI descriptions',
        'Basic analytics',
        'WhatsApp support',
        'Telebirr integration'
      ],
      cta: 'Start Selling',
      highlighted: false
    },
    {
      name: 'Pro',
      price: formatETB(1500),
      period: 'month',
      description: 'For growing Ethiopian businesses',
      features: [
        'List up to 100 products',
        'Advanced Amharic & English AI descriptions',
        'AI-powered pricing suggestions',
        'Priority support',
        'Custom storefront',
        'Advanced analytics',
        'CBE & Telebirr integration',
        'SMS notifications'
      ],
      cta: 'Go Pro',
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: formatETB(5000),
      period: 'month',
      description: 'For large Ethiopian retailers',
      features: [
        'Unlimited products',
        'Full AI suite with Amharic support',
        'Dedicated account manager',
        'API access',
        'Custom integrations',
        'Advanced fraud protection',
        'All payment methods',
        'Multi-store management'
      ],
      cta: 'Contact Sales',
      highlighted: false
    }
  ];

  const ethiopianCategories = [
    {
      name: 'Traditional Wear',
      description: 'Habesha Kemis, Tilfi, and more',
      image: '/traditional.jpg'
    },
    {
      name: 'Modern Fashion',
      description: 'Contemporary Ethiopian designs',
      image: '/modern.jpg'
    },
    {
      name: 'Accessories',
      description: 'Ethiopian jewelry and accessories',
      image: '/accessories.jpg'
    }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch featured sellers (owners with store settings)
      const { data: sellersData, error: sellersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          store_settings,
          products!inner (
            id,
            title,
            price,
            product_images (
              id,
              image_url
            ),
            likes:likes(count)
          )
        `)
        .eq('role', 'owner')
        .not('store_settings', 'is', null)
        .order('created_at', { ascending: false })
        .limit(4);

      if (sellersError) throw sellersError;

      // Process sellers data
      const featuredSellers = sellersData?.map(seller => ({
        seller_id: seller.id,
        seller_name: seller.full_name,
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

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularProducts = async () => {
    try {
      // First get products with their like counts
      const { data: productsData, error } = await supabase
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
          likes (
            id
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      // Get flash sale prices for all products
      const productIds = productsData?.map(item => item.id) || [];
      const flashSalePrices = await getFlashSalePrices(productIds);

      // Process products to include like count and flash sale prices
      const processedProducts = productsData?.map(product => ({
        ...product,
        like_count: product.likes?.length || 0,
        flash_sale_price: flashSalePrices[product.id]
      })) || [];

      // Sort by like count
      const sortedProducts = processedProducts.sort((a, b) => b.like_count - a.like_count);

      setPopularProducts(sortedProducts);
    } catch (err) {
      console.error('Error fetching popular products:', err);
      setError('Failed to load popular products');
    }
  };

  useEffect(() => {
    const fetchFlashSales = async () => {
      try {
        const { data: salesData, error } = await supabase
          .from('flash_sales')
          .select(`
            *,
            products:flash_sale_products(
              id,
              product_id,
              special_price,
              product:products(
                id,
                title,
                price,
                description,
                product_images(id, image_url),
                owner:users(store_settings)
              )
            )
          `)
          .eq('is_active', true)
          .gte('end_time', new Date().toISOString())
          .lte('start_time', new Date().toISOString());

        if (error) throw error;

        if (salesData) {
          const processedSales: FlashSale[] = salesData.map(sale => ({
            id: sale.id,
            title: sale.title,
            description: sale.description,
            discount_percentage: sale.discount_percentage,
            start_time: sale.start_time,
            end_time: sale.end_time,
            store_id: sale.store_id,
            store_name: sale.store_name,
            created_by: sale.created_by,
            products: sale.products
          }));
          
          setActiveFlashSales(processedSales);
        }
      } catch (error) {
        console.error('Error fetching flash sales:', error);
      }
    };

    fetchFlashSales();
  }, []);

  // Update the renderFeaturedSellers function
  const renderFeaturedSellers = () => {
    if (loading) {
      return <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse flex flex-col items-center">
            <div className="bg-gray-200 h-40 w-40 rounded-full mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
      </div>;
    }

      return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {featuredBrands.map((seller) => (
          <Link 
            key={seller.seller_id}
            href={`/stores/${seller.seller_id}`}
            className="group flex flex-col items-center"
          >
            {/* Large circular store logo/image */}
            <div className="relative w-40 h-40 rounded-full overflow-hidden mb-6 
                          border-4 border-white shadow-xl transform transition-transform 
                          duration-300 group-hover:scale-105">
                  <Image
                src={seller.store_settings.logo_url || seller.top_product.images[0]?.image_url || '/placeholder.png'}
                    alt={seller.store_settings.name}
                    fill
                    className="object-cover"
                  />
              </div>

            {/* Store info with hover effect */}
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2 
                           group-hover:text-indigo-600 transition-colors">
                {seller.store_settings.name}
                </h3>
                
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {seller.store_settings.description}
                  </p>

              {/* Stats/Badges */}
              <div className="flex items-center justify-center space-x-4 text-sm">
                <div className="flex items-center text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  4.8
                      </div>
                <div className="flex items-center text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                          </svg>
                  {seller.top_product ? `${seller.top_product.like_count} likes` : 'New Seller'}
                        </div>
                      </div>

              {/* View Store Button */}
              <button className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 
                             bg-indigo-50 rounded-full opacity-0 group-hover:opacity-100 
                             transition-opacity duration-300 hover:bg-indigo-100">
                View Store →
              </button>
              </div>
            </Link>
        ))}
      </div>
    );
  };

  // Update the renderPopularProducts function
  const renderPopularProducts = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;
    if (!popularProducts.length) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found</p>
        </div>
      );
    }

      return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {popularProducts.map((product) => (
          <ProductCard key={product.id} product={product} showOwner />
        ))}
        </div>
      );
  };

  // Update the renderFlashSales function
  const renderFlashSales = () => {
    if (!activeFlashSales.length) return null;

    return (
      <section className="py-6 bg-gradient-to-b from-red-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">⚡ Flash Deals</h2>
            <Link
              href="/flash-sales"
              className="text-sm text-red-600 hover:text-red-700"
            >
              View All
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeFlashSales.map((sale) => (
              <div key={sale.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Sale Header */}
                <div className="bg-red-600 text-white p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold">{sale.title}</h3>
                      <p className="text-red-100 text-sm mt-1">
                        {sale.store_name || 'Flash Sale'}
                      </p>
                    </div>
                    <CountdownTimer endTime={sale.end_time} />
                  </div>
                </div>

                {/* Products Grid */}
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {sale.products.slice(0, 4).map((flashProduct) => (
                      <div key={flashProduct.id} className="group relative">
                        <Link
                          href={`/products/${flashProduct.product.id}`}
                          className="block"
                        >
                          <div className="relative w-[150px] h-[150px] mx-auto overflow-hidden rounded-lg mb-2">
                            {flashProduct.product.product_images?.[0]?.image_url ? (
                              <Image
                                src={cleanImageUrl(flashProduct.product.product_images[0].image_url)}
                                alt={flashProduct.product.title}
                                width={150}
                                height={150}
                                className="object-cover object-center transform group-hover:scale-105 transition-transform duration-200"
                                style={{ width: '150px', height: '150px' }}
                              />
                            ) : (
                              <div className="w-[150px] h-[150px] bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-400">No image</span>
                              </div>
                            )}
                            <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                              {sale.discount_percentage}% OFF
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {flashProduct.product.title}
                            </h4>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-lg font-bold text-red-600">
                                ETB {flashProduct.special_price}
                              </span>
                              <span className="text-sm text-gray-400 line-through">
                                ETB {flashProduct.product.price}
                              </span>
                            </div>
                          </div>
                        </Link>
                        {/* Buy Now Button */}
                        <Link
                          href={`/products/${flashProduct.product.id}?action=buy`}
                          className="mt-2 block w-full text-center py-2 px-4 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors duration-200"
                        >
                          Buy Now
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                {/* View More Footer */}
                <div className="border-t border-gray-100 p-4">
                  <Link
                    href={`/flash-sales/${sale.id}`}
                    className="block text-center text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    View All Products →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section - Modern Design */}
      <div className="relative bg-gradient-to-r from-gray-900 to-gray-800 overflow-hidden">
        <div className="absolute inset-0 bg-pattern opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
                <motion.h1 
                className="text-4xl md:text-6xl font-bold text-white"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                Your One-Stop
                <span className="block text-red-500">Global Marketplace</span>
                </motion.h1>
                <motion.p 
                className="mt-6 text-xl text-gray-300"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                >
                Shop millions of products with amazing deals and worldwide shipping. Find everything you need, all in one place.
                </motion.p>
                  <motion.div
                className="mt-8 flex flex-wrap gap-4 justify-center lg:justify-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                  >
                    <Link
                      href="/products"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl text-base sm:text-lg"
                >
                  <span className="flex items-center">
                    <svg 
                      className="w-5 h-5 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" 
                      />
                    </svg>
                    Start Shopping
                  </span>
                </Link>
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-gray-900 rounded-full font-medium hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border-2 border-transparent hover:border-red-600 text-base sm:text-lg"
                >
                  <span className="flex items-center">
                    <svg 
                      className="w-5 h-5 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                      />
                    </svg>
                    Become a Seller
                  </span>
                    </Link>
                  </motion.div>
                </div>
            <div className="relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-2 gap-4"
              >
                {/* Featured Product Images */}
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform">
                    <Image
                      src="/images/products/electronics.jpg"
                      alt="Electronics"
                      width={300}
                      height={400}
                      className="object-cover"
                    />
              </div>
                  <div className="rounded-2xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform">
                    <Image
                      src="/images/products/fashion.jpg"
                      alt="Fashion"
                      width={300}
                      height={400}
                      className="object-cover"
                    />
          </div>
        </div>
                <div className="space-y-4 mt-8">
                  <div className="rounded-2xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform">
          <Image
                      src="/images/products/home.jpg"
                      alt="Home"
                      width={300}
                      height={400}
                      className="object-cover"
                    />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform">
                    <Image
                      src="/images/products/beauty.jpg"
                      alt="Beauty"
                      width={300}
                      height={400}
                      className="object-cover"
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Flash Sales Section */}
      {renderFlashSales()}

      {/* Categories Showcase */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Shop By Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {[
              { name: 'Electronics', icon: '📱', color: 'bg-blue-500' },
              { name: 'Fashion', icon: '👕', color: 'bg-pink-500' },
              { name: 'Home & Living', icon: '🏠', color: 'bg-green-500' },
              { name: 'Beauty & Health', icon: '💄', color: 'bg-purple-500' },
              { name: 'Sports', icon: '⚽', color: 'bg-orange-500' },
              { name: 'Toys & Games', icon: '🎮', color: 'bg-yellow-500' },
              { name: 'Books', icon: '📚', color: 'bg-indigo-500' },
              { name: 'Automotive', icon: '🚗', color: 'bg-red-500' },
            ].map((category) => (
              <Link
                key={category.name}
                href={`/products?category=${encodeURIComponent(category.name)}`}
                className="group relative rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className={`aspect-square ${category.color} bg-opacity-10 flex flex-col items-center justify-center p-6 group-hover:bg-opacity-20 transition-all`}>
                  <span className="text-4xl mb-4">{category.icon}</span>
                  <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* Featured Sellers */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Featured Sellers
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Discover Ethiopia's top fashion brands and their most popular designs
          </p>
          
          {renderFeaturedSellers()}

          <div className="text-center mt-12">
            <Link
              href="/stores"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
            >
              View All Stores
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Products */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Popular Products
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Discover our most loved Ethiopian fashion pieces
          </p>
          
          {renderPopularProducts()}

          <div className="text-center mt-12">
            <Link
              href="/products"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
            >
              View All Products
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>


    {/* Why Choose Us Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Why Choose AVRIO?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Best Prices</h3>
              <p className="text-gray-600">Unbeatable deals and discounts on millions of products</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Quality Guaranteed</h3>
              <p className="text-gray-600">All products are verified and quality checked</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Global Shipping</h3>
              <p className="text-gray-600">Fast and reliable worldwide delivery</p>
          </div>
          </div>
        </div>
      </section>

      {/* Download App Section */}
      <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Shop On The Go</h2>
              <p className="text-xl text-gray-300 mb-8">
                Download our mobile app for a better shopping experience
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100">
                  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.5 1.32-.82 2.67-2.53 4.08M13 3.5c.73-.83 2.07-1.46 3.15-1.5.17 1.37-.37 2.74-1.08 3.69-.73.87-1.96 1.5-3.07 1.45-.18-1.33.35-2.69 1-3.64z"/>
                  </svg>
                  App Store
                </button>
                <button className="flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100">
                  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                  Google Play
                </button>
          </div>
              </div>
            <div className="relative h-96">
                <Image
                src="/images/app-preview.png"
                alt="Mobile app preview"
                fill
                className="object-contain"
                />
              </div>
          </div>
        </div>
      </section>


      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Choose Your Plan
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Start selling with the perfect plan for your business
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {subscriptionTiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-lg overflow-hidden ${
                  tier.highlighted
                    ? 'ring-2 ring-indigo-600 transform scale-105'
                    : 'transform hover:scale-105'
                } transition-all duration-200 bg-white shadow-xl`}
              >
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                  <p className="mt-4 text-gray-600">{tier.description}</p>
                  <p className="mt-8">
                    <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                    <span className="text-gray-600">/{tier.period}</span>
                  </p>

                  <ul className="mt-8 space-y-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center">
                        <svg
                          className="h-5 w-5 text-indigo-500"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="ml-3 text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <Link
                      href="/signup"
                      className={`block w-full py-3 px-6 text-center rounded-md ${
                        tier.highlighted
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-800 text-white hover:bg-gray-900'
                      } font-medium transition-colors`}
                    >
                      {tier.cta}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

            {/* Features Section */}
            <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mx-auto h-12 w-12 text-indigo-600">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
          </div>
              <h3 className="mt-6 text-lg font-medium text-gray-900">Authentic & Handcrafted</h3>
              <p className="mt-2 text-base text-gray-500">Each piece is handmade by skilled Ethiopian artisans</p>
            </motion.div>

            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="mx-auto h-12 w-12 text-indigo-600">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-6 text-lg font-medium text-gray-900">Fair Pricing</h3>
              <p className="mt-2 text-base text-gray-500">Support local communities while getting exceptional value</p>
            </motion.div>

            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="mx-auto h-12 w-12 text-indigo-600">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="mt-6 text-lg font-medium text-gray-900">Worldwide Shipping</h3>
              <p className="mt-2 text-base text-gray-500">We deliver Ethiopian fashion globally</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer with Ethiopian context */}
      <footer className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link href="/about" className="text-base text-gray-500 hover:text-gray-900">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-base text-gray-500 hover:text-gray-900">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Legal</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link href="/privacy" className="text-base text-gray-500 hover:text-gray-900">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-base text-gray-500 hover:text-gray-900">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-8">
            <p className="text-base text-gray-400 text-center">
              © 2024 Fashion Marketplace. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
