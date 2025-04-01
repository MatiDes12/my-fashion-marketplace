'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponent();
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('payment_success');
  const tx_ref = searchParams.get('tx_ref');
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        // Fetch orders with product details
        const { data, error: fetchError } = await supabase
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
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
          
        if (fetchError) {
          throw new Error('Failed to fetch orders');
        }
        
        setOrders(data || []);
        
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, []);
  
  useEffect(() => {
    if (paymentSuccess === 'true' && tx_ref) {
      if (tx_ref.startsWith('CASH-')) {
        toast.success('Order placed successfully! Please prepare cash for delivery/pickup.');
      } else {
        toast.success('Payment successful! Your order has been placed.');
      }
    }
  }, [paymentSuccess, tx_ref]);
  
  // Update the useEffect for payment verification
  useEffect(() => {
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
    const tx_ref = searchParams.get('tx_ref');
    if (!tx_ref) {
      setIsPaymentConfirmed(false);
    }
  }, [searchParams]);
  
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
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-wrap items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">
                        Order #{order.id.substring(0, 8)}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Placed on {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.order_status)}`}>
                        {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
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
                          ${order.total_price?.toFixed(2) || '0.00'}
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
                        <p className="mt-1 text-sm text-gray-500">Price per item: ${order.product?.price}</p>
                        
                        {(order.payment_reference || order.tx_ref) && (
                          <div className="mt-3 bg-gray-50 p-2 rounded-md flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-gray-700">References</p>
                              {order.tx_ref?.startsWith('CASH-') ? (
                                <>
                                  <p className="text-sm text-gray-600">
                                    Payment Method: <span className="font-medium">Cash on Delivery/Pickup</span>
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Reference: <span className="font-mono">{order.tx_ref}</span>
                                  </p>
                                </>
                              ) : (
                                <>
                                  {order.payment_reference && (
                                    <p className="text-sm text-gray-600">
                                      Chapa: <span className="font-mono">{order.payment_reference}</span>
                                    </p>
                                  )}
                                  {order.tx_ref && !order.tx_ref.startsWith('CASH-') && (
                                    <p className="text-sm text-gray-600">
                                      Merchant: <span className="font-mono">{order.tx_ref}</span>
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            {(order.receipt_url || (order.tx_ref?.startsWith('CASH-') && order.order_status === 'delivered')) && (
                              <button
                                onClick={async () => {
                                  if (order.tx_ref?.startsWith('CASH-') && !order.receipt_url) {
                                    // Generate receipt for cash payment
                                    const receiptUrl = await generateCashReceipt(order);
                                    if (receiptUrl) {
                                      handleDownloadReceipt(receiptUrl, order.tx_ref);
                                    }
                                  } else {
                                    handleDownloadReceipt(order.receipt_url, order.tx_ref);
                                  }
                                }}
                                className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                              >
                                <ArrowDownTrayIcon className="h-5 w-5" />
                                <span>View Receipt</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      {order.order_status === 'delivered' ? (
                        <span className="flex items-center text-green-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Delivered on {formatDate(order.updated_at)}
                        </span>
                      ) : order.order_status === 'shipped' ? (
                        <span className="flex items-center text-purple-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2a1 1 0 00.9-.5l1.08-1.5-3.7-3.7A1 1 0 0010.46 4H3z" />
                          </svg>
                          Shipped on {formatDate(order.updated_at)}
                        </span>
                      ) : (
                        <span>
                          {order.order_status === 'cancelled' ? 'Cancelled' : 'Processing your order'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      {order.order_status !== 'cancelled' && order.order_status !== 'delivered' && (
                        <button
                          onClick={() => router.push(`/support?order=${order.id}`)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Contact Support
                        </button>
                      )}
                      
                      {order.order_status === 'delivered' && (
                        <button
                          onClick={() => router.push(`/products/${order.product.id}?review=true`)}
                          className="inline-flex items-center px-3 py-1 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          Write a Review
                        </button>
                      )}
                      
                      <button
                        onClick={() => router.push(`/products/${order.product.id}`)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Buy Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 