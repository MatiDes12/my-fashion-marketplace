'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cleanImageUrl } from '@/utils/url';
import { Tab } from '@headlessui/react';

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
  created_at: string;
  avgRating: number;
  totalRatings: number;
  totalLikes: number;
  recentActivity: number;
  trendingScore: number;
}

interface StoreCategory {
  name: string;
  description: string;
  icon: React.ReactNode;
}

// Add this type for store metrics
interface StoreMetrics {
  avgRating: number;
  totalRatings: number;
  totalLikes: number;
  recentActivity: number;
  trendingScore: number;
}

export default function StoresPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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
          created_at,
          products (
            id,
            created_at,
            ratings (
              rating,
              created_at
            ),
            likes (
              created_at
            )
          )
        `)
        .eq('role', 'owner')
        .not('store_settings', 'is', null);

      if (error) throw error;

      // Calculate metrics for each store
      const formattedSellers: Seller[] = (sellers as any[])
        .filter(seller => seller.store_settings)
        .map(seller => {
          const metrics = calculateStoreMetrics(seller);
          
          return {
            id: seller.id,
            full_name: seller.full_name,
            email: seller.email,
            store_settings: seller.store_settings as StoreSettings,
            created_at: seller.created_at,
            total_products: seller.products?.length || 0,
            products: seller.products,
            ...metrics
          };
        })
        .sort((a, b) => b.trendingScore - a.trendingScore);

      setSellers(formattedSellers);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStoreMetrics = (seller: any): StoreMetrics => {
    const now = new Date();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    
    // Get all ratings across all products
    const allRatings = seller.products?.flatMap((product: any) => 
      product.ratings?.map((r: any) => ({
        rating: r.rating,
        created_at: new Date(r.created_at)
      })) || []
    ) || [];

    // Get all likes across all products
    const allLikes = seller.products?.flatMap((product: any) => 
      product.likes?.map((l: any) => ({
        created_at: new Date(l.created_at)
      })) || []
    ) || [];

    // Calculate average rating with explicit types
    const avgRating = allRatings.length > 0
      ? allRatings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / allRatings.length
      : 0;

    // Count recent activity with explicit types
    const recentRatings = allRatings.filter((r: { created_at: Date }) => 
      now.getTime() - r.created_at.getTime() < THIRTY_DAYS
    ).length;

    const recentLikes = allLikes.filter((l: { created_at: Date }) => 
      now.getTime() - l.created_at.getTime() < THIRTY_DAYS
    ).length;

    const recentActivity = recentRatings + recentLikes;

    // Calculate trending score
    // Formula: (Recent Activity * 0.5) + (Average Rating * 0.3) + (Total Engagement * 0.2)
    const trendingScore = 
      (recentActivity * 0.5) + 
      (avgRating * 0.3) + 
      ((allRatings.length + allLikes.length) * 0.2);

    return {
      avgRating,
      totalRatings: allRatings.length,
      totalLikes: allLikes.length,
      recentActivity,
      trendingScore
    };
  };

  // Define store categories
  const categories: StoreCategory[] = [
    {
      name: 'all',
      description: 'All Stores',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      name: 'trending',
      description: 'Trending Stores',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      name: 'new',
      description: 'New Stores',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      name: 'featured',
      description: 'Featured Stores',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
  ];

  // Modify the filtering logic for trending stores
  const filteredSellers = sellers.filter(seller => {
    const searchTerm = searchQuery.toLowerCase();
    const storeName = seller.store_settings?.name?.toLowerCase() || '';
    const storeDescription = seller.store_settings?.description?.toLowerCase() || '';
    const ownerName = seller.full_name.toLowerCase();
    
    const matchesSearch = 
      storeName.includes(searchTerm) ||
      storeDescription.includes(searchTerm) ||
      ownerName.includes(searchTerm);

    if (selectedCategory === 'all') return matchesSearch;
    if (selectedCategory === 'trending') {
      return matchesSearch && 
             seller.recentActivity > 0 && 
             seller.trendingScore > 5 && 
             (seller.totalRatings + seller.totalLikes) >= 3;
    }
    if (selectedCategory === 'new') {
      return matchesSearch && 
             (Date.now() - new Date(seller.created_at).getTime() < 7 * 24 * 60 * 60 * 1000);
    }
    if (selectedCategory === 'featured') {
      return matchesSearch && 
             seller.total_products >= 5 && 
             seller.avgRating >= 4;
    }
    
    return matchesSearch;
  });

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
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Discover Ethiopian Brands
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore unique Ethiopian stores, from traditional crafts to modern fashion. 
            Support local businesses and find your next favorite brand.
          </p>
        </div>

        {/* Enhanced Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by store name, description, or owner name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-full border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <svg
              className="absolute right-4 top-3.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-500 text-center">
              Found {filteredSellers.length} store{filteredSellers.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </p>
          )}
        </div>

        {/* Category Tabs */}
        <Tab.Group onChange={(index) => setSelectedCategory(categories[index].name)}>
          <Tab.List className="flex space-x-2 rounded-xl bg-white p-1 shadow-sm mb-8">
            {categories.map((category) => (
              <Tab
                key={category.name}
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                   ${selected
                    ? 'bg-red-500 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  {category.icon}
                  <span>{category.description}</span>
                </div>
              </Tab>
            ))}
          </Tab.List>
        </Tab.Group>

        {/* Store Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredSellers.map((seller) => (
            <motion.div
              key={seller.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden"
            >
              <Link href={`/stores/${seller.id}`} className="block">
                {/* Banner Image */}
                <div className="relative h-32 bg-gradient-to-r from-red-500 to-pink-500">
                  {seller.store_settings?.banner_url && (
                    <Image
                      src={cleanImageUrl(seller.store_settings.banner_url)}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                </div>

                {/* Logo */}
                <div className="relative -mt-16 px-4">
                  <div className="relative w-32 h-32 mx-auto">
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
                </div>

                {/* Store Info */}
                <div className="px-4 pt-4 pb-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {seller.store_settings?.name || seller.full_name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {seller.store_settings?.description || 'Ethiopian Store'}
                  </p>

                  {/* Metrics */}
                  <div className="mt-4 flex items-center justify-center space-x-4 text-sm">
                    <div className="flex items-center text-yellow-500">
                      <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{seller.avgRating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center text-red-500">
                      <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                      </svg>
                      <span>{seller.totalLikes}</span>
                    </div>
                    <div className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <span>{seller.total_products}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredSellers.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No stores found</h3>
            <p className="mt-2 text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
} 