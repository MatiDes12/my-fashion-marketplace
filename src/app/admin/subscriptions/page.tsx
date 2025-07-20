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
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';
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

interface SellerSubscriptionGroup {
  user_id: string;
  user: {
    full_name: string;
    email: string;
    subscription_plan: string;
  };
  currentSubscription: Subscription | null;
  allSubscriptions: Subscription[];
}

export default function AdminSubscriptionsPage() {
  const [subscriptionGroups, setSubscriptionGroups] = useState<SellerSubscriptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());
  const supabase = createClientComponent();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
  
      // Fetch all subscriptions for all users
      const { data, error: fetchError } = await supabase
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
  
      if (fetchError) throw fetchError;

      // Group subscriptions by user_id
      const groupedData = new Map<string, SellerSubscriptionGroup>();
      
      data?.forEach((subscription: Subscription) => {
        const userId = subscription.user_id;
        
        if (!groupedData.has(userId)) {
          groupedData.set(userId, {
            user_id: userId,
            user: subscription.user,
            currentSubscription: null,
            allSubscriptions: []
          });
        }
        
        const group = groupedData.get(userId)!;
        group.allSubscriptions.push(subscription);
        
        // Set current subscription (most recent completed, or most recent if none completed)
        if (subscription.status === 'completed' && !group.currentSubscription) {
          group.currentSubscription = subscription;
        } else if (!group.currentSubscription) {
          group.currentSubscription = subscription;
        }
      });

      // Convert to array and sort by current subscription date
      const sortedGroups = Array.from(groupedData.values()).sort((a, b) => {
        if (!a.currentSubscription) return 1;
        if (!b.currentSubscription) return -1;
        return new Date(b.currentSubscription.created_at).getTime() - new Date(a.currentSubscription.created_at).getTime();
      });

      setSubscriptionGroups(sortedGroups);
  
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
      toast.error('Failed to stop subscription');
    } finally {
      setLoading(false);
    }
  };

  const toggleSellerExpanded = (userId: string) => {
    const newExpanded = new Set(expandedSellers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedSellers(newExpanded);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-orange-100 text-orange-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
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
                  Current Plan
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
              {subscriptionGroups.map((group) => (
                <>
                  <tr key={group.user_id} className="bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {group.user.full_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {group.user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {group.currentSubscription?.plan_id || 'No active plan'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {group.currentSubscription?.period || ''}ly
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {group.currentSubscription ? formatCurrency(group.currentSubscription.amount) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {group.currentSubscription && (
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(group.currentSubscription.status)}`}>
                          {group.currentSubscription.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {group.currentSubscription?.subscription_end_date ? 
                        format(new Date(group.currentSubscription.subscription_end_date), 'PPP') :
                        'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {group.currentSubscription?.transaction_reference ? (
                        <div className="text-sm text-gray-900">
                          {group.currentSubscription.transaction_reference}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {group.currentSubscription?.status === 'completed' && (
                          <button
                            className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 text-xs font-semibold"
                            onClick={() => handleStopPlan(group.currentSubscription!.id)}
                          >
                            Stop Plan
                          </button>
                        )}
                        <button
                          className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-xs font-semibold"
                          onClick={() => toggleSellerExpanded(group.user_id)}
                        >
                          {expandedSellers.has(group.user_id) ? 'Hide History' : 'View History'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Subscription History */}
                  {expandedSellers.has(group.user_id) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-900">Subscription History</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Ref</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {group.allSubscriptions.map((subscription) => (
                                  <tr key={subscription.id} className={subscription.id === group.currentSubscription?.id ? 'bg-green-50' : ''}>
                                    <td className="px-3 py-2 text-sm text-gray-900">
                                      {subscription.plan_id} ({subscription.period}ly)
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-900">
                                      {formatCurrency(subscription.amount)}
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(subscription.status)}`}>
                                        {subscription.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-500">
                                      {format(new Date(subscription.created_at), 'MMM dd, yyyy')}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-500">
                                      {subscription.subscription_end_date ? 
                                        format(new Date(subscription.subscription_end_date), 'MMM dd, yyyy') :
                                        'N/A'
                                      }
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-500">
                                      {subscription.transaction_reference || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 