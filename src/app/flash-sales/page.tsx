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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Flash Sales</h1>
          <p className="text-lg text-gray-600">Don't miss out on these amazing deals!</p>
        </div>

        <div className="space-y-8">
          {flashSales.map((flashSale) => (
            <div 
              key={flashSale.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
              {/* Flash Sale Header */}
              <div className="bg-gradient-to-r from-red-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{flashSale.title}</h2>
                    <p className="text-red-100 mt-1">{flashSale.description}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                        Up to {flashSale.discount_percentage}% OFF
                      </span>
                      {flashSale.free_shipping && (
                        <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                          Free Shipping
                        </span>
                      )}
                      {flashSale.min_order_amount && (
                        <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                          Min. Order: ETB {flashSale.min_order_amount.toLocaleString()}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-red-100">Ends in:</span>
                        <CountdownTimer 
                          endTime={flashSale.end_time}
                          className="font-mono text-white"
                        />
                      </div>
                    </div>
                  </div>
                  {flashSale.store_name && (
                    <div className="hidden md:block text-right">
                      <span className="text-sm text-red-100">By</span>
                      <h3 className="text-lg font-semibold">{flashSale.store_name}</h3>
                    </div>
                  )}
                </div>
              </div>

              {/* Products Grid */}
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-6">
                  {flashSale.products?.map((flashProduct) => (
                    <motion.div
                      key={flashProduct.id}
                      whileHover={{ y: -5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Link
                        href={`/products/${flashProduct.product.id}`}
                        className="block relative bg-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg border border-gray-100"
                      >
                        <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}%
                        </div>
                        
                        <div className="aspect-w-1 aspect-h-1 relative bg-gray-100">
                          <Image
                            src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                            alt={flashProduct.product.title}
                            fill
                            className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>

                        <div className="p-4">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-red-600">
                            {flashProduct.product.title}
                          </h3>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-lg font-bold text-red-600">
                              ETB {flashProduct.special_price.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-500 line-through">
                              ETB {flashProduct.product.price.toLocaleString()}
                            </span>
                          </div>
                          {flashProduct.product.owner?.store_settings?.name && (
                            <p className="mt-1 text-xs text-gray-500">
                              {flashProduct.product.owner.store_settings.name}
                            </p>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                <div className="hidden lg:grid lg:grid-cols-4 gap-6">
                  {flashSale.products?.map((flashProduct) => (
                    <motion.div
                      key={flashProduct.id}
                      whileHover={{ y: -5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Link
                        href={`/products/${flashProduct.product.id}`}
                        className="block relative overflow-hidden transition-all duration-300 hover:shadow-lg"
                      >
                        <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}%
                        </div>
                        
                        <div className="aspect-w-1 aspect-h-1 relative bg-gray-100">
                          <Image
                            src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                            alt={flashProduct.product.title}
                            fill
                            className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>

                        <div className="p-4">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-red-600">
                            {flashProduct.product.title}
                          </h3>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-lg font-bold text-red-600">
                              ETB {flashProduct.special_price.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-500 line-through">
                              ETB {flashProduct.product.price.toLocaleString()}
                            </span>
                          </div>
                          {flashProduct.product.owner?.store_settings?.name && (
                            <p className="mt-1 text-xs text-gray-500">
                              {flashProduct.product.owner.store_settings.name}
                            </p>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {flashSales.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900">No active flash sales at the moment</h3>
              <p className="mt-2 text-gray-500">Check back later for new deals!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 