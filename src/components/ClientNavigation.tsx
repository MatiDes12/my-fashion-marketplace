'use client';

import { useUserDetails } from '@/hooks/useUserDetails';
import Navigation from './Navigation';
import LoadingSpinner from './LoadingSpinner';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';

export default function ClientNavigation() {
  const { userDetails, loading } = useUserDetails();
  const pathname = usePathname();
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const supabase = createClientComponent();
  
  // Hide navigation on dashboard and admin pages
  if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')) {
    return null;
  }

  useEffect(() => {
    fetchCustomCategories();
  }, []);

  const fetchCustomCategories = async () => {
    try {
      const { data: customCategoriesData, error: customCategoriesError } = await supabase
        .from('custom_categories')
        .select('name')
        .eq('is_active', true)
        .order('name');
      
      if (!customCategoriesError && customCategoriesData) {
        setCustomCategories(customCategoriesData.map(cat => cat.name));
      }
    } catch (error) {
      console.error('Error fetching custom categories:', error);
    }
  };
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return (
    <Navigation userDetails={userDetails} customCategories={customCategories}>
      <div className="hidden lg:ml-8 lg:flex lg:items-center lg:space-x-6">
        <Link
          href="/wishlist"
          className="text-gray-700 hover:text-red-600 flex items-center space-x-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span>Wishlist</span>
        </Link>
      </div>

      {/* Mobile menu */}
      <div className="lg:hidden">
        <div className="flex items-center space-x-4">
          <Link
            href="/wishlist"
            className="text-gray-700 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </Navigation>
  );
} 