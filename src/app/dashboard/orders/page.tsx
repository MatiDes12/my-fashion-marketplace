'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { formatCurrency } from '@/utils/currency';
import { toast } from 'react-hot-toast';

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
  updated_at: string;
  user_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  order_status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  service_fee: number;
  payment_status?: string;
  payment_reference?: string;
  tx_ref?: string;
  receipt_url?: string;
  delivery_fee: number;
  delivery_proof_image?: string;
  delivery_method?: 'home_delivery' | 'store_pickup';
  delivery_address?: string;
  product?: Product;
  user?: User;
  transaction?: {
    customer_phone?: string;
    payment_method?: string;
    payment_status?: string;
    subtotal?: number;
    platform_fee?: number;
    service_fee?: number;
    delivery_fee?: number;
    vat_amount?: number;
    total_amount?: number;
    seller_payout_amount?: number;
    platform_revenue?: number;
    seller_payout_status?: string;
  };
}

interface OrderWithUser {
  id: string;
  created_at: string;
  quantity: number;
  total_price: number;
  order_status: Order['order_status'];
  user_id: string;
  service_fee: number;
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
  service_fee: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    ordersByStatus: {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);

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
              updated_at,
              quantity,
              total_price,
              order_status,
              user_id,
              service_fee,
              delivery_fee,
              payment_status,
              payment_reference,
              tx_ref,
              receipt_url,
              delivery_proof_image,
              delivery_method,
              delivery_address,
              user:users!user_id (
                id,
                full_name,
                email
              ),
              transaction:transactions (
                customer_phone,
                payment_method,
                payment_status,
                subtotal,
                platform_fee,
                service_fee,
                delivery_fee,
                vat_amount,
                total_amount,
                seller_payout_amount,
                platform_revenue,
                seller_payout_status
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
          (product.orders || []).map((order: any) => ({
            id: order.id,
            created_at: order.created_at,
            updated_at: order.updated_at,
            user_id: order.user_id,
            product_id: product.id,
            quantity: order.quantity,
            total_price: order.total_price,
            order_status: order.order_status,
            service_fee: order.service_fee || 0,
            payment_status: order.payment_status,
            payment_reference: order.payment_reference,
            tx_ref: order.tx_ref,
            receipt_url: order.receipt_url,
            delivery_fee: order.delivery_fee || 0,
            delivery_proof_image: order.delivery_proof_image,
            delivery_method: order.delivery_method,
            delivery_address: order.delivery_address,
            product: {
              id: product.id,
              title: product.title,
              price: product.price,
              owner_id: session.user.id
            },
            user: order.user && {
              id: order.user.id,
              full_name: order.user.full_name,
              email: order.user.email
            },
            transaction: order.transaction?.[0] || null // Get the first transaction record
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
    fetchOrderStats();
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

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);

      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type must be JPEG, PNG, or GIF');
      }

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      console.log('Attempting to upload to:', filePath);

      // Upload image to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('delivery-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL using the correct method
      const publicUrl = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(filePath).data.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to get public URL');
      }

      console.log('Upload successful, public URL:', publicUrl);
      return publicUrl;

    } catch (error) {
      console.error('Error uploading image:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image');
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Order['order_status']) => {
    if (!selectedOrder) return;
    
    // Prevent changing status if already delivered
    if (selectedOrder.order_status === 'delivered') {
      toast.error("Cannot change status once order is marked as delivered");
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const isCashPayment = selectedOrder.transaction?.payment_method === 'CASH';
      const isMarkingDelivered = newStatus === 'delivered';

      // If marking as delivered, require image (unless already delivered)
      if (isMarkingDelivered && !selectedImage && !selectedOrder.delivery_proof_image) {
        alert('Please upload delivery proof image before marking as delivered');
        return;
      }

      let deliveryProofUrl = selectedOrder.delivery_proof_image;

      // Upload new image if provided
      if (isMarkingDelivered && selectedImage) {
        deliveryProofUrl = await handleImageUpload(selectedImage);
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Update order with image URL and status
      const { data: orderUpdate, error: orderError } = await supabase
        .from('orders')
        .update({ 
          order_status: newStatus,
          updated_at: new Date().toISOString(),
          delivery_proof_image: deliveryProofUrl,
          ...(isCashPayment && isMarkingDelivered ? { payment_status: 'paid' } : {})
        })
        .eq('id', selectedOrder.id)
        .select('*')
        .single();

      if (orderError) throw orderError;

      // If status is delivered, update the transaction with seller_id
      if (isMarkingDelivered) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .update({
            payment_status: 'paid',
            platform_payout_status: 'completed',
            seller_payout_status: 'pending',
            updated_at: new Date().toISOString(),
            seller_id: session.user.id  // Add seller_id for RLS
          })
          .eq('order_id', selectedOrder.id)
          .eq('seller_id', session.user.id); // Add this condition for RLS

        if (transactionError) {
          console.error('Transaction update error:', transactionError);
          throw transactionError;
        }
      }

      // Update the local state with the new order data
      setOrders(orders.map(order => 
        order.id === selectedOrder.id 
          ? { 
              ...order, 
              order_status: newStatus,
              delivery_proof_image: deliveryProofUrl,
              updated_at: new Date().toISOString(),
              ...(isCashPayment && isMarkingDelivered ? {
                payment_status: 'paid',
                transaction: {
                  ...order.transaction,
                  payment_status: 'paid',
                  platform_payout_status: 'completed',
                  seller_payout_status: 'completed'
                }
              } : {})
            }
          : order
      ));

      setIsUpdateModalOpen(false);
      setSelectedOrder(null);
      toast.success(`Order status updated to ${newStatus}`);

    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
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

  const indexOfLastOrder = currentPage * itemsPerPage;
  const indexOfFirstOrder = indexOfLastOrder - itemsPerPage;
  const paginatedOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const fetchOrderStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Get transactions for this seller to calculate actual revenue
      const { data: transactions } = await supabase
        .from('transactions')
        .select('seller_payout_amount, created_at')
        .eq('seller_id', session.user.id)
        .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString());

      // Calculate total revenue using seller_payout_amount
      const totalRevenue = transactions?.reduce((sum, transaction) => {
        return sum + (transaction.seller_payout_amount || 0);
      }, 0) || 0;

      // First get all products owned by the seller
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('owner_id', session.user.id);

      const productIds = products?.map(p => p.id) || [];

      // Then get orders for these products
      const { data: orders } = await supabase
        .from('orders')
        .select('order_status, created_at')
        .in('product_id', productIds)
        .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString());

