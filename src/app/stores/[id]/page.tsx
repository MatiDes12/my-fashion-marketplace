'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { motion } from 'framer-motion';
import { getFlashSalePrices } from '@/utils/flashSales';

// Add interfaces for store settings
interface PaymentMethods {
  cash: boolean;
  [key: string]: boolean;
}

interface DeliveryOptions {
  pickup: boolean;
  [key: string]: boolean;
}

interface StoreSettings {
  name: string;
  description: string;
  logo_url: string;
  banner_url: string;
  email: string;
  phone: string;
  address: string;
  payment_methods: PaymentMethods;
  delivery_options: DeliveryOptions;
}

export default function StorePage() {
  const params = useParams();
  const id = params?.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : null;
  const router = useRouter();
  const [owner, setOwner] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const supabase = createClientComponent();

  useEffect(() => {
    if (!id) {
      console.error('No ID provided in URL');
      setError('No store ID provided');
      setLoading(false);
      return;
    }
    
    console.log('Store ID from URL:', id);
    fetchStoreData();
  }, [id]);

  const fetchStoreData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching store data for ID:', id);
      
      // Use a direct fetch to bypass RLS for public data
      const response = await fetch(`/api/stores/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch store data');
      }
      
      const data = await response.json();
      console.log('Store API response:', data);
      
      if (!data.owner) {
        throw new Error(`Store not found. ID: ${id}`);
      }

      // Get flash sale prices for all products
      const productIds = data.products?.map((p: any) => p.id) || [];
      const flashSalePrices = await getFlashSalePrices(productIds);

      // Add flash sale prices to products without modifying the original structure
      const productsWithFlashSales = data.products?.map((product: any) => ({
        ...product,
        flash_sale_price: flashSalePrices[product.id]
      }));
      
      setOwner(data.owner);
      setProducts(productsWithFlashSales || []);
      setDebugInfo(data);

    } catch (err) {
      console.error('Error fetching store data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !owner) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-lg">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          
          {/* Debug information - remove in production */}
          <div className="mt-4 text-left text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-60">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
          
          <div className="mt-6 flex justify-center space-x-4">
            <button 
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all"
            >
              Return to Home
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-full hover:bg-gray-300 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create default store settings if missing
  const storeSettings = owner.store_settings || {
    name: owner.full_name || 'Store',
    description: 'No description available',
    logo_url: '',
    banner_url: '',
    email: owner.email || '',
    phone: '',
    address: '',
    payment_methods: { cash: true },
    delivery_options: { pickup: true }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Store Banner */}
      <div className="relative h-64 md:h-80 w-full bg-gray-200">
        {storeSettings.banner_url ? (
          <Image
            src={storeSettings.banner_url}
            alt={storeSettings.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500" />
        )}
      </div>

      {/* Store Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-24 sm:-mt-32 pb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Store Logo */}
              <div className="relative h-32 w-32 rounded-2xl overflow-hidden bg-gray-100 ring-4 ring-white">
                {storeSettings.logo_url ? (
                  <Image
                    src={storeSettings.logo_url}
                    alt={storeSettings.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-4xl font-bold">
                    {storeSettings.name?.[0] || '?'}
                  </div>
                )}
              </div>

              {/* Store Details */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">
                  {storeSettings.name}
                </h1>
                <p className="mt-2 text-lg text-gray-600">
                  {storeSettings.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-4">
                  {storeSettings.phone && (
                    <a
                      href={`tel:${storeSettings.phone}`}
                      className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {storeSettings.phone}
                    </a>
                  )}
                  {storeSettings.email && (
                    <a
                      href={`mailto:${storeSettings.email}`}
                      className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {storeSettings.email}
                    </a>
                  )}
                  {storeSettings.address && (
                    <span className="inline-flex items-center text-sm text-gray-500">
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {storeSettings.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Payment & Delivery Options */}
            {(storeSettings.payment_methods || storeSettings.delivery_options) && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
                {storeSettings.payment_methods && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Payment Methods</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(Object.entries(storeSettings.payment_methods) as [string, boolean][]).map(([method, isAvailable]) => (
                        isAvailable && (
                          <span key={method} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                            {method.charAt(0).toUpperCase() + method.slice(1)}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}
                
                {storeSettings.delivery_options && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Delivery Options</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(Object.entries(storeSettings.delivery_options) as [string, boolean][]).map(([option, isAvailable]) => (
                        isAvailable && (
                          <span key={option} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Products Section */}
        <div className="py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Store Products</h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <ProductCard 
                    product={{
                      ...product,
                      users: {
                        id: owner.id,
                        full_name: owner.full_name,
                        store_settings: storeSettings
                      },
                      product_images: product.product_images,
                      flash_sale_price: product.flash_sale_price
                    }} 
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg">
              <p className="text-gray-500">No products available at the moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 