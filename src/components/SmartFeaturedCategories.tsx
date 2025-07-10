'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { PRODUCT_CATEGORIES } from '@/utils/constants';

interface Filters {
  category: string;
  priceRange: { min: number; max: number | null };
  ratingRange: { min: number; max: number } | null;
  minReviews: number;
  sortBy: string;
}

interface CategorySet {
  name: string;
  icon: JSX.Element;
  description: string;
  type: 'products' | 'custom' | 'default';
}

interface SmartFeaturedCategoriesProps {
  setFilters: (fn: (prev: Filters) => Filters) => void;
}

export default function SmartFeaturedCategories({ setFilters }: SmartFeaturedCategoriesProps) {
  const [currentCategorySet, setCurrentCategorySet] = useState(0);
  const [categorySets, setCategorySets] = useState<CategorySet[][]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const supabase = createClientComponent();

  // Icon mapping for different categories
  const getCategoryIcon = (categoryName: string): JSX.Element => {
    const iconMap: { [key: string]: JSX.Element } = {
      'Traditional Wear': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16"/>
        </svg>
      ),
      'Modern Fashion': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15V3m0 0L8 7m4-4l4 4"/>
        </svg>
      ),
      'Home & Living': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      ),
      'Jewelry': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3L3 8.5l9 5.5 9-5.5L12 3z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 14.5L12 20l9-5.5"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.5v6"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 8.5v6"/>
        </svg>
      ),
      'Beauty & Personal Care': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4H7z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/>
        </svg>
      ),
      'Art & Collectibles': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4H7z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 7a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2z"/>
        </svg>
      ),
      'Food & Beverages': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
        </svg>
      ),
      'Electronics': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      ),
      'Books & Media': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
      ),
      'Kids & Baby': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
        </svg>
      ),
      'Sports & Fitness': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      ),
      'Health & Wellness': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      ),
      'Musical Instruments': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
        </svg>
      ),
      'Party & Events': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>
      ),
      'Pet Supplies': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      ),
      'Office & Stationery': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
        </svg>
      ),
      'Garden & Outdoor': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      ),
      'Vintage & Antiques': (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
        </svg>
      )
    };

    return iconMap[categoryName] || (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
      </svg>
    );
  };

  // Get description for category
  const getCategoryDescription = (categoryName: string): string => {
    const descriptionMap: { [key: string]: string } = {
      'Traditional Wear': 'Authentic Ethiopian clothing',
      'Modern Fashion': 'Contemporary styles',
      'Home & Living': 'Ethiopian home decor',
      'Jewelry': 'Traditional & modern pieces',
      'Beauty & Personal Care': 'Natural beauty products',
      'Art & Collectibles': 'Ethiopian art & culture',
      'Food & Beverages': 'Ethiopian coffee & spices',
      'Electronics': 'Modern technology',
      'Books & Media': 'Ethiopian literature & media',
      'Kids & Baby': 'Children\'s clothing & toys',
      'Sports & Fitness': 'Ethiopian sports & fitness',
      'Health & Wellness': 'Traditional medicine & wellness',
      'Musical Instruments': 'Traditional & modern instruments',
      'Party & Events': 'Wedding & event supplies',
      'Pet Supplies': 'Pet care & accessories',
      'Office & Stationery': 'Office supplies & stationery',
      'Garden & Outdoor': 'Garden tools & outdoor items',
      'Vintage & Antiques': 'Vintage & antique items'
    };

    return descriptionMap[categoryName] || 'Ethiopian products';
  };

  // Fetch categories with products and custom categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);

        // 1. Fetch categories that have products
        const { data: productsData } = await supabase
          .from('products')
          .select('category')
          .eq('is_active', true);

        const categoriesWithProducts = Array.from(
          new Set(productsData?.map(p => p.category).filter(Boolean))
        );

        // 2. Fetch custom categories
        const { data: customCategoriesData } = await supabase
          .from('custom_categories')
          .select('name')
          .eq('is_active', true)
          .order('name');

        const customCategories = customCategoriesData?.map(cat => cat.name) || [];

        // 3. Get default categories from constants
        const defaultCategories = PRODUCT_CATEGORIES.filter(cat => 
          cat !== 'All' && 
          !categoriesWithProducts.includes(cat) && 
          !customCategories.includes(cat)
        );

        // Create category sets with pagination for variety
        const sets: CategorySet[][] = [];

        // Helper function to get paginated categories
        const getPaginatedCategories = (categories: string[], page: number, pageSize: number = 6): string[] => {
          const startIndex = page * pageSize;
          return categories.slice(startIndex, startIndex + pageSize);
        };

        // Helper function to fill remaining slots
        const fillRemainingSlots = (baseCategories: CategorySet[], maxSlots: number = 6): CategorySet[] => {
          if (baseCategories.length >= maxSlots) {
            return baseCategories.slice(0, maxSlots);
          }

          const remaining = maxSlots - baseCategories.length;
          let filledCategories = [...baseCategories];

          // Fill with custom categories first, then default categories
          const availableCustom = customCategories
            .filter(cat => !filledCategories.some(fc => fc.name === cat))
            .slice(0, remaining);
          
          filledCategories.push(...availableCustom.map(cat => ({
            name: cat,
            icon: getCategoryIcon(cat),
            description: `Custom category: ${cat}`,
            type: 'custom' as const
          })));

          // If still need more, fill with default categories
          if (filledCategories.length < maxSlots) {
            const stillNeeded = maxSlots - filledCategories.length;
            const availableDefault = defaultCategories
              .filter(cat => !filledCategories.some(fc => fc.name === cat))
              .slice(0, stillNeeded);
            
            filledCategories.push(...availableDefault.map(cat => ({
              name: cat,
              icon: getCategoryIcon(cat),
              description: getCategoryDescription(cat),
              type: 'default' as const
            })));
          }

          return filledCategories;
        };

        // Calculate how many pages we need for each category type
        const productPages = Math.ceil(categoriesWithProducts.length / 6);
        const customPages = Math.ceil(customCategories.length / 6);
        const defaultPages = Math.ceil(defaultCategories.length / 6);

        // Create multiple sets for each category type if they have more than 6 items
        for (let page = 0; page < Math.max(productPages, customPages, defaultPages, 1); page++) {
          const currentSets: CategorySet[][] = [];

          // Get paginated categories for current page
          const paginatedProducts = getPaginatedCategories(categoriesWithProducts, page);
          const paginatedCustom = getPaginatedCategories(customCategories, page);
          const paginatedDefault = getPaginatedCategories(defaultCategories, page);

          // Set 1: Categories with products (paginated)
          if (categoriesWithProducts.length > 0) {
            const productCategories = paginatedProducts.map((cat: string) => ({
              name: cat,
              icon: getCategoryIcon(cat),
              description: getCategoryDescription(cat),
              type: 'products' as const
            }));
            currentSets.push(fillRemainingSlots(productCategories));
          }

          // Set 2: Custom categories (paginated)
          if (customCategories.length > 0) {
            const customCategorySet = paginatedCustom.map((cat: string) => ({
              name: cat,
              icon: getCategoryIcon(cat),
              description: `Custom category: ${cat}`,
              type: 'custom' as const
            }));
            
            // Fill remaining slots with product categories first, then default
            const fillCustomSlots = (baseCategories: CategorySet[]): CategorySet[] => {
              if (baseCategories.length >= 6) {
                return baseCategories.slice(0, 6);
              }

              const remaining = 6 - baseCategories.length;
              let filledCategories = [...baseCategories];

              // Fill with product categories first (from current page)
              const availableProducts = paginatedProducts
                .filter((cat: string) => !filledCategories.some(fc => fc.name === cat))
                .slice(0, remaining);
              
              filledCategories.push(...availableProducts.map((cat: string) => ({
                name: cat,
                icon: getCategoryIcon(cat),
                description: getCategoryDescription(cat),
                type: 'products' as const
              })));

              // If still need more, fill with default categories
              if (filledCategories.length < 6) {
                const stillNeeded = 6 - filledCategories.length;
                const availableDefault = defaultCategories
                  .filter((cat: string) => !filledCategories.some(fc => fc.name === cat))
                  .slice(0, stillNeeded);
                
                filledCategories.push(...availableDefault.map((cat: string) => ({
                  name: cat,
                  icon: getCategoryIcon(cat),
                  description: getCategoryDescription(cat),
                  type: 'default' as const
                })));
              }

              return filledCategories;
            };

            currentSets.push(fillCustomSlots(customCategorySet));
          }

          // Set 3: Default categories (paginated)
          if (defaultCategories.length > 0) {
            const defaultCategorySet = paginatedDefault.map((cat: string) => ({
              name: cat,
              icon: getCategoryIcon(cat),
              description: getCategoryDescription(cat),
              type: 'default' as const
            }));
            
            // Fill remaining slots with product categories first, then custom
            const fillDefaultSlots = (baseCategories: CategorySet[]): CategorySet[] => {
              if (baseCategories.length >= 6) {
                return baseCategories.slice(0, 6);
              }

              const remaining = 6 - baseCategories.length;
              let filledCategories = [...baseCategories];

              // Fill with product categories first (from current page)
              const availableProducts = paginatedProducts
                .filter((cat: string) => !filledCategories.some(fc => fc.name === cat))
                .slice(0, remaining);
              
              filledCategories.push(...availableProducts.map((cat: string) => ({
                name: cat,
                icon: getCategoryIcon(cat),
                description: getCategoryDescription(cat),
                type: 'products' as const
              })));

              // If still need more, fill with custom categories
              if (filledCategories.length < 6) {
                const stillNeeded = 6 - filledCategories.length;
                const availableCustom = customCategories
                  .filter((cat: string) => !filledCategories.some(fc => fc.name === cat))
                  .slice(0, stillNeeded);
                
                filledCategories.push(...availableCustom.map((cat: string) => ({
                  name: cat,
                  icon: getCategoryIcon(cat),
                  description: `Custom category: ${cat}`,
                  type: 'custom' as const
                })));
              }

              return filledCategories;
            };

            currentSets.push(fillDefaultSlots(defaultCategorySet));
          }

          // Add all sets from current page
          sets.push(...currentSets);
        }

        setCategorySets(sets);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Rotate categories every 30 seconds
  useEffect(() => {
    if (categorySets.length === 0) return;

    const interval = setInterval(() => {
      setCurrentCategorySet((prev) => (prev + 1) % categorySets.length);
    }, 30 * 1000); // 30 seconds

    return () => clearInterval(interval);
  }, [categorySets.length]);

  if (loading || categorySets.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-xl mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  const currentCategories = categorySets[currentCategorySet] || [];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
      {currentCategories.map((category) => (
        <button
          key={category.name}
          onClick={() => setFilters((prev) => ({ 
            ...prev, 
            category: category.name.toLowerCase() 
          }))}
          className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:bg-red-50 group"
        >
          <div className={`text-gray-600 group-hover:text-red-600 transition-colors mb-3 ${
            category.type === 'custom' ? 'text-purple-600' : 
            category.type === 'products' ? 'text-green-600' : 'text-gray-600'
          }`}>
            {category.icon}
          </div>
          <span className="text-sm font-medium text-gray-900 text-center mb-1">
            {category.name}
          </span>
          <span className="text-xs text-gray-500 text-center">
            {category.description}
          </span>
          {category.type === 'custom' && (
            <span className="text-xs text-purple-600 font-medium mt-1">
              Custom
            </span>
          )}
        </button>
      ))}
    </div>
  );
} 