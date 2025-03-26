'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import { DateRangePicker } from '@/components/DateRangePicker';
import { LineChart } from '@/components/charts/LineChart';
import { PieChart } from '@/components/charts/PieChart';
import { BarChart } from '@/components/charts/BarChart';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';

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
  }>;
  topSellers: Array<{
    seller_id: string;
    seller_name: string;
    total_sales: number;
    total_payout: number;
    transaction_count: number;
  }>;
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
    topSellers: []
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
        } else {
          acc.push({
            method: t.payment_method,
            amount: t.total_amount || 0
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

      setStats({
        totalRevenue: transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0,
        platformRevenue: transactions?.reduce((sum, t) => sum + (t.platform_revenue || 0), 0) || 0,
        sellerPayouts: transactions?.reduce((sum, t) => sum + (t.seller_payout_amount || 0), 0) || 0,
        vatCollected: transactions?.reduce((sum, t) => sum + (t.vat_amount || 0), 0) || 0,
        serviceFees: transactions?.reduce((sum, t) => sum + (t.service_fee || 0), 0) || 0,
        deliveryFees: transactions?.reduce((sum, t) => sum + (t.delivery_fee || 0), 0) || 0,
        dailyRevenue,
        revenueByPaymentMethod,
        topSellers
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

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue Distribution Over Time</h2>
          <LineChart
            data={[
              {
                id: "Total Revenue",
                data: stats.dailyRevenue.map(d => ({
                  x: d.date,
                  y: d.totalRevenue
                }))
              },
              {
                id: "Platform Revenue",
                data: stats.dailyRevenue.map(d => ({
                  x: d.date,
                  y: d.platformRevenue
                }))
              },
              {
                id: "Seller Payouts",
                data: stats.dailyRevenue.map(d => ({
                  x: d.date,
                  y: d.sellerPayouts
                }))
              }
            ]}
            height={300}
          />
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue by Payment Method</h2>
          <PieChart
            data={stats.revenueByPaymentMethod.map(p => ({
              id: p.method,
              label: p.method,
              value: p.amount
            }))}
            height={300}
          />
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