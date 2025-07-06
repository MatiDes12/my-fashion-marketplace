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
    completedPayouts: number;
  };
  recentTransactions: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    payment_status: string;
    customer_name: string;
  }>;
}

interface AdvancedAnalytics extends AnalyticsData {
  customerMetrics: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    averageLifetimeValue: number;
  };
  productMetrics: {
    topProducts: Array<{
      id: string;
      title: string;
      totalSales: number;
      revenue: number;
      likes: number;
      averageRating: number;
      totalQuantity: number;
    }>;
    categoryPerformance: Array<{
      category: string;
      sales: number;
      revenue: number;
    }>;
  };
  performanceMetrics: {
    conversionRate: number;
    averageOrderCompletion: number;
    cancelationRate: number;
  };
  salesMetrics: {
    bestSellingCategories: Array<{
      category: string;
      sales: number;
      growth: number; // percentage growth from previous period
    }>;
    peakSalesHours: Array<{
      hour: number;
      count: number;
    }>;
    deliveryStats: {
      homeDelivery: number;
      storePickup: number;
      averageDeliveryTime: number;
    };
  };
  productInsights: {
    outOfStock: number;
    lowStock: number;
    topRated: Array<{
      id: string;
      title: string;
      rating: number;
      reviewCount: number;
    }>;
    mostLiked: Array<{
      id: string;
      title: string;
      likes: number;
    }>;
  };
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalytics | null>(null);
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

      // First get all products and their data
      const { data: productData } = await supabase
        .from('products')
        .select(`
          id,
          title,
          category,
          quantity,
          orders (
            id,
            quantity,
            total_price,
            created_at
          ),
          likes:likes!product_id(count),
          ratings (
            rating
          )
        `)
        .eq('owner_id', session.user.id);

      const productIds = productData?.map(p => p.id) || [];

      // Fetch other data
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .in('product_id', productIds)
        .gte('created_at', startDate.toISOString());

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

      const { data: paymentsData } = await supabase
        .from('transactions')
        .select('payment_method')
        .eq('seller_id', session.user.id)
        .gte('created_at', startDate.toISOString());

      const { data: salesData } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          delivery_method,
          order_status,
          products!inner (
            id,
            title,
            category,
            owner_id
          )
        `)
        .eq('products.owner_id', session.user.id)
        .in('order_status', ['delivered', 'picked up'])
        .gte('created_at', startDate.toISOString());

      // Process all data
      const processedData = processAnalyticsData(
        revenueData, 
        ordersData, 
        paymentsData, 
        productData, 
        salesData,
        session.user.id,
        startDate
      );
      setAnalyticsData(processedData);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };
  
  const processAnalyticsData = (
    revenueData: any[] | null, 
    ordersData: any[] | null, 
    paymentsData: any[] | null,
    productData: any[] | null,
    salesData: any[] | null,
    userId: string,
    startDate: Date
  ) => {
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
      labels: ['Pending', 'Confirmed', 'Shipped', 'Completed', 'Cancelled'],
      data: Array(5).fill(0) // Initialize array with zeros
    };

    const statusMap = {
      'pending': 0,
      'confirmed': 1,
      'shipped': 2,
      'delivered': 3,
      'picked up': 3, // Both delivered and picked up go to "Completed"
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
      'rgba(34, 197, 94, 0.5)',   // green-500 for completed (delivered + picked up)
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
        // Count as completed payout if:
        // 1. seller_payout_status is 'completed' (admin has paid)
        // 2. payment_status is 'paid' (customer has paid)
        if (item.seller_payout_status === 'completed' && item.payment_status === 'paid') {
          return sum + (item.seller_payout_amount || 0);
        }
        return sum;
      }, 0) || 0
    };

    // Debug logging
    console.log('Analytics Debug:', {
      timeRange,
      startDate: startDate.toISOString(),
      totalOrders: summary.totalOrders,
      totalRevenue: summary.totalRevenue,
      pendingPayouts: summary.pendingPayouts,
      completedPayouts: summary.completedPayouts,
      revenueDataCount: revenueData?.length || 0,
      ordersDataCount: ordersData?.length || 0,
      productDataCount: productData?.length || 0,
      pendingPayoutsBreakdown: revenueData?.filter(item => 
        item.seller_payout_status === 'pending' && 
        item.payment_status === 'paid'
      ).map(item => ({
        orderId: item.order_id,
        amount: item.seller_payout_amount,
        orderStatus: ordersData?.find(o => o.id === item.order_id)?.order_status,
        sellerPayoutStatus: item.seller_payout_status,
        paymentStatus: item.payment_status
      })) || [],
      completedPayoutsBreakdown: revenueData?.filter(item => 
        item.seller_payout_status === 'completed' && 
        item.payment_status === 'paid'
      ).map(item => ({
        orderId: item.order_id,
        amount: item.seller_payout_amount,
        orderStatus: ordersData?.find(o => o.id === item.order_id)?.order_status,
        sellerPayoutStatus: item.seller_payout_status,
        paymentStatus: item.payment_status
      })) || [],
      allOrdersWithStatus: ordersData?.map(order => ({
        orderId: order.id,
        status: order.order_status,
        hasTransaction: revenueData?.some(t => t.order_id === order.id)
      })) || []
    });

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

    // Process advanced metrics
    const customerMetrics = {
      totalCustomers: revenueData?.length || 0,
      newCustomers: new Set(revenueData?.map(t => t.customer_name)).size || 0,
      returningCustomers: 0, // Calculate based on repeat customers
      averageLifetimeValue: revenueData?.length ? 
        (revenueData.reduce((sum, t) => sum + (t.total_amount || 0), 0) / revenueData.length) : 0
    };

    const productMetrics = {
      topProducts: productData?.map(product => {
        // Filter orders by time range for this product
        const filteredOrders = product.orders?.filter((order: any) => 
          new Date(order.created_at) >= startDate
        ) || [];
        
        // Calculate revenue using seller_payout_amount from transactions
        const productRevenue = revenueData?.reduce((sum, transaction) => {
          // Find the order for this transaction and check if it belongs to this product
          const order = ordersData?.find(o => o.id === transaction.order_id);
          if (order && order.product_id === product.id) {
            return sum + (transaction.seller_payout_amount || 0);
          }
          return sum;
        }, 0) || 0;

        return {
          id: product.id,
          title: product.title,
          totalSales: filteredOrders.length,
          revenue: productRevenue,
          totalQuantity: filteredOrders.reduce((sum: number, order: { quantity?: number }) => sum + (order.quantity || 0), 0),
          likes: product.likes[0]?.count || 0,
          averageRating: product.ratings?.length 
            ? product.ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / product.ratings.length 
            : 0
        };
      }).filter(product => product.totalSales > 0) // Only show products with sales in the time range
        .sort((a, b) => b.totalQuantity - a.totalQuantity) || [],
      categoryPerformance: []
    };

    const performanceMetrics = {
      conversionRate: ordersData?.length && revenueData?.length ? 
        ((ordersData.length / revenueData.length) * 100) : 0,
      averageOrderCompletion: ordersData?.filter(o => 
        o.order_status === 'delivered' || o.order_status === 'picked up'
      ).length || 0,
      cancelationRate: ordersData?.length ? 
        ((ordersData.filter(o => o.order_status === 'cancelled').length / ordersData.length) * 100) : 0
    };

    const salesMetrics = {
      bestSellingCategories: [] as Array<{
        category: string;
        sales: number;
        growth: number;
      }>,
      peakSalesHours: [] as Array<{
        hour: number;
        count: number;
      }>,
      deliveryStats: {
        homeDelivery: 0,
        storePickup: 0,
        averageDeliveryTime: 0
      }
    };

    const productInsights = {
      outOfStock: 0,
      lowStock: 0,
      topRated: [] as Array<{
        id: string;
        title: string;
        rating: number;
        reviewCount: number;
      }>,
      mostLiked: [] as Array<{
        id: string;
        title: string;
        likes: number;
      }>
    };

    // Process sales metrics
    if (salesData && salesData.length > 0) {
      // Filter out any data not belonging to the current seller
      const ownerSalesData = salesData.filter(item => 
        item.products?.owner_id === userId
      );

      const categorySales = ownerSalesData.reduce((acc: { [key: string]: number }, item) => {
        const category = item.products?.category || 'Unknown';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const totalSales = Object.values(categorySales).reduce((sum, sales) => sum + sales, 0);

      for (const category in categorySales) {
        const growth = ((categorySales[category] - (categorySales[category] || 0)) / (categorySales[category] || 0)) * 100;
        salesMetrics.bestSellingCategories.push({
          category,
          sales: categorySales[category],
          growth
        });
      }

      // Calculate peak sales hours
      const hourlySales = ownerSalesData.reduce((acc: { [key: string]: number }, item) => {
        const date = new Date(item.created_at);
        const hour = date.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      const peakSales = Object.values(hourlySales).reduce((max, sales) => Math.max(max, sales), 0);
      const peakHours = Object.entries(hourlySales).filter(([hour, sales]) => sales === peakSales).map(([hour]) => parseInt(hour));

      salesMetrics.peakSalesHours = peakHours.map(hour => ({
        hour,
        count: hourlySales[hour]
      }));

      // Calculate delivery stats
      const homeDeliveryCount = salesData.filter(item => item.delivery_method === 'home_delivery').length;
      const storePickupCount = salesData.filter(item => item.delivery_method === 'store_pickup').length;
      const totalDeliveryTime = salesData.reduce((sum, item) => sum + (item.delivery_time || 0), 0);

      salesMetrics.deliveryStats.homeDelivery = salesData.length > 0 ? homeDeliveryCount / salesData.length : 0;
      salesMetrics.deliveryStats.storePickup = salesData.length > 0 ? storePickupCount / salesData.length : 0;
      salesMetrics.deliveryStats.averageDeliveryTime = salesData.length > 0 ? totalDeliveryTime / salesData.length : 0;
    }

    // Process product insights
    if (productData && productData.length > 0) {
      // Consider products with quantity 0 as out of stock
      const outOfStockCount = productData.filter(p => p.quantity === 0).length;
      
      // Consider products with quantity less than 5 as low stock
      const lowStockCount = productData.filter(p => p.quantity > 0 && p.quantity <= 5).length;

      productInsights.outOfStock = outOfStockCount;
      productInsights.lowStock = lowStockCount;

      const topRatedProducts = productData.map(p => ({
        id: p.id,
        title: p.title,
        rating: p.ratings?.length ? p.ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / p.ratings.length : 0,
        reviewCount: p.ratings?.length || 0
      })).sort((a, b) => b.rating - a.rating).slice(0, 5);

      productInsights.topRated = topRatedProducts;

      const mostLikedProducts = productData.map(p => ({
        id: p.id,
        title: p.title,
        likes: p.likes?.length || 0
      })).sort((a, b) => b.likes - a.likes).slice(0, 5);

      productInsights.mostLiked = mostLikedProducts;
    }

    return {
      revenueByMonth,
      ordersByStatus: {
        ...ordersByStatus,
        backgroundColor: statusColors
      },
      paymentMethods,
      summary,
      recentTransactions,
      customerMetrics,
      productMetrics,
      performanceMetrics,
      salesMetrics,
      productInsights
    };
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
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

          {/* Completed Payouts */}
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
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed Payouts</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(analyticsData?.summary.completedPayouts || 0)}
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
            <p className="text-sm text-gray-500 mb-4">Completed includes both delivered and picked up orders</p>
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

          {/* Payment Methods */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900">Payment Methods</h3>
            <div className="mt-6" style={{ height: '300px' }}>
              <Doughnut
                data={{
                  labels: analyticsData?.paymentMethods.labels || [],
                  datasets: [
                    {
                      data: analyticsData?.paymentMethods.data || [],
                      backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)',
                      ],
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

          {/* Recent Transactions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
            <div className="mt-6">
              <div className="flow-root">
                <ul role="list" className="-my-5 divide-y divide-gray-200">
                  {analyticsData?.recentTransactions.map((transaction) => (
                    <li key={transaction.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {transaction.customer_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.payment_status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {transaction.payment_status}
                          </span>
                        </div>
                        <div className="flex-shrink-0 text-sm font-medium text-gray-900">
                          {formatCurrency(transaction.total_amount)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* New Advanced Metrics Section */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Advanced Metrics</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Conversion Rate</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {analyticsData?.performanceMetrics.conversionRate.toFixed(1)}%
              </p>
            </div>
            {/* Add more metric cards */}
          </div>
        </div>

        {/* Customer Insights */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Insights</h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Customer Segments */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Customer Segments</h3>
              <div className="h-64"> {/* Fixed height container */}
                <Doughnut
                  data={{
                    labels: ['New', 'Returning', 'Inactive'],
                    datasets: [{
                      data: [
                        analyticsData?.customerMetrics.newCustomers || 0,
                        analyticsData?.customerMetrics.returningCustomers || 0,
                        (analyticsData?.customerMetrics.totalCustomers || 0) - 
                        ((analyticsData?.customerMetrics.newCustomers || 0) + 
                         (analyticsData?.customerMetrics.returningCustomers || 0))
                      ],
                      backgroundColor: [
                        'rgba(34, 197, 94, 0.5)',
                        'rgba(59, 130, 246, 0.5)',
                        'rgba(107, 114, 128, 0.5)'
                      ]
                    }]
                  }}
                  options={{ 
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Customer Lifetime Value */}
            <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-center">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Customer Lifetime Value</h3>
              <div className="mt-2 text-center">
                <p className="text-3xl font-semibold text-gray-900">
                  {formatCurrency(analyticsData?.customerMetrics.averageLifetimeValue || 0)}
                </p>
                <p className="mt-2 text-sm text-gray-500">Average value per customer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Product Performance */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Product Performance</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Units Sold
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Likes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyticsData?.productMetrics.topProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.totalQuantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(product.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.likes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="text-yellow-400 mr-1">★</span>
                        {product.averageRating.toFixed(1)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales Insights */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Insights</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Best Selling Categories */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Best Selling Categories</h3>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: analyticsData?.salesMetrics.bestSellingCategories.map(c => c.category) || [],
                    datasets: [{
                      data: analyticsData?.salesMetrics.bestSellingCategories.map(c => c.sales) || [],
                      backgroundColor: [
                        'rgba(34, 197, 94, 0.5)',
                        'rgba(59, 130, 246, 0.5)',
                        'rgba(107, 114, 128, 0.5)'
                      ]
                    }]
                  }}
                  options={{ 
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Peak Sales Hours */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Peak Sales Hours</h3>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: analyticsData?.salesMetrics.peakSalesHours.map(h => `${h.hour}:00`) || [],
                    datasets: [{
                      data: analyticsData?.salesMetrics.peakSalesHours.map(h => h.count) || [],
                      backgroundColor: [
                        'rgba(34, 197, 94, 0.5)',
                        'rgba(59, 130, 246, 0.5)',
                        'rgba(107, 114, 128, 0.5)'
                      ]
                    }]
                  }}
                  options={{ 
                    responsive: true,
                    maintainAspectRatio: true,
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
        </div>

        {/* Delivery Insights */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Delivery Insights</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Home Delivery</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {((analyticsData?.salesMetrics.deliveryStats.homeDelivery || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Store Pickup</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {((analyticsData?.salesMetrics.deliveryStats.storePickup || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Average Delivery Time</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {analyticsData?.salesMetrics.deliveryStats.averageDeliveryTime ? 
                  `${analyticsData.salesMetrics.deliveryStats.averageDeliveryTime.toFixed(1)} days` : 
                  'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Product Insights */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Product Insights</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Out of Stock</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {analyticsData?.productInsights.outOfStock}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Low Stock</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {analyticsData?.productInsights.lowStock}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Top Rated</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {analyticsData?.productInsights.topRated.length}
              </p>
            </div>
          </div>
        </div>

        {/* Payout Performance Insights */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Payout Performance Insights</h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Cash Flow Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Cash Flow Analysis</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Revenue Generated</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(analyticsData?.summary.totalRevenue || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Money Received</span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(analyticsData?.summary.completedPayouts || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Payouts</span>
                  <span className="text-sm font-semibold text-amber-600">
                    {formatCurrency(analyticsData?.summary.pendingPayouts || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payout Trends */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Payout Trends</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Payout Time</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {analyticsData?.summary.totalOrders && analyticsData.summary.totalOrders > 0 ? 
                      `${Math.round(analyticsData.summary.totalOrders / 30)} days` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Payout Success Rate</span>
                  <span className="text-sm font-semibold text-green-600">
                    {analyticsData?.summary.pendingPayouts && analyticsData?.summary.completedPayouts ? 
                      `${((analyticsData.summary.completedPayouts) / (analyticsData.summary.completedPayouts + analyticsData.summary.pendingPayouts) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Monthly Payout Average</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatCurrency((analyticsData?.summary.totalRevenue || 0) / 12)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Best Payout Month</span>
                  <span className="text-sm font-semibold text-indigo-600">
                    {analyticsData?.revenueByMonth.labels && analyticsData.revenueByMonth.labels.length > 0 ? 
                      analyticsData.revenueByMonth.labels[analyticsData.revenueByMonth.data.indexOf(Math.max(...analyticsData.revenueByMonth.data))] : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Health Dashboard */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Financial Health Dashboard</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-green-600">Cash Position</h3>
              <p className="mt-2 text-2xl font-semibold text-green-900">
                {formatCurrency(analyticsData?.summary.completedPayouts || 0)}
              </p>
              <p className="mt-1 text-xs text-green-600">Money in your account</p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-blue-600">Revenue Growth</h3>
              <p className="mt-2 text-2xl font-semibold text-blue-900">
                {analyticsData?.revenueByMonth.data && analyticsData.revenueByMonth.data.length > 1 ? 
                  `${((analyticsData.revenueByMonth.data[analyticsData.revenueByMonth.data.length - 1] - analyticsData.revenueByMonth.data[analyticsData.revenueByMonth.data.length - 2]) / analyticsData.revenueByMonth.data[analyticsData.revenueByMonth.data.length - 2] * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="mt-1 text-xs text-blue-600">Month over month</p>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-purple-600">Profit Margin</h3>
              <p className="mt-2 text-2xl font-semibold text-purple-900">
                100%
              </p>
              <p className="mt-1 text-xs text-purple-600">No platform fees</p>
            </div>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-amber-600">Pending Cash</h3>
              <p className="mt-2 text-2xl font-semibold text-amber-900">
                {formatCurrency(analyticsData?.summary.pendingPayouts || 0)}
              </p>
              <p className="mt-1 text-xs text-amber-600">Awaiting transfer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 