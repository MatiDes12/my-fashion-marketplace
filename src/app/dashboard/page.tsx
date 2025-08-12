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
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

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
  order_status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'picked up';
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  product: {
    id: string;
    title: string;
    price: number;
    owner_id: string;
  };
}

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalSales: number;
  monthlyRevenue: number;
  recentOrders: Order[];
  topProducts: Product[];
  totalRevenue?: number;
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

interface SubscriptionLimits {
  productLimit: number;
  storageLimit: number;
  aiCredits: number;
  analyticsAccess: 'standard' | 'detailed' | 'advanced';
  flashSalesLimit: {
    monthly: number;  // -1 for unlimited
    isEnabled: boolean;
  };
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

const PLAN_LIMITS: { [key: string]: SubscriptionLimits } = {
  basic: {
    productLimit: 20,
    storageLimit: 5,
    aiCredits: 0,
    analyticsAccess: 'standard',
    flashSalesLimit: {
      monthly: 0,
      isEnabled: false
    }
  },
  pro: {
    productLimit: 75,
    storageLimit: 15,
    aiCredits: 100,
    analyticsAccess: 'detailed',
    flashSalesLimit: {
      monthly: 5,
      isEnabled: true
    }
  },
  enterprise: {
    productLimit: Infinity,
    storageLimit: Infinity,
    aiCredits: 500,
    analyticsAccess: 'advanced',
    flashSalesLimit: {
      monthly: -1,
      isEnabled: true
    }
  }
};

export default withSellerVerification(function DashboardPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { userDetails } = useUserDetails();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponent();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('basic');
  const [hasPaymentSettings, setHasPaymentSettings] = useState(false);
  const [usageStats, setUsageStats] = useState({
    totalProducts: 0,
    storageUsed: 0,
    totalImages: 0,
    imageDetails: [],
    flashSalesUsed: 0
  });
  const [recentTickets, setRecentTickets] = useState<SupportTicket[]>([]);

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

        // Check payment settings
        const { data: settings, error: settingsError } = await supabase
          .from('payment_settings')
          .select('telebirr_settings, chapa_settings, bank_settings, cbe_birr_settings, amole_settings, mpesa_settings')
          .eq('user_id', session.user.id)
          .single();

        if (settingsError) {
          console.error('Error checking payment settings:', settingsError);
        } else {
          const hasSettings = settings?.telebirr_settings?.is_active || 
                             settings?.chapa_settings?.is_active || 
                             settings?.bank_settings?.is_active || 
                             settings?.cbe_birr_settings?.is_active || 
                             settings?.amole_settings?.is_active || 
                             settings?.mpesa_settings?.is_active || 
                             false;
          setHasPaymentSettings(hasSettings);

          if (!hasSettings) {
            toast.error(
              <div>
                <p>{t('dashboard.banner.paymentsRequired')}</p>
                <Link 
                  href="/dashboard/payment-settings" 
                  className="text-green-600 hover:text-green-500 mt-2 block"
                >
                  {t('dashboard.actions.setupPayments')}
                </Link>
              </div>,
              { duration: 5000 }
            );
          }
        }

        // If verified, fetch dashboard data
        if (userData?.is_verified) {
          await Promise.all([
            fetchDashboardStats(),
            fetchRecentTickets()
          ]);
        }

      } catch (error) {
        console.error('Error:', error);
        setError(t('dashboard.error.verifyPermissions'));
      } finally {
        setLoading(false);
      }
    };
    
    checkAccessAndLoadData();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No session');
      }

      // First get the original product and order data
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          title,
          price,
          category,
          is_active,
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          orders!inner (
            id,
            created_at,
            quantity,
            total_price,
            order_status,
            user:users!orders_user_id_fkey (
              id,
              full_name,
              email
            )
          )
        `)
        .eq('owner_id', session.user.id);

      if (productsError) throw productsError;

      // Get transactions for actual revenue calculation
      const { data: transactions } = await supabase
        .from('transactions')
        .select('seller_payout_amount')
        .eq('seller_id', session.user.id);

      // Calculate actual revenue from seller payouts
      const actualRevenue = transactions?.reduce((sum, t) => 
        sum + (t.seller_payout_amount || 0), 0) || 0;

      // Get recent orders for current owner's products
      const { data: recentOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          quantity,
          total_price,
          order_status,
          user:users!orders_user_id_fkey (
            id,
            full_name,
            email
          ),
          product:products!inner (
            id,
            title,
            price,
            owner_id
          )
        `)
        .eq('product.owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      // Calculate total sales from orders
      const totalSales = products?.reduce((sum, product) => {
        return sum + (product.orders?.length || 0);
      }, 0) || 0;

      // Calculate monthly revenue
      const monthlyRevenue = products?.reduce((sum, product) => {
        return sum + product.orders.reduce((orderSum, order) => {
          return orderSum + (order.total_price || 0);
        }, 0);
      }, 0) || 0;

      // Process products to include sales count
      const topProducts = products
        ?.map(product => ({
          ...product,
          total_sales: product.orders?.length || 0
        }))
        .sort((a, b) => (b.total_sales - a.total_sales))
        .slice(0, 5) || [];

      setStats({
        totalProducts: products?.length || 0,
        activeProducts: products?.filter(p => p.is_active)?.length || 0,
        totalSales,
        monthlyRevenue,
        recentOrders: (recentOrders || []) as unknown as Order[],
        topProducts: topProducts as unknown as Product[],
        totalRevenue: actualRevenue
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError(t('dashboard.error.verifyPermissions'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentTickets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: tickets, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentTickets(tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  useEffect(() => {
    const fetchUserPlanAndUsage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get user's plan
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('subscription_plan')
          .eq('id', session.user.id)
          .single();

        if (userError) throw userError;
        setCurrentPlan(userData.subscription_plan || 'basic');

        // Get storage stats
        const { data: storageData, error: storageError } = await supabase
          .rpc('calculate_user_storage_usage', { user_id: session.user.id });

        if (storageError) throw storageError;

        // Get flash sales usage for current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: flashSales, error: flashSalesError } = await supabase
          .from('flash_sales')
          .select('id')
          .eq('created_by', session.user.id)
          .gte('created_at', startOfMonth.toISOString());

        if (flashSalesError) throw flashSalesError;

        if (storageData && storageData.length > 0) {
          setUsageStats({
            totalProducts: stats?.totalProducts || 0,
            storageUsed: Number(storageData[0].total_size_mb),
            totalImages: storageData[0].total_images,
            imageDetails: storageData[0].image_details || [],
            flashSalesUsed: flashSales?.length || 0
          });
        }

      } catch (error) {
        console.error('Error fetching usage stats:', error);
        toast.error('Failed to load subscription information');
      }
    };

    fetchUserPlanAndUsage();
  }, [stats?.totalProducts]);

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
            <h3 className="text-lg font-medium text-gray-900">{t('dashboard.support.helpTitle')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('dashboard.support.helpSubtitle')}</p>
            <div className="mt-4">
              <Link
                href="/support"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
              >
                {t('dashboard.support.getSupport')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const currentLimits = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Subscription Plan Stats */}
        <div className="mb-8 bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Plan Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  currentPlan === 'enterprise' 
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-300' 
                    : currentPlan === 'pro'
                      ? 'bg-gradient-to-r from-gray-300 to-gray-100'
                      : 'bg-gradient-to-r from-amber-700 to-amber-600'
                }`}>
                  {currentPlan === 'enterprise' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-900" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3v1a1 1 0 102 0v-1a5 5 0 00-5-5H8.414l1.293-1.293z" clipRule="evenodd" />
                    </svg>
                  ) : currentPlan === 'pro' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-200" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-200">{t('dashboard.plan.current')}</h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-xl font-bold text-white capitalize">{currentPlan}</p>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      currentPlan === 'enterprise' 
                        ? 'bg-yellow-400 text-yellow-900' 
                        : currentPlan === 'pro'
                          ? 'bg-gray-200 text-gray-800'
                          : 'bg-amber-600 text-amber-100'
                    }`}>
                      {currentPlan === 'enterprise' ? t('dashboard.plan.gold') : currentPlan === 'pro' ? t('dashboard.plan.silver') : t('dashboard.plan.bronze')}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href="/dashboard/subscription"
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                {t('dashboard.plan.upgrade')}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Usage Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">{t('dashboard.stats.productsUsed')}</h3>
                <span className="text-xs text-gray-400">
                  {Math.round((usageStats.totalProducts / (currentLimits.productLimit === Infinity ? usageStats.totalProducts + 5 : currentLimits.productLimit)) * 100)}{t('dashboard.stats.usedSuffix')}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {usageStats.totalProducts} <span className="text-gray-400 text-lg font-normal">/ {currentLimits.productLimit === Infinity ? '∞' : currentLimits.productLimit}</span>
              </p>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${(usageStats.totalProducts / (currentLimits.productLimit === Infinity ? usageStats.totalProducts + 5 : currentLimits.productLimit)) * 100}%` 
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">{t('dashboard.stats.storageUsed')}</h3>
                <span className="text-xs text-gray-400">
                  {Math.round((usageStats.storageUsed / (currentLimits.storageLimit === Infinity ? usageStats.storageUsed + 5 : currentLimits.storageLimit * 1024)) * 100)}{t('dashboard.stats.usedSuffix')}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {usageStats.storageUsed.toFixed(1)} <span className="text-gray-400 text-lg font-normal">/ {currentLimits.storageLimit === Infinity ? '∞' : `${currentLimits.storageLimit * 1024}`} MB</span>
              </p>
              <div className="space-y-1">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
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
                <p className="text-xs text-gray-500">{usageStats.totalImages} {t('dashboard.stats.imagesUploaded')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">{t('dashboard.stats.flashSales')}</h3>
                {currentLimits.flashSalesLimit.isEnabled && currentLimits.flashSalesLimit.monthly !== -1 && (
                  <span className="text-xs text-gray-400">
                    {Math.round((usageStats.flashSalesUsed / currentLimits.flashSalesLimit.monthly) * 100)}{t('dashboard.stats.usedSuffix')}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {usageStats.flashSalesUsed} <span className="text-gray-400 text-lg font-normal">/ {currentLimits.flashSalesLimit.monthly === -1 ? '∞' : currentLimits.flashSalesLimit.monthly}</span>
              </p>
              <div className="space-y-1">
                {currentLimits.flashSalesLimit.isEnabled && currentLimits.flashSalesLimit.monthly !== -1 ? (
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        usageStats.flashSalesUsed >= currentLimits.flashSalesLimit.monthly
                          ? 'bg-red-600' 
                          : usageStats.flashSalesUsed >= currentLimits.flashSalesLimit.monthly * 0.8 
                            ? 'bg-yellow-600' 
                            : 'bg-indigo-600'
                      }`}
                      style={{ 
                        width: `${Math.min((usageStats.flashSalesUsed / currentLimits.flashSalesLimit.monthly) * 100, 100)}%` 
                      }}
                    />
                  </div>
                ) : (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    currentLimits.flashSalesLimit.monthly === -1
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {currentLimits.flashSalesLimit.monthly === -1 ? t('dashboard.stats.unlimited') : t('dashboard.stats.notAvailable')}
                  </span>
                )}
                <p className="text-xs text-gray-500">{t('dashboard.stats.thisMonth')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Welcome Section with Quick Stats */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between text-white">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold sm:text-3xl">{t('dashboard.welcome.greeting')} {userDetails?.full_name || 'Store Owner'}</h1>
              <p className="mt-1 text-red-100">{t('dashboard.welcome.subtitle')}</p>
            </div>
            <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
              {hasPaymentSettings ? (
              <Link
                href="/dashboard/products/new"
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white text-red-600 hover:bg-red-50 transition-all"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                {t('dashboard.actions.addProduct')}
              </Link>
              ) : (
                <Link
                  href="/dashboard/payment-settings"
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-all"
                >
                  <CreditCardIcon className="-ml-1 mr-2 h-5 w-5" />
                  {t('dashboard.actions.setupPayments')}
                </Link>
              )}
            </div>
          </div>
          
          {!hasPaymentSettings && (
            <div className="mt-4 bg-yellow-50/10 backdrop-blur-sm border border-yellow-200/20 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-200" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-200">
                    {t('dashboard.banner.paymentsRequired')}
                    <Link 
                      href="/dashboard/payment-settings"
                      className="font-medium text-yellow-100 underline ml-2"
                    >
                      {t('dashboard.banner.setupNow')}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}
          
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
                  <p className="text-sm text-red-100">{t('dashboard.cards.totalProducts')}</p>
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
                  <p className="text-sm text-red-100">{t('dashboard.cards.activeProducts')}</p>
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
                  <p className="text-sm text-red-100">{t('dashboard.cards.totalSales')}</p>
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
                  <p className="text-sm text-red-100">{t('dashboard.cards.totalRevenue')}</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(stats.totalRevenue || 0)}
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
                <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.recentOrders.title')}</h2>
                <Link href="/dashboard/orders" className="text-sm font-medium text-red-600 hover:text-red-500">
                  {t('dashboard.recentOrders.viewAll')}
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
                        {t('dashboard.recentOrders.by')} {order.user?.full_name || 'Unknown Customer'}
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
                      {formatCurrency(order.total_price)}
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
                <h2 className="text-lg font-medium text-gray-900">{t('dashboard.topProducts.title')}</h2>
                <Link href="/dashboard/products" className="text-sm font-medium text-red-600 hover:text-red-500">
                  {t('dashboard.topProducts.manage')}
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
                              {formatCurrency(product.price)}
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
                  {t('dashboard.topProducts.noProducts')} {hasPaymentSettings ? (
                    <Link href="/dashboard/products/new" className="text-red-600 hover:text-red-500">
                      {t('dashboard.topProducts.addFirst')}
                    </Link>
                  ) : (
                    <Link href="/dashboard/payment-settings" className="text-yellow-600 hover:text-yellow-500">
                      {t('dashboard.topProducts.setupPaymentsFirst')}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant Section - Mobile responsive */}
        <div className="mt-6 sm:mt-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-4 sm:p-8 text-white relative overflow-hidden">
          {/* Blur overlay */}
          <div className="absolute inset-0 backdrop-blur-[2px] bg-black/20 z-10" />
          
          {/* Coming soon badge */}
          <div className="absolute top-4 right-4 z-20">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-200 border border-red-500/30">
              {t('dashboard.ai.comingSoon')}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 relative z-[5] opacity-75">
            <div className="flex-shrink-0">
              <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="ml-6">
              <h3 className="text-xl font-semibold">{t('dashboard.ai.title')}</h3>
              <p className="mt-2 text-gray-300">{t('dashboard.ai.subtitle')}</p>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <button disabled className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium bg-red-600/50 cursor-not-allowed">{t('dashboard.ai.generateDescriptions')}</button>
                <button disabled className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium bg-blue-600/50 cursor-not-allowed">{t('dashboard.ai.optimizePricing')}</button>
                <button disabled className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium bg-purple-600/50 cursor-not-allowed">{t('dashboard.ai.marketAnalysis')}</button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Support Tickets */}
        <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">{t('dashboard.support.recentTickets')}</h3>
              <Link
                href="/support"
                className="text-sm font-medium text-red-600 hover:text-red-500"
              >
                {t('dashboard.support.viewAllTickets')}
              </Link>
            </div>
          </div>
          <div className="px-6 py-4">
            {recentTickets.length > 0 ? (
              <div className="space-y-4">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">{ticket.subject}</h4>
                      <span className={classNames(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        {
                          'bg-yellow-100 text-yellow-800': ticket.status === 'open',
                          'bg-blue-100 text-blue-800': ticket.status === 'in_progress',
                          'bg-green-100 text-green-800': ticket.status === 'resolved',
                          'bg-gray-100 text-gray-800': ticket.status === 'closed',
                        }
                      )}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{ticket.message}</p>
                    {ticket.admin_response && (
                      <div className="mt-3 bg-gray-50 rounded p-3">
                        <p className="text-sm font-medium text-gray-900">Admin Response:</p>
                        <p className="mt-1 text-sm text-gray-600">{ticket.admin_response}</p>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                {t('dashboard.support.noTickets')}{' '}
                <Link href="/support" className="text-red-600 hover:text-red-500">
                  {t('dashboard.support.createOne')}
                </Link>
              </p>
            )}
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
