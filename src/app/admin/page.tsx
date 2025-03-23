'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPayouts: number;
  completedPayouts: number;
  recentTransactions: any[];
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
  seller: {
    id: string;
    full_name: string;
    email: string;
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
  const supabase = createClientComponent();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingPayouts: 0,
    completedPayouts: 0,
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);

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

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Use service role client for orders query
      const { data: orderCheck, error: orderError } = await serviceRoleClient
        .from('orders')
        .select(`
          *,
          product:products (
            id,
            title
          )
        `)
        .eq('id', '708dd44d-7483-4d05-beb8-43dd788229a9')
        .single();

      console.log('Order Check:', { orderCheck, orderError });

      // Get total users
      const { count: userCount } = await serviceRoleClient
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get total products
      const { count: productCount } = await serviceRoleClient
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Use service role client for transactions query
      const { data: transactions, error: transactionError } = await serviceRoleClient
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
        .order('created_at', { ascending: false })
        .limit(10);

      // Debug logging
      console.log('Transaction Query Error:', transactionError);
      console.log('Raw Transactions Data:', JSON.stringify(transactions, null, 2));

      // Set the stats
      if (transactions) {
        setStats({
          ...stats,
          totalUsers: userCount || 0,
          totalProducts: productCount || 0,
          totalOrders: transactions.length,
          totalRevenue: transactions.reduce((sum, t) => sum + (t.platform_revenue || 0), 0),
          pendingPayouts: transactions.reduce((sum, t) => 
            t.seller_payout_status === 'pending' ? sum + (t.seller_payout_amount || 0) : sum, 0),
          completedPayouts: transactions.reduce((sum, t) => 
            t.seller_payout_status === 'completed' ? sum + (t.seller_payout_amount || 0) : sum, 0),
          recentTransactions: transactions
        });
      }

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

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

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon="currency"
        />
        <StatCard
          title="Pending Payouts"
          value={formatCurrency(stats.pendingPayouts)}
          icon="clock"
        />
        <StatCard
          title="Completed Payouts"
          value={formatCurrency(stats.completedPayouts)}
          icon="check"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders.toString()}
          icon="shopping-cart"
        />
      </div>

      {/* Recent Transactions */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg font-medium text-gray-900">Recent Transactions</h2>
        </div>
        <div className="border-t border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Info</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product & Seller</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fees & VAT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recentTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-sm font-medium text-gray-900">
                      #{transaction.id.substring(0, 8)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(transaction.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Order #{transaction.order_id ? transaction.order_id.substring(0, 8) : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Ref: {transaction.order?.payment_reference || 'N/A'}
                      {transaction.order_id && !transaction.order && 
                        <span className="text-red-500"> (Order exists but not found)</span>
                      }
                      {!transaction.order_id && 
                        <span className="text-red-500"> (No order ID)</span>
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      Tx: {transaction.order?.tx_ref || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Product: {transaction.order?.product?.title || 'N/A'}
                      {transaction.order && !transaction.order.product && 
                        <span className="text-red-500"> (No product info)</span>
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Transaction #{transaction.id.substring(0, 8)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Seller: {transaction.seller?.full_name || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {transaction.seller?.email || 'No email'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      Total: {formatCurrency(transaction.total_amount)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Method: {transaction.payment_method}
                    </div>
                    <div className="text-sm text-gray-500">
                      Status: {transaction.payment_status}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Platform: {formatCurrency(transaction.platform_fee || 0)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Service: {formatCurrency(transaction.service_fee || 0)}
                    </div>
                    <div className="text-sm text-gray-500">
                      VAT: {formatCurrency(transaction.vat_amount || 0)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Delivery: {formatCurrency(transaction.delivery_fee || 0)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${transaction.seller_payout_status === 'completed' ? 
                        'bg-green-100 text-green-800' : 
                        'bg-yellow-100 text-yellow-800'}`}>
                      {transaction.seller_payout_status}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      Order: {transaction.order?.order_status || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {transaction.seller_payout_status === 'pending' && (
                      <button
                        onClick={() => approvePayout(transaction.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Approve Payout
                      </button>
                    )}
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
function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
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