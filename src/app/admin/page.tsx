'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { LineChart } from '@/components/charts/LineChart';
import { PieChart } from '@/components/charts/PieChart';
import { BarChart } from '@/components/charts/BarChart';
import { DateRangePicker } from '@/components/DateRangePicker';
import Link from 'next/link';
import { ResponsiveLine } from '@nivo/line';
import { format } from 'date-fns';

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPayouts: number;
  completedPayouts: number;
  recentTransactions: any[];
  dailyRevenue: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
}

// Add interface for Transaction type
interface Transaction {
  id: string;
  created_at: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  vat_amount: number;
  platform_fee: number;
  service_fee: number;
  delivery_fee: number;
  total_amount: number;
  seller_payout_amount: number;
  platform_revenue: number;
  seller_payout_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_id: string;
  seller?: {
    id: string;
    full_name: string;
    email: string;
    store_settings?: {
      name: string;
      // ... other store settings fields
    };
  } | null;
  order: {
    id: string;
    tx_ref: string;
    payment_reference: string;
    order_status: string;
    payment_status: string;
    product: {
      id: string;
      title: string;
    } | null;
  } | null;
}

export default function AdminDashboardPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingPayouts: 0,
    completedPayouts: 0,
    recentTransactions: [],
    dailyRevenue: [],
    paymentMethods: []
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponent();

  // Create service role client inside component
  const serviceRoleClient = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    ) : supabase;

  useEffect(() => {
    fetchDashboardStats();
  }, [dateRange]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch transactions within date range
      const { data: transactions, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          *,
          seller:users!transactions_seller_id_fkey (
            id,
            full_name,
            email,
            store_settings
          ),
          order:orders!transactions_order_id_fkey (
            id,
            tx_ref,
            payment_reference,
            order_status,
            payment_status,
            product:products!orders_product_id_fkey (
              id,
              title
            )
          )
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      if (transactionError) throw transactionError;

      // Calculate daily revenue
      const dailyRevenue = transactions?.reduce((acc, t) => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        const platformProfit = (t.service_fee || 0) + (t.platform_fee || 0); // Calculate platform profit
        
        const existing = acc.find((d: { date: string }) => d.date === date);
        if (existing) {
          existing.revenue += platformProfit;
          existing.transactions += 1;
        } else {
          acc.push({
            date,
            revenue: platformProfit,
            transactions: 1
          });
        }
        return acc;
      }, [] as DashboardStats['dailyRevenue']).sort((a: {date: string}, b: {date: string}) => a.date.localeCompare(b.date)) || [];

      // Calculate payment method stats
      const paymentMethods = transactions?.reduce((acc, t) => {
        const existing = acc.find((p: { method: string }) => p.method === t.payment_method);
        if (existing) {
          existing.count += 1;
          existing.amount += t.total_amount || 0;
        } else {
          acc.push({
            method: t.payment_method,
            count: 1,
            amount: t.total_amount || 0
          });
        }
        return acc;
      }, [] as DashboardStats['paymentMethods']) || [];

      // Get other stats
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: userCount || 0,
        totalProducts: productCount || 0,
        totalOrders: transactions?.length || 0,
        totalRevenue: transactions?.reduce((sum, t) => 
          sum + ((t.service_fee || 0) + (t.platform_fee || 0)), 0) || 0, // Update total revenue to show platform profit
        pendingPayouts: transactions?.reduce((sum, t) => 
          t.seller_payout_status === 'pending' ? sum + (t.seller_payout_amount || 0) : sum, 0) || 0,
        completedPayouts: transactions?.reduce((sum, t) => 
          t.seller_payout_status === 'completed' ? sum + (t.seller_payout_amount || 0) : sum, 0) || 0,
        recentTransactions: transactions?.slice(0, 5) || [],
        dailyRevenue,
        paymentMethods
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const approvePayout = async (transactionId: string) => {
    try {
      const { error: transactionError } = await serviceRoleClient
        .from('transactions')
        .update({ 
          seller_payout_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (transactionError) throw transactionError;
      
      toast.success('Payout approved successfully');
      fetchDashboardStats(); // Refresh the data
    } catch (error) {
      console.error('Error approving payout:', error);
      toast.error('Failed to approve payout');
    }
  };

  if (loading) return <LoadingSpinner />;

  // Update the columns array
  const columns = [
    {
      header: 'Transaction ID',
      accessorKey: 'id',
      cell: ({ row }: { row: { original: Transaction } }) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900">#{row.original.id.slice(0, 8)}</div>
          <div className="text-gray-500">{format(new Date(row.original.created_at), 'MMM d, yyyy')}</div>
        </div>
      ),
    },
    {
      header: 'Order Info',
      accessorKey: 'order',
      cell: ({ row }: { row: { original: Transaction } }) => (
        <div className="text-sm">
          <div className="text-gray-900 relative group">
            <span 
              className="truncate block max-w-[200px] cursor-help"
              data-tip={row.original.order?.product?.title || 'N/A'}
            >
              {row.original.order?.product?.title || 'N/A'}
            </span>
            <div className="opacity-0 bg-black text-white text-xs rounded py-1 px-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-nowrap">
              {row.original.order?.product?.title || 'N/A'}
              <svg className="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
            </div>
          </div>
          <div className="text-gray-500">Ref: {row.original.order?.payment_reference?.slice(0, 8) || 'N/A'}</div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessorKey: 'customer',
      cell: ({ row }: { row: { original: Transaction } }) => (
        <div className="text-sm">
          <div className="text-gray-900">{row.original.customer_name || 'N/A'}</div>
          <div className="text-gray-500">{row.original.customer_email || 'N/A'}</div>
        </div>
      ),
    },
    {
      header: 'Payment Details',
      accessorKey: 'payment_details',
      cell: ({ row }: { row: { original: Transaction } }) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900">Total: {formatCurrency(row.original.total_amount)}</div>
          <div className="text-gray-500">Method: {row.original.payment_method}</div>
          <div className="text-gray-500">Status: {row.original.payment_status}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'payment_status',
      cell: ({ row }: { row: { original: Transaction } }) => (
        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
          row.original.payment_status === 'paid'
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {row.original.payment_status}
        </span>
      ),
    },
    {
      header: 'Seller Info',
      accessorKey: 'seller',
      cell: ({ row }: { row: { original: Transaction } }) => {
        const storeSettings = row.original.seller?.store_settings as any; // Cast to any to access JSON
        return (
          <div className="text-sm">
            <div className="text-gray-900">
              {storeSettings?.name || 'Unknown Store'}
            </div>
            <div className="text-gray-500">{row.original.seller?.email || 'No email'}</div>
          </div>
        );
      },
    },
    {
      header: 'Fees & VAT',
      accessorKey: 'fees',
      cell: ({ row }: { row: { original: Transaction } }) => (
        <div className="text-sm">
          <div className="text-gray-900">Service: {formatCurrency(row.original.service_fee)}</div>
          <div className="text-gray-500">VAT: {formatCurrency(row.original.vat_amount)}</div>
        </div>
      ),
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
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

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          trend={+12}
        />
        <StatCard
          title="Pending Payouts"
          value={formatCurrency(stats.pendingPayouts)}
          trend={+5}
        />
        <StatCard
          title="Completed Payouts"
          value={formatCurrency(stats.completedPayouts)}
          trend={+8}
        />
      </div>

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Platform Revenue Trend</h2>
            <div className="text-sm text-gray-500">
              Service Fee + Platform Fee
            </div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveLine
              data={[{
                id: "Platform Revenue",
                data: stats.dailyRevenue.map(d => ({
                  x: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  y: d.revenue
                }))
              }]}
              colors={['#ef4444']}
              margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
              enableArea={true}
              areaBaselineValue={0}
              areaOpacity={0.1}
              pointSize={8}
              pointColor="#ffffff"
              pointBorderWidth={2}
              pointBorderColor="#ef4444"
              yFormat={value => `ETB ${value.toLocaleString()}`}
              curve="monotoneX"
              useMesh={true}
              tooltip={({ point }) => (
                <div className="bg-gray-800 text-white p-2 text-sm rounded-lg shadow-lg">
                  <div className="font-bold">{point.data.xFormatted}</div>
                  <div>Revenue: ETB {point.data.yFormatted}</div>
                </div>
              )}
            />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Payment Methods</h2>
          <PieChart
            data={stats.paymentMethods.map(p => ({
              id: p.method,
              label: p.method,
              value: p.amount
            }))}
            height={300}
          />
        </div>

        {/* Transaction Volume */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Volume</h2>
          <BarChart
            data={stats.dailyRevenue}
            keys={['transactions']}
            indexBy="date"
            height={300}
          />
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Recent Transactions</h2>
          <Link href="/admin/transactions" className="text-red-600 hover:text-red-700">
            View all
          </Link>
        </div>
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Info
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Details
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payout Status
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seller Info
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fees & VAT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recentTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium text-gray-900">#{transaction.id.slice(0, 8)}</div>
                    <div className="text-gray-500">{new Date(transaction.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="text-gray-900 relative group">
                      <span 
                        className="truncate block max-w-[200px] cursor-help"
                        data-tip={transaction.order?.product?.title || 'N/A'}
                      >
                        {transaction.order?.product?.title || 'N/A'}
                      </span>
                      <div className="opacity-0 bg-black text-white text-xs rounded py-1 px-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-nowrap">
                        {transaction.order?.product?.title || 'N/A'}
                        <svg className="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                      </div>
                    </div>
                    <div className="text-gray-500">Ref: {transaction.order?.payment_reference?.slice(0, 8) || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="text-gray-900">{transaction.customer_name || 'N/A'}</div>
                    <div className="text-gray-500">{transaction.customer_email || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium text-gray-900">Total: {formatCurrency(transaction.total_amount)}</div>
                    <div className="text-gray-500">Method: {transaction.payment_method}</div>
                    <div className="text-gray-500">Status: {transaction.payment_status}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${transaction.seller_payout_status === 'completed' ? 
                        'bg-green-100 text-green-800' : 
                        'bg-yellow-100 text-yellow-800'}`}>
                      {transaction.seller_payout_status}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="text-gray-900">
                      {(() => {
                        const storeSettings = transaction.seller?.store_settings as any;
                        return storeSettings?.name || 'Unknown Store';
                      })()}
                    </div>
                    <div className="text-gray-500">{transaction.seller?.email || 'No email'}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="text-gray-900">Service: {formatCurrency(transaction.service_fee)}</div>
                    <div className="text-gray-500">VAT: {formatCurrency(transaction.vat_amount)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, trend }: { title: string; value: string; trend: number }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {/* Add icon based on type */}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
} 