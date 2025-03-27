'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Image from 'next/image';
import { formatCurrency } from '@/utils/currency';
import Link from 'next/link';
import { CreditCardIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { classNames } from '@/utils/classNames';
import { useUserDetails } from '@/hooks/useUserDetails';
import SellerVerificationForm from '@/components/SellerVerificationForm';
import { withSellerVerification } from '@/components/withSellerVerification';

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

interface VerificationStatus {
  status: 'pending' | 'approved' | 'rejected';
  is_verified: boolean;
}

export default withSellerVerification(function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { userDetails } = useUserDetails();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponent();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      try {
        setLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }

        // Check verification status
        const { data: userData } = await supabase
          .from('users')
          .select('is_verified, verification_status')
          .eq('id', session.user.id)
          .single();

        if (userData?.verification_status === 'rejected') {
          router.push('/dashboard/verification-rejected');
          return;
        }

        // Now TypeScript knows about both fields
        if (!userData?.is_verified) {
          const { data: verificationData } = await supabase
            .from('seller_verification')
            .select('status')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // If no verification exists or status is rejected, redirect to verification form
          if (!verificationData || verificationData.status === 'rejected') {
            router.push('/dashboard/verify');
            return;
          }

          // If verification is pending, show pending page
          if (verificationData.status === 'pending') {
            router.push('/dashboard/verification-pending');
            return;
          }
        }
        // If verified, fetch dashboard data
        if (userData?.is_verified) {
          await fetchDashboardData(session.user.id);
        }

      } catch (error) {
        console.error('Error:', error);
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

  const SupportSection = () => {
    return (
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <QuestionMarkCircleIcon className="h-8 w-8 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">Need Help?</h3>
            <p className="mt-1 text-sm text-gray-500">
              Having issues or questions? Our support team is here to help you.
            </p>
            <div className="mt-4">
              <Link
                href="/support"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
              >
                Get Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Section with Quick Stats */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between text-white">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold sm:text-3xl">
                Welcome back, {userDetails?.full_name || 'Store Owner'}
              </h1>
              <p className="mt-1 text-red-100">
                Here's what's happening with your store today
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
              <Link
                href="/dashboard/products/new"
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white text-red-600 hover:bg-red-50 transition-all"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add New Product
              </Link>
            </div>
          </div>
          
          {/* Quick Stats Cards - Mobile responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-lg bg-white/20">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-100">Total Products</p>
                  <p className="text-2xl font-bold text-white">{stats.totalProducts}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-lg bg-white/20">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-100">Active Products</p>
                  <p className="text-2xl font-bold text-white">{stats.activeProducts}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-lg bg-white/20">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-100">Total Sales</p>
                  <p className="text-2xl font-bold text-white">{stats.totalSales}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-lg bg-white/20">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-100">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.monthlyRevenue.toLocaleString('en-ET', {
                      style: 'currency',
                      currency: 'ETB',
                      minimumFractionDigits: 2
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid - Mobile responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Recent Orders Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
                <Link href="/dashboard/orders" className="text-sm font-medium text-red-600 hover:text-red-500">
                  View all
                </Link>
              </div>
              
              {/* Orders List */}
              <div className="space-y-4">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center p-4 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {order.product?.title || 'Unknown Product'}
                      </p>
                      <p className="text-sm text-gray-500">
                        by {order.user?.full_name || 'Unknown Customer'}
                      </p>
                    </div>
                    <div className="ml-4">
                      <span className={classNames(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        {
                          'bg-green-100 text-green-800': order.order_status === 'delivered',
                          'bg-red-100 text-red-800': order.order_status === 'cancelled',
                          'bg-yellow-100 text-yellow-800': !['delivered', 'cancelled'].includes(order.order_status)
                        }
                      )}>
                        {order.order_status}
                      </span>
                    </div>
                    <div className="ml-4 text-sm font-medium text-gray-900">
                      {order.total_price.toLocaleString('en-ET', {
                        style: 'currency',
                        currency: 'ETB',
                        minimumFractionDigits: 2
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Products Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Top Products</h2>
                <Link href="/dashboard/products" className="text-sm font-medium text-red-600 hover:text-red-500">
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
                            <p className="text-sm font-medium text-red-600">
                              {product.price.toLocaleString('en-ET', {
                                style: 'currency',
                                currency: 'ETB',
                                minimumFractionDigits: 2
                              })}
                            </p>
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
                  No products available. <Link href="/dashboard/products/new" className="text-red-600 hover:text-red-500">Add your first product</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant Section - Mobile responsive */}
        <div className="mt-6 sm:mt-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-4 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="ml-6">
              <h3 className="text-xl font-semibold">AI Business Assistant</h3>
              <p className="mt-2 text-gray-300">
                Leverage our AI tools to optimize your business operations and boost sales performance.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <button className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 transition-colors">
                  Generate Descriptions
                </button>
                <button className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-colors">
                  Optimize Pricing
                </button>
                <button className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 transition-colors">
                  Market Analysis
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Support Section - Mobile responsive */}
        <div className="mt-6 sm:mt-8">
          <SupportSection />
        </div>
      </div>
    </div>
  );
}); 
