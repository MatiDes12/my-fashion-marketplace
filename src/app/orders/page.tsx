'use client';

import { useState, useEffect, Fragment } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponent();
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams?.get('payment_success') ?? null;
  const tx_ref = searchParams?.get('tx_ref') ?? null;
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState<string>('all');
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const ordersPerPage = 10;
  
  const fetchOrders = async (userId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        product:products(
          id, 
          title, 
          price,
          owner_id,
          images:product_images(*),
          seller:users!products_owner_id_fkey(
            id,
            full_name,
            store_settings
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Failed to fetch orders');
    
    // Helper function to get the base payment reference
    const getBasePaymentRef = (paymentRef: string) => {
      if (!paymentRef) return null;
      // For cash payments, extract the base reference (before the last hyphen)
      if (paymentRef.startsWith('CASH-')) {
        const parts = paymentRef.split('-');
        // Remove the last part (variant) and join back
        return parts.slice(0, -1).join('-');
      }
      // For Chapa payments, use as is
      return paymentRef;
    };

    // Group orders by payment reference
    const groupedOrders = data.reduce((acc: any, order: any) => {
      const basePaymentRef = getBasePaymentRef(order.payment_reference);
      if (!basePaymentRef) return acc;

      if (!acc[basePaymentRef]) {
        acc[basePaymentRef] = {
          orders: [],
          total: 0,
          created_at: order.created_at,
          payment_status: order.payment_status,
          order_status: order.order_status,
          payment_reference: basePaymentRef,
          is_cash_payment: basePaymentRef.startsWith('CASH-'),
          tx_ref: order.tx_ref,
          receipt_url: order.receipt_url
        };
      }
      acc[basePaymentRef].orders.push(order);
      acc[basePaymentRef].total += parseFloat(order.total_price);
      return acc;
    }, {});

    // Convert to array and sort by date
    return Object.values(groupedOrders).sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const queryClient = useQueryClient();

  useEffect(() => {
    const getSessionAndFetch = async () => {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setLoading(false);
      // React Query will handle fetching
    };
    getSessionAndFetch();
  }, []);

  const { data: ordersData, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders', supabase.auth.getSession],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');
      return fetchOrders(session.user.id);
    },
    enabled: !loading && !error,
  });

  useEffect(() => {
    if (ordersData) setOrders(ordersData);
  }, [ordersData]);

  // When payment is confirmed, refetch orders
  useEffect(() => {
    if (paymentSuccess === 'true' && tx_ref) {
      refetch();
    }
  }, [paymentSuccess, tx_ref, refetch]);
  
  // Update the useEffect for payment verification
  useEffect(() => {
    if (!searchParams) return;
    const tx_ref = searchParams.get('tx_ref');
    if (!tx_ref || isPaymentConfirmed) return;

    // Don't poll for cash payments
    if (tx_ref.startsWith('CASH-')) {
      setIsPaymentConfirmed(true);
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/payments/chapa/verify?tx_ref=${tx_ref}`);
        const data = await response.json();

        if (data.status === 'success' && data.data?.status === 'success') {
          // Refresh orders list
          setOrders([]); // Reset orders to trigger refetch
          // Clear URL params
          router.replace('/orders');
          // Stop polling by setting payment as confirmed
          setIsPaymentConfirmed(true);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        // Stop polling on error as well
        setIsPaymentConfirmed(true);
      }
    };

    // Only set up polling for non-cash payments
    const pollInterval = setInterval(checkPaymentStatus, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [searchParams, isPaymentConfirmed]);
  
  // Reset payment confirmation when tx_ref changes
  useEffect(() => {
    if (!searchParams) return;
    const tx_ref = searchParams.get('tx_ref');
    if (!tx_ref) {
      setIsPaymentConfirmed(false);
    }
  }, [searchParams]);
  
  useEffect(() => {
    // Filter orders based on status
    const filtered = orders.filter(order => 
      orderStatus === 'all' ? true : order.order_status === orderStatus
    );
    setFilteredOrders(filtered);
  }, [orders, orderStatus]);
  
  // Add this pagination calculation
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  
  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };
  
  // Helper function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleDownloadReceipt = async (receiptUrl: string, orderRef: string) => {
    try {
      if (!receiptUrl) {
        toast.error('Receipt not available');
        return;
      }

      // Open receipt in new tab instead of downloading
      window.open(receiptUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening receipt:', error);
      toast.error('Failed to open receipt');
    }
  };
  
  const generateCashReceipt = async (order: any) => {
    try {
      const supabase = createClientComponent();
      
      // Generate receipt URL
      const receiptUrl = `/api/receipts/cash/${order.tx_ref}`;
      
      // Update the order with receipt URL and payment status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          receipt_url: receiptUrl,
          payment_status: 'paid' 
        })
        .eq('id', order.id);
        
      if (orderError) throw orderError;

      // Update the transaction statuses
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          payment_status: 'paid',
          platform_payout_status: 'completed',
          seller_payout_status: 'completed'
        })
        .eq('order_id', order.id);

      if (transactionError) throw transactionError;
      
      return receiptUrl;
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Failed to generate receipt');
      return null;
    }
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="h-20"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="mt-2 text-gray-600">
            Track and manage your purchases
          </p>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-600">Filter by status:</label>
            <select
              value={orderStatus}
              onChange={(e) => {
                setOrderStatus(e.target.value);
                setCurrentPage(1); // Reset to first page when filter changes
              }}
              className="rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
            >
              <option value="all">All Orders</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="bg-red-50 p-6 rounded-lg shadow-sm">
            <ErrorMessage message={error} />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No orders yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              You haven't placed any orders yet. Start shopping to see your orders here.
            </p>
            <button
              onClick={() => router.push('/products')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {currentOrders.map((orderGroup: any) => (
              <div key={orderGroup.payment_reference} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-wrap items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">
                        {orderGroup.is_cash_payment ? (
                          <>Cash Payment #{orderGroup.payment_reference.split('-')[2]}</>
                        ) : (
                          <>Chapa Payment #{orderGroup.payment_reference.substring(0, 8)}</>
                        )}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Placed on {formatDate(orderGroup.created_at)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Total Amount: ETB {orderGroup.total.toFixed(2)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Payment Method: {orderGroup.is_cash_payment ? 'Cash on Delivery/Pickup' : 'Chapa'}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(orderGroup.order_status)}`}>
                        {orderGroup.order_status.charAt(0).toUpperCase() + orderGroup.order_status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {orderGroup.orders.map((order: any) => (
                    <div key={order.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-md overflow-hidden">
                          {order.product?.images && order.product.images.length > 0 ? (
                            <Image
                              src={order.product.images[0].image_url}
                              alt={order.product.title}
                              width={80}
                              height={80}
                              className="w-full h-full object-center object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="ml-6 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">
                              <button 
                                onClick={() => router.push(`/products/${order.product?.id}`)}
                                className="hover:text-green-600"
                              >
                                {order.product?.title || 'Product Unavailable'}
                              </button>
                            </h3>
                            <p className="ml-4 text-lg font-medium text-gray-900">
                              ETB {order.total_price?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="mt-1 text-sm text-gray-500">
                              Seller: {order.product?.seller?.store_settings?.name || 
                                       order.product?.seller?.full_name || 
                                       'Unknown Seller'}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              Contact: {order.product?.seller?.store_settings?.email || 'N/A'} | {order.product?.seller?.store_settings?.phone || 'N/A'}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              Address: {order.product?.seller?.store_settings?.address?.city || 'N/A'}, {order.product?.seller?.store_settings?.address?.subCity || ''}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">Quantity: {order.quantity}</p>
                            <p className="mt-1 text-sm text-gray-500">Price per item: ETB {order.product?.price}</p>
                            
                            {order.selected_variant_sku && (
                              <p className="mt-1 text-sm text-gray-500">Variant: {order.selected_variant_sku}</p>
                            )}
                            {order.selected_size && (
                              <p className="mt-1 text-sm text-gray-500">Size: {order.selected_size}</p>
                            )}
                            {order.selected_color && (
                              <p className="mt-1 text-sm text-gray-500">Color: {order.selected_color}</p>
                            )}
                            
                            <p className="mt-1 text-sm text-gray-500">
                              Delivery Method: {order.delivery_method ? order.delivery_method.replace('_', ' ').toUpperCase() : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      {orderGroup.orders[0].order_status === 'delivered' ? (
                        <span className="flex items-center text-green-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Delivered on {formatDate(orderGroup.orders[0].updated_at)}
                        </span>
                      ) : orderGroup.orders[0].order_status === 'shipped' ? (
                        <span className="flex items-center text-purple-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2a1 1 0 00.9-.5l1.08-1.5-3.7-3.7A1 1 0 0010.46 4H3z" />
                          </svg>
                          Shipped on {formatDate(orderGroup.orders[0].updated_at)}
                        </span>
                      ) : (
                        <span>
                          {orderGroup.orders[0].order_status === 'cancelled' ? 'Cancelled' : 'Processing your order'}
                        </span>
                      )}
                    </div>

                    <div className="flex space-x-3">
                      {orderGroup.receipt_url && (
                        <button
                          onClick={() => handleDownloadReceipt(orderGroup.receipt_url, orderGroup.tx_ref)}
                          className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                          <span>View Receipt</span>
                        </button>
                      )}

                      {orderGroup.orders[0].order_status !== 'cancelled' && orderGroup.orders[0].order_status !== 'delivered' && (
                        <button
                          onClick={() => router.push(`/support?order=${orderGroup.orders[0].id}`)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Contact Support
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredOrders.length > ordersPerPage && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
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
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        page === currentPage
                          ? 'z-10 bg-green-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <Transition.Root show={isDetailsModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setIsDetailsModalOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={() => setIsDetailsModalOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  {selectedOrder && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Order Details</h3>
                        <p className="text-sm text-gray-500">Order #{selectedOrder.id.substring(0, 8)}</p>
                      </div>

                      <div className="border-t border-gray-200 pt-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium">Product Information</h4>
                            <p className="text-gray-600">{selectedOrder.product?.title}</p>
                            {selectedOrder.selected_size && (
                              <p className="text-sm text-gray-500">Size: {selectedOrder.selected_size}</p>
                            )}
                            {selectedOrder.selected_color && (
                              <p className="text-sm text-gray-500">Color: {selectedOrder.selected_color}</p>
                            )}
                            {selectedOrder.selected_variant_sku && (
                              <p className="text-sm text-gray-500">SKU: {selectedOrder.selected_variant_sku}</p>
                            )}
                          </div>

                          <div>
                            <h4 className="font-medium">Delivery Details</h4>
                            <p className="text-sm text-gray-500">Method: {selectedOrder.delivery_method?.replace('_', ' ').toUpperCase()}</p>
                            {selectedOrder.delivery_address && (
                              <div className="text-sm text-gray-500">
                                {typeof selectedOrder.delivery_address === 'string' 
                                  ? JSON.parse(selectedOrder.delivery_address)?.city
                                  : selectedOrder.delivery_address?.city}
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="font-medium">Payment Information</h4>
                            <p className="text-sm text-gray-500">Status: {selectedOrder.payment_status?.toUpperCase()}</p>
                            <p className="text-sm text-gray-500">Total: ETB {selectedOrder.total_price}</p>
                            {selectedOrder.delivery_fee > 0 && (
                              <p className="text-sm text-gray-500">Delivery Fee: ETB {selectedOrder.delivery_fee}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
} 