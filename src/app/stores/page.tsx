'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cleanImageUrl } from '@/utils/url';

interface Rating {
  rating: number;
}

interface Product {
  id: string;
  ratings?: Rating[];
  likes?: Array<{ count: number }>;
}

interface StoreSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  logo_url: string;
  banner_url: string;
  description: string;
  payment_methods: {
    cash: boolean;
    telebirr: boolean;
    creditCard: boolean;
    bankTransfer: boolean;
  };
  delivery_options: {
    pickup: boolean;
    delivery: boolean;
    shipping: boolean;
  };
}

interface Seller {
  id: string;
  full_name: string;
  email: string;
  store_settings: StoreSettings;
  products?: Product[];
  total_products: number;
  average_rating: number;
  total_likes: number;
  score: number;
}

export default function StoresPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      const { data: sellers, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          store_settings,
          products (
            id,
            ratings (
              rating
            ),
            likes (count)
          )
        `)
        .eq('role', 'owner')
        .not('store_settings', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate scores and format sellers
      const formattedSellers = (sellers as any[])
        .filter(seller => seller.store_settings)
        .map(seller => {
          // Calculate total products
          const totalProducts = seller.products?.length || 0;

          // Calculate average rating across all products
          const allRatings = seller.products?.flatMap((product: Product) => 
            product.ratings?.map((r: Rating) => r.rating) || []
          ) || [];
          const averageRating = allRatings.length > 0
            ? allRatings.reduce((sum: number, rating: number) => sum + rating, 0) / allRatings.length
            : 0;

          // Calculate total likes across all products
          const totalLikes = seller.products?.reduce((sum: number, product: Product) => 
            sum + (product.likes?.[0]?.count || 0), 0
          ) || 0;

          // Calculate combined score
          const normalizedLikes = Math.min(totalLikes / 20, 5);
          const score = (averageRating + normalizedLikes) / 2;

          return {
            id: seller.id,
            full_name: seller.full_name,
            email: seller.email,
            store_settings: seller.store_settings as StoreSettings,
            total_products: totalProducts,
            average_rating: averageRating,
            total_likes: totalLikes,
            score: score
          };
        })
        .sort((a, b) => b.score - a.score);

      console.log('Fetched sellers:', formattedSellers);
      setSellers(formattedSellers);
    } catch (error) {
      console.error('Error fetching sellers:', error);
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
    <div className="min-h-screen bg-gray-50 pt-[120px] pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Featured Brands</h1>
          <p className="text-lg text-gray-600">Discover amazing Ethiopian brands and sellers</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {sellers.map((seller) => (
            <motion.div
              key={seller.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <Link 
                href={`/stores/${seller.id}`}
                className="group block text-center"
              >
                {/* Store Logo */}
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  {seller.store_settings?.logo_url ? (
                    <Image
                      src={cleanImageUrl(seller.store_settings.logo_url)}
                      alt={seller.store_settings.name}
                      fill
                      className="rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
                      {seller.store_settings?.name?.[0] || seller.full_name[0]}
                    </div>
                  )}
                </div>

                {/* Store Info */}
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                  {seller.store_settings?.name || seller.full_name}
                </h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {seller.store_settings?.description || 'Ethiopian Store'}
                </p>

                {/* Store Metrics */}
                <div className="mt-3 flex items-center justify-center space-x-3 text-sm text-gray-500">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {seller.average_rating.toFixed(1)}
                  </div>
                  <span>•</span>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-red-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                    </svg>
                    {seller.total_likes}
                  </div>
                  <span>•</span>
                  <span>{seller.total_products} Products</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {sellers.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No stores available</h3>
            <p className="mt-2 text-gray-500">Check back later for new stores</p>
          </div>
        )}
      </div>
    </div>
  );
} 