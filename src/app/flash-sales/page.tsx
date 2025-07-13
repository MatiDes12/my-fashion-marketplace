'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import CountdownTimer from '@/components/CountdownTimer';
import { motion } from 'framer-motion';
import { cleanImageUrl } from '@/utils/url';

interface FlashSale {
  id: string;
  title: string;
  description: string | null;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  store_id: string | null;
  store_name: string | null;
  created_by: string | null;
  products: FlashSaleProduct[];
  free_shipping: boolean | null;
  min_order_amount: number | null;
  is_active: boolean;
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
      id?: string;
      store_settings?: {
        name?: string;
      };
    };
  };
}

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ELoading...%3C/text%3E%3C/svg%3E';

export default function FlashSalesPage() {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchFlashSales();
  }, []);

  const fetchFlashSales = async () => {
    try {
      const now = new Date().toISOString();
      
      const { data: flashSalesData, error } = await supabase
        .from('flash_sales')
        .select(`
          *,
          products:flash_sale_products (
            id,
            product_id,
            special_price,
            product:products (
              id,
              title,
              description,
              price,
              product_images (
                id,
                image_url
              ),
              owner:users (
                id,
                store_settings
              )
            )
          )
        `)
        .eq('is_active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .order('end_time', { ascending: true });

      if (error) throw error;

      const validFlashSales = (flashSalesData || [])
        .filter(sale => sale.products && sale.products.length > 0) as FlashSale[];

      setFlashSales(validFlashSales);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading amazing deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-pink-600 to-red-700 py-20">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse"></div>
            <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute bottom-10 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-2000"></div>
          </div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              ⚡ Flash Sales
            </h1>
            <p className="text-xl md:text-2xl text-red-100 mb-8 max-w-3xl mx-auto">
              Don't miss out on these incredible deals! Limited time offers with massive discounts.
            </p>
            <div className="flex items-center justify-center gap-4 text-white/90">
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Limited Time</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium">Huge Savings</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {flashSales.map((flashSale, index) => (
            <motion.div
              key={flashSale.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-500">
                {/* Flash Sale Header */}
                <div className="relative bg-gradient-to-r from-red-600 via-pink-600 to-red-700 p-8 text-white overflow-hidden">
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                  
                  <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold animate-pulse">
                          🔥 ACTIVE SALE
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold">
                          {flashSale.discount_percentage}% OFF
                        </div>
                      </div>
                      
                      <h2 className="text-3xl md:text-4xl font-bold mb-3">{flashSale.title}</h2>
                      {flashSale.description && (
                        <p className="text-red-100 text-lg mb-6 max-w-2xl">{flashSale.description}</p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-4 mb-6">
                        {flashSale.free_shipping && (
                          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            Free Shipping
                          </span>
                        )}
                        {flashSale.min_order_amount && (
                          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                            Min. Order: ETB {flashSale.min_order_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Ends in:</span>
                          <CountdownTimer 
                            endTime={flashSale.end_time}
                            className="font-mono text-white font-bold"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {flashSale.store_name && (
                      <div className="lg:text-right">
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                          <span className="text-sm text-red-100 block mb-1">Presented by</span>
                          <h3 className="text-xl font-bold">{flashSale.store_name}</h3>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Products Grid */}
                <div className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-6">
                    {flashSale.products?.map((flashProduct, productIndex) => (
                      <motion.div
                        key={flashProduct.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: productIndex * 0.1 }}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className="group/product"
                      >
                        <Link
                          href={`/products/${flashProduct.product.id}`}
                          className="block relative bg-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-gray-100"
                        >
                          <div className="absolute top-3 left-3 z-10 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
                            -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}%
                          </div>
                          
                          <div className="aspect-w-1 aspect-h-1 relative bg-gray-100 overflow-hidden">
                            <Image
                              src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                              alt={flashProduct.product.title}
                              fill
                              className="object-cover transform group-hover/product:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/product:opacity-100 transition-opacity"></div>
                          </div>

                          <div className="p-5">
                            <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover/product:text-red-600 transition-colors mb-3">
                              {flashProduct.product.title}
                            </h3>
                            <div className="flex items-baseline gap-3 mb-3">
                              <span className="text-2xl font-bold text-red-600">
                                ETB {flashProduct.special_price.toLocaleString()}
                              </span>
                              <span className="text-lg text-gray-400 line-through">
                                ETB {flashProduct.product.price.toLocaleString()}
                              </span>
                            </div>
                            {flashProduct.product.owner?.store_settings?.name && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {flashProduct.product.owner.store_settings.name}
                              </div>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  <div className="hidden lg:grid lg:grid-cols-4 gap-6">
                    {flashSale.products?.map((flashProduct, productIndex) => (
                      <motion.div
                        key={flashProduct.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: productIndex * 0.1 }}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className="group/product"
                      >
                        <Link
                          href={`/products/${flashProduct.product.id}`}
                          className="block relative bg-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-gray-100"
                        >
                          <div className="absolute top-3 left-3 z-10 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
                            -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}%
                          </div>
                          
                          <div className="aspect-w-1 aspect-h-1 relative bg-gray-100 overflow-hidden">
                            <Image
                              src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                              alt={flashProduct.product.title}
                              fill
                              className="object-cover transform group-hover/product:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/product:opacity-100 transition-opacity"></div>
                          </div>

                          <div className="p-5">
                            <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover/product:text-red-600 transition-colors mb-3">
                              {flashProduct.product.title}
                            </h3>
                            <div className="flex items-baseline gap-3 mb-3">
                              <span className="text-2xl font-bold text-red-600">
                                ETB {flashProduct.special_price.toLocaleString()}
                              </span>
                              <span className="text-lg text-gray-400 line-through">
                                ETB {flashProduct.product.price.toLocaleString()}
                              </span>
                            </div>
                            {flashProduct.product.owner?.store_settings?.name && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {flashProduct.product.owner.store_settings.name}
                              </div>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {flashSales.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="bg-white rounded-2xl shadow-lg p-12 max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">No Active Flash Sales</h3>
                <p className="text-gray-600 mb-8">Don't worry! New amazing deals are coming soon. Check back regularly for the latest offers.</p>
                <Link 
                  href="/products" 
                  className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Browse All Products
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 