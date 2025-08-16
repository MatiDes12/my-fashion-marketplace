'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { fetchDashboardStats } from '@/components/DashboardStats';

// First, let's define the Transaction interface
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
    delivery_proof_image?: string;
    delivery_method?: string;
    delivery_address?: string;
    selected_size?: string;
    selected_color?: string;
    receipt_url?: string;
    product: {
      id: string;
      title: string;
    } | null;
  } | null;
}

interface Stats {
  totalTransactions: number;
  totalRevenue: number;
  pendingPayouts: number;
  completedPayouts: number;
  platformRevenue: number;
  allPendingPayouts: number; // Added for the new stat
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null
  });
  const [filters, setFilters] = useState({
    status: 'all',
    paymentMethod: 'all',
    payoutStatus: 'all'
  });
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    totalRevenue: 0,
    pendingPayouts: 0,
    completedPayouts: 0,
    platformRevenue: 0,
    allPendingPayouts: 0 // Initialize the new stat
  });
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    fetchTransactions();
  }, [dateRange, filters]);

  // Filter transactions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTransactions(transactions);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = transactions.filter(transaction => {
      return (
        transaction.id.toLowerCase().includes(query) ||
        transaction.order_id.toLowerCase().includes(query) ||
        transaction.payment_method.toLowerCase().includes(query) ||
        transaction.payment_status.toLowerCase().includes(query) ||
        transaction.seller_payout_status.toLowerCase().includes(query) ||
        transaction.seller?.full_name?.toLowerCase().includes(query) ||
        transaction.seller?.email?.toLowerCase().includes(query) ||
        transaction.order?.product?.title?.toLowerCase().includes(query) ||
        transaction.order?.order_status?.toLowerCase().includes(query) ||
        transaction.order?.tx_ref?.toLowerCase().includes(query) ||
        transaction.order?.payment_reference?.toLowerCase().includes(query) ||
        formatCurrency(transaction.total_amount).toLowerCase().includes(query) ||
        formatCurrency(transaction.seller_payout_amount).toLowerCase().includes(query)
      );
    });

    setFilteredTransactions(filtered);
  }, [searchQuery, transactions]);

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
            delivery_proof_image,
            delivery_method,
            delivery_address,
            selected_size,
            selected_color,
            receipt_url,
            product:products!orders_product_id_fkey (
              id,
              title
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Apply date filters
      if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0); // Set to start of day
        query = query.gte('created_at', startDate.toISOString());
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        query = query.lte('created_at', endDate.toISOString());
      }

      // Apply status filters
      if (filters.status !== 'all') {
        query = query.eq('payment_status', filters.status);
      }

      // Apply payment method filters
      if (filters.paymentMethod !== 'all') {
        query = query.eq('payment_method', filters.paymentMethod);
      }

      // Apply payout status filters
      if (filters.payoutStatus !== 'all') {
        if (filters.payoutStatus === 'pending_payouts') {
          // Show only completed orders (delivered or picked up) with pending seller payouts
          query = query.eq('seller_payout_status', 'pending')
                      .eq('payment_status', 'paid');
          
          // Execute query and filter results
          const { data, error } = await query;
          if (error) throw error;

          // Filter the results to only include completed orders
          const filteredData = data?.filter(transaction => 
            transaction.order?.order_status === 'delivered' || 
            transaction.order?.order_status === 'picked up'
          ) || [];
          
          setTransactions(filteredData);
          setFilteredTransactions(filteredData);
          updateStats(filteredData);
          return; // Exit early since we've already set the data
        } else {
          query = query.eq('seller_payout_status', filters.payoutStatus);
        }
      }

      // Execute the main query for all other cases
      const { data, error } = await query;
      console.log('Fetched transactions:', data);

      if (error) throw error;
      setTransactions(data || []);
      setFilteredTransactions(data || []);
      updateStats(data || []);

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (transactions: Transaction[]) => {
    // Calculate pending payouts - only for completed orders (delivered/picked up)
    const pendingPayouts = transactions.reduce((sum, t) => {
      if (t.seller_payout_status === 'pending' && 
          t.payment_status === 'paid' && 
          (t.order?.order_status === 'delivered' || t.order?.order_status === 'picked up')) {
        return sum + (t.seller_payout_amount || 0);
      }
      return sum;
    }, 0);

    // Calculate completed payouts
    const completedPayouts = transactions.reduce((sum, t) => {
      if (t.seller_payout_status === 'completed' && t.payment_status === 'paid') {
        return sum + (t.seller_payout_amount || 0);
      }
      return sum;
    }, 0);

    // Calculate all pending payouts (including those awaiting delivery/pickup)
    const allPendingPayouts = transactions.reduce((sum, t) => {
      if (t.seller_payout_status === 'pending' && t.payment_status === 'paid') {
        return sum + (t.seller_payout_amount || 0);
      }
      return sum;
    }, 0);

    setStats({
      totalTransactions: transactions.length,
      totalRevenue: transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0),
      pendingPayouts: pendingPayouts,
      completedPayouts: completedPayouts,
      platformRevenue: transactions.reduce((sum, t) => 
        sum + ((t.service_fee || 0) + (t.platform_fee || 0)), 0),
      allPendingPayouts: allPendingPayouts // Update the new stat
    });
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

      // Update the transaction - only update seller_payout_status and updated_at
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          seller_payout_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updateError) throw updateError;

      // Notify seller via Telegram if they are linked
      try {
        const sellerId = (transaction as any)?.seller_id;
        if (sellerId) {
          const payload = {
            type: 'seller_notification',
            userId: String(sellerId),
            data: {
              type: 'payout_transfer',
              message: 'Your payout has been transferred to your account.',
              amount: (transaction as any)?.seller_payout_amount || 0,
              order_id: (transaction as any)?.order_id || ''
            }
          };
          await fetch('/api/telegram/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      } catch (notifyErr) {
        console.warn('[TELEGRAM] Failed to send payout transfer notification:', notifyErr);
      }
      
      toast.success('Payment transferred to seller successfully');
      setShowTransferModal(false);
      setSelectedTransaction(null);
      fetchTransactions(); // Refresh the data
    } catch (error) {
      console.error('Error approving payout:', error);
      toast.error('Failed to transfer payment');
    }
  };

  const handleTransferClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransferModal(true);
  };

  const getOrderStatusCounts = (transactions: Transaction[]) => {
    return transactions.reduce((acc, transaction) => {
      const status = transaction.order?.order_status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
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
            onChange={({ startDate, endDate }) => {
              setDateRange({ start: startDate, end: endDate });
            }}
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
            <option value="CASH">Cash</option>
            <option value="CHAPA">Chapa</option>
            <option value="TELEBIRR">Telebirr</option>
          </select>
          <select
            value={filters.payoutStatus}
            onChange={(e) => setFilters({ ...filters, payoutStatus: e.target.value })}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
          >
            <option value="all">All Payout Status</option>
            <option value="pending_payouts">Seller Payout (Ready to Transfer)</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          {/* Quick filter button for pending payouts */}
          <button
            onClick={() => setFilters({ ...filters, payoutStatus: 'pending_payouts' })}
            className="mt-1 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Show Seller Payout
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions by ID, seller name, product, amount, status..."
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
          />
          {searchQuery && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Found {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Transaction Stats */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          title="Total Transactions"
          value={filteredTransactions.length}
          trend={+5}
          icon="transactions"
        />
        <StatCard
          title="Total Volume"
          value={formatCurrency(filteredTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0))}
          trend={+12}
          icon="volume"
        />
        <StatCard
          title="Service Fee Revenue"
          value={formatCurrency(filteredTransactions.reduce((sum, t) => sum + ((t.service_fee || 0) + (t.platform_fee || 0)), 0))}
          trend={+8}
          icon="revenue"
        />
        <StatCard
          title="Average Transaction"
          value={filteredTransactions.length > 0 ? formatCurrency(filteredTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0) / filteredTransactions.length) : formatCurrency(0)}
          trend={-2}
          icon="average"
        />
        <StatCard
          title="Seller Payout"
          value={formatCurrency(filteredTransactions.reduce((sum, t) => {
            if (t.seller_payout_status === 'pending' && 
                t.payment_status === 'paid' && 
                (t.order?.order_status === 'delivered' || t.order?.order_status === 'picked up')) {
              return sum + (t.seller_payout_amount || 0);
            }
            return sum;
          }, 0))}
          trend={0}
          highlight={true}
          icon="payouts"
        />
        <StatCard
          title="All Pending Payouts"
          value={formatCurrency(filteredTransactions.reduce((sum, t) => {
            if (t.seller_payout_status === 'pending' && t.payment_status === 'paid') {
              return sum + (t.seller_payout_amount || 0);
            }
            return sum;
          }, 0))}
          trend={+3}
          icon="allPayouts"
        />
      </div>

      {/* Order Status Stats */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Order Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => {
            const count = getOrderStatusCounts(filteredTransactions)[status] || 0;
            return (
              <div 
                key={status}
                className="bg-white rounded-lg shadow p-4 border-l-4"
                style={{
                  borderLeftColor: 
                    status === 'delivered' ? '#10B981' :  // green
                    status === 'pending' ? '#F59E0B' :    // yellow
                    status === 'confirmed' ? '#3B82F6' :  // blue
                    status === 'shipped' ? '#6366F1' :    // indigo
                    '#EF4444'                             // red (cancelled)
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
                    {/* Icons for each status */}
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {status === 'cancelled' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-gray-500">
                    {filteredTransactions.length > 0 ? ((count / filteredTransactions.length) * 100).toFixed(1) : '0'}% of total
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Updated Transactions Table */}
      <div className="mt-8">
        <DataTable
          data={filteredTransactions}
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
                <div className="flex flex-col gap-1">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${row.payment_status === 'paid' ? 
                    'bg-green-100 text-green-800' : 
                      row.payment_status === 'failed' ?
                      'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'}`}>
                  {row.payment_status}
                </span>
                </div>
              )
            },
            {
              header: 'Delivery',
              accessor: 'delivery',
              cell: (row) => (
                <div>
                  {row.order?.order_status === 'delivered' && row.order?.delivery_proof_image && (
                    <div className="relative group">
                      <img 
                        src={row.order.delivery_proof_image}
                        alt="Delivery Proof"
                        className="h-10 w-10 rounded object-cover cursor-pointer"
                        onClick={() => {
                          setSelectedTransaction(row);
                          setShowDetailsModal(true);
                        }}
                      />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
                        Click to view details
                      </div>
                    </div>
                  )}
                  <span className={`text-sm ${
                    row.order?.order_status === 'delivered' || row.order?.order_status === 'picked up'
                      ? 'text-green-600' 
                      : 'text-gray-500'
                  }`}>
                    {row.order?.order_status || 'N/A'}
                  </span>
                </div>
              )
            },

            {
              header: 'Actions',
              accessor: 'actions',
              cell: (row) => {
                return (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedTransaction(row);
                        setShowDetailsModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View Details
                    </button>
                    {(row.order?.order_status === 'delivered' || row.order?.order_status === 'picked up') && row.payment_status === 'paid' && row.seller_payout_status !== 'completed' && (
                      <button
                        onClick={() => handleTransferClick(row)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
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

      {/* Order Details Modal */}
      {showDetailsModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity z-50">
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white bg-opacity-20">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Transaction Details</h3>
                        <p className="text-blue-100">#{selectedTransaction.id.substring(0, 8)} • {new Date(selectedTransaction.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSelectedTransaction(null);
                    }}
                      className="rounded-full p-2 hover:bg-white hover:bg-opacity-20 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  {/* Key Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Total Amount */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-blue-700">Total Amount</h4>
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                      <p className="text-3xl font-bold text-blue-900">{formatCurrency(selectedTransaction.total_amount)}</p>
                      <div className="mt-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedTransaction.payment_status === 'paid' ? 
                            'bg-green-100 text-green-800' : 
                            selectedTransaction.payment_status === 'failed' ?
                            'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedTransaction.payment_status}
                        </span>
                      </div>
                    </div>

                    {/* Seller Payout */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-green-700">Seller Payout</h4>
                        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-green-900">{formatCurrency(selectedTransaction.seller_payout_amount)}</p>
                      <div className="mt-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedTransaction.seller_payout_status === 'completed' ? 
                            'bg-green-100 text-green-800' : 
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedTransaction.seller_payout_status}
                        </span>
                      </div>
                      </div>

                    {/* Platform Revenue */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-purple-700">Platform Revenue</h4>
                        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-purple-900">
                        {formatCurrency((selectedTransaction.service_fee || 0) + (selectedTransaction.platform_fee || 0))}
                      </p>
                      <p className="text-sm text-purple-600 mt-1">Service + Platform Fees</p>
                    </div>
                      </div>

                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-6">
                      {/* Transaction & Order Info */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                            <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Transaction & Order Info
                          </h4>
                        </div>
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                              <p className="font-semibold text-gray-900">#{selectedTransaction.id.substring(0, 8)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Order ID</p>
                              <p className="font-semibold text-gray-900">#{selectedTransaction.order_id.substring(0, 8)}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Product</p>
                            <p className="font-semibold text-gray-900">{selectedTransaction.order?.product?.title || 'N/A'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Order Status</p>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {selectedTransaction.order?.order_status?.toUpperCase()}
                        </span>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Payment Method</p>
                              <p className="font-semibold text-gray-900">{selectedTransaction.payment_method}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                                              {/* Customer Information */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                              <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Customer Information
                            </h4>
                          </div>
                          <div className="p-6 space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Name</p>
                              <p className="font-semibold text-gray-900">{selectedTransaction.customer_name || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Email</p>
                              <p className="font-medium text-gray-900">{selectedTransaction.customer_email || 'No email'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Phone</p>
                              <p className="font-medium text-gray-900">{selectedTransaction.customer_phone || 'No phone'}</p>
                            </div>
                      </div>
                    </div>

                        {/* Seller Information */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                              <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Seller Information
                            </h4>
                          </div>
                          <div className="p-6 space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Name</p>
                              <p className="font-semibold text-gray-900">{selectedTransaction.seller?.full_name || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Email</p>
                              <p className="font-medium text-gray-900">{selectedTransaction.seller?.email || 'No email'}</p>
                            </div>
                      </div>
                    </div>

                      
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                      {/* Payment Details */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                            <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            Payment Details
                          </h4>
                        </div>
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Method</p>
                              <p className="font-semibold text-gray-900">{selectedTransaction.payment_method}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Status</p>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                selectedTransaction.payment_status === 'paid' ? 
                            'bg-green-100 text-green-800' : 
                                  selectedTransaction.payment_status === 'failed' ?
                                  'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                                {selectedTransaction.payment_status}
                        </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                            <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedTransaction.total_amount)}</p>
                          </div>
                      </div>
                    </div>

                      {/* Fees & VAT Breakdown */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                            <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Fees & VAT Breakdown
                          </h4>
                        </div>
                        <div className="p-6 space-y-4">
                      <div className="space-y-3">
                            <div className="flex justify-between items-center py-2">
                              <span className="text-gray-600">Service Fee</span>
                              <span className="font-medium text-gray-900">{formatCurrency(selectedTransaction.service_fee || 0)}</span>
                        </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-gray-600">Platform Fee</span>
                              <span className="font-medium text-gray-900">{formatCurrency(selectedTransaction.platform_fee || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-gray-600">Delivery Fee</span>
                              <span className="font-medium text-gray-900">{formatCurrency(selectedTransaction.delivery_fee || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-gray-600">VAT Amount</span>
                              <span className="font-medium text-gray-900">{formatCurrency(selectedTransaction.vat_amount || 0)}</span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-900">Total Fees</span>
                                <span className="font-bold text-red-600">
                                  {formatCurrency((selectedTransaction.service_fee || 0) + (selectedTransaction.platform_fee || 0) + (selectedTransaction.delivery_fee || 0) + (selectedTransaction.vat_amount || 0))}
                          </span>
                        </div>
                            </div>
                        </div>
                      </div>
                    </div>

                      {/* Payout Status */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                            <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Payout Status
                          </h4>
                        </div>
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Status</p>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                selectedTransaction.seller_payout_status === 'completed' ? 
                                  'bg-green-100 text-green-800' : 
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                                {selectedTransaction.seller_payout_status}
                              </span>
                        </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Amount</p>
                              <p className="text-xl font-bold text-green-600">{formatCurrency(selectedTransaction.seller_payout_amount || 0)}</p>
                        </div>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Proof */}
                    {selectedTransaction.order?.delivery_proof_image && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                              <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Delivery Proof
                            </h4>
                          </div>
                          <div className="p-6">
                            <div className="relative w-full h-48 rounded-lg overflow-hidden shadow-md">
                          <img 
                            src={selectedTransaction.order.delivery_proof_image}
                            alt="Delivery Proof"
                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                            </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>

                    {/* Action Buttons */}
                  <div className="mt-8 flex justify-end space-x-4">
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          setSelectedTransaction(null);
                        }}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                      >
                        Close
                      </button>
                    {(selectedTransaction.order?.order_status === 'delivered' || selectedTransaction.order?.order_status === 'picked up') && 
                     selectedTransaction.payment_status === 'paid' && 
                     selectedTransaction.seller_payout_status !== 'completed' && (
                      <button
                        onClick={() => handleTransferClick(selectedTransaction)}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-medium"
                      >
                        Transfer to Seller
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Confirmation Modal */}
      {showTransferModal && selectedTransaction && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50">
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    onClick={() => {
                      setShowTransferModal(false);
                      setSelectedTransaction(null);
                    }}
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                      Confirm Payment Transfer
                    </h3>
                    
                    {/* Transfer Amount */}
                    <div className="bg-green-50 rounded-lg p-4 mb-4">
                      <div className="text-center">
                        <p className="text-sm text-green-600 mb-2">Amount to Transfer</p>
                        <p className="text-3xl font-bold text-green-700">
                          {formatCurrency(selectedTransaction.seller_payout_amount || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Seller Information */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Seller Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Name:</span>
                          <span className="font-medium">{selectedTransaction.seller?.full_name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Email:</span>
                          <span className="font-medium">{selectedTransaction.seller?.email || 'No email'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Order Information */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Order Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Order ID:</span>
                          <span className="font-medium">#{selectedTransaction.order_id?.substring(0, 8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Product:</span>
                          <span className="font-medium">{selectedTransaction.order?.product?.title || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Status:</span>
                          <span className="font-medium text-green-600">
                            {selectedTransaction.order?.order_status?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Payment Method:</span>
                          <span className="font-medium">{selectedTransaction.payment_method}</span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="bg-blue-50 rounded-lg p-4 mb-6">
                      <h4 className="font-medium text-blue-900 mb-2">Transaction Breakdown</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Total Amount:</span>
                          <span className="font-medium">{formatCurrency(selectedTransaction.total_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Service Fee:</span>
                          <span className="font-medium">-{formatCurrency((selectedTransaction.platform_fee || 0) + (selectedTransaction.service_fee || 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">VAT:</span>
                          <span className="font-medium">{formatCurrency(selectedTransaction.vat_amount || 0)}</span>
                        </div>
                        <div className="border-t border-blue-200 pt-2 mt-2">
                          <div className="flex justify-between font-semibold text-blue-900">
                            <span>Seller Payout:</span>
                            <span>{formatCurrency(selectedTransaction.seller_payout_amount || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Warning Message */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-6">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700">
                            This action will transfer <strong>{formatCurrency(selectedTransaction.seller_payout_amount || 0)}</strong> to the seller's account. This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="button"
                        onClick={() => approvePayout(selectedTransaction.id)}
                        disabled={isProcessingTransfer}
                        className="w-full inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        {isProcessingTransfer ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          'Transfer Money'
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowTransferModal(false);
                          setSelectedTransaction(null);
                        }}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Update the StatCard interface
interface StatCardProps {
  title: string;
  value: string | number;
  trend: number;
  highlight?: boolean;
  icon?: string; // Added icon prop
}

// Custom Tooltip component for stat cards
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

function StatCard({ title, value, trend, highlight, icon }: StatCardProps) {
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'transactions':
        return (
          <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'volume':
        return (
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'revenue':
        return (
          <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'average':
        return (
          <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'payouts':
        return (
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'allPayouts': // Added new icon
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

  // Format the display value to show full number
  const formatDisplayValue = (val: string | number) => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  // Get the full value for tooltip
  const getFullValue = (val: string | number) => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className={`bg-white overflow-hidden shadow-lg rounded-xl border ${highlight ? 'border-red-300 ring-2 ring-red-200' : 'border-gray-100'}`}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <Tooltip content={getFullValue(value)}>
              <p className="text-2xl font-bold text-gray-900 mb-2 cursor-help">
                {formatDisplayValue(value)}
              </p>
            </Tooltip>
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
            {getIcon(icon || '')}
          </div>
        </div>
      </div>
    </div>
  );
} 