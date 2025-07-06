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
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchRevenueStats();
  }, [dateRange]);

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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Revenue Analytics</h1>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={({ startDate, endDate }) => {
            setDateRange({ start: startDate, end: endDate });
          }}
        />
      </div>

      {/* Revenue Overview Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Order Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(stats.orderStatusCounts).map(([status, count]) => (
            <div 
              key={status}
              className="bg-white rounded-lg shadow p-4 border-l-4"
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
                <div>
                  <p className="text-sm text-gray-500">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {count}
                  </p>
                </div>
                <div className={`
                  rounded-full p-2
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
                  {/* Add other status icons as needed */}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-sm text-gray-500">
                  {((count / Object.values(stats.orderStatusCounts).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}% of total
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
        
      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue Distribution Over Time</h2>
          <div style={{ height: 300 }}>
            <ResponsiveLine
              data={[
                {
                  id: "Total Revenue",
                  data: stats.dailyRevenue.map(d => ({
                    x: new Date(d.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    }),
                    y: d.totalRevenue
                  }))
                },
                {
                  id: "Service Revenue",
                  data: stats.dailyRevenue.map(d => ({
                    x: new Date(d.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    }),
                    y: d.platformRevenue
                  }))
                },
                {
                  id: "Seller Payouts",
                  data: stats.dailyRevenue.map(d => ({
                    x: new Date(d.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    }),
                    y: d.sellerPayouts
                  }))
                }
              ]}
              colors={['#10b981', '#3b82f6', '#ef4444']}
              margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
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
              tooltip={({ point }) => (
                <div className="bg-gray-800 text-white p-2 text-sm rounded-lg shadow-lg">
                  <div className="font-bold">{point.data.xFormatted}</div>
                  <div>{point.serieId}: ETB {point.data.yFormatted}</div>
                </div>
              )}
            />
          </div>
        </div>
        
        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue by Payment Method</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Revenue</h3>
              <div style={{ height: 250 }}>
                <ResponsivePie
                  data={stats.revenueByPaymentMethod.map(p => ({
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
                  arcLinkLabelsTextColor="#333333"
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
                  tooltip={({ datum }) => (
                    <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg transform transition-all duration-200 scale-105">
                      <div className="font-bold text-lg">{datum.label}</div>
                      <div className="text-lg">{datum.formattedValue}</div>
                      <div className="text-sm text-gray-300">
                        {((datum.value / stats.totalRevenue) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Service Revenue</h3>
              <div style={{ height: 250 }}>
                <ResponsivePie
                  data={stats.revenueByPaymentMethod.map(p => ({
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
                  arcLinkLabelsTextColor="#333333"
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
                  tooltip={({ datum }) => (
                    <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg transform transition-all duration-200 scale-105">
                      <div className="font-bold text-lg">{datum.label}</div>
                      <div className="text-lg">{datum.formattedValue}</div>
                      <div className="text-sm text-gray-300">
                        {((datum.value / stats.serviceFees) * 100).toFixed(1)}% of service revenue
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
            <div className="md:col-span-2 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.revenueByPaymentMethod.map(method => (
                  <div key={method.method} className="bg-gray-50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-500">{method.method}</h4>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(method.amount)}</p>
                    <p className="text-sm text-gray-500">
                      Service: {formatCurrency(method.serviceRevenue)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Sellers Table */}
      <div className="mt-8">
      <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Top Performing Sellers</h3>
          </div>
          <div className="border-t border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earnings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg. Order Value</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.topSellers.map((seller) => (
                  <tr key={seller.seller_id}>
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
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'platform revenue':
        return (
          <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'seller payouts':
        return (
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'vat collected':
        return (
          <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'service fees':
        return (
          <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'delivery fees':
        return (
          <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'all pending payouts':
        return (
          <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return (
          <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
            <p className="text-sm text-gray-500 mb-2">{subtext}</p>
            <div className={`flex items-center text-sm font-medium ${
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend > 0 ? (
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              ) : trend < 0 ? (
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
              )}
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          </div>
          <div className="flex-shrink-0 ml-4">
            {getIcon(title)}
          </div>
        </div>
      </div>
    </div>
  );
} 