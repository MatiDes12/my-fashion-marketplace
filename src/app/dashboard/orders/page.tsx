'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { formatCurrency } from '@/utils/currency';

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  owner_id: string;
}

interface Order {
  id: string;
  created_at: string;
  user_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  order_status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  platform_fee?: number;
  service_fee?: number;
  ethiopia_tax?: number;
  delivery_fee?: number;
  payment_status?: string;
  payment_reference?: string;
  tx_ref?: string;
  receipt_url?: string;
  product?: Product;
  user?: User;
}

interface OrderWithUser {
  id: string;
  created_at: string;
  quantity: number;
  total_price: number;
  order_status: Order['order_status'];
  user_id: string;
  platform_fee?: number;
  service_fee?: number;
  ethiopia_tax?: number;
  delivery_fee?: number;
  payment_status?: string;
  payment_reference?: string;
  tx_ref?: string;
  receipt_url?: string;
  user: User;  // Not an array, just a single user object
}

interface SupabaseOrder {
  id: string;
  created_at: string;
  quantity: number;
  total_price: number;
  order_status: Order['order_status'];
  user_id: string;
  platform_fee?: number;
  service_fee?: number;
  ethiopia_tax?: number;
  delivery_fee?: number;
  payment_status?: string;
  payment_reference?: string;
  tx_ref?: string;
  receipt_url?: string;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponent();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }

        // Update the query to properly join with users table
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select(`
            id,
            title,
            price,
            orders (
              id,
              created_at,
              quantity,
              total_price,
              order_status,
              user_id,
              platform_fee,
              service_fee,
              ethiopia_tax,
              delivery_fee,
              payment_status,
              payment_reference,
              tx_ref,
              receipt_url,
              user:users!user_id (
                id,
                full_name,
                email
              )
            )
          `)
          .eq('owner_id', session.user.id);

        if (productsError) {
          console.error('Products error:', productsError);
          throw productsError;
        }

        // Transform the data structure with proper user information
        const allOrders: Order[] = products.flatMap(product => 
          (product.orders || []).map((order: unknown) => ({
            id: (order as any).id,
            created_at: (order as any).created_at,
            user_id: (order as any).user_id,
            product_id: product.id,
            quantity: (order as any).quantity,
            total_price: (order as any).total_price,
            order_status: (order as any).order_status,
            platform_fee: (order as any).platform_fee,
            service_fee: (order as any).service_fee,
            ethiopia_tax: (order as any).ethiopia_tax,
            delivery_fee: (order as any).delivery_fee,
            payment_status: (order as any).payment_status,
            payment_reference: (order as any).payment_reference,
            tx_ref: (order as any).tx_ref,
            receipt_url: (order as any).receipt_url,
            product: {
              id: product.id,
              title: product.title,
              price: product.price,
              owner_id: session.user.id
            },
            user: (order as any).user && {
              id: (order as any).user.id,
              full_name: (order as any).user.full_name,
              email: (order as any).user.email
            }
          }))
        );

        // Sort by date
        const sortedOrders = allOrders.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        console.log('Processed orders:', sortedOrders);

        setOrders(sortedOrders);

      } catch (error) {
        console.error('Error in fetchOrders:', error);
        setError('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [router]);

  useEffect(() => {
    // Debug current user session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      if (session) {
        // Debug user's products
        const { data: products } = await supabase
          .from('products')
          .select('id, title')
          .eq('owner_id', session.user.id);
        
        console.log('User products:', products);
        
        // Debug orders for these products
        if (products && products.length > 0) {
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .in('product_id', products.map(p => p.id));
            
          console.log('Orders for products:', orders);
        }
      }
    };
    
    checkSession();
  }, []);

  const handleUpdateStatus = async (newStatus: Order['order_status']) => {
    if (!selectedOrder) return;
    
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          order_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      // Update the local state
      setOrders(orders.map(order => 
        order.id === selectedOrder.id 
          ? { ...order, order_status: newStatus }
          : order
      ));

      setIsUpdateModalOpen(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  async function debugOrderData(supabase: any) {
    // Check orders table
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        user:users (*)
      `)
      .limit(5);

    console.log('Debug - Orders with users:', orders);
    console.log('Debug - Orders error:', ordersError);
  }

  useEffect(() => {
    debugOrderData(supabase);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track all orders for your products
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No orders yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              You don't have any orders for your products yet.
            </p>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg">
            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Details
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">
                            #{order.id.substring(0, 8)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.product?.title || 'Unknown Product'} × {order.quantity}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.user?.full_name || 'Unknown Customer'}</div>
                        <div className="text-sm text-gray-500">{order.user?.email || 'No email'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${order.order_status === 'delivered' ? 'bg-green-100 text-green-800' : 
                            order.order_status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                            order.order_status === 'shipped' ? 'bg-blue-100 text-blue-800' : 
                            order.order_status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.total_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button 
                            className="text-indigo-600 hover:text-indigo-900"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsUpdateModalOpen(true);
                            }}
                          >
                            Update Status
                          </button>
                          <button 
                            className="text-gray-600 hover:text-gray-900"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsViewModalOpen(true);
                            }}
                          >
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination - Optional */}
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{orders.length}</span> orders
                </div>
                {/* Add pagination controls here if needed */}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Update Status Modal */}
      <div className={`fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${isUpdateModalOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    Update Order Status
                  </h3>
                  <div className="mt-2 space-y-3">
                    {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleUpdateStatus(status as Order['order_status'])}
                        disabled={updatingStatus}
                        className={`w-full text-left px-4 py-2 rounded ${
                          selectedOrder?.order_status === status
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      <div className={`fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${isViewModalOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              {selectedOrder && (
                <div>
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    Order Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Order ID</p>
                      <p className="text-sm text-gray-900">{selectedOrder.id}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Product</p>
                      <p className="text-sm text-gray-900">{selectedOrder.product?.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Customer</p>
                      <p className="text-sm text-gray-900">{selectedOrder.user?.full_name}</p>
                      <p className="text-sm text-gray-500">{selectedOrder.user?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Order Details</p>
                      <p className="text-sm text-gray-900">Quantity: {selectedOrder.quantity}</p>
                      <p className="text-sm text-gray-900">Total: {formatCurrency(selectedOrder.total_price)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Status</p>
                      <p className="text-sm text-gray-900">{selectedOrder.order_status}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Order Date</p>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedOrder.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 