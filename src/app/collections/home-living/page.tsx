'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { motion } from 'framer-motion';
import { CATEGORY_GROUPS, normalizeCategory, DB_CATEGORY_MAP } from '@/utils/constants';
import { generateTemplateCategoryProducts } from '@/utils/templateData';

// Add proper type definitions
interface ProductImage {
  id: string;
  image_url: string;
  is_model_picture: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  product_images: ProductImage[];
  likes: { count: number }[];
  like_count?: number;
  users: {
    id: string;
    full_name: string;
    store_settings?: {
      name: string;
      logo_url: string;
    };
  };
  is_coming_soon: boolean;
}

interface CategoryProducts {
  [key: string]: Product[];
}

// Add this new component for empty product cards
const EmptyProductCard = ({ category }: { category: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden"
  >
    <div className="aspect-w-1 aspect-h-1 bg-gray-800/50">
      <div className="flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
    <div className="p-4">
      <h3 className="text-lg font-medium text-gray-300">{category} Coming Soon</h3>
      <p className="mt-1 text-sm text-gray-400">New products will be added soon</p>
      <div className="mt-2 flex justify-between items-center">
        <span className="text-gray-500">ETB ---.--</span>
        <span className="text-sm text-gray-500">Coming Soon</span>
      </div>
    </div>
  </motion.div>
);

// Add filter state type
type FilterState = {
  category: string;
  priceRange: string;
};

export default function HomeLivingCollection() {
  const [categoryProducts, setCategoryProducts] = useState<CategoryProducts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add filter state
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    priceRange: 'all'
  });

  const supabase = createClientComponent();

  // Add price range options specific to home & living
  const priceRanges = [
    { label: 'All Prices', value: 'all' },
    { label: 'Under ETB 5,000', value: '0-5000' },
    { label: 'ETB 5,000 - 15,000', value: '5000-15000' },
    { label: 'ETB 15,000 - 30,000', value: '15000-30000' },
    { label: 'Over ETB 30,000', value: '30000-above' }
  ];

  // Update the filter products function
  const getFilteredProducts = (products: Product[]) => {
    return products.filter(product => {
      // Skip template/coming soon products
      if (product.is_coming_soon) return false;

      // Category filter
      if (filters.category !== 'All') {
        const normalizedProductCategory = normalizeCategory(product.category);
        const normalizedFilterCategory = normalizeCategory(filters.category);
        if (normalizedProductCategory !== normalizedFilterCategory) {
          return false;
        }
      }

      // Price range filter
      if (filters.priceRange !== 'all') {
        const [min, max] = filters.priceRange.split('-').map(Number);
        const price = product.price || 0;
        
        if (filters.priceRange.endsWith('above')) {
          if (price < min) return false;
        } else {
          if (price < min || price > max) return false;
        }
      }

      return true;
    });
  };

  const hasRealProducts = (category: string) => {
    return categoryProducts[category]?.some(product => !product.is_coming_soon) || false;
  };

  const hasAnyRealProducts = Object.values(categoryProducts).some(products => 
    products.some(product => !product.is_coming_soon)
  );

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          likes:likes(count),
          users (
            id,
            full_name,
            store_settings
          )
        `)
        .in('category', [
          'home_living',
          ...CATEGORY_GROUPS['Home & Living'].map(cat => cat.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_'))
        ])
        .eq('is_active', true);

      if (error) throw error;

      // Group products by category and sort by likes
      const groupedProducts: CategoryProducts = {};
      
      // Initialize categories with template data
      CATEGORY_GROUPS['Home & Living'].forEach(category => {
        groupedProducts[category] = generateTemplateCategoryProducts(category);
      });

      // If we have real data, override the template data
      if (data && data.length > 0) {
        // Add products to their categories
        data.forEach(product => {
          const categoryKey = Object.entries(groupedProducts).find(([key]) => 
            product.category === key.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_')
          )?.[0];

          if (categoryKey) {
            if (groupedProducts[categoryKey][0]?.id.startsWith('template-')) {
              // Replace template data with real data
              groupedProducts[categoryKey] = [];
            }
            groupedProducts[categoryKey].push({
              ...product,
              like_count: product.likes[0]?.count || 0
            });
          }
        });
      }

      // Sort products in each category by likes
      Object.keys(groupedProducts).forEach(category => {
        groupedProducts[category].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      });

      setCategoryProducts(groupedProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gray-900 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1 
            className="text-4xl font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Home & Living Collection
          </motion.h1>
          <motion.p 
            className="text-gray-400 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Discover beautiful pieces for your home
          </motion.p>
        </div>

        {/* Filter Section */}
        <div className="mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Filter */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="bg-gray-700 text-white rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Categories</option>
                  {CATEGORY_GROUPS['Home & Living'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Price Range Filter */}
              <div>
                <label htmlFor="priceRange" className="block text-sm font-medium text-gray-300 mb-2">
                  Price Range
                </label>
                <select
                  id="priceRange"
                  value={filters.priceRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceRange: e.target.value }))}
                  className="bg-gray-700 text-white rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-indigo-500"
                >
                  {priceRanges.map(range => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset Filters Button */}
            <button
              onClick={() => setFilters({ category: 'All', priceRange: 'all' })}
              className="mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="space-y-16">
          {CATEGORY_GROUPS['Home & Living'].map(category => {
            const filteredProducts = getFilteredProducts(categoryProducts[category] || []);
            const hasReal = hasRealProducts(category);
            
            // Skip empty sections when filtering
            if (filters.category !== 'All' && filters.category !== category) {
              return null;
            }

            return (
              <motion.section
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4">
                  {category}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {!hasReal || filteredProducts.length === 0 ? (
                    <EmptyProductCard category={category} />
                  ) : (
                    filteredProducts.map((product, index) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <ProductCard product={product} />
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.section>
            );
          })}
        </div>

        {/* Show coming soon message only if no real products */}
        {!hasAnyRealProducts && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 max-w-2xl mx-auto">
              <div className="text-6xl mb-4">🏠</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Coming Soon!
              </h3>
              <p className="text-gray-400">
                We're curating an amazing collection of home and living products. 
                Check back soon to discover beautiful pieces for your home.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 