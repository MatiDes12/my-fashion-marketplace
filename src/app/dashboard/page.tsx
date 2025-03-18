'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Image from 'next/image';
import { formatCurrency } from '@/utils/currency';
import Link from 'next/link';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import { classNames } from '@/utils/classNames';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  is_active: boolean;
  created_at: string;
  owner_id: string;
  product_images: ProductImage[];
  orders?: Order[];
  total_sales?: number;
}

interface Order {
  id: string;
  created_at: string;
  quantity: number;
  total_price: number;
  order_status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  user_id: string;
  product_id: string;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  product?: {
    title: string;
    price: number;
  };
}

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalSales: number;
  monthlyRevenue: number;
  recentOrders: Order[];
  topProducts: Product[];
}

type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  is_model_picture: boolean;
};

interface ProductWithRelations extends Product {
  orders: (Order & {
    user: {
      id: string;
      full_name: string;
      email: string;
    };
  })[];
  product_images: ProductImage[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      try {
        setLoading(true);
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }
        
        // Check role directly from database
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          setError('Failed to verify user role');
          return;
        }
        
        if (data?.role !== 'owner') {
          router.push('/');
          return;
        }
        
        // If we have a valid session and correct role, fetch data
        await fetchDashboardData(session.user.id);
      } catch (error) {
        setError('Failed to verify access permissions');
      } finally {
        setLoading(false);
      }
    };
    
    checkAccessAndLoadData();
  }, [router]);

  async function fetchDashboardData(ownerId: string) {
    try {
      // Fetch products with their orders and images
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_images (*),
          orders (
            id,
            quantity,
            total_price,
            order_status,
            created_at,
            user_id,
            user:users (
              id,
              full_name,
              email
            )
          )
        `)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .returns<ProductWithRelations[]>();

      console.log('Fetched products:', products); // Debug log

      if (productsError) throw productsError;

      // Transform the data to include product info in orders
      const allOrders: Order[] = products.flatMap(product => 
        product.orders?.map((order: Order) => ({
          ...order,
          product: {  // Add product info to each order
            title: product.title,
            price: product.price
          }
        })) || []
      );

      // Sort orders by created_at date
      const recentOrders = allOrders
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      // Calculate product sales and get top products
      const productSales = products
        .map(product => ({
          ...product,
          total_sales: product.orders?.length || 0
        }))
        .sort((a, b) => (b.total_sales - a.total_sales))
        .slice(0, 4);

      console.log('Top products with images:', productSales); // Debug log

      // Calculate stats
      const activeProducts = products.filter(p => p.is_active).length;
      const totalSales = allOrders.length;
      const monthlyRevenue = allOrders
        .filter(order => {
          const orderDate = new Date(order.created_at);
          const now = new Date();
          return orderDate.getMonth() === now.getMonth() &&
                 orderDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, order) => sum + order.total_price, 0);

      setStats({
        totalProducts: products.length,
        activeProducts,
        totalSales,
        monthlyRevenue,
        recentOrders,  // These orders now include product info
        topProducts: productSales
      });

    } catch (error) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data error:', error);
    }
  }

  // Show loading state while checking auth or loading data
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Show error state if something went wrong
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  // Show loading state while fetching stats
  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Add this helper function at the top of your component
  const cleanImageUrl = (url: string | undefined): string => {
    if (!url) return '';
    // Remove @ symbol if it exists at the beginning of the URL
    return url.startsWith('@') ? url.substring(1) : url;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Remove duplicate padding-top since it's handled by layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Business Dashboard Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Business Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your products, orders, and business performance
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
              <Link
                href="/dashboard/products/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add New Product
              </Link>
              <Link
                href="/dashboard/orders"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Manage Orders
              </Link>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Store Settings
              </Link>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'overview' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-green-100 text-green-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Products</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.totalProducts}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Active Products</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.activeProducts}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Sales</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.totalSales}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Monthly Revenue</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(stats.monthlyRevenue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Orders */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-gray-900">Recent Orders</h2>
                      <Link href="/dashboard/orders" className="text-sm font-medium text-green-600 hover:text-green-500">
                        View all
                      </Link>
                    </div>
                    <div className="mt-6 flow-root">
                      <ul className="-my-5 divide-y divide-gray-200">
                        {stats.recentOrders.map((order) => (
                          <li key={order.id} className="py-5">
                            <div className="flex items-center space-x-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {order.product?.title || 'Unknown Product'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  by {order.user?.full_name || 'Unknown Customer'}
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  order.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                                  order.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {order.order_status}
                                </span>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-900">
                                  {formatCurrency(order.total_price)}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Top Products */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-gray-900">Top Products</h2>
                      <Link href="/dashboard/products" className="text-sm font-medium text-green-600 hover:text-green-500">
                        Manage products
                      </Link>
                    </div>
                    
                    {stats.topProducts.length > 0 ? (
                      <div className="mt-6">
                        <ul className="divide-y divide-gray-200">
                          {stats.topProducts.map((product) => (
                            <li key={product.id} className="py-4 flex items-center">
                              <div className="flex-shrink-0 h-12 w-12 relative">
                                {product.product_images && product.product_images.length > 0 ? (
                                  <div>
                                    <Image
                                      src={cleanImageUrl(product.product_images[0].image_url)}
                                      alt={product.title}
                                      fill
                                      className="object-cover rounded-lg"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                    <span className="text-gray-400">No image</span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-4 flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-gray-900">{product.title}</p>
                                  <p className="text-sm font-medium text-green-600">{formatCurrency(product.price)}</p>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <span className="mr-2">{product.orders?.length || 0} sales</span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    {product.category || 'Uncategorized'}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-2">
                                <Link 
                                  href={`/dashboard/products/edit/${product.id}`}
                                  className="text-sm text-indigo-600 hover:text-indigo-900"
                                >
                                  Edit
                                </Link>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-6 text-center py-4 text-sm text-gray-500">
                        No products available. <Link href="/dashboard/products/new" className="text-green-600 hover:text-green-500">Add your first product</Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* AI Assistant Section */}
              <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">AI Business Assistant</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Use our AI tools to optimize your business operations and increase sales.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                        Generate Product Descriptions
                      </button>
                      <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Optimize Pricing
                      </button>
                      <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Market Analysis
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'products' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Your Products</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Manage your product inventory</p>
                </div>
                <Link
                  href="/dashboard/products/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  Add New Product
                </Link>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                <div className="py-5 sm:px-6">
                  <p className="text-center text-gray-500">Product management interface will be displayed here</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'orders' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Order Management</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Track and manage your customer orders</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                <div className="py-5 sm:px-6">
                  <p className="text-center text-gray-500">Order management interface will be displayed here</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'analytics' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Business Analytics</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Insights and performance metrics for your business</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                <div className="py-5 sm:px-6">
                  <p className="text-center text-gray-500">Analytics dashboard will be displayed here</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'marketing' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Marketing Tools</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Promote your products and grow your business</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                <div className="py-5 sm:px-6">
                  <p className="text-center text-gray-500">Marketing tools will be displayed here</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
} 
