'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker } from '@/components/DateRangePicker';

// First, let's define the Transaction interface
interface Transaction {
  id: string;
  created_at: string;
  order_id: string;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  platform_fee: number;
  service_fee: number;
  vat_amount: number;
  delivery_fee: number;
  seller_payout_amount: number;
  seller_payout_status: string;
  seller?: {
    id: string;
    full_name: string;
    email: string;
  };
  order?: {
    id: string;
    tx_ref: string;
    payment_reference: string;
    order_status: string;
    payment_status: string;
    product?: {
      id: string;
      title: string;
    };
  };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ 
    start: null, 
    end: null 
  });
  const [filters, setFilters] = useState({
    status: 'all',
    paymentMethod: 'all'
  });

  const supabase = createClientComponent();

  useEffect(() => {
    fetchTransactions();
  }, [dateRange, filters]);

  const fetchTransactions = async () => {
    try {
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
        .order('created_at', { ascending: false });

      // Apply date filters
      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end);
      }

      // Apply status filters
      if (filters.status !== 'all') {
        query = query.eq('payment_status', filters.status);
      }

      // Apply payment method filters
      if (filters.paymentMethod !== 'all') {
        query = query.eq('payment_method', filters.paymentMethod);
      }

      // Add console.log to debug the data
      const { data, error } = await query;
      console.log('Fetched transactions:', data);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const approvePayout = async (transactionId: string) => {
    try {
      // First, get the current transaction data
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (fetchError) throw fetchError;

      // Update the transaction
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          seller_payout_status: 'completed',
          updated_at: new Date().toISOString(),
          payout_completed_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updateError) throw updateError;
      
      toast.success('Payment transferred to seller successfully');
      fetchTransactions(); // Refresh the data
    } catch (error) {
      console.error('Error approving payout:', error);
      toast.error('Failed to transfer payment');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
        <div className="mt-4 sm:mt-0 sm:flex sm:space-x-4">
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={({ startDate, endDate }) => 
              setDateRange({ start: startDate, end: endDate })}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
          >
            <option value="all">All Payment Methods</option>
            <option value="card">Card</option>
            <option value="bank">Bank Transfer</option>
            <option value="mobile">Mobile Money</option>
          </select>
        </div>
      </div>

      {/* Transaction Stats */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Transactions"
          value={transactions.length}
          trend={+5}
        />
        <StatCard
          title="Total Volume"
          value={formatCurrency(
            transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0)
          )}
          trend={+12}
        />
        <StatCard
          title="Average Transaction"
          value={formatCurrency(
            transactions.length > 0
              ? transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0) / transactions.length
              : 0
          )}
          trend={-2}
        />
      </div>

      {/* Updated Transactions Table */}
      <div className="mt-8">
        <DataTable
          data={transactions}
          columns={[
            {
              header: 'Transaction ID',
              accessor: 'id',
              cell: (row) => (
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    #{row.id.substring(0, 8)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                </div>
              )
            },
            {
              header: 'Order Info',
              accessor: 'order',
              cell: (row) => (
                <div>
                  <div className="text-sm text-gray-900">
                    Order #{row.order_id ? row.order_id.substring(0, 8) : 'N/A'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.order?.product?.title || 'N/A'}
                  </div>
                </div>
              )
            },
            {
              header: 'Amount',
              accessor: 'total_amount',
              cell: (row) => (
                <div className="text-sm font-medium text-gray-900">
                  {formatCurrency(row.total_amount)}
                </div>
              )
            },
            {
              header: 'Status',
              accessor: 'payment_status',
              cell: (row) => (
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                  ${row.payment_status === 'completed' ? 
                    'bg-green-100 text-green-800' : 
                    'bg-yellow-100 text-yellow-800'}`}>
                  {row.payment_status}
                </span>
              )
            },
            {
              header: 'Seller Info',
              accessor: 'seller',
              cell: (row) => (
                <div>
                  <div className="text-sm text-gray-900">
                    {row.seller?.full_name || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.seller?.email || 'No email'}
                  </div>
                </div>
              )
            },
            {
              header: 'Payment Details',
              accessor: 'payment_details',
              cell: (row) => (
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Total: {formatCurrency(row.total_amount)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Method: {row.payment_method}
                  </div>
                  <div className="text-sm text-gray-500">
                    Status: {row.payment_status}
                  </div>
                </div>
              )
            },
            {
              header: 'Fees & VAT',
              accessor: 'fees',
              cell: (row) => (
                <div>
                  <div className="text-sm text-gray-900">
                    Platform: {formatCurrency(row.platform_fee || 0)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Service: {formatCurrency(row.service_fee || 0)}
                  </div>
                  <div className="text-sm text-gray-500">
                    VAT: {formatCurrency(row.vat_amount || 0)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Delivery: {formatCurrency(row.delivery_fee || 0)}
                  </div>
                </div>
              )
            },
            {
              header: 'Payout Status',
              accessor: 'seller_payout_status',
              cell: (row) => (
                <div>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${row.seller_payout_status === 'completed' ? 
                      'bg-green-100 text-green-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {row.seller_payout_status}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">
                    Payout Amount: {formatCurrency(row.seller_payout_amount || 0)}
                  </div>
                </div>
              )
            },
            {
              header: 'Actions',
              accessor: 'actions',
              cell: (row) => {
                console.log('Row data:', row); // Debug log
                return (
                  <div className="flex items-center space-x-2">
                    {row.payment_status === 'paid' && row.seller_payout_status !== 'completed' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to transfer payment to the seller?')) {
                            approvePayout(row.id);
                          }
                        }}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Transfer to Seller
                      </button>
                    )}
                    {row.seller_payout_status === 'completed' && (
                      <span className="text-sm text-green-600 font-medium">
                        ✓ Transferred
                      </span>
                    )}
                    {row.payment_status !== 'paid' && (
                      <span className="text-sm text-yellow-600">
                        Payment Pending
                      </span>
                    )}
                  </div>
                );
              }
            }
          ]}
          itemsPerPage={10}
        />
      </div>
    </div>
  );
}

// Update the StatCard interface
interface StatCardProps {
  title: string;
  value: string | number;
  trend: number;
}

function StatCard({ title, value, trend }: StatCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
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