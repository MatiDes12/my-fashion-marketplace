'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import { DateRangePicker } from '@/components/DateRangePicker';
import { PieChart } from '@/components/charts/PieChart';
import { BarChart } from '@/components/charts/BarChart';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { fetchDashboardStats } from '@/components/DashboardStats';

interface RevenueStats {
  totalRevenue: number;
  platformRevenue: number;
  sellerPayouts: number;
  vatCollected: number;
  serviceFees: number;
  deliveryFees: number;
  dailyRevenue: Array<{
    date: string;
    totalRevenue: number;
    platformRevenue: number;
    sellerPayouts: number;
  }>;
  revenueByPaymentMethod: Array<{
    method: string;
    amount: number;
    serviceRevenue: number;
  }>;
  topSellers: Array<{
    seller_id: string;
    seller_name: string;
    total_sales: number;
    total_payout: number;
    transaction_count: number;
  }>;
  orderStatusCounts: {
    pending: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  allPendingPayouts: number;
}

export default function RevenuePage() {
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null
  });
  const [revenueChartDateRange, setRevenueChartDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null
  });
  const [paymentMethodDateRange, setPaymentMethodDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null
  });
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    platformRevenue: 0,
    sellerPayouts: 0,
    vatCollected: 0,
    serviceFees: 0,
    deliveryFees: 0,
    dailyRevenue: [],
    revenueByPaymentMethod: [],
    topSellers: [],
    orderStatusCounts: {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    },
    allPendingPayouts: 0
  });
  const [revenueChartData, setRevenueChartData] = useState<RevenueStats['dailyRevenue']>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<RevenueStats['revenueByPaymentMethod']>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchRevenueStats();
  }, [dateRange]);

  useEffect(() => {
    fetchRevenueChartData();
  }, [revenueChartDateRange]);

  useEffect(() => {
    fetchPaymentMethodData();
  }, [paymentMethodDateRange]);

  // Initialize chart data with main stats when they load
  useEffect(() => {
    if (stats.dailyRevenue.length > 0) {
      setRevenueChartData(stats.dailyRevenue);
    }
  }, [stats.dailyRevenue]);

  // Initialize payment method data with main stats when they load
  useEffect(() => {
    if (stats.revenueByPaymentMethod.length > 0) {
      setPaymentMethodData(stats.revenueByPaymentMethod);
    }
  }, [stats.revenueByPaymentMethod]);

  const fetchRevenueStats = async () => {
    try {
      setLoading(true);

      // Fix date range filtering to use proper ISO strings
      let query = supabase
        .from('transactions')
        .select(`
          *,
          seller:users!transactions_seller_id_fkey (
            id,
            full_name,
            email
          ),
          order:orders!transactions_order_id_fkey (
            id,
            order_status
          )
        `)
        .order('created_at', { ascending: true });

      // Apply date filters only if dates are provided
      if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      // Calculate daily revenue
      const dailyRevenue = transactions?.reduce((acc, t) => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        const existing = acc.find((d: {date: string}) => d.date === date);
        
        if (existing) {
          existing.totalRevenue += t.total_amount || 0;
          existing.platformRevenue += (t.service_fee || 0) + (t.platform_fee || 0);
          existing.sellerPayouts += t.seller_payout_amount || 0;
        } else {
          acc.push({
            date,
            totalRevenue: t.total_amount || 0,
            platformRevenue: (t.service_fee || 0) + (t.platform_fee || 0),
            sellerPayouts: t.seller_payout_amount || 0
          });
        }
        return acc;
      }, [] as RevenueStats['dailyRevenue']).sort((a: {date: string}, b: {date: string}) => a.date.localeCompare(b.date)) || [];

      // Calculate revenue by payment method
      const revenueByPaymentMethod = transactions?.reduce((acc, t) => {
        const existing = acc.find((p: { method: string }) => p.method === t.payment_method);
        if (existing) {
          existing.amount += t.total_amount || 0;
          existing.serviceRevenue += (t.service_fee || 0) + (t.platform_fee || 0);
        } else {
          acc.push({
            method: t.payment_method,
            amount: t.total_amount || 0,
            serviceRevenue: (t.service_fee || 0) + (t.platform_fee || 0)
          });
        }
        return acc;
      }, [] as RevenueStats['revenueByPaymentMethod']) || [];

      // Calculate top sellers
      const sellerStats = transactions?.reduce((acc, t) => {
        const existing = acc.find((s: { seller_id: string }) => s.seller_id === t.seller?.id);
        if (existing) {
          existing.total_sales += t.total_amount || 0;
          existing.total_payout += t.seller_payout_amount || 0;
          existing.transaction_count += 1;
        } else if (t.seller) {
          acc.push({
            seller_id: t.seller.id,
            seller_name: t.seller.full_name,
            total_sales: t.total_amount || 0,
            total_payout: t.seller_payout_amount || 0,
            transaction_count: 1
          });
        }
        return acc;
      }, [] as RevenueStats['topSellers']) || [];
      // Sort sellers by total sales
      const topSellers = sellerStats.sort((a: { total_sales: number }, b: { total_sales: number }) => b.total_sales - a.total_sales).slice(0, 5);

      // Calculate order status counts
      const orderStatusCounts = transactions?.reduce((acc, t) => {
        const status = t.order?.order_status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {
        pending: 0,
        confirmed: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
      });

      // Calculate platform revenue (service fee + platform fee)
      const platformRevenue = transactions?.reduce((sum, t) => 
        sum + ((t.service_fee || 0) + (t.platform_fee || 0)), 0) || 0;

      // Calculate seller payouts - only for completed orders (delivered/picked up)
      const sellerPayouts = transactions?.reduce((sum, t) => {
        if (t.seller_payout_status === 'pending' && 
            t.payment_status === 'paid' && 
            (t.order?.order_status === 'delivered' || t.order?.order_status === 'picked up')) {
          return sum + (t.seller_payout_amount || 0);
        }
        return sum;
      }, 0) || 0;

      // Calculate all pending payouts (sum of all pending seller payouts)
      const allPendingPayouts = transactions?.reduce((sum, t) => {
        if (t.seller_payout_status === 'pending' && t.payment_status === 'paid') {
          return sum + (t.seller_payout_amount || 0);
        }
        return sum;
      }, 0) || 0;

      setStats({
        totalRevenue: transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0,
        platformRevenue: platformRevenue,
        sellerPayouts: sellerPayouts,
        vatCollected: transactions?.reduce((sum, t) => sum + (t.vat_amount || 0), 0) || 0,
        serviceFees: transactions?.reduce((sum, t) => sum + (t.service_fee || 0), 0) || 0,
        deliveryFees: transactions?.reduce((sum, t) => sum + (t.delivery_fee || 0), 0) || 0,
        dailyRevenue,
        revenueByPaymentMethod,
        topSellers,
        orderStatusCounts,
        allPendingPayouts: allPendingPayouts
      });

      // Debug logging
      console.log('Revenue Page Debug:', {
        dateRange: {
          start: dateRange.start ? new Date(dateRange.start).toISOString() : 'N/A',
          end: dateRange.end ? new Date(dateRange.end).toISOString() : 'N/A'
        },
        transactionsCount: transactions?.length || 0,
        totalRevenue: transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0,
        platformRevenue,
        sellerPayouts,
        sellerPayoutsBreakdown: transactions?.filter(t => 
          t.seller_payout_status === 'pending' && 
          t.payment_status === 'paid'
        ).map(t => ({
          orderStatus: t.order?.order_status,
          amount: t.seller_payout_amount,
          isCompleted: t.order?.order_status === 'delivered' || t.order?.order_status === 'picked up'
        })) || []
      });

    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      toast.error('Failed to load revenue statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueChartData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('transactions')
        .select(`
          *,
          seller:users!transactions_seller_id_fkey (
            id,
            full_name,
            email
          ),
          order:orders!transactions_order_id_fkey (
            id,
            order_status
          )
        `)
        .order('created_at', { ascending: true });

      if (revenueChartDateRange.start) {
        const startDate = new Date(revenueChartDateRange.start);
        startDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());
      }
      if (revenueChartDateRange.end) {
        const endDate = new Date(revenueChartDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      const dailyRevenue = transactions?.reduce((acc, t) => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        const existing = acc.find((d: {date: string}) => d.date === date);
        
        if (existing) {
          existing.totalRevenue += t.total_amount || 0;
          existing.platformRevenue += (t.service_fee || 0) + (t.platform_fee || 0);
          existing.sellerPayouts += t.seller_payout_amount || 0;
        } else {
          acc.push({
            date,
            totalRevenue: t.total_amount || 0,
            platformRevenue: (t.service_fee || 0) + (t.platform_fee || 0),
            sellerPayouts: t.seller_payout_amount || 0
          });
        }
        return acc;
      }, [] as RevenueStats['dailyRevenue']).sort((a: {date: string}, b: {date: string}) => a.date.localeCompare(b.date)) || [];

      setRevenueChartData(dailyRevenue);

    } catch (error) {
      console.error('Error fetching revenue chart data:', error);
      toast.error('Failed to load revenue distribution data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethodData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('transactions')
        .select(`
          *,
          seller:users!transactions_seller_id_fkey (
            id,
            full_name,
            email
          ),
          order:orders!transactions_order_id_fkey (
            id,
            order_status
          )
        `)
        .order('created_at', { ascending: true });

      if (paymentMethodDateRange.start) {
        const startDate = new Date(paymentMethodDateRange.start);
        startDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());
      }
      if (paymentMethodDateRange.end) {
        const endDate = new Date(paymentMethodDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      const revenueByPaymentMethod = transactions?.reduce((acc, t) => {
        const existing = acc.find((p: { method: string }) => p.method === t.payment_method);
        if (existing) {
          existing.amount += t.total_amount || 0;
          existing.serviceRevenue += (t.service_fee || 0) + (t.platform_fee || 0);
        } else {
          acc.push({
            method: t.payment_method,
            amount: t.total_amount || 0,
            serviceRevenue: (t.service_fee || 0) + (t.platform_fee || 0)
          });
        }
        return acc;
      }, [] as RevenueStats['revenueByPaymentMethod']) || [];

      setPaymentMethodData(revenueByPaymentMethod);

    } catch (error) {
      console.error('Error fetching payment method data:', error);
      toast.error('Failed to load payment method distribution data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Revenue Analytics</h1>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={({ startDate, endDate }) => {
            setDateRange({ start: startDate, end: endDate });
          }}
        />
      </div>

      {/* Revenue Overview Cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          subtext="Gross transaction volume"
          trend={+12}
        />
        <StatCard
          title="Platform Revenue"
          value={formatCurrency(stats.platformRevenue)}
          subtext="Net platform earnings"
          trend={+8}
        />
        <StatCard
          title="Seller Payouts"
          value={formatCurrency(stats.sellerPayouts)}
          subtext="Total seller earnings"
          trend={+15}
        />
        <StatCard
          title="All Pending Payouts"
          value={formatCurrency(stats.allPendingPayouts)}
          subtext="All non-transferred money"
          trend={+3}
        />
      </div>

      {/* Fee Breakdown Cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="VAT Collected"
          value={formatCurrency(stats.vatCollected)}
          subtext="To be remitted to tax authority"
          trend={+5}
        />
        <StatCard
          title="Service Fees"
          value={formatCurrency(stats.serviceFees)}
          subtext="Platform service charges"
          trend={+3}
        />
        <StatCard
          title="Delivery Fees"
          value={formatCurrency(stats.deliveryFees)}
          subtext="Total delivery charges"
          trend={+7}
        />
      </div>

      {/* Order Status Overview */}
      <div className="mt-10">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Order Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {Object.entries(stats.orderStatusCounts).map(([status, count]) => (
            <div 
              key={status}
              className="bg-white rounded-xl shadow-lg p-6 border-l-4 hover:shadow-xl transition-shadow duration-300"
              style={{
                borderLeftColor: 
                  status === 'delivered' ? '#10B981' :
                  status === 'pending' ? '#F59E0B' :
                  status === 'confirmed' ? '#3B82F6' :
                  status === 'shipped' ? '#6366F1' :
                  '#EF4444'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 truncate">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {count}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {((count / Object.values(stats.orderStatusCounts).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}% of total
                  </p>
                </div>
                <div className={`
                  flex-shrink-0 rounded-full p-3
                  ${status === 'delivered' ? 'bg-green-100 text-green-600' : 
                    status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                    status === 'confirmed' ? 'bg-blue-100 text-blue-600' :
                    status === 'shipped' ? 'bg-indigo-100 text-indigo-600' :
                    'bg-red-100 text-red-600'}
                `}>
                  {/* Status Icons */}
                  {status === 'delivered' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {status === 'pending' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {status === 'confirmed' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {status === 'shipped' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                  {status === 'cancelled' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
        
      {/* Charts */}
      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Revenue Distribution Over Time</h2>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
              Daily revenue breakdown
            </div>
          </div>
          
          {/* Chart Container */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">Revenue Trends</span>
              </div>
              <div className="flex items-center space-x-4 text-xs text-gray-600">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Total Revenue</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Service Revenue</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Seller Payouts</span>
                </div>
              </div>
            </div>
            <div style={{ height: 350 }}>
              <ResponsiveLine
                data={[
                  {
                    id: "Total Revenue",
                    data: revenueChartData.map(d => ({
                      x: new Date(d.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      }),
                      y: d.totalRevenue
                    }))
                  },
                  {
                    id: "Service Revenue",
                    data: revenueChartData.map(d => ({
                      x: new Date(d.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      }),
                      y: d.platformRevenue
                    }))
                  },
                  {
                    id: "Seller Payouts",
                    data: revenueChartData.map(d => ({
                      x: new Date(d.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      }),
                      y: d.sellerPayouts
                    }))
                  }
                ]}
                colors={['#10b981', '#3b82f6', '#ef4444']}
                margin={{ top: 20, right: 20, bottom: 80, left: 80 }}
                enableArea={true}
                areaBaselineValue={0}
                areaOpacity={0.1}
                pointSize={8}
                pointColor="#ffffff"
                pointBorderWidth={2}
                pointBorderColor={{ from: 'serieColor' }}
                yFormat={value => `ETB ${value.toLocaleString()}`}
                curve="monotoneX"
                useMesh={true}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 8,
                  tickRotation: -45,
                  legend: 'Date',
                  legendOffset: 60,
                  legendPosition: 'middle'
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 8,
                  tickRotation: 0,
                  legend: 'Revenue (ETB)',
                  legendOffset: -60,
                  legendPosition: 'middle',
                  format: (value) => `${value.toLocaleString()}`
                }}
                theme={{
                  axis: {
                    ticks: {
                      text: {
                        fill: '#6B7280',
                        fontSize: 11
                      }
                    },
                    legend: {
                      text: {
                        fill: '#374151',
                        fontSize: 12,
                        fontWeight: 600
                      }
                    }
                  },
                  grid: {
                    line: {
                      stroke: '#E5E7EB',
                      strokeWidth: 1
                    }
                  }
                }}
                tooltip={({ point }) => (
                  <div className="bg-gray-800 text-white p-3 text-sm rounded-lg shadow-lg border border-gray-700">
                    <div className="font-bold text-white mb-1">{point.data.xFormatted}</div>
                    <div className="text-green-300">{point.serieId}: {point.data.yFormatted}</div>
                  </div>
                )}
              />
            </div>
          </div>
          
          {/* Revenue Chart Date Range Picker */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Filter by date range:</span>
                <p className="text-xs text-gray-500 mt-1">Select a time period to analyze revenue trends</p>
              </div>
              <DateRangePicker
                startDate={revenueChartDateRange.start}
                endDate={revenueChartDateRange.end}
                onChange={({ startDate, endDate }) => {
                  setRevenueChartDateRange({ start: startDate, end: endDate });
                }}
              />
            </div>
          </div>

          {/* Revenue Distribution Summary */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Distribution Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Total Revenue</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(revenueChartData.reduce((sum, d) => sum + d.totalRevenue, 0))}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {revenueChartData.length > 0 ? `${revenueChartData.length} days` : 'No data'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Service Revenue</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(revenueChartData.reduce((sum, d) => sum + d.platformRevenue, 0))}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {revenueChartData.length > 0 ? 
                    `${((revenueChartData.reduce((sum, d) => sum + d.platformRevenue, 0) / revenueChartData.reduce((sum, d) => sum + d.totalRevenue, 0)) * 100).toFixed(1)}% of total` : 
                    'No data'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Seller Payouts</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(revenueChartData.reduce((sum, d) => sum + d.sellerPayouts, 0))}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {revenueChartData.length > 0 ? 
                    `${((revenueChartData.reduce((sum, d) => sum + d.sellerPayouts, 0) / revenueChartData.reduce((sum, d) => sum + d.totalRevenue, 0)) * 100).toFixed(1)}% of total` : 
                    'No data'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Avg Daily Revenue</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {revenueChartData.length > 0 ? 
                    formatCurrency(revenueChartData.reduce((sum, d) => sum + d.totalRevenue, 0) / revenueChartData.length) : 
                    formatCurrency(0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {revenueChartData.length > 0 ? `Based on ${revenueChartData.length} days` : 'No data'}
                </p>
              </div>
            </div>

            {/* Additional Insights */}
            {revenueChartData.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Peak Performance</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Highest Daily Revenue:</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(Math.max(...revenueChartData.map(d => d.totalRevenue)))}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Lowest Daily Revenue:</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(Math.min(...revenueChartData.map(d => d.totalRevenue)))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Revenue Efficiency</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Platform Margin:</span>
                      <span className="font-medium text-green-600">
                        {((revenueChartData.reduce((sum, d) => sum + d.platformRevenue, 0) / revenueChartData.reduce((sum, d) => sum + d.totalRevenue, 0)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Seller Share:</span>
                      <span className="font-medium text-blue-600">
                        {((revenueChartData.reduce((sum, d) => sum + d.sellerPayouts, 0) / revenueChartData.reduce((sum, d) => sum + d.totalRevenue, 0)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Revenue by Payment Method</h2>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
              Payment distribution analysis
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Total Revenue Chart */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Total Revenue</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Revenue Distribution</span>
                </div>
              </div>
              <div style={{ height: 280 }}>
                <ResponsivePie
                  data={paymentMethodData.map(p => ({
                    id: p.method,
                    label: p.method,
                    value: p.amount,
                    formattedValue: formatCurrency(p.amount)
                  }))}
                  margin={{ top: 20, right: 20, bottom: 60, left: 20 }}
                  innerRadius={0.6}
                  padAngle={0.7}
                  cornerRadius={3}
                  activeOuterRadiusOffset={8}
                  colors={{ scheme: 'nivo' }}
                  borderWidth={1}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="#374151"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                  motionConfig="wobbly"
                  transitionMode="pushIn"
                  legends={[
                    {
                      anchor: 'bottom',
                      direction: 'row',
                      justify: false,
                      translateX: 0,
                      translateY: 50,
                      itemWidth: 80,
                      itemHeight: 20,
                      itemsSpacing: 10,
                      symbolSize: 12,
                      itemDirection: 'left-to-right'
                    }
                  ]}
                  theme={{
                    legends: {
                      text: {
                        fill: '#6B7280',
                        fontSize: 11
                      }
                    }
                  }}
                  tooltip={({ datum }) => (
                    <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg transform transition-all duration-200 scale-105">
                      <div className="font-bold text-lg">{datum.label}</div>
                      <div className="text-lg">{datum.formattedValue}</div>
                      <div className="text-sm text-gray-300">
                        {((datum.value / paymentMethodData.reduce((sum, p) => sum + p.amount, 0)) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Service Revenue Chart */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Service Revenue</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Platform Earnings</span>
                </div>
              </div>
              <div style={{ height: 280 }}>
                <ResponsivePie
                  data={paymentMethodData.map(p => ({
                    id: p.method,
                    label: p.method,
                    value: p.serviceRevenue,
                    formattedValue: formatCurrency(p.serviceRevenue)
                  }))}
                  margin={{ top: 20, right: 20, bottom: 60, left: 20 }}
                  innerRadius={0.6}
                  padAngle={0.7}
                  cornerRadius={3}
                  activeOuterRadiusOffset={8}
                  colors={{ scheme: 'category10' }}
                  borderWidth={1}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="#374151"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                  motionConfig="wobbly"
                  transitionMode="pushIn"
                  legends={[
                    {
                      anchor: 'bottom',
                      direction: 'row',
                      justify: false,
                      translateX: 0,
                      translateY: 50,
                      itemWidth: 80,
                      itemHeight: 20,
                      itemsSpacing: 10,
                      symbolSize: 12,
                      itemDirection: 'left-to-right'
                    }
                  ]}
                  theme={{
                    legends: {
                      text: {
                        fill: '#6B7280',
                        fontSize: 11
                      }
                    }
                  }}
                  tooltip={({ datum }) => (
                    <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg transform transition-all duration-200 scale-105">
                      <div className="font-bold text-lg">{datum.label}</div>
                      <div className="text-lg">{datum.formattedValue}</div>
                      <div className="text-sm text-gray-300">
                        {((datum.value / paymentMethodData.reduce((sum, p) => sum + p.serviceRevenue, 0)) * 100).toFixed(1)}% of service revenue
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Payment Method Summary Cards */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Method Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {paymentMethodData.map(method => (
                <div key={method.method} className="bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 flex-1 pr-2">{method.method}</h4>
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Total Revenue</p>
                      <p className="text-base font-bold text-gray-900">{formatCurrency(method.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Service Revenue</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(method.serviceRevenue)}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        {((method.amount / paymentMethodData.reduce((sum, p) => sum + p.amount, 0)) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Chart Date Range Picker */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Filter by date range:</span>
                <p className="text-xs text-gray-500 mt-1">Select a time period to analyze payment method trends</p>
              </div>
              <DateRangePicker
                startDate={paymentMethodDateRange.start}
                endDate={paymentMethodDateRange.end}
                onChange={({ startDate, endDate }) => {
                  setPaymentMethodDateRange({ start: startDate, end: endDate });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Sellers Table */}
      <div className="mt-10">
        <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">Top Performing Sellers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Seller</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sales</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Earnings</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Transactions</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg. Order Value</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.topSellers.map((seller) => (
                  <tr key={seller.seller_id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {seller.seller_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(seller.total_sales)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(seller.total_payout)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {seller.transaction_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(seller.total_sales / seller.transaction_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtext, trend }: { 
  title: string; 
  value: string; 
  subtext: string;
  trend: number;
}) {
  const getIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case 'total revenue':
        return (
          <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'platform revenue':
        return (
          <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'seller payouts':
        return (
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'vat collected':
        return (
          <svg className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'service fees':
        return (
          <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'delivery fees':
        return (
          <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'all pending payouts':
        return (
          <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 mb-2 truncate">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mb-2 truncate">{value}</p>
            <p className="text-sm text-gray-500 mb-2 truncate">{subtext}</p>
            <div className={`flex items-center text-sm font-medium ${
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend > 0 ? (
                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              ) : trend < 0 ? (
                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
              )}
              <span className="truncate">{trend > 0 ? '+' : ''}{trend}%</span>
            </div>
          </div>
          <div className="flex-shrink-0 ml-3 p-2 bg-gray-50 rounded-lg">
            {getIcon(title)}
          </div>
        </div>
      </div>
    </div>
  );
} 