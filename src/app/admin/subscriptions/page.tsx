'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  period: 'month' | 'year';
  status: 'pending' | 'completed' | 'failed';
  tx_ref: string;
  created_at: string;
  subscription_end_date: string | null;
  user: {
    full_name: string;
    email: string;
    subscription_plan: string;
  };
  transaction?: {
    id: string;
    payment_status: string;
    payment_method: string;
    total_amount: number;
    created_at: string;
  };
  transaction_reference?: string;
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSubscriptions();
  }, [filter]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
  
      let query = supabase
        .from('subscription_orders')
        .select(`
          *,
          user:users(
            id,
            full_name,
            email,
            subscription_plan
          ),
          transaction:transactions(
            id,
            payment_status,
            payment_method,
            total_amount,
            created_at
          )
        `)
        .order('created_at', { ascending: false });
  
      if (filter === 'active') {
        query = query.eq('status', 'completed');
      } else if (filter === 'expired') {
        const now = new Date().toISOString();
        query = query.eq('status', 'completed');
      }
  
      const { data, error: fetchError } = await query;
  
      console.log('Subscription Data:', data); // Debug log
      console.log('Fetch Error:', fetchError); // Debug log
  
      if (fetchError) throw fetchError;
      setSubscriptions(data || []);
  
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleStopPlan = async (subscriptionId: string) => {
    if (!window.confirm('Are you sure you want to stop this subscription? This action cannot be undone.')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('subscription_orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);
      if (error) throw error;
      toast.success('Subscription stopped successfully.');
      fetchSubscriptions();
    } catch (err) {
      console.error('Error stopping subscription:', err);
      toast.error('Failed to stop subscription.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">Loading subscriptions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Seller Subscriptions</h1>
          
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">All Subscriptions</option>
              <option value="active">Active Only</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscription End
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Ref
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {subscription.user.full_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {subscription.user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {subscription.plan_id}
                    </div>
                    <div className="text-sm text-gray-500">
                      {subscription.period}ly
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(subscription.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(subscription.status)}`}>
                      {subscription.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {subscription.subscription_end_date ? 
                      format(new Date(subscription.subscription_end_date), 'PPP') :
                      'N/A'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {subscription.transaction_reference ? (
                      <div className="text-sm text-gray-900">
                        {subscription.transaction_reference}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">-</div>
                    )}
                    {subscription.transaction && (
                      <div className="text-xs text-gray-500">
                        {subscription.transaction.payment_method} - {subscription.transaction.payment_status}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {subscription.status === 'completed' && (
                      <button
                        className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 text-xs font-semibold"
                        onClick={() => handleStopPlan(subscription.id)}
                      >
                        Stop Plan
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