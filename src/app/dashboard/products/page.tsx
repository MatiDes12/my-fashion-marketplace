'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Image from 'next/image';
import Link from 'next/link';
import { formatCurrency } from '@/utils/currency';
import { toast } from 'react-hot-toast';
import { withSellerVerification } from '@/components/withSellerVerification';

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  is_active: boolean;
  created_at: string;
  category: string;
  product_images?: ProductImage[];
  sizes: string[];
  colors: string[];
  available_variants: {
    size: string;
    color: string;
    quantity: number;
    sku: string;
  }[];
  brand?: string;
  material?: string;
  care_instructions?: string;
  measurements?: {
    [key: string]: string;
  };
};

type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  is_model_picture: boolean;
};

type CategoryGroup = {
  [key: string]: Product[];
};

// Add subscription plan type
interface SubscriptionLimits {
  productLimit: number;
  storageLimit: number;
  aiCredits: number;
  analyticsAccess: 'standard' | 'detailed' | 'advanced';
}

const PLAN_LIMITS: { [key: string]: SubscriptionLimits } = {
  basic: {
    productLimit: 20,
    storageLimit: 5,
    aiCredits: 0,
    analyticsAccess: 'standard'
  },
  pro: {
    productLimit: 75,
    storageLimit: 15,
    aiCredits: 100,
    analyticsAccess: 'detailed'
  },
  enterprise: {
    productLimit: Infinity,
    storageLimit: Infinity,
    aiCredits: 500,
    analyticsAccess: 'advanced'
  }
};


// Update the usageStats state to match the data structure
interface UsageStats {
  totalProducts: number;
  storageUsed: number;
  totalImages: number;
  imageDetails: Array<{
    url: string;
    product: string;
    estimated_size: string;
  }>;
}

