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
}

export default function RevenuePage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
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
    }
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchRevenueStats();
  }, [dateRange]);

  const fetchRevenueStats = async () => {
    try {
      setLoading(true);

      const { data: transactions, error } = await supabase
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
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate daily revenue
      const dailyRevenue = transactions?.reduce((acc, t) => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        const existing = acc.find((d: {date: string}) => d.date === date);
        
        if (existing) {
          existing.totalRevenue += t.total_amount || 0;
          existing.platformRevenue += t.platform_revenue || 0;
          existing.sellerPayouts += t.seller_payout_amount || 0;
        } else {
          acc.push({
            date,
            totalRevenue: t.total_amount || 0,
            platformRevenue: t.platform_revenue || 0,
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
          existing.serviceRevenue += t.service_fee || 0;
        } else {
          acc.push({
            method: t.payment_method,
            amount: t.total_amount || 0,
            serviceRevenue: t.service_fee || 0
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

      setStats({
        totalRevenue: transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0,
        platformRevenue: transactions?.reduce((sum, t) => sum + (t.platform_revenue || 0), 0) || 0,
        sellerPayouts: transactions?.reduce((sum, t) => sum + (t.seller_payout_amount || 0), 0) || 0,
        vatCollected: transactions?.reduce((sum, t) => sum + (t.vat_amount || 0), 0) || 0,
        serviceFees: transactions?.reduce((sum, t) => sum + (t.service_fee || 0), 0) || 0,
        deliveryFees: transactions?.reduce((sum, t) => sum + (t.delivery_fee || 0), 0) || 0,
        dailyRevenue,
        revenueByPaymentMethod,
        topSellers,
        orderStatusCounts,
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
            if (startDate && endDate) {
              setDateRange({ start: startDate, end: endDate });
            }
          }}
        />
      </div>

      {/* Revenue Overview Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              colors={['#ef4444', '#3b82f6', '#10b981']}
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
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
            <dd className="mt-1 text-sm text-gray-500">{subtext}</dd>
          </div>
          <div className={`flex items-center text-sm ${
            trend > 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </div>
        </div>
      </div>
    </div>
  );
} 