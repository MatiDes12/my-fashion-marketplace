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
    delivery_proof_image?: string;
    product?: {
      id: string;
      title: string;
    };
    delivery_method: string;
    delivery_address: string;
    selected_size: string;
    selected_color: string;
    receipt_url?: string;
  };
  receipt_url?: string;
  subtotal?: number;
  platform_revenue?: number;
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
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

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
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
          title="Service Fee Revenue"
          value={formatCurrency(
            transactions.reduce((sum, t) => sum + (t.service_fee || 0) + (t.platform_fee || 0), 0)
          )}
          trend={+8}
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

      {/* Order Status Stats */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Order Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => {
            const count = getOrderStatusCounts(transactions)[status] || 0;
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
                    {((count / transactions.length) * 100).toFixed(1)}% of total
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
                          setIsDetailsModalOpen(true);
                        }}
                      />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
                        Click to view details
                      </div>
                    </div>
                  )}
                  <span className={`text-sm ${
                    row.order?.order_status === 'delivered' 
                      ? 'text-green-600' 
                      : 'text-gray-500'
                  }`}>
                    {row.order?.order_status || 'N/A'}
                  </span>
                </div>
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
                  <div className="text-sm text-gray-500">
                    Service: {formatCurrency(row.service_fee || 0)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Delivery: {formatCurrency(row.delivery_fee || 0)}
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    Seller Payout: {formatCurrency(row.seller_payout_amount || 0)}
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
                return (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedTransaction(row);
                        setIsDetailsModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View Details
                    </button>
                    {row.order?.order_status === 'delivered' && row.payment_status === 'paid' && row.seller_payout_status !== 'completed' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to transfer payment to the seller?')) {
                            approvePayout(row.id);
                          }
                        }}
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
      {isDetailsModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50">
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    onClick={() => {
                      setIsDetailsModalOpen(false);
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
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                      Order Details
                    </h3>
                    
                    {/* Order Information */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Order Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Order ID</p>
                          <p className="font-medium">{selectedTransaction.order?.id}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Order Status</p>
                          <p className={`font-medium ${
                            selectedTransaction.order?.order_status === 'delivered' ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {selectedTransaction.order?.order_status?.toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Payment Status</p>
                          <p className="font-medium">{selectedTransaction.payment_status}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Payment Method</p>
                          <p className="font-medium">{selectedTransaction.payment_method}</p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Proof */}
                    {selectedTransaction.order?.delivery_proof_image && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Delivery Proof</h4>
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                          <img 
                            src={selectedTransaction.order.delivery_proof_image}
                            alt="Delivery Proof"
                            className="w-full h-full object-contain bg-gray-100"
                          />
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          Delivery Method: {selectedTransaction.order.delivery_method === 'home_delivery' ? 'Home Delivery' : 'Store Pickup'}
                        </p>
                      </div>
                    )}

                    {/* Receipt URL */}
                    {selectedTransaction.order?.receipt_url && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Payment Receipt</h4>
                        <a 
                          href={selectedTransaction.order.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View Receipt
                        </a>
                      </div>
                    )}

                    {/* Financial Details */}
                    <div className="space-y-6">
                      {/* Financial Details Section */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Details</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="space-y-3">
                            {/* Subtotal */}
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Subtotal</span>
                              <span className="text-gray-900 font-medium">
                                {formatCurrency(selectedTransaction.subtotal || 0)}
                              </span>
                            </div>

                            {/* Delivery Fee */}
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Delivery Fee</span>
                              <span className="text-gray-900 font-medium">
                                {formatCurrency(selectedTransaction.delivery_fee || 0)}
                              </span>
                            </div>

                            {/* Platform Fee */}
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Platform Fee</span>
                              <span className="text-gray-900 font-medium text-red-600">
                                -{formatCurrency(selectedTransaction.platform_fee || 0)}
                              </span>
                            </div>

                            {/* Service Fee */}
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Service Fee</span>
                              <span className="text-gray-900 font-medium text-red-600">
                                -{formatCurrency(selectedTransaction.service_fee || 0)}
                              </span>
                            </div>

                            {/* VAT */}
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">VAT</span>
                              <span className="text-gray-900 font-medium">
                                {formatCurrency(selectedTransaction.vat_amount || 0)}
                              </span>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-200 my-2"></div>

                            {/* Total */}
                            <div className="flex justify-between text-base font-semibold">
                              <span className="text-gray-900">Total Amount</span>
                              <span className="text-gray-900">
                                {formatCurrency(selectedTransaction.total_amount || 0)}
                              </span>
                            </div>

                            {/* Platform Revenue */}
                            <div className="flex justify-between text-sm bg-blue-50 p-2 rounded-md">
                              <span className="text-blue-700">Platform Revenue</span>
                              <span className="text-blue-700 font-medium">
                                {formatCurrency(selectedTransaction.platform_revenue || 0)}
                              </span>
                            </div>

                            {/* Seller Payout */}
                            <div className="flex justify-between text-sm bg-green-50 p-2 rounded-md">
                              <span className="text-green-700">Seller Payout</span>
                              <span className="text-green-700 font-medium">
                                {formatCurrency(selectedTransaction.seller_payout_amount || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        {selectedTransaction.order?.order_status === 'delivered' && 
                         selectedTransaction.payment_status === 'paid' && 
                         selectedTransaction.seller_payout_status !== 'completed' && (
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to transfer payment to the seller?')) {
                                approvePayout(selectedTransaction.id);
                                setIsDetailsModalOpen(false);
                              }
                            }}
                            className="w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm"
                          >
                            Transfer to Seller
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsDetailsModalOpen(false);
                            setSelectedTransaction(null);
                          }}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm"
                        >
                          Close
                        </button>
                      </div>
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