// Add this utility function near the top of the file
const formatImageUrl = (url: string) => {
  if (!url) return '/placeholder.png';
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${url}`;
};

// Update the ProductImage component in the products page
const ProductImage = ({ imageUrl, title }: { imageUrl: string; title: string }) => {
  const [imageError, setImageError] = useState(false);
  const formattedUrl = imageError ? '/placeholder.png' : formatImageUrl(imageUrl);

  return (
    <div className="relative aspect-w-3 aspect-h-2 bg-gray-100">
      <Image
        src={formattedUrl}
        alt={title}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
};

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPaymentSettings, setHasPaymentSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'in-stock', 'low-stock', 'out-of-stock'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'price-high', 'price-low'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'all' | 'categories' | 'out-of-stock'>('all');
  const [currentPlan, setCurrentPlan] = useState<string>('basic');
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalProducts: 0,
    storageUsed: 0,
    totalImages: 0,
    imageDetails: []
  });
  const router = useRouter();
  const supabase = createClientComponent();

  // Define fetchProducts outside useEffect so it can be reused
  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login?message=Please login to access the dashboard');
        return;
      }

      // Fetch products with their images
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_images (*)
        `)
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Group products by category
      const groups: CategoryGroup = {};
      productsData?.forEach((product: any) => {
        const category = product.category || 'Uncategorized';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(product);
      });

      setProducts(productsData || []);
      setCategoryGroups(groups);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkPaymentSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        const { data: settings, error } = await supabase
          .from('payment_settings')
          .select('telebirr_settings, chapa_settings, bank_settings, cbe_birr_settings, amole_settings, mpesa_settings')
          .eq('user_id', session.user.id)
          .single();

        if (error) {
          console.error('Error checking payment settings:', error);
          return false;
        }

        return settings?.telebirr_settings?.is_active || 
               settings?.chapa_settings?.is_active || 
               settings?.bank_settings?.is_active || 
               settings?.cbe_birr_settings?.is_active || 
               settings?.amole_settings?.is_active || 
               settings?.mpesa_settings?.is_active || 
               false;
      } catch (error) {
        console.error('Error:', error);
        return false;
      }
    };

    checkPaymentSettings().then((result) => {
      setHasPaymentSettings(result);
      if (!result) {
          toast.error(
            <div>
              <p>Please set up your payment settings before adding products.</p>
              <Link 
                href="/dashboard/payment-settings" 
                className="text-green-600 hover:text-green-500 mt-2 block"
              >
                Set up payment settings →
              </Link>
            </div>,
            { duration: 5000 }
          );
        }
    });
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchUserPlanAndUsage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        // Get user's plan
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('subscription_plan')
          .eq('id', session.user.id)
          .single();

        if (userError) throw userError;
        setCurrentPlan(userData.subscription_plan || 'basic');

        // Get storage stats using the function we created
        const { data: storageData, error: storageError } = await supabase
          .rpc('calculate_user_storage_usage', { user_id: session.user.id });

        if (storageError) throw storageError;

        if (storageData && storageData.length > 0) {
          setUsageStats({
            totalProducts: products.length,
            storageUsed: Number(storageData[0].total_size_mb),
            totalImages: storageData[0].total_images,
            imageDetails: storageData[0].image_details || []
          });
        }

      } catch (error) {
        console.error('Error fetching usage stats:', error);
      }
    };

    fetchUserPlanAndUsage();
  }, [products.length]); // Add products.length as dependency

  // Clean image URL helper
  const cleanImageUrl = (url: string | undefined): string => {
    if (!url) return '';
    return url.startsWith('@') ? url.substring(1) : url;
  };

  // Add this function to handle sorting
  const getSortedProducts = (products: Product[]) => {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'price-high':
          return b.price - a.price;
        case 'price-low':
          return a.price - b.price;
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: // 'newest'
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  };

  // Add this function to handle filtering
  const getFilteredProducts = (products: Product[]) => {
    return products.filter(product => {
      const matchesSearch = 
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStock = () => {
        switch (stockFilter) {
          case 'in-stock':
            return product.quantity > 10;
          case 'low-stock':
            return product.quantity <= 10 && product.quantity > 0;
          case 'out-of-stock':
            return product.quantity === 0;
          default:
            return true;
        }
      };

      return matchesSearch && matchesStock();
    });
  };

  // Add a function to get out of stock products
  const getOutOfStockProducts = () => {
    return products.filter(product => product.quantity === 0);
  };

  // Add this before the return statement
  const currentLimits = PLAN_LIMITS[currentPlan];
  const canAddMoreProducts = usageStats.totalProducts < currentLimits.productLimit;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Plan Usage Stats */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Current Plan</h3>
              <p className="mt-1 text-xl font-semibold text-indigo-600 capitalize">{currentPlan}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Products Used</h3>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {usageStats.totalProducts} / {currentLimits.productLimit === Infinity ? '∞' : currentLimits.productLimit}
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full" 
                  style={{ 
                    width: `${(usageStats.totalProducts / (currentLimits.productLimit === Infinity ? usageStats.totalProducts + 5 : currentLimits.productLimit)) * 100}%` 
                  }}
                />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Storage Used</h3>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {usageStats.storageUsed.toFixed(2)} MB / {currentLimits.storageLimit === Infinity ? '∞' : `${currentLimits.storageLimit * 1024} MB`}
              </p>
              <p className="text-sm text-gray-500">
                {usageStats.totalImages} images uploaded
              </p>
              {currentLimits.storageLimit !== Infinity && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      usageStats.storageUsed >= currentLimits.storageLimit * 1024 
                        ? 'bg-red-600' 
                        : usageStats.storageUsed >= currentLimits.storageLimit * 1024 * 0.8 
                          ? 'bg-yellow-600' 
                          : 'bg-indigo-600'
                    }`}
                    style={{ 
                      width: `${Math.min((usageStats.storageUsed / (currentLimits.storageLimit * 1024)) * 100, 100)}%` 
                    }}
                  />
                </div>
              )}
              {usageStats.storageUsed >= currentLimits.storageLimit * 1024 * 0.8 && (
                <p className="mt-1 text-sm text-yellow-600">
                  Storage limit {usageStats.storageUsed >= currentLimits.storageLimit * 1024 ? 'reached' : 'approaching'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Products by Category</h1>
          {hasPaymentSettings ? (
            canAddMoreProducts ? (
            <Link
              href="/dashboard/products/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Add New Product
            </Link>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  disabled
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"
                >
                  Product Limit Reached
                </button>
                <Link
                  href="/dashboard/subscription"
                  className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                >
                  Upgrade Plan →
                </Link>
              </div>
            )
          ) : (
            <Link
              href="/dashboard/payment-settings"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
            >
              Set Up Payment Settings
            </Link>
          )}
        </div>

        {!hasPaymentSettings && (
          <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You need to set up your payment settings before you can add products.
                  <Link 
                    href="/dashboard/payment-settings"
                    className="font-medium text-yellow-700 underline ml-2"
                  >
                    Set up now
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Show warning when close to limit */}
        {usageStats.totalProducts >= currentLimits.productLimit * 0.8 && usageStats.totalProducts < currentLimits.productLimit && (
          <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You're approaching your product limit. Consider upgrading your plan to add more products.
                  <Link href="/dashboard/subscription" className="ml-2 font-medium underline">
                    Upgrade Now
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('all')}
                className={`${
                  activeTab === 'all'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                All Products
              </button>
            <button
                onClick={() => setActiveTab('categories')}
                className={`${
                  activeTab === 'categories'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Categories
            </button>
              <button
                onClick={() => setActiveTab('out-of-stock')}
                className={`${
                  activeTab === 'out-of-stock'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
              >
                Out of Stock
                {getOutOfStockProducts().length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getOutOfStockProducts().length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Conditional Rendering based on active tab */}
        {activeTab === 'all' ? (
          <>
            {/* Controls Section */}
            <div className="mb-8 bg-white rounded-lg shadow p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="all">All Stock</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low-stock">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="price-low">Price: Low to High</option>
                  </select>

                  {/* View Toggle */}
                  <div className="flex rounded-lg border">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-4 py-2 ${viewMode === 'grid' ? 'bg-green-50 text-green-600' : 'text-gray-600'}`}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-4 py-2 ${viewMode === 'list' ? 'bg-green-50 text-green-600' : 'text-gray-600'}`}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Display */}
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {getFilteredProducts(getSortedProducts(products)).map((product) => (
                <div key={product.id} className={`bg-white rounded-lg shadow-sm overflow-hidden${viewMode === 'list' ? ' flex' : ''}`}>
                  {/* Product Image */}
                  <div className={viewMode === 'list' ? 'w-48 h-48 flex-shrink-0 relative' : 'relative h-48'}>
                    {product.product_images && product.product_images.length > 0 ? (
                      <div className="w-full h-full">
                        {viewMode === 'list' ? (
                          <Image
                            src={formatImageUrl(product.product_images[0].image_url)}
                            alt={product.title}
                            width={192}
                            height={192}
                            className="object-cover rounded-l-lg"
                          />
                        ) : (
                        <Image
                          src={formatImageUrl(product.product_images[0].image_url)}
                          alt={product.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400">No image</span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-1">{product.title}</h3>
                        <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ml-3 ${
                        product.quantity > 10 ? 'bg-green-100 text-green-800' :
                        product.quantity > 0 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {product.quantity > 10 ? 'In Stock' :
                         product.quantity > 0 ? 'Low Stock' :
                         'Out of Stock'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                      <span className="text-xl font-medium text-green-600">
                        {formatCurrency(product.price)}
                      </span>
                        <span className="text-sm text-gray-500">
                          Quantity: {product.quantity}
                        </span>
                        {product.category && (
                          <span className="text-sm text-gray-500">
                            Category: {product.category}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/products/edit/${product.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : activeTab === 'categories' ? (
        <div className="space-y-8">
            {Object.entries(categoryGroups).map(([category, products]) => (
              <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
                    <p className="text-sm text-gray-500">{products.length} products</p>
                  </div>
                  <Link
                    href="/dashboard/products/new"
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    Add to {category}
                  </Link>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                      <div key={product.id} className="group relative bg-white border rounded-lg flex flex-col overflow-hidden hover:shadow-lg transition-shadow duration-200">
                        {/* Product Image */}
                        <div className="relative h-48">
                          {product.product_images && product.product_images.length > 0 ? (
                            <div className="w-full h-full">
                              <Image
                                src={formatImageUrl(cleanImageUrl(product.product_images[0].image_url))}
                                alt={product.title}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-400">No image</span>
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 p-3 space-y-2 flex flex-col">
                          <h3 className="text-sm font-medium text-gray-900">
                            <Link href={`/dashboard/products/edit/${product.id}`}>
                              <span aria-hidden="true" className="absolute inset-0" />
                              {product.title}
                            </Link>
                          </h3>

                          <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>

                          <div className="flex-1 flex flex-col justify-end">
                            <div className="flex items-center justify-between">
                              <p className="text-base font-medium text-gray-900">
                                {formatCurrency(product.price)}
                              </p>
                              <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                                product.quantity > 10 ? 'bg-green-100 text-green-800' :
                                product.quantity > 0 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {product.quantity} in stock
                              </div>
                            </div>

                            {/* Product Attributes */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {product.sizes?.map((size) => (
                                <span key={size} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {size}
                                </span>
                              ))}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {product.colors?.map((color) => (
                                <span key={color} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {color}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Out of Stock View */
          <div className="space-y-6">
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    You have {getOutOfStockProducts().length} products that need restocking.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Out of Stock Products</h2>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getOutOfStockProducts().map((product) => (
                    <div key={product.id} className="group relative bg-white border rounded-lg flex flex-col overflow-hidden hover:shadow-lg transition-shadow duration-200">
                      {/* Product Image */}
                      <div className="relative h-48">
                        {product.product_images && product.product_images.length > 0 ? (
                          <div className="w-full h-full">
                          <Image
                              src={formatImageUrl(cleanImageUrl(product.product_images[0].image_url))}
                            alt={product.title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                              <span className="text-white text-lg font-bold">Out of Stock</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-400">No image</span>
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 p-3 space-y-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          <Link href={`/dashboard/products/edit/${product.id}`}>
                            {product.title}
                          </Link>
                        </h3>
                        <p className="text-sm text-gray-500">{product.description}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium text-gray-900">
                            {formatCurrency(product.price)}
                          </span>
                          <Link
                            href={`/dashboard/products/edit/${product.id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                          >
                            Restock
                          </Link>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Category: {product.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </div>
        )}

        {/* Add this debug section to your JSX */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700">Storage Debug Info</h4>
            <p className="text-sm text-gray-600">Total Images: {usageStats.totalImages}</p>
            <div className="mt-2 max-h-40 overflow-auto">
              {usageStats.imageDetails.map((detail, index) => (
                <div key={index} className="text-xs text-gray-500 mb-1">
                  <span className="font-medium">{detail.product}</span>: {detail.estimated_size}
                  <br />
                  <span className="text-gray-400">{detail.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withSellerVerification(ProductsPage); 