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
import { fetchDashboardStats, StatCard, DashboardStats } from '@/components/DashboardStats';
import Link from 'next/link';
import { ResponsiveLine } from '@nivo/line';
import { format } from 'date-fns';

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
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null
  });
  const [revenueDateRange, setRevenueDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null
  });
  const [transactionDateRange, setTransactionDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null
  });
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingPayouts: 0,
    allPendingPayouts: 0,
    completedPayouts: 0,
    recentTransactions: [],
    dailyRevenue: [],
    paymentMethods: []
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [transactionData, setTransactionData] = useState<any[]>([]);
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
    loadDashboardStats();
  }, [dateRange]);

  useEffect(() => {
    loadRevenueData();
  }, [revenueDateRange]);

  useEffect(() => {
    loadTransactionData();
  }, [transactionDateRange]);

  // Initialize chart data with main stats when they load
  useEffect(() => {
    if (stats.dailyRevenue.length > 0) {
      setRevenueData(stats.dailyRevenue);
      setTransactionData(stats.dailyRevenue);
    } else {
      // Provide fallback data when no transactions exist
      const fallbackData = [{
        date: new Date().toISOString().split('T')[0],
        revenue: 0,
        transactions: 0
      }];
      setRevenueData(fallbackData);
      setTransactionData(fallbackData);
    }
  }, [stats.dailyRevenue]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const dashboardStats = await fetchDashboardStats(dateRange);
      setStats(dashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueData = async () => {
    try {
      const revenueStats = await fetchDashboardStats(revenueDateRange);
      setRevenueData(revenueStats.dailyRevenue);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      toast.error('Failed to load revenue data');
    }
  };

  const loadTransactionData = async () => {
    try {
      const transactionStats = await fetchDashboardStats(transactionDateRange);
      setTransactionData(transactionStats.dailyRevenue);
    } catch (error) {
      console.error('Error fetching transaction data:', error);
      toast.error('Failed to load transaction data');
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
      loadDashboardStats(); // Refresh the data
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={({ startDate, endDate }) => {
            setDateRange({ start: startDate, end: endDate });
          }}
        />
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          trend={+12}
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders.toString()}
          trend={+8}
        />
        <StatCard
          title="Seller Payout"
          value={formatCurrency(stats.pendingPayouts)}
          trend={+5}
        />
        <StatCard
          title="All Pending Payouts"
          value={formatCurrency(stats.allPendingPayouts)}
          trend={+3}
        />
        <StatCard
          title="Completed Payouts"
          value={formatCurrency(stats.completedPayouts)}
          trend={+8}
        />
      </div>

      {/* Charts */}
      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Platform Revenue Trend</h2>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
              Service Fee + Platform Fee
            </div>
          </div>
          <div style={{ height: 350 }}>
            {revenueData.length > 0 && revenueData.some(d => d.revenue > 0) ? (
              <ResponsiveLine
                data={[{
                  id: "Platform Revenue",
                  data: revenueData.map(d => ({
                    x: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    y: d.revenue
                  }))
                }]}
                colors={['#10b981']}
                margin={{ top: 20, right: 20, bottom: 80, left: 80 }}
                enableArea={true}
                areaBaselineValue={0}
                areaOpacity={0.1}
                pointSize={8}
                pointColor="#ffffff"
                pointBorderWidth={2}
                pointBorderColor="#10b981"
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
                    <div className="text-green-300">Revenue: {point.data.yFormatted}</div>
                  </div>
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-[350px] text-gray-500">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <p className="mt-2 text-sm">No revenue data available</p>
                </div>
              </div>
            )}
          </div>
          {/* Revenue Chart Date Range Picker */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Filter by date range:</span>
              <DateRangePicker
                startDate={revenueDateRange.start}
                endDate={revenueDateRange.end}
                onChange={({ startDate, endDate }) => {
                  setRevenueDateRange({ start: startDate, end: endDate });
                }}
              />
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Methods Distribution</h2>
          <div style={{ height: 350 }}>
            {stats.paymentMethods.length > 0 ? (
              <PieChart
                data={stats.paymentMethods.map(p => ({
                  id: p.method,
                  label: p.method,
                  value: p.amount
                }))}
                height={300}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="mt-2 text-sm">No payment data available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Volume */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Daily Transaction Volume</h2>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
              Number of transactions per day
            </div>
          </div>
          <div style={{ height: 350 }}>
            {transactionData.length > 0 && transactionData.some(d => d.transactions > 0) ? (
              <BarChart
                data={transactionData}
                keys={['transactions']}
                indexBy="date"
                height={300}
              />
            ) : (
              <div className="flex items-center justify-center h-[350px] text-gray-500">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="mt-2 text-sm">No transaction data available</p>
                </div>
              </div>
            )}
          </div>
          {/* Transaction Chart Date Range Picker */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Filter by date range:</span>
              <DateRangePicker
                startDate={transactionDateRange.start}
                endDate={transactionDateRange.end}
                onChange={({ startDate, endDate }) => {
                  setTransactionDateRange({ start: startDate, end: endDate });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Transactions</h2>
          <Link href="/admin/transactions" className="text-red-600 hover:text-red-700 font-medium">
            View all
          </Link>
        </div>
        <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Order Info
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Payment Details
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Payout Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Seller Info
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Fees & VAT
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentTransactions.length > 0 ? (
                  stats.recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">#{transaction.id.slice(0, 8)}</div>
                        <div className="text-gray-500">{new Date(transaction.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="text-gray-900">{transaction.customer_name || 'N/A'}</div>
                        <div className="text-gray-500">{transaction.customer_email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">Total: {formatCurrency(transaction.total_amount)}</div>
                        <div className="text-gray-500">Method: {transaction.payment_method}</div>
                        <div className="text-gray-500">Status: {transaction.payment_status}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${transaction.seller_payout_status === 'completed' ? 
                            'bg-green-100 text-green-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {transaction.seller_payout_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="text-gray-900">
                          {(() => {
                            const storeSettings = transaction.seller?.store_settings as any;
                            return storeSettings?.name || 'Unknown Store';
                          })()}
                        </div>
                        <div className="text-gray-500">{transaction.seller?.email || 'No email'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="text-gray-900">Service: {formatCurrency(transaction.service_fee)}</div>
                        <div className="text-gray-500">VAT: {formatCurrency(transaction.vat_amount)}</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <p className="text-lg font-medium">No transactions found</p>
                        <p className="text-sm">Transactions will appear here once orders are placed and payments are processed.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 