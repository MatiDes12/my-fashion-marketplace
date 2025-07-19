'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { withSellerVerification } from '@/components/withSellerVerification';
import Link from 'next/link';

type DeliveryAccount = {
  id: string;
  delivery_person_name: string;
  phone_number: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DeliveryTracking = {
  id: string;
  order_id: string;
  delivery_account_id: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  assigned_at: string;
  picked_up_at?: string;
  delivered_at?: string;
  delivery_notes?: string;
  proof_images?: string[];
  order: {
    id: string;
    user_id: string;
    total_price: number;
    delivery_address: string;
    delivery_method: string;
    pickup_code?: string;
    product_id: string;
    quantity: number;
    users: {
      full_name: string;
      email: string;
      phone: string;
    };
    products: {
      title: string;
      description: string;
      price: number;
    };
  };
  delivery_accounts: {
    delivery_person_name: string;
    phone_number: string;
  };
};

type Order = {
  id: string;
  user_id: string;
  total_price: number;
  delivery_address: string;
  delivery_method: string;
  pickup_code?: string;
  order_status: string;
  created_at: string;
  product_id: string;
  quantity: number;
  users: {
    full_name: string;
    email: string;
    phone: string;
  };
  products: {
    title: string;
    description: string;
    price: number;
  };
};

function DeliveryPage() {
  const [deliveryAccounts, setDeliveryAccounts] = useState<DeliveryAccount[]>([]);
  const [deliveryTracking, setDeliveryTracking] = useState<DeliveryTracking[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'accounts' | 'tracking' | 'orders' | 'shipped'>('accounts');
  
  // Form state
  const [formData, setFormData] = useState({
    delivery_person_name: '',
    phone_number: '',
    email: ''
  });

  // Filter states for shipped orders
  const [shippedFilter, setShippedFilter] = useState('all'); // 'all', 'assigned', 'unassigned'
  const [shippedSearchTerm, setShippedSearchTerm] = useState('');
  
  // Access token generation states
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<{
    accountId: string;
    token: string;
    link: string;
    expiresAt: string;
  } | null>(null);

  const router = useRouter();
  const supabase = createClientComponent();

  const fetchDeliveryData = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login?message=Please login to access the dashboard');
        return;
      }

      // Fetch delivery accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('delivery_accounts')
        .select('*')
        .eq('seller_id', session.user.id)
        .order('created_at', { ascending: false });

      if (accountsError) throw accountsError;

      // Fetch delivery tracking with order details
      // First get all products owned by the seller
      const { data: sellerProducts, error: sellerProductsError } = await supabase
        .from('products')
        .select('id')
        .eq('owner_id', session.user.id);

      if (sellerProductsError) throw sellerProductsError;

      let trackingData: any[] = [];
      if (sellerProducts && sellerProducts.length > 0) {
        // Then fetch delivery tracking for orders of these products
        const { data: trackingResult, error: trackingError } = await supabase
          .from('delivery_tracking')
          .select(`
            *,
            order:orders!inner(
              id,
              user_id,
              total_price,
              delivery_address,
              delivery_method,
              pickup_code,
              product_id,
              quantity,
              users!inner(full_name, email, phone),
              products!inner(title, description, price)
            ),
            delivery_accounts!inner(delivery_person_name, phone_number)
          `)
          .in('order.product_id', sellerProducts.map(p => p.id))
          .order('assigned_at', { ascending: false });

        if (trackingError) throw trackingError;
        trackingData = trackingResult || [];
      }

      // Fetch pending orders that need delivery assignment
      let pendingOrdersData: any[] = [];
      if (sellerProducts && sellerProducts.length > 0) {
        // Then fetch orders for these products - include both confirmed and shipped orders
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            *,
            users!inner(full_name, email, phone),
            products!inner(title, description, price)
          `)
          .in('product_id', sellerProducts.map(p => p.id))
          .in('order_status', ['confirmed', 'shipped'])
          .eq('delivery_method', 'home_delivery')
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // Filter out orders that are already assigned for delivery
        const assignedOrderIds = new Set(trackingData.map(t => t.order_id));
        pendingOrdersData = ordersData?.filter(order => !assignedOrderIds.has(order.id)) || [];
      }

      console.log('Fetched delivery tracking data:', trackingData);
      console.log('Fetched pending orders data:', pendingOrdersData);
      
      setDeliveryAccounts(accountsData || []);
      setDeliveryTracking(trackingData);
      setPendingOrders(pendingOrdersData);
    } catch (error) {
      console.error('Error fetching delivery data:', error);
      setError('Failed to load delivery data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryData();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('delivery_accounts')
        .insert({
          seller_id: session.user.id,
          delivery_person_name: formData.delivery_person_name,
          phone_number: formData.phone_number,
          email: formData.email || null
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Delivery account created successfully!');
      setShowCreateForm(false);
      setFormData({ delivery_person_name: '', phone_number: '', email: '' });
      fetchDeliveryData();
    } catch (error) {
      console.error('Error creating delivery account:', error);
      toast.error('Failed to create delivery account');
    }
  };

  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('delivery_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', accountId);

      if (error) throw error;

      toast.success(`Account ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
      fetchDeliveryData();
    } catch (error) {
      console.error('Error updating account status:', error);
      toast.error('Failed to update account status');
    }
  };

  const assignDelivery = async (orderId: string, deliveryAccountId: string) => {
    try {
      const { error } = await supabase
        .from('delivery_tracking')
        .insert({
          order_id: orderId,
          delivery_account_id: deliveryAccountId,
          status: 'assigned'
        });

      if (error) throw error;

      toast.success('Delivery assigned successfully!');
      fetchDeliveryData();
    } catch (error) {
      console.error('Error assigning delivery:', error);
      toast.error('Failed to assign delivery');
    }
  };

  const removeDeliveryAssignment = async (trackingId: string) => {
    try {
      console.log('Removing delivery assignment for tracking ID:', trackingId);
      
      const { error } = await supabase
        .from('delivery_tracking')
        .delete()
        .eq('id', trackingId);

      if (error) throw error;

      console.log('Delivery assignment removed from database successfully');
      toast.success('Delivery assignment removed successfully!');
      
      // Immediately update the local state to reflect the change
      setDeliveryTracking(prev => prev.filter(tracking => tracking.id !== trackingId));
      
      // Then fetch fresh data to ensure everything is in sync
      setTimeout(() => {
        fetchDeliveryData();
      }, 100);
    } catch (error) {
      console.error('Error removing delivery assignment:', error);
      toast.error('Failed to remove delivery assignment');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  const generateAccessToken = async (accountId: string) => {
    try {
      setGeneratingToken(accountId);
      
      const response = await fetch('/api/delivery/generate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deliveryAccountId: accountId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setGeneratedToken({
          accountId,
          token: data.accessToken,
          link: data.accessLink,
          expiresAt: data.expiresAt
        });
        toast.success('Access token generated successfully!');
      } else {
        toast.error(data.error || 'Failed to generate access token');
      }
    } catch (error) {
      console.error('Error generating access token:', error);
      toast.error('Failed to generate access token');
    } finally {
      setGeneratingToken(null);
    }
  };

  // Helper functions for shipped orders filtering
  const getShippedOrders = () => {
    return pendingOrders.filter(order => order.order_status === 'shipped');
  };

  const getFilteredShippedOrders = () => {
    let filtered = getShippedOrders();

    // Apply search filter
    if (shippedSearchTerm) {
      filtered = filtered.filter(order => 
        order.users.full_name.toLowerCase().includes(shippedSearchTerm.toLowerCase()) ||
        order.products.title.toLowerCase().includes(shippedSearchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(shippedSearchTerm.toLowerCase())
      );
    }

    // Apply assignment filter
    if (shippedFilter === 'assigned') {
      const assignedOrderIds = new Set(deliveryTracking.map(t => t.order_id));
      filtered = filtered.filter(order => assignedOrderIds.has(order.id));
    } else if (shippedFilter === 'unassigned') {
      const assignedOrderIds = new Set(deliveryTracking.map(t => t.order_id));
      filtered = filtered.filter(order => !assignedOrderIds.has(order.id));
    }

    return filtered;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Delivery Management</h1>
            <p className="text-sm text-gray-600 mt-1">Manage delivery accounts and track deliveries</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard/delivery/instructions"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              View Instructions
            </Link>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Add Delivery Person
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('accounts')}
                className={`${
                  activeTab === 'accounts'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Delivery Accounts ({deliveryAccounts.length})
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`${
                  activeTab === 'orders'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
              >
                Pending Orders ({pendingOrders.length})
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('shipped')}
                className={`${
                  activeTab === 'shipped'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
              >
                Shipped Orders ({getShippedOrders().length})
                {getShippedOrders().filter(order => !deliveryTracking.some(t => t.order_id === order.id)).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getShippedOrders().filter(order => !deliveryTracking.some(t => t.order_id === order.id)).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('tracking')}
                className={`${
                  activeTab === 'tracking'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
              >
                Delivery Tracking ({deliveryTracking.length})
                {deliveryTracking.filter(d => d.status === 'assigned').length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {deliveryTracking.filter(d => d.status === 'assigned').length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Create Account Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Delivery Account</h3>
                <form onSubmit={handleCreateAccount}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Person Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.delivery_person_name}
                      onChange={(e) => setFormData({ ...formData, delivery_person_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'accounts' ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Delivery Accounts ({deliveryAccounts.length})
              </h3>
              {deliveryAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No delivery accounts created yet.</p>
                  <p className="text-sm text-gray-400 mt-2">Create your first delivery account to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deliveryAccounts.map((account) => (
                    <div key={account.id} className="border rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{account.delivery_person_name}</h4>
                        <p className="text-sm text-gray-500">{account.phone_number}</p>
                        {account.email && <p className="text-sm text-gray-500">{account.email}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          Created: {new Date(account.created_at).toLocaleDateString()}
                        </p>
                        <div className="mt-2 p-3 bg-gray-50 rounded border">
                          <p className="text-xs text-gray-600 mb-2 font-medium">Access Information:</p>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Phone Number:</p>
                              <p className="text-sm font-mono text-gray-800 bg-white px-2 py-1 rounded border">{account.phone_number}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => generateAccessToken(account.id)}
                                disabled={generatingToken === account.id}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                              >
                                {generatingToken === account.id ? (
                                  <>
                                    <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    Generate Access Link
                                  </>
                                )}
                              </button>
                            </div>
                            
                            {/* Show generated token if available */}
                            {generatedToken && generatedToken.accountId === account.id && (
                              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                                <p className="text-xs text-green-800 mb-2 font-medium">Generated Access Information:</p>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Access Token:</p>
                                    <p className="text-sm font-mono text-gray-800 bg-white px-2 py-1 rounded border">{generatedToken.token}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Access Link:</p>
                                    <div className="flex items-center space-x-2">
                                      <p className="text-sm font-mono text-gray-800 bg-white px-2 py-1 rounded border flex-1 text-xs">
                                        {generatedToken.link}
                                      </p>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(`Access Token: ${generatedToken.token}\nAccess Link: ${generatedToken.link}\nExpires: ${new Date(generatedToken.expiresAt).toLocaleString()}`);
                                          toast.success('Access information copied to clipboard!');
                                        }}
                                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                                      >
                                        <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Expires: {new Date(generatedToken.expiresAt).toLocaleString()}
                                  </div>
                                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                    <p className="text-xs text-blue-800">
                                      💡 Share this access link with the delivery person. The token will expire in 24 hours for security.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          account.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => toggleAccountStatus(account.id, account.is_active)}
                          className={`px-3 py-1 text-sm font-medium rounded-md ${
                            account.is_active
                              ? 'text-red-600 hover:text-red-700'
                              : 'text-green-600 hover:text-green-700'
                          }`}
                        >
                          {account.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Pending Orders ({pendingOrders.length})
              </h3>
              {pendingOrders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No pending orders that need delivery assignment.</p>
                  <p className="text-sm text-gray-400 mt-2">Orders will appear here when they are confirmed and ready for delivery.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingOrders.map((order) => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">
                              Order #{order.id.slice(0, 8)}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {new Date(order.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-semibold text-green-600">
                              {formatCurrency(order.total_price)}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.order_status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                              order.order_status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Customer Information */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h5>
                            <div className="space-y-2">
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-sm text-gray-900">{order.users.full_name}</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-600">{order.users.email}</span>
                              </div>
                              {order.users.phone && (
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">{order.users.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Product Information */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-3">Product Information</h5>
                            <div className="space-y-2">
                              <div className="flex items-start">
                                <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <div className="text-sm text-gray-900">
                                  <p className="font-medium">{order.products.title}</p>
                                  <p className="text-gray-600 text-xs line-clamp-2">{order.products.description}</p>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-gray-500">
                                      Qty: {order.quantity} × {formatCurrency(order.products.price)}
                                    </span>
                                    <span className="text-xs font-medium text-green-600">
                                      {formatCurrency(order.products.price * order.quantity)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Delivery Address */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-3">Delivery Address</h5>
                            <div className="space-y-2">
                              {(() => {
                                try {
                                  const address = JSON.parse(order.delivery_address);
                                  return (
                                    <div className="space-y-1">
                                      <div className="flex items-start">
                                        <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <div className="text-sm text-gray-600">
                                          <p className="font-medium">{address.houseNo} {address.landmark || ''}</p>
                                          <p>{address.city}, {address.subCity}</p>
                                          <p>Wereda: {address.wereda}, Kebele: {address.kebele}</p>
                                          {address.mapLink && (
                                            <a
                                              href={address.mapLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-indigo-600 hover:text-indigo-900 text-xs inline-flex items-center mt-1"
                                            >
                                              <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>
                                              View on Map
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } catch {
                                  return (
                                    <div className="flex items-start">
                                      <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <span className="text-sm text-gray-600">{order.delivery_address}</span>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Assignment Actions */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500">
                              {order.order_status === 'shipped' ? (
                                <>
                                  <span className="font-medium text-green-600">Ready for assignment</span>
                                  <p className="text-xs mt-1">Select a delivery person to assign this order</p>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium text-yellow-600">Awaiting shipment</span>
                                  <p className="text-xs mt-1">Order must be marked as shipped before assignment</p>
                                </>
                              )}
                            </div>
                            <div className="flex items-center space-x-3">
                              {order.order_status === 'shipped' ? (
                                deliveryAccounts.filter(acc => acc.is_active).length > 0 ? (
                                  <div className="flex items-center space-x-2">
                                    <label htmlFor={`assign-${order.id}`} className="text-sm font-medium text-gray-700">
                                      Assign to:
                                    </label>
                                    <select
                                      id={`assign-${order.id}`}
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          assignDelivery(order.id, e.target.value);
                                        }
                                      }}
                                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                      defaultValue=""
                                    >
                                      <option value="" disabled>
                                        Select delivery person
                                      </option>
                                      {deliveryAccounts.filter(acc => acc.is_active).map(account => (
                                        <option key={account.id} value={account.id}>
                                          {account.delivery_person_name} ({account.phone_number})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500 bg-yellow-50 px-3 py-2 rounded-md">
                                    No active delivery accounts available
                                  </div>
                                )
                              ) : (
                                <button
                                  disabled
                                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
                                >
                                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Assign (Shipment Required)
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'shipped' ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Shipped Orders ({getShippedOrders().length})
              </h3>
              
              {/* Filters */}
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by customer name, product, or order ID..."
                        value={shippedSearchTerm}
                        onChange={(e) => setShippedSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Filter */}
                  <div className="flex gap-4">
                    <select
                      value={shippedFilter}
                      onChange={(e) => setShippedFilter(e.target.value)}
                      className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="all">All Shipped Orders</option>
                      <option value="unassigned">Unassigned Only</option>
                      <option value="assigned">Assigned Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {getFilteredShippedOrders().length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {getShippedOrders().length === 0 
                      ? "No shipped orders found." 
                      : "No shipped orders match your filters."}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {getShippedOrders().length === 0 
                      ? "Orders will appear here when they are marked as shipped." 
                      : "Try adjusting your search or filter criteria."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {getFilteredShippedOrders().map((order) => {
                    const isAssigned = deliveryTracking.some(t => t.order_id === order.id);
                    const assignedTracking = deliveryTracking.find(t => t.order_id === order.id);
                    
                    return (
                      <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">
                                Order #{order.id.slice(0, 8)}
                              </h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {new Date(order.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {isAssigned && assignedTracking && (
                                <p className="text-sm text-blue-600 mt-1">
                                  <svg className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  Assigned to: {assignedTracking.delivery_accounts.delivery_person_name} ({assignedTracking.delivery_accounts.phone_number})
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-semibold text-green-600">
                                {formatCurrency(order.total_price)}
                              </p>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isAssigned ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {isAssigned ? 'Assigned' : 'Ready for Assignment'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Customer Information */}
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h5>
                              <div className="space-y-2">
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="text-sm text-gray-900">{order.users.full_name}</span>
                                </div>
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">{order.users.email}</span>
                                </div>
                                {order.users.phone && (
                                  <div className="flex items-center">
                                    <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span className="text-sm text-gray-600">{order.users.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Product Information */}
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-3">Product Information</h5>
                              <div className="space-y-2">
                                <div className="flex items-start">
                                  <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  <div className="text-sm text-gray-900">
                                    <p className="font-medium">{order.products.title}</p>
                                    <p className="text-gray-600 text-xs line-clamp-2">{order.products.description}</p>
                                    <div className="flex items-center justify-between mt-1">
                                      <span className="text-xs text-gray-500">
                                        Qty: {order.quantity} × {formatCurrency(order.products.price)}
                                      </span>
                                      <span className="text-xs font-medium text-green-600">
                                        {formatCurrency(order.products.price * order.quantity)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Delivery Address */}
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-3">Delivery Address</h5>
                              <div className="space-y-2">
                                {(() => {
                                  try {
                                    const address = JSON.parse(order.delivery_address);
                                    return (
                                      <div className="space-y-1">
                                        <div className="flex items-start">
                                          <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                          <div className="text-sm text-gray-600">
                                            <p className="font-medium">{address.houseNo} {address.landmark || ''}</p>
                                            <p>{address.city}, {address.subCity}</p>
                                            <p>Wereda: {address.wereda}, Kebele: {address.kebele}</p>
                                            {address.mapLink && (
                                              <a
                                                href={address.mapLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-600 hover:text-indigo-900 text-xs inline-flex items-center mt-1"
                                              >
                                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                View on Map
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } catch {
                                    return (
                                      <div className="flex items-start">
                                        <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="text-sm text-gray-600">{order.delivery_address}</span>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Assignment Actions */}
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <div className="text-sm text-gray-500">
                                {isAssigned ? (
                                  <>
                                    <span className="font-medium text-blue-600">Already assigned</span>
                                    <p className="text-xs mt-1">This order has been assigned to a delivery person</p>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-green-600">Ready for assignment</span>
                                    <p className="text-xs mt-1">Select a delivery person to assign this order</p>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center space-x-3">
                                {!isAssigned ? (
                                  deliveryAccounts.filter(acc => acc.is_active).length > 0 ? (
                                    <div className="flex items-center space-x-2">
                                      <label htmlFor={`assign-shipped-${order.id}`} className="text-sm font-medium text-gray-700">
                                        Assign to:
                                      </label>
                                      <select
                                        id={`assign-shipped-${order.id}`}
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            assignDelivery(order.id, e.target.value);
                                          }
                                        }}
                                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        defaultValue=""
                                      >
                                        <option value="" disabled>
                                          Select delivery person
                                        </option>
                                        {deliveryAccounts.filter(acc => acc.is_active).map(account => (
                                          <option key={account.id} value={account.id}>
                                            {account.delivery_person_name} ({account.phone_number})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500 bg-yellow-50 px-3 py-2 rounded-md">
                                      No active delivery accounts available
                                    </div>
                                  )
                                ) : (
                                  <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md">
                                    ✓ Assigned to delivery person
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Delivery Tracking ({deliveryTracking.length})
              </h3>
              {deliveryTracking.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No deliveries assigned yet.</p>
                  <p className="text-sm text-gray-400 mt-2">Assign deliveries from the Pending Orders tab.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {deliveryTracking.map((tracking) => (
                    <div key={tracking.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">
                              Order #{tracking.order.id.slice(0, 8)}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Assigned: {new Date(tracking.assigned_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            <p className="text-sm text-blue-600 mt-1">
                              <svg className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Assigned to: {tracking.delivery_accounts.delivery_person_name} ({tracking.delivery_accounts.phone_number})
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-semibold text-green-600">
                              {formatCurrency(tracking.order.total_price)}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              tracking.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              tracking.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                              tracking.status === 'picked_up' ? 'bg-yellow-100 text-yellow-800' :
                              tracking.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {tracking.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Customer Information */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h5>
                            <div className="space-y-2">
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-sm text-gray-900">{tracking.order.users.full_name}</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-600">{tracking.order.users.email}</span>
                              </div>
                              {tracking.order.users.phone && (
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">{tracking.order.users.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Product Information */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-3">Product Information</h5>
                            <div className="space-y-2">
                              <div className="flex items-start">
                                <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <div className="text-sm text-gray-900">
                                  <p className="font-medium">{tracking.order.products.title}</p>
                                  <p className="text-gray-600 text-xs line-clamp-2">{tracking.order.products.description}</p>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-gray-500">
                                      Qty: {tracking.order.quantity} × {formatCurrency(tracking.order.products.price)}
                                    </span>
                                    <span className="text-xs font-medium text-green-600">
                                      {formatCurrency(tracking.order.products.price * tracking.order.quantity)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Delivery Address */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-3">Delivery Address</h5>
                            <div className="space-y-2">
                              {(() => {
                                try {
                                  const address = JSON.parse(tracking.order.delivery_address);
                                  return (
                                    <div className="space-y-1">
                                      <div className="flex items-start">
                                        <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <div className="text-sm text-gray-600">
                                          <p className="font-medium">{address.houseNo} {address.landmark || ''}</p>
                                          <p>{address.city}, {address.subCity}</p>
                                          <p>Wereda: {address.wereda}, Kebele: {address.kebele}</p>
                                          {address.mapLink && (
                                            <a
                                              href={address.mapLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-indigo-600 hover:text-indigo-900 text-xs inline-flex items-center mt-1"
                                            >
                                              <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>
                                              View on Map
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } catch {
                                  return (
                                    <div className="flex items-start">
                                      <svg className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <span className="text-sm text-gray-600">{tracking.order.delivery_address}</span>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Delivery Notes */}
                        {tracking.delivery_notes && (
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Delivery Notes</h5>
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                              <p className="text-sm text-blue-800">{tracking.delivery_notes}</p>
                            </div>
                          </div>
                        )}

                        {/* Status Timeline */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                          <h5 className="text-sm font-medium text-gray-900 mb-3">Delivery Progress</h5>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="ml-2 text-sm text-gray-600">Assigned</span>
                            </div>
                            {tracking.status !== 'assigned' && (
                              <>
                                <div className="flex-1 h-px bg-gray-300"></div>
                                <div className="flex items-center">
                                  <div className={`w-3 h-3 rounded-full ${
                                    tracking.status === 'picked_up' || tracking.status === 'in_transit' || tracking.status === 'delivered' 
                                      ? 'bg-blue-500' : 'bg-gray-300'
                                  }`}></div>
                                  <span className="ml-2 text-sm text-gray-600">Picked Up</span>
                                </div>
                              </>
                            )}
                            {tracking.status === 'in_transit' || tracking.status === 'delivered' && (
                              <>
                                <div className="flex-1 h-px bg-gray-300"></div>
                                <div className="flex items-center">
                                  <div className={`w-3 h-3 rounded-full ${
                                    tracking.status === 'delivered' ? 'bg-green-500' : 'bg-blue-500'
                                  }`}></div>
                                  <span className="ml-2 text-sm text-gray-600">In Transit</span>
                                </div>
                              </>
                            )}
                            {tracking.status === 'delivered' && (
                              <>
                                <div className="flex-1 h-px bg-gray-300"></div>
                                <div className="flex items-center">
                                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  <span className="ml-2 text-sm text-gray-600">Delivered</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Remove Assignment Button */}
                        {tracking.status === 'assigned' && (
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex justify-end">
                              <button
                                onClick={() => removeDeliveryAssignment(tracking.id)}
                                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                              >
                                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Remove Assignment
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              Removing assignment will move this order back to pending orders
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withSellerVerification(DeliveryPage); 