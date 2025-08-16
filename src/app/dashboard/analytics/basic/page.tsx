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
  payoutAnalytics: {
    payoutTimeline: {
      labels: string[];
      data: number[];
    };
    payoutEfficiency: {
      totalEligible: number;
      totalPaid: number;
      averagePayoutTime: number;
      payoutRate: number;
    };
    payoutStatusDistribution: {
      labels: string[];
      data: number[];
      backgroundColor: string[];
    };
  };
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    pendingPayouts: number;
    completedPayouts: number;
    totalMoneyReceived: number;
    payoutEfficiency: number;
  };
  recentTransactions: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    payment_status: string;
    customer_name: string;
    seller_payout_status?: string;
    seller_payout_amount?: number;
  }>;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('all'); // '7days', '30days', '90days', 'year', 'all'
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
        case 'all':
        default:
          startDate = new Date(0); // Start from epoch (Jan 1, 1970) to get all data
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
          customer_name,
          order_id
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

    // Process payout timeline
    const payoutTimeline: { labels: string[]; data: number[] } = {
      labels: [],
      data: []
    };

    if (revenueData && revenueData.length > 0) {
      const monthlyPayouts = revenueData
        .filter(item => item.seller_payout_status === 'completed')
        .reduce((acc: { [key: string]: number }, item) => {
          const date = new Date(item.created_at);
          const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
          acc[monthYear] = (acc[monthYear] || 0) + (item.seller_payout_amount || 0);
          return acc;
        }, {});

      payoutTimeline.labels = Object.keys(monthlyPayouts);
      payoutTimeline.data = Object.values(monthlyPayouts);
    }

    // Calculate payout efficiency
    const completedPayouts = revenueData?.filter(item => item.seller_payout_status === 'completed') || [];
    const pendingPayouts = revenueData?.filter(item => item.seller_payout_status === 'pending') || [];

    // Only count transactions for orders that are completed (delivered or picked up) AND paid
    const completedOrderIds = new Set(
      (ordersData || [])
        .filter(o => o.order_status === 'delivered' || o.order_status === 'picked up')
        .map(o => o.id)
    );
    const eligibleTransactions = (revenueData || []).filter(tx => 
      tx.payment_status === 'paid' && completedOrderIds.has(tx.order_id)
    );

    const totalEligible = eligibleTransactions.length;
    const totalPaid = eligibleTransactions.filter(tx => tx.seller_payout_status === 'completed').length;
    const payoutRate = totalEligible > 0 ? (totalPaid / totalEligible) * 100 : 0;

    // Calculate average payout time (simplified - using order completion to payout)
    const payoutTimes = completedPayouts.map(payout => {
      const order = ordersData?.find(o => o.id === payout.order_id);
      if (order && (order.order_status === 'delivered' || order.order_status === 'picked up')) {
        const orderDate = new Date(order.created_at);
        const payoutDate = new Date(payout.created_at);
        return (payoutDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24); // days
      }
      return 0;
    }).filter(time => time > 0);

    const averagePayoutTime = payoutTimes.length > 0 
      ? payoutTimes.reduce((sum, time) => sum + time, 0) / payoutTimes.length 
      : 0;

    // Process payout status distribution
    const payoutStatusCounts = {
      completed: eligibleTransactions.filter(tx => tx.seller_payout_status === 'completed').length,
      pending: eligibleTransactions.filter(tx => tx.seller_payout_status === 'pending').length,
      notEligible: (revenueData?.length || 0) - totalEligible
    };

    const payoutStatusDistribution = {
      labels: ['Completed', 'Pending', 'Not Eligible'],
      data: [payoutStatusCounts.completed, payoutStatusCounts.pending, payoutStatusCounts.notEligible],
      backgroundColor: [
        'rgba(34, 197, 94, 0.5)',   // green for completed
        'rgba(251, 191, 36, 0.5)',  // amber for pending
        'rgba(107, 114, 128, 0.5)'  // gray for not eligible
      ]
    };

    // Process orders by status - match exactly with database schema
    const ordersByStatus = {
      labels: ['Pending', 'Confirmed', 'Shipped/Ready pickup', 'Delivered', 'Cancelled'],
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
    const totalMoneyReceived = completedPayouts.reduce((sum, item) => sum + (item.seller_payout_amount || 0), 0);
    
    const summary = {
      totalOrders: ordersData?.length || 0,
      totalRevenue: revenueData?.reduce((sum, item) => {
        return sum + (item.seller_payout_amount || 0);
      }, 0) || 0,
      averageOrderValue: revenueData?.length ? 
        (revenueData.reduce((sum, item) => sum + (item.seller_payout_amount || 0), 0) / revenueData.length) : 0,
      pendingPayouts: revenueData?.reduce((sum, item) => {
        // Only count as pending payout if:
        // 1. seller_payout_status is 'pending'
        // 2. payment_status is 'paid' (customer has paid)
        // 3. Find the corresponding order and check if it's completed (delivered or picked up)
        if (item.seller_payout_status === 'pending' && item.payment_status === 'paid') {
          const order = ordersData?.find(o => o.id === item.order_id);
          if (order && (order.order_status === 'delivered' || order.order_status === 'picked up')) {
            return sum + (item.seller_payout_amount || 0);
          }
        }
        return sum;
      }, 0) || 0,
      completedPayouts: revenueData?.reduce((sum, item) => {
        // Only count as completed payout if:
        // 1. seller_payout_status is 'completed'
        // 2. payment_status is 'paid' (customer has paid)
        if (item.seller_payout_status === 'completed' && item.payment_status === 'paid') {
          return sum + (item.seller_payout_amount || 0);
        }
        return sum;
      }, 0) || 0,
      totalMoneyReceived, // This is the actual money received (completed payouts only)
      payoutEfficiency: payoutRate
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
        customer_name: transaction.customer_name || 'Anonymous',
        seller_payout_status: transaction.seller_payout_status,
        seller_payout_amount: transaction.seller_payout_amount
      }));

    return {
      revenueByMonth,
      ordersByStatus: {
        ...ordersByStatus,
        backgroundColor: statusColors
      },
      paymentMethods,
      payoutAnalytics: {
        payoutTimeline,
        payoutEfficiency: {
          totalEligible,
          totalPaid,
          averagePayoutTime,
          payoutRate
        },
        payoutStatusDistribution
      },
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
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
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

          {/* Money Received */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Money Received</dt>
                    <dd className="text-lg font-semibold text-green-600">
                      {formatCurrency(analyticsData?.summary.totalMoneyReceived || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Payout Efficiency */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Payout Rate</dt>
                    <dd className="text-lg font-semibold text-blue-600">
                      {analyticsData?.summary.payoutEfficiency.toFixed(1)}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Average Payout Time */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Payout Time</dt>
                    <dd className="text-lg font-semibold text-purple-600">
                      {analyticsData?.payoutAnalytics.payoutEfficiency.averagePayoutTime.toFixed(1)} days
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

        {/* Payout Analytics Section */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Payout Analytics</h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Payout Timeline */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Money Received Timeline</h3>
              <div className="mt-6" style={{ height: '300px' }}>
                <Line
                  data={{
                    labels: analyticsData?.payoutAnalytics.payoutTimeline.labels || [],
                    datasets: [
                      {
                        label: 'Money Received',
                        data: analyticsData?.payoutAnalytics.payoutTimeline.data || [],
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
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

            {/* Payout Status Distribution */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Payout Status Distribution</h3>
              <div className="mt-6" style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: analyticsData?.payoutAnalytics.payoutStatusDistribution.labels || [],
                    datasets: [
                      {
                        data: analyticsData?.payoutAnalytics.payoutStatusDistribution.data || [],
                        backgroundColor: analyticsData?.payoutAnalytics.payoutStatusDistribution.backgroundColor || [],
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Payout Efficiency Metrics */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Eligible for Payout</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {analyticsData?.payoutAnalytics.payoutEfficiency.totalEligible}
              </p>
              <p className="mt-1 text-sm text-gray-500">Orders completed and paid</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Successfully Paid Out</h3>
              <p className="mt-2 text-3xl font-semibold text-green-600">
                {analyticsData?.payoutAnalytics.payoutEfficiency.totalPaid}
              </p>
              <p className="mt-1 text-sm text-gray-500">Money transferred to your account</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Payout Success Rate</h3>
              <p className="mt-2 text-3xl font-semibold text-blue-600">
                {analyticsData?.payoutAnalytics.payoutEfficiency.payoutRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-sm text-gray-500">Efficiency of payout process</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 