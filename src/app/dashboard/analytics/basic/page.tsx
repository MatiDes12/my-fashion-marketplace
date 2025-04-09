 'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { formatCurrency } from '@/utils/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface AnalyticsData {
  revenueByMonth: {
    labels: string[];
    data: number[];
  };
  ordersByStatus: {
    labels: string[];
    data: number[];
    backgroundColor: string[];
  };
  paymentMethods: {
    labels: string[];
    data: number[];
  };
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    pendingPayouts: number;
  };
  recentTransactions: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    payment_status: string;
    customer_name: string;
  }>;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('30days'); // '7days', '30days', '90days', 'year'
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login?message=Please login to access analytics');
        return;
      }

      // Get date range
      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case '7days':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(now.getDate() - 90);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // First get all products owned by the seller
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('owner_id', session.user.id);

      const productIds = products?.map(p => p.id) || [];

      // Fetch orders for these products
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .in('product_id', productIds)
        .gte('created_at', startDate.toISOString());

      // Fetch revenue data
      const { data: revenueData } = await supabase
        .from('transactions')
        .select(`
          id,
          created_at,
          total_amount,
          seller_payout_amount,
          seller_payout_status,
          payment_status,
          customer_name
        `)
        .eq('seller_id', session.user.id)
        .gte('created_at', startDate.toISOString());

      // Fetch payment methods distribution
      const { data: paymentsData } = await supabase
        .from('transactions')
        .select('payment_method')
        .eq('seller_id', session.user.id)
        .gte('created_at', startDate.toISOString());

      // Process data for charts
      const processedData = processAnalyticsData(revenueData, ordersData, paymentsData);
      setAnalyticsData(processedData);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };
  
  const processAnalyticsData = (revenueData: any[] | null, ordersData: any[] | null, paymentsData: any[] | null) => {
    // Initialize data structures
    const revenueByMonth: { labels: string[]; data: number[] } = {
      labels: [],
      data: []
    };

    // Process revenue by month
    if (revenueData && revenueData.length > 0) {
      const monthlyRevenue = revenueData.reduce((acc: { [key: string]: number }, item) => {
        const date = new Date(item.created_at);
        const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        acc[monthYear] = (acc[monthYear] || 0) + (item.seller_payout_amount || 0);
        return acc;
      }, {});

      revenueByMonth.labels = Object.keys(monthlyRevenue);
      revenueByMonth.data = Object.values(monthlyRevenue);
    }

    // Process orders by status - match exactly with database schema
    const ordersByStatus = {
      labels: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
      data: Array(5).fill(0) // Initialize array with zeros
    };

    const statusMap = {
      'pending': 0,
      'confirmed': 1,
      'shipped': 2,
      'delivered': 3,
      'cancelled': 4
    };

    if (ordersData && ordersData.length > 0) {
      ordersData.forEach(order => {
        const statusIndex = statusMap[order.order_status as keyof typeof statusMap];
        if (typeof statusIndex === 'number') {
          ordersByStatus.data[statusIndex]++;
        }
      });
    }

    // Update the Bar chart colors to match status meanings
    const statusColors = [
      'rgba(251, 191, 36, 0.5)',  // amber-400 for pending
      'rgba(59, 130, 246, 0.5)',  // blue-500 for confirmed
      'rgba(139, 92, 246, 0.5)',  // purple-500 for shipped
      'rgba(34, 197, 94, 0.5)',   // green-500 for delivered
      'rgba(239, 68, 68, 0.5)',   // red-500 for cancelled
    ];

    // Process payment methods
    const paymentMethodsMap = new Map<string, number>();
    if (paymentsData && paymentsData.length > 0) {
      paymentsData.forEach(payment => {
        const method = payment.payment_method || 'Unknown';
        paymentMethodsMap.set(method, (paymentMethodsMap.get(method) || 0) + 1);
      });
    }

    const paymentMethods = {
      labels: Array.from(paymentMethodsMap.keys()),
      data: Array.from(paymentMethodsMap.values())
    };

    // Calculate summary metrics
    const summary = {
      totalOrders: ordersData?.length || 0,
      totalRevenue: revenueData?.reduce((sum, item) => {
        return sum + (item.seller_payout_amount || 0);
      }, 0) || 0,
      averageOrderValue: revenueData?.length ? 
        (revenueData.reduce((sum, item) => sum + (item.seller_payout_amount || 0), 0) / revenueData.length) : 0,
      pendingPayouts: revenueData?.reduce((sum, item) => {
        if (item.seller_payout_status === 'pending') {
          return sum + (item.seller_payout_amount || 0);
        }
        return sum;
      }, 0) || 0
    };

    // Get recent transactions
    const recentTransactions = (revenueData || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(transaction => ({
        id: transaction.id,
        created_at: transaction.created_at,
        total_amount: transaction.total_amount || 0,
        payment_status: transaction.payment_status || 'pending',
        customer_name: transaction.customer_name || 'Anonymous'
      }));

    return {
      revenueByMonth,
      ordersByStatus: {
        ...ordersByStatus,
        backgroundColor: statusColors
      },
      paymentMethods,
      summary,
      recentTransactions
    };
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Basic Analytics</h1>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Orders */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                    <dd className="text-lg font-semibold text-gray-900">{analyticsData?.summary.totalOrders}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(analyticsData?.summary.totalRevenue || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Average Order Value</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(analyticsData?.summary.averageOrderValue || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Payouts */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Payouts</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(analyticsData?.summary.pendingPayouts || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Revenue Chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900">Revenue Over Time</h3>
            <div className="mt-6" style={{ height: '300px' }}>
              <Line
                data={{
                  labels: analyticsData?.revenueByMonth.labels || [],
                  datasets: [
                    {
                      label: 'Revenue',
                      data: analyticsData?.revenueByMonth.data || [],
                      borderColor: 'rgb(75, 192, 192)',
                      tension: 0.1
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </div>
          </div>

          {/* Orders by Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900">Orders by Status</h3>
            <div className="mt-6" style={{ height: '300px' }}>
              <Bar
                data={{
                  labels: analyticsData?.ordersByStatus.labels || [],
                  datasets: [
                    {
                      label: 'Orders',
                      data: analyticsData?.ordersByStatus.data || [],
                      backgroundColor: analyticsData?.ordersByStatus.backgroundColor || [],
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        stepSize: 1
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 