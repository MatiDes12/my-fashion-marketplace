'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { motion } from 'framer-motion';
import { CATEGORY_GROUPS, normalizeCategory, DB_CATEGORY_MAP } from '@/utils/constants';
import { generateTemplateCategoryProducts } from '@/utils/templateData';
import { Sparkles, Filter, RefreshCw, Star, ShoppingBag, Shirt } from 'lucide-react';

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
  avgRating?: number;
  totalRatings?: number;
}

interface CategoryProducts {
  [key: string]: Product[];
}

// Add this type definition
type FilterState = {
  category: string;
  priceRange: string;
};

// Add at the top with other interfaces
interface Section {
  title: string;
  categories: string[];
  hasProducts: boolean;
}

// Enhanced EmptyProductCard component with luxurious design
const EmptyProductCard = ({ category }: { category: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden group hover:bg-white/10 transition-all duration-300"
  >
    <div className="aspect-square bg-gradient-to-br from-amber-500/10 to-yellow-500/5 flex items-center justify-center relative">
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10"
      >
        <Shirt className="w-16 h-16 text-amber-400/60" />
      </motion.div>
      <div className="absolute top-4 right-4">
        <Sparkles className="w-5 h-5 text-amber-400/40" />
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-amber-300 transition-colors">
        {category}
      </h3>
      <p className="text-gray-400 text-sm mb-4">Exciting new pieces coming soon to our collection</p>
      <div className="flex justify-between items-center">
        <span className="text-amber-400/60 font-medium">Coming Soon</span>
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-amber-400/40" />
          <span className="text-gray-500 text-sm">New</span>
        </div>
      </div>
    </div>
  </motion.div>
);

export default function ClothingCollection() {
  const [categoryProducts, setCategoryProducts] = useState<CategoryProducts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();

  // Add filter state
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    priceRange: 'all'
  });

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
          ratings:ratings(rating),
          users (
            id,
            full_name,
            store_settings
          )
        `)
        .in('category', [
          ...CATEGORY_GROUPS['Traditional Wear'].map(cat => normalizeCategory(cat)),
          ...CATEGORY_GROUPS['Modern Fashion'].map(cat => normalizeCategory(cat))
        ])
        .eq('is_active', true);

      if (error) throw error;

      // Group products by category and sort by likes
      const groupedProducts: CategoryProducts = {};
      
      // Initialize categories with template data
      [...CATEGORY_GROUPS['Traditional Wear'], ...CATEGORY_GROUPS['Modern Fashion']].forEach(category => {
        groupedProducts[category] = generateTemplateCategoryProducts(category);
      });

      // If we have real data, override the template data
      if (data && data.length > 0) {
        data.forEach(product => {
          // Find the display category name from the database category
          const displayCategory = DB_CATEGORY_MAP[product.category] || product.category;
          
          if (groupedProducts[displayCategory]) {
            if (groupedProducts[displayCategory][0]?.id.startsWith('template-')) {
              groupedProducts[displayCategory] = [];
            }

            // Calculate average rating
            const ratings = product.ratings || [];
            const avgRating = ratings.length > 0
              ? ratings.reduce((acc: number, curr: any) => acc + (curr.rating || 0), 0) / ratings.length
              : 0;

            groupedProducts[displayCategory].push({
              ...product,
              like_count: product.likes[0]?.count || 0,
              avgRating: Number(avgRating.toFixed(1)),
              totalRatings: ratings.length,
              is_coming_soon: false
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

  // Price ranges specific to clothing
  const priceRanges = [
    { label: 'All Prices', value: 'all' },
    { label: 'Under ETB 1,000', value: '0-1000' },
    { label: 'ETB 1,000 - 5,000', value: '1000-5000' },
    { label: 'ETB 5,000 - 10,000', value: '5000-10000' },
    { label: 'Over ETB 10,000', value: '10000-above' }
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

  // Add this helper function to check if a section has any real products
  const hasSectionProducts = (categoryGroup: string[]) => {
    return categoryGroup.some(category => hasRealProducts(category));
  };

  // Update the filter functions with types
  const sortCategories = (categories: string[]): string[] => {
    return [...categories].sort((a, b) => {
      const aHasProducts = hasRealProducts(a);
      const bHasProducts = hasRealProducts(b);
      if (aHasProducts && !bHasProducts) return -1;
      if (!aHasProducts && bHasProducts) return 1;
      return 0;
    });
  };

  // Get sorted categories for each section
  const sortedTraditionalCategories = sortCategories(CATEGORY_GROUPS['Traditional Wear']);
  const sortedModernCategories = sortCategories(CATEGORY_GROUPS['Modern Fashion']);

  // Add this function to sort sections
  const getSortedSections = (): Section[] => {
    const sections = [
      { 
        title: 'Traditional Wear', 
        categories: sortedTraditionalCategories,
        hasProducts: hasSectionProducts(CATEGORY_GROUPS['Traditional Wear'])
      },
      { 
        title: 'Modern Fashion', 
        categories: sortedModernCategories,
        hasProducts: hasSectionProducts(CATEGORY_GROUPS['Modern Fashion'])
      }
    ];

    return sections.sort((a, b) => {
      if (a.hasProducts && !b.hasProducts) return -1;
      if (!a.hasProducts && b.hasProducts) return 1;
      return 0;
    });
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
      {/* Hero Section */}
      <div className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-yellow-500/5"></div>
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-screen-2xl mx-auto px-4 lg:px-12 xl:px-16">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-6 py-3 rounded-full text-sm font-medium mb-8 shadow-lg"
            >
              <Shirt className="w-5 h-5" />
              Fashion & Traditional Wear
            </motion.div>
            
            <motion.h1 
              className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 tracking-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Clothing
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-yellow-500">
                Collection
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Discover our exquisite collection of traditional Ethiopian wear and contemporary fashion. 
              From timeless heritage pieces to modern style statements.
            </motion.p>

            <motion.div 
              className="flex flex-wrap justify-center gap-8 mt-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="flex items-center gap-2 text-gray-600">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span className="font-medium">Premium Quality</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="font-medium">Authentic Designs</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <ShoppingBag className="w-5 h-5 text-amber-500" />
                <span className="font-medium">Curated Selection</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 lg:px-12 xl:px-16 pb-20">

        {/* Filter Section */}
        <motion.div 
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-100 rounded-xl">
                <Filter className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Filter Collections</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Filter */}
              <div className="space-y-3">
                <label htmlFor="category" className="block text-sm font-semibold text-gray-700">
                  Category
                </label>
                <select
                  id="category"
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm transition-all duration-200"
                >
                  <option value="All">All Categories</option>
                  <optgroup label="Traditional Wear">
                    {CATEGORY_GROUPS['Traditional Wear'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Modern Fashion">
                    {CATEGORY_GROUPS['Modern Fashion'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Price Range Filter */}
              <div className="space-y-3">
                <label htmlFor="priceRange" className="block text-sm font-semibold text-gray-700">
                  Price Range
                </label>
                <select
                  id="priceRange"
                  value={filters.priceRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceRange: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm transition-all duration-200"
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
            <motion.button
              onClick={() => setFilters({ category: 'All', priceRange: 'all' })}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors group"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
              Reset Filters
            </motion.button>
          </div>
        </motion.div>

        {/* Products Grid - Updated to show sections with products first */}
        <div className="space-y-20">
          {getSortedSections().map((section, sectionIndex) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: sectionIndex * 0.2 }}
              className="space-y-12"
            >
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: sectionIndex * 0.2 + 0.3 }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 px-6 py-3 rounded-full text-sm font-medium mb-6 shadow-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  {section.title}
                </motion.div>
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  {section.title}
                  <span className="block text-2xl md:text-3xl font-normal text-gray-600 mt-2">
                    {section.title === 'Traditional Wear' ? 'Heritage & Authenticity' : 'Contemporary Style'}
                  </span>
                </h2>
              </div>
              <div className="space-y-12">
                {/* Categories with real products */}
                {section.categories
                  .filter((category: string) => hasRealProducts(category))
                  .map((category: string) => {
                    const filteredProducts = getFilteredProducts(categoryProducts[category] || []);
                    
                    // Skip when filtering
                    if (filters.category !== 'All' && filters.category !== category) {
                      return null;
                    }

                    return (
                      <div key={category} className="space-y-8">
                        <div className="text-center">
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">{category}</h3>
                          <div className="w-24 h-1 bg-gradient-to-r from-amber-500 to-yellow-500 mx-auto rounded-full"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                          {filteredProducts.map((product, index) => (
                            <motion.div
                              key={product.id}
                              initial={{ opacity: 0, y: 30 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1, duration: 0.6 }}
                              whileHover={{ y: -5 }}
                              className="group"
                            >
                              <ProductCard product={product} />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                {/* Categories without products (coming soon) */}
                {section.categories
                  .filter((category: string) => !hasRealProducts(category))
                  .map((category: string) => {
                    // Skip when filtering
                    if (filters.category !== 'All' && filters.category !== category) {
                      return null;
                    }

                    return (
                      <div key={category} className="space-y-8">
                        <div className="text-center">
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">{category}</h3>
                          <div className="w-24 h-1 bg-gradient-to-r from-amber-400/50 to-yellow-400/50 mx-auto rounded-full"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                          <EmptyProductCard category={category} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.section>
          ))}

          {/* Coming soon message - show only if no categories at all */}
          {CATEGORY_GROUPS['Traditional Wear'].length === 0 && 
           CATEGORY_GROUPS['Modern Fashion'].length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-12 max-w-3xl mx-auto">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="text-8xl mb-8"
                >
                  👗
                </motion.div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Amazing Collections Coming Soon!
                </h3>
                <p className="text-xl text-gray-600 leading-relaxed">
                  We're curating an extraordinary collection of traditional Ethiopian wear and contemporary fashion. 
                  Beautiful pieces that celebrate heritage and embrace modern style await you.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">Authentic Designs</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-600">
                    <Star className="w-5 h-5" />
                    <span className="font-medium">Premium Quality</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 