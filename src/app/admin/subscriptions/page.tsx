'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { 
  CreditCardIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  StopIcon,
  EyeIcon,
  BuildingStorefrontIcon,
  EnvelopeIcon,
  StarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [showStopModal, setShowStopModal] = useState(false);
  const [subscriptionToStop, setSubscriptionToStop] = useState<Subscription | null>(null);
  const [stoppingSubscription, setStoppingSubscription] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
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

  const handleStopPlanClick = (subscription: Subscription) => {
    setSubscriptionToStop(subscription);
    setShowStopModal(true);
  };

  const handleStopPlanConfirm = async () => {
    if (!subscriptionToStop) return;
    
    try {
      setStoppingSubscription(true);
      const { error } = await supabase
        .from('subscription_orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', subscriptionToStop.id);
      if (error) throw error;
      toast.success('Subscription stopped successfully.');
      setShowStopModal(false);
      setSubscriptionToStop(null);
      fetchSubscriptions();
    } catch (err) {
      console.error('Error stopping subscription:', err);
      toast.error('Failed to stop subscription');
    } finally {
      setStoppingSubscription(false);
    }
  };

  const handleStopPlanCancel = () => {
    setShowStopModal(false);
    setSubscriptionToStop(null);
  };

  const handleCleanupPending = async () => {
    try {
      setCleaningUp(true);
      const response = await fetch('/api/cron/cleanup-pending-subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'N1PMxaceyJhbGciOiJIUzHiiSfG'}`
        }
      });
      
      if (response.ok) {
        const result = await response.text();
        toast.success(result);
        fetchSubscriptions();
      } else {
        toast.error('Failed to cleanup pending subscriptions');
      }
    } catch (error) {
      console.error('Error cleaning up pending subscriptions:', error);
      toast.error('Failed to cleanup pending subscriptions');
    } finally {
      setCleaningUp(false);
      setShowCleanupModal(false);
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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'expired':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'pending':
        return <ClockIcon className="h-4 w-4" />;
      case 'failed':
        return <XCircleIcon className="h-4 w-4" />;
      case 'cancelled':
        return <StopIcon className="h-4 w-4" />;
      case 'expired':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  // Calculate statistics
  const stats = {
    total: subscriptionGroups.length,
    active: subscriptionGroups.filter(g => g.currentSubscription?.status === 'completed').length,
    pending: subscriptionGroups.filter(g => g.currentSubscription?.status === 'pending').length,
    cancelled: subscriptionGroups.filter(g => g.currentSubscription?.status === 'cancelled').length,
    totalRevenue: subscriptionGroups.reduce((sum, g) => {
      const completedSubs = g.allSubscriptions.filter(s => s.status === 'completed');
      return sum + completedSubs.reduce((subSum, s) => subSum + s.amount, 0);
    }, 0),
  };

  // Filter subscription groups
  const filteredGroups = subscriptionGroups.filter(group => {
    const matchesSearch = !searchTerm || 
      group.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.currentSubscription?.plan_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (group.currentSubscription?.status === statusFilter);
    
    const matchesPlan = planFilter === 'all' || 
      (group.currentSubscription?.plan_id === planFilter);
    
    return matchesSearch && matchesStatus && matchesPlan;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Seller Subscriptions</h1>
        <p className="text-gray-600">Manage and monitor seller subscription plans and payments</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <StatCard
          title="Total Sellers"
          value={stats.total}
          icon={<UserIcon className="h-6 w-6" />}
          color="blue"
          description="All subscribed sellers"
        />
        <StatCard
          title="Active Plans"
          value={stats.active}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          color="green"
          description="Currently active"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<ClockIcon className="h-6 w-6" />}
          color="yellow"
          description="Awaiting payment"
        />
        <StatCard
          title="Cancelled"
          value={stats.cancelled}
          icon={<StopIcon className="h-6 w-6" />}
          color="orange"
          description="Stopped plans"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<CurrencyDollarIcon className="h-6 w-6" />}
          color="purple"
          description="From all subscriptions"
        />
      </div>

      {/* Search and Filter */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sellers by name, email, or plan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Active</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div className="relative">
            <BuildingStorefrontIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Plans</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          {statusFilter === 'pending' && (
            <button
              onClick={() => setShowCleanupModal(true)}
              className="inline-flex items-center px-4 py-3 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Cleanup Old Pending
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Subscriptions Grid */}
      <div className="space-y-6">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No subscriptions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' || planFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No seller subscriptions found.'
              }
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.user_id} className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{group.user.full_name}</h3>
                      <p className="text-sm text-gray-500">{group.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {group.currentSubscription && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(group.currentSubscription.status)}`}>
                        {getStatusIcon(group.currentSubscription.status)}
                        <span className="ml-1">{group.currentSubscription.status}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Current Subscription Details */}
                {group.currentSubscription && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                      <BuildingStorefrontIcon className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">{group.currentSubscription.plan_id}</p>
                        <p className="text-xs text-blue-600">Current Plan</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
                      <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">{formatCurrency(group.currentSubscription.amount)}</p>
                        <p className="text-xs text-green-600">Amount</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg">
                      <CalendarIcon className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-purple-900">
                          {group.currentSubscription.subscription_end_date ? 
                            format(new Date(group.currentSubscription.subscription_end_date), 'MMM d, yyyy') :
                            'N/A'
                          }
                        </p>
                        <p className="text-xs text-purple-600">End Date</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
                      <CreditCardIcon className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium text-orange-900">{group.currentSubscription.period}ly</p>
                        <p className="text-xs text-orange-600">Billing Cycle</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pending Subscription Age Warning */}
                {group.currentSubscription?.status === 'pending' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">
                          Pending for {Math.floor((Date.now() - new Date(group.currentSubscription.created_at).getTime()) / (1000 * 60 * 60))} hours
                        </p>
                        <p className="text-xs text-yellow-700">
                          This subscription will be automatically cleaned up after 1 hour of inactivity
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Reference */}
                {group.currentSubscription?.transaction_reference && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <CreditCardIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        <span className="font-medium">Payment Reference:</span> {group.currentSubscription.transaction_reference}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex space-x-2">
                    {group.currentSubscription?.status === 'completed' && (
                      <button
                        onClick={() => handleStopPlanClick(group.currentSubscription!)}
                        className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <StopIcon className="h-4 w-4 mr-1" />
                        Stop Plan
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={() => toggleSellerExpanded(group.user_id)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {expandedSellers.has(group.user_id) ? (
                      <>
                        <ChevronUpIcon className="h-4 w-4 mr-1" />
                        Hide History
                      </>
                    ) : (
                      <>
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View History
                      </>
                    )}
                  </button>
                </div>

                {/* Subscription History */}
                {expandedSellers.has(group.user_id) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Subscription History</h4>
                    <div className="space-y-3">
                      {group.allSubscriptions.map((subscription) => (
                        <div 
                          key={subscription.id} 
                          className={`p-4 rounded-lg border ${
                            subscription.id === group.currentSubscription?.id 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(subscription.status)}`}>
                                  {getStatusIcon(subscription.status)}
                                  <span className="ml-1">{subscription.status}</span>
                                </span>
                                {subscription.id === group.currentSubscription?.id && (
                                  <StarIcon className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {subscription.plan_id} ({subscription.period}ly)
                                </p>
                                <p className="text-xs text-gray-500">
                                  {format(new Date(subscription.created_at), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(subscription.amount)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {subscription.subscription_end_date ? 
                                  format(new Date(subscription.subscription_end_date), 'MMM dd, yyyy') :
                                  'N/A'
                                }
                              </p>
                            </div>
                          </div>
                          {subscription.transaction_reference && (
                            <div className="mt-2 text-xs text-gray-500">
                              Ref: {subscription.transaction_reference}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stop Subscription Modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={handleStopPlanCancel}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Stop Subscription
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to stop the subscription for{' '}
                        <span className="font-medium text-gray-900">
                          {subscriptionToStop?.user?.full_name}
                        </span>?
                      </p>
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Plan:</span>
                          <span className="font-medium text-gray-900">{subscriptionToStop?.plan_id}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-gray-600">Amount:</span>
                          <span className="font-medium text-gray-900">{formatCurrency(subscriptionToStop?.amount || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-gray-600">Period:</span>
                          <span className="font-medium text-gray-900">{subscriptionToStop?.period}ly</span>
                        </div>
                      </div>
                      <p className="text-sm text-red-600 mt-3">
                        This action cannot be undone. The seller will lose access to premium features immediately.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleStopPlanConfirm}
                  disabled={stoppingSubscription}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {stoppingSubscription ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Stopping...
                    </>
                  ) : (
                    'Stop Subscription'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleStopPlanCancel}
                  disabled={stoppingSubscription}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowCleanupModal(false)}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
                    <XMarkIcon className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Cleanup Pending Subscriptions
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        This will remove all pending subscriptions older than 1 hour and failed subscriptions older than 1 day.
                      </p>
                      <div className="mt-3 bg-orange-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-sm">
                          <ClockIcon className="h-4 w-4 text-orange-600" />
                          <span className="text-orange-800">
                            Pending subscriptions older than 1 hour will be deleted
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm mt-2">
                          <XCircleIcon className="h-4 w-4 text-orange-600" />
                          <span className="text-orange-800">
                            Failed subscriptions older than 1 day will be deleted
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-orange-600 mt-3">
                        This action cannot be undone. Only abandoned transactions will be affected.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCleanupPending}
                  disabled={cleaningUp}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cleaningUp ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Cleaning...
                    </>
                  ) : (
                    'Cleanup Subscriptions'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCleanupModal(false)}
                  disabled={cleaningUp}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// StatCard component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

function StatCard({ title, value, icon, color, description }: StatCardProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-50 border-blue-200 text-blue-600';
      case 'green': return 'bg-green-50 border-green-200 text-green-600';
      case 'yellow': return 'bg-yellow-50 border-yellow-200 text-yellow-600';
      case 'orange': return 'bg-orange-50 border-orange-200 text-orange-600';
      case 'purple': return 'bg-purple-50 border-purple-200 text-purple-600';
      default: return 'bg-blue-50 border-blue-200 text-blue-600';
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <div className={`flex-shrink-0 ml-4 p-3 rounded-lg border ${getColorClasses(color)}`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
} 