      const stats = {
        totalRevenue,
        totalOrders: orders?.length || 0,
        averageOrderValue: orders?.length ? totalRevenue / orders.length : 0,
        ordersByStatus: {
          pending: orders?.filter(o => o.order_status === 'pending').length || 0,
          confirmed: orders?.filter(o => o.order_status === 'confirmed').length || 0,
          shipped: orders?.filter(o => o.order_status === 'shipped').length || 0,
          delivered: orders?.filter(o => o.order_status === 'delivered').length || 0,
          cancelled: orders?.filter(o => o.order_status === 'cancelled').length || 0,
        }
      };

      setOrderStats(stats);
    } catch (error) {
      console.error('Error fetching order stats:', error);
      toast.error('Failed to load order statistics');
    }
  };

  useEffect(() => {
    if (!orders) return;

    let result = [...orders];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => order.order_status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(order => 
        // Search in order info
        order.id.toLowerCase().includes(searchLower) ||
        order.order_status.toLowerCase().includes(searchLower) ||
        formatCurrency(order.total_price).toLowerCase().includes(searchLower) ||
        // Search in customer info
        order.user?.full_name?.toLowerCase().includes(searchLower) ||
        order.user?.email?.toLowerCase().includes(searchLower) ||
        // Search in product info
        order.product?.title?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredOrders(result);
  }, [orders, searchTerm, statusFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Stats Overview Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-indigo-600">Total Orders</h3>
              <p className="text-2xl font-bold text-indigo-900">{orderStats.totalOrders}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-green-600">Completed Orders</h3>
              <p className="text-2xl font-bold text-green-900">
                {orderStats.ordersByStatus.delivered}
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-600">Pending Orders</h3>
              <p className="text-2xl font-bold text-yellow-900">
                {orderStats.ordersByStatus.pending}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-600">Total Revenue</h3>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(orderStats.totalRevenue)}
              </p>
            </div>
          </div>
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
            <div className="p-12">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No orders yet</h3>
              <p className="mt-2 text-sm text-gray-500">
                When customers place orders for your products, they'll appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              {/* Search Bar */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search orders, customers, or products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 pr-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              <div className="sm:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Orders List */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Info
                    </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment
                    </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                              </svg>
                            </div>
                            <div>
                          <div className="text-sm font-medium text-gray-900">
                            #{order.id.substring(0, 8)}
                          </div>
                              <div className="text-sm text-gray-500 truncate max-w-[200px]">
                                {order.product?.title || 'Unknown Product'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                              </div>
                          </div>
                        </div>
                      </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{order.user?.full_name}</div>
                          <div className="text-sm text-gray-500">{order.user?.email}</div>
                      </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{formatCurrency(order.total_price)}</div>
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                        </div>
                      </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${order.order_status === 'delivered' ? 'bg-green-100 text-green-800' : 
                            order.order_status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                            order.order_status === 'shipped' ? 'bg-blue-100 text-blue-800' : 
                              'bg-yellow-100 text-yellow-800'}`}>
                          {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                        </span>
                      </td>
                        <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-3">
                          <button 
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsUpdateModalOpen(true);
                            }}
                              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                              Update
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsViewModalOpen(true);
                            }}
                              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                          >
                              View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Add Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{indexOfFirstOrder + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(indexOfLastOrder, filteredOrders.length)}
                      </span>{' '}
                      of <span className="font-medium">{filteredOrders.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => handlePageChange(i + 1)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === i + 1
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
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
                  
                  {/* Add Image Upload Section */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Proof Image
                      {selectedOrder?.order_status !== 'delivered' && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        {imagePreview || (selectedOrder?.delivery_proof_image || '') ? (
                          <div className="relative">
                            <img
                              src={imagePreview || (selectedOrder?.delivery_proof_image || '')}
                              alt="Delivery Proof"
                              className="mx-auto h-32 w-auto object-contain"
                            />
                            {selectedOrder?.order_status !== 'delivered' && (
                              <button
                                onClick={() => {
                                  setSelectedImage(null);
                                  setImagePreview(null);
                                }}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {selectedOrder?.order_status !== 'delivered' && (
                              <>
                                <div className="flex text-sm text-gray-600">
                                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                    <span>Upload a file</span>
                                    <input
                                      type="file"
                                      className="sr-only"
                                      accept="image/*"
                                      onChange={handleImageSelect}
                                    />
                                  </label>
                                  <p className="pl-1">or drag and drop</p>
                                </div>
                                <p className="text-xs text-gray-500">
                                  PNG, JPG, GIF up to 10MB
                                </p>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Buttons */}
                  <div className="mt-2 space-y-3">
                    {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleUpdateStatus(status as Order['order_status'])}
                        disabled={
                          updatingStatus || 
                          selectedOrder?.order_status === 'delivered' ||
                          (selectedOrder?.order_status === status)
                        }
                        className={`px-4 py-2 text-sm font-medium rounded-md ${
                          selectedOrder?.order_status === status
                            ? 'bg-gray-100 text-gray-800'
                            : selectedOrder?.order_status === 'delivered'
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdateModalOpen(false);
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
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
      <div className={`fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${isViewModalOpen ? 'block' : 'hidden'} z-[100]`}>
        <div className="fixed inset-0 z-[101] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              {/* Modal Header - Fixed */}
              <div className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-[102]">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                    Order Details
                  </h3>
              </div>

              {/* Scrollable Content */}
              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-4 py-4">
                {selectedOrder && (
                  <div className="space-y-4">
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
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-500 mb-2">Financial Breakdown</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Subtotal</span>
                          <span className="text-gray-900">
                            ETB {selectedOrder.transaction?.subtotal?.toFixed(2) || 
                              ((selectedOrder.product?.price ?? 0) * (selectedOrder.quantity ?? 0)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Platform Fee</span>
                          <span className="text-red-600">
                            -ETB {selectedOrder.transaction?.platform_fee?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Service Fee</span>
                          <span className="text-red-600">
                            -ETB {selectedOrder.transaction?.service_fee?.toFixed(2) || selectedOrder.service_fee?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Delivery Fee</span>
                          <span className="text-gray-900">
                            ETB {selectedOrder.transaction?.delivery_fee?.toFixed(2) || selectedOrder.delivery_fee?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">VAT</span>
                          <span className="text-gray-900">
                            ETB {selectedOrder.transaction?.vat_amount?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-medium pt-2 border-t">
                          <span className="text-gray-900">Total Amount</span>
                          <span className="text-gray-900">
                            ETB {selectedOrder.transaction?.total_amount?.toFixed(2) || selectedOrder.total_price?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-medium pt-2">
                          <span className="text-gray-900">Your Earnings</span>
                          <span className="text-green-600">
                            ETB {selectedOrder.transaction?.seller_payout_amount?.toFixed(2) || (selectedOrder.total_price - selectedOrder.service_fee)?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm text-gray-500">
                          Payment Method: <span className="font-medium">{selectedOrder.transaction?.payment_method || 'Unknown'}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                          Payment Status: <span className="font-medium">{selectedOrder.payment_status}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                          Payout Status: <span className="font-medium">{selectedOrder.transaction?.payment_status || 'Pending'}</span>
                        </p>
                        {selectedOrder.tx_ref && (
                          <p className="text-sm text-gray-500">
                            Reference: <span className="font-mono text-xs">{selectedOrder.tx_ref}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-500 mb-2">Customer Information</p>
                      <p className="text-sm text-gray-900">{selectedOrder.user?.full_name}</p>
                      <p className="text-sm text-gray-500">{selectedOrder.user?.email}</p>
                      <p className="text-sm text-gray-500">
                        {selectedOrder.transaction?.customer_phone || 'No phone'}
                      </p>
                    </div>
                    {selectedOrder.order_status === 'delivered' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Delivered on {new Date(selectedOrder.created_at).toLocaleString()}
                      </p>
                    )}

                    {/* Delivery Information Section */}
                    <div className="bg-gray-50 p-4 rounded-lg mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Delivery Information</h4>
                      <div className="space-y-3">
                        {/* Delivery Method */}
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-gray-500">Delivery Method</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedOrder?.delivery_method === 'home_delivery' 
                                ? 'Home Delivery' 
                                : selectedOrder?.delivery_method === 'store_pickup'
                                ? 'Store Pickup'
                                : 'Not specified'}
                            </p>
                          </div>
                        </div>

                        {/* Delivery Fee */}
                        {selectedOrder?.delivery_method === 'home_delivery' && (
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm text-gray-500">Delivery Fee</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(selectedOrder.delivery_fee || 0)}
                              </p>
                  </div>
                </div>
              )}

                        {/* Delivery Address */}
                        {selectedOrder?.delivery_address && (
                          <div className="border-t border-gray-200 pt-3">
                            <div className="flex items-start">
                              <div className="flex-shrink-0 mt-1">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <p className="text-sm text-gray-500">Delivery Address</p>
                                {(() => {
                                  try {
                                    const addressObj = typeof selectedOrder.delivery_address === 'string' 
                                      ? JSON.parse(selectedOrder.delivery_address)
                                      : selectedOrder.delivery_address;

                                    return (
                                      <div className="mt-1 space-y-1">
                                        {/* Street Address */}
                                        <p className="text-sm font-medium text-gray-900">
                                          {Object.entries(addressObj)
                                            .filter(([key]) => !isNaN(Number(key)))
                                            .map(([_, value]) => value)
                                            .join('')}
                                        </p>
                                        
                                        {/* City and Sub-City */}
                                        <p className="text-sm text-gray-700">
                                          {addressObj.city}
                                          {addressObj.subCity && `, ${addressObj.subCity}`}
                                        </p>

                                        {/* Additional Details */}
                                        <div className="text-sm text-gray-600 grid grid-cols-2 gap-2">
                                          {addressObj.wereda && (
                                            <span>Wereda: {addressObj.wereda}</span>
                                          )}
                                          {addressObj.kebele && (
                                            <span>Kebele: {addressObj.kebele}</span>
                                          )}
                                          {addressObj.houseNo && (
                                            <span>House No: {addressObj.houseNo}</span>
                                          )}
                                          {addressObj.landmark && (
                                            <span>Landmark: {addressObj.landmark}</span>
                                          )}
                                        </div>

                                        {/* Map Link */}
                                        {addressObj.mapLink && (
                                          <a 
                                            href={addressObj.mapLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 mt-2"
                                          >
                                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            View on Google Maps
                                          </a>
                                        )}
                                      </div>
                                    );
                                  } catch (e) {
                                    // Fallback for non-JSON address
                                    return (
                                      <p className="text-sm font-medium text-gray-900">
                                        {selectedOrder.delivery_address}
                                      </p>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer - Fixed */}
              <div className="bg-white px-4 py-3 border-t border-gray-200 sticky bottom-0 z-[102] sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Close
                </button>
                {/* Add Download Button */}
                <button
                  type="button"
                  onClick={() => {
                    // Create a text version of the order details
                    const orderDetails = `
Order ID: ${selectedOrder?.id}
Product: ${selectedOrder?.product?.title}
Customer: ${selectedOrder?.user?.full_name}
Email: ${selectedOrder?.user?.email}
Order Date: ${new Date(selectedOrder?.created_at || '').toLocaleString()}
Status: ${selectedOrder?.order_status}
Total Amount: ${formatCurrency(selectedOrder?.total_price || 0)}
Payment Status: ${selectedOrder?.payment_status}

Delivery Information:
Method: ${selectedOrder?.delivery_method === 'home_delivery' ? 'Home Delivery' : 'Store Pickup'}
${selectedOrder?.delivery_fee ? `Delivery Fee: ${formatCurrency(selectedOrder?.delivery_fee)}` : ''}

${(() => {
  try {
    const address = JSON.parse(selectedOrder?.delivery_address || '{}');
    return `
Delivery Address:
${Object.entries(address)
  .filter(([key]) => !isNaN(Number(key)))
  .map(([_, value]) => value)
  .join('')}
${address.city}${address.subCity ? `, ${address.subCity}` : ''}
${address.wereda ? `Wereda: ${address.wereda}` : ''}
${address.kebele ? `Kebele: ${address.kebele}` : ''}
${address.houseNo ? `House No: ${address.houseNo}` : ''}
${address.landmark ? `Landmark: ${address.landmark}` : ''}`;
  } catch (e) {
    return selectedOrder?.delivery_address || '';
  }
})()}

Financial Details:
Subtotal: ${formatCurrency(selectedOrder?.transaction?.subtotal || 0)}
Platform Fee: ${formatCurrency(selectedOrder?.transaction?.platform_fee || 0)}
Service Fee: ${formatCurrency(selectedOrder?.transaction?.service_fee || 0)}
VAT: ${formatCurrency(selectedOrder?.transaction?.vat_amount || 0)}
Total Amount: ${formatCurrency(selectedOrder?.transaction?.total_amount || 0)}
`;

                    // Create and download the file
                    const blob = new Blob([orderDetails], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `order-${selectedOrder?.id.substring(0, 8)}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  }}
                  className="mr-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 