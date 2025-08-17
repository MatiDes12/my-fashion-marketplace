'use client';

import { useState, useEffect, Fragment } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { ArrowDownTrayIcon, TruckIcon, MapPinIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { convertETBToUSD } from '@/utils/currency';
import PickupCodeDisplay from '@/components/PickupCodeDisplay';
import DeliveryMap from '@/components/DeliveryMap';

// Add delivery tracking types
interface DeliveryStatus {
  id: string;
  order_id: string;
  delivery_account_id?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered';
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  created_at: string;
  delivery_person_name?: string;
  delivery_person_phone?: string;
  proof_image?: string;
}

interface TrackingStep {
  status: DeliveryStatus['status'];
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  current: boolean;
  timestamp?: string;
}

export default function OrdersPage() {
  const { t } = useLanguage();
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
  const [isPickupCodeModalOpen, setIsPickupCodeModalOpen] = useState(false);
  const [selectedPickupOrder, setSelectedPickupOrder] = useState<any>(null);
  
  // Add delivery tracking states
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<any>(null);
  const [deliveryStatuses, setDeliveryStatuses] = useState<DeliveryStatus[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  
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
    const getBasePaymentRef = (order: any) => {
      if (!order.payment_reference) return null;
      
      // For cash payments, use the tx_ref which contains the base reference
      if (order.payment_reference.startsWith('CASH-')) {
        // Extract the base CASH reference from tx_ref
        const txRefParts = order.tx_ref?.split('-') || [];
        if (txRefParts.length >= 3) {
          // Get the base CASH reference: CASH-timestamp-random
          return `${txRefParts[0]}-${txRefParts[1]}-${txRefParts[2]}`;
        }
        // Fallback to payment_reference if tx_ref parsing fails
        return order.payment_reference;
      }
      
      // For Stripe payments, use the payment_reference as is
      if (order.payment_reference.startsWith('cs_test_') || order.payment_reference.startsWith('cs_live_')) {
        return order.payment_reference;
      }
      
      // For Chapa payments, use the payment_reference as is
      return order.payment_reference;
    };

    // Group orders by payment reference
    const groupedOrders = data.reduce((acc: any, order: any) => {
      const basePaymentRef = getBasePaymentRef(order);
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
          receipt_url: (() => {
            if (basePaymentRef.startsWith('CASH-')) {
              return `/api/receipts/cash/${basePaymentRef}`;
            } else if (basePaymentRef.startsWith('cs_test_') || basePaymentRef.startsWith('cs_live_')) {
              return `/api/receipts/stripe/${order.tx_ref || basePaymentRef}`;
            } else {
              return order.receipt_url;
            }
          })()
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
  
  // Display label mapping (keep underlying status values unchanged)
  const getDisplayStatus = (status: string, deliveryMethod?: string) => {
    if (status === 'shipped' && deliveryMethod === 'store_pickup') {
      return 'ready for pickup';
    }
    return status;
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

  // Add function to fetch delivery statuses
  const fetchDeliveryStatuses = async (orderId: string) => {
    try {
      setTrackingLoading(true);
      const response = await fetch(`/api/delivery/status/${orderId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch delivery statuses');
      }
      
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error fetching delivery statuses:', error);
      return [];
    } finally {
      setTrackingLoading(false);
    }
  };

  // Add function to generate tracking steps
  const generateTrackingSteps = (order: any, statuses: DeliveryStatus[]): TrackingStep[] => {
    const currentStatus = order.order_status;
    
    // Get the latest delivery status to determine the actual progress
    const latestDeliveryStatus = statuses.length > 0 ? statuses[statuses.length - 1].status : null;
    
    // Check if any delivery status indicates in_transit
    const hasInTransitStatus = statuses.some(s => s.status === 'in_transit' || s.status === 'out_for_delivery');
    
    const steps: TrackingStep[] = [
      {
        status: 'pending',
        title: 'Order Placed',
        description: 'Your order has been placed and is being processed',
        icon: ClockIcon,
        completed: ['pending', 'confirmed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(currentStatus),
        current: currentStatus === 'pending',
        timestamp: order.created_at
      },
      {
        status: 'confirmed',
        title: 'Order Confirmed',
        description: 'Your order has been confirmed by the seller',
        icon: CheckCircleIcon,
        completed: ['confirmed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(currentStatus) || latestDeliveryStatus === 'confirmed',
        current: currentStatus === 'confirmed' && !hasInTransitStatus && latestDeliveryStatus !== 'delivered',
        timestamp: statuses.find(s => s.status === 'confirmed')?.created_at
      },
      {
        status: 'shipped',
        title: 'Order Shipped',
        description: 'Your order has been shipped and is on its way',
        icon: TruckIcon,
        completed: ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(currentStatus) || hasInTransitStatus || latestDeliveryStatus === 'delivered',
        current: currentStatus === 'shipped' && !hasInTransitStatus && latestDeliveryStatus !== 'delivered',
        timestamp: statuses.find(s => s.status === 'shipped')?.created_at
      },
      {
        status: 'in_transit',
        title: 'In Transit',
        description: 'Your order is being transported to your location',
        icon: TruckIcon,
        completed: hasInTransitStatus || latestDeliveryStatus === 'delivered',
        current: hasInTransitStatus && latestDeliveryStatus !== 'delivered',
        timestamp: statuses.find(s => s.status === 'in_transit')?.created_at || statuses.find(s => s.status === 'out_for_delivery')?.created_at
      },
      {
        status: 'delivered',
        title: 'Delivered',
        description: 'Your order has been successfully delivered',
        icon: CheckCircleIcon,
        completed: currentStatus === 'delivered' || latestDeliveryStatus === 'delivered',
        current: latestDeliveryStatus === 'delivered',
        timestamp: statuses.find(s => s.status === 'delivered')?.created_at
      }
    ];

    // If delivered, mark all steps as completed
    if (currentStatus === 'delivered' || latestDeliveryStatus === 'delivered') {
      steps.forEach(step => {
        step.completed = true;
        step.current = false;
      });
      // Mark delivered as current
      steps[steps.length - 1].current = true;
    }

    return steps;
  };

  // Add function to handle tracking modal open
  const handleTrackingOpen = async (order: any) => {
    setSelectedTrackingOrder(order);
    setIsTrackingModalOpen(true);
    
    // Fetch delivery statuses
    const statuses = await fetchDeliveryStatuses(order.id);
    setDeliveryStatuses(statuses);
  };

  // Add function to format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Add function to get delivery person info
  const getDeliveryPersonInfo = () => {
    const lastStatus = deliveryStatuses[deliveryStatuses.length - 1];
    if (lastStatus?.delivery_person_name) {
      return {
        name: lastStatus.delivery_person_name,
        phone: lastStatus.delivery_person_phone
      };
    }
    return null;
  };

  // Add function to clean up image URL
  const cleanImageUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    // Fix duplicate path segments in Supabase storage URLs
    if (url.includes('/delivery-proofs/delivery-proofs/')) {
      return url.replace('/delivery-proofs/delivery-proofs/', '/delivery-proofs/');
    }
    
    // Also handle cases where the URL might have other path issues
    if (url.includes('/storage/v1/object/public/delivery-proofs/')) {
      // Ensure the URL is properly formatted
      const baseUrl = url.split('/storage/v1/object/public/delivery-proofs/')[0];
      const fileName = url.split('/delivery-proofs/').pop();
      if (fileName) {
        return `${baseUrl}/storage/v1/object/public/delivery-proofs/${fileName}`;
      }
    }
    
    return url;
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="h-20"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('orders.title')}</h1>
          <p className="mt-2 text-gray-600">{t('orders.subtitle')}</p>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-600">{t('orders.filterByStatus')}</label>
            <select
              value={orderStatus}
              onChange={(e) => {
                setOrderStatus(e.target.value);
                setCurrentPage(1); // Reset to first page when filter changes
              }}
              className="rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
            >
              <option value="all">{t('orders.status.all')}</option>
              <option value="pending">{t('orders.status.pending')}</option>
              <option value="confirmed">{t('orders.status.confirmed')}</option>
              <option value="shipped">{t('orders.status.shipped')}</option>
              <option value="delivered">{t('orders.status.delivered')}</option>
              <option value="cancelled">{t('orders.status.cancelled')}</option>
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
            <h3 className="mt-2 text-lg font-medium text-gray-900">{t('orders.empty.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('orders.empty.subtitle')}</p>
            <button
              onClick={() => router.push('/products')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              {t('orders.empty.cta')}
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
                        {(() => {
                          const paymentRef = orderGroup.payment_reference;
                          if (paymentRef?.startsWith('CASH-')) {
                            return <>Cash Payment #{paymentRef.split('-')[2]}</>;
                          } else if (paymentRef?.startsWith('cs_test_') || paymentRef?.startsWith('cs_live_')) {
                            return <>Stripe Payment #{paymentRef.slice(-16)}</>;
                          } else {
                            return <>Chapa Payment #{paymentRef?.substring(0, 8)}</>;
                          }
                        })()}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Placed on {formatDate(orderGroup.created_at)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {(() => {
                          const paymentRef = orderGroup.payment_reference;
                          const isStripe = paymentRef?.startsWith('cs_test_') || paymentRef?.startsWith('cs_live_');
                          const totalETB = orderGroup.total.toFixed(2);
                          const totalUSD = convertETBToUSD(orderGroup.total);
                          
                          if (isStripe) {
                            return (
                              <>
                                Total Amount: ETB {totalETB} (${totalUSD} USD)
                                <br />
                                <span className="text-xs text-blue-600">Paid in USD via Stripe</span>
                              </>
                            );
                          } else {
                            return `Total Amount: ETB ${totalETB}`;
                          }
                        })()}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Payment Method: {(() => {
                          const paymentRef = orderGroup.payment_reference;
                          if (paymentRef?.startsWith('CASH-')) return 'Cash on Delivery/Pickup';
                          if (paymentRef?.startsWith('cs_test_') || paymentRef?.startsWith('cs_live_')) return 'Credit/Debit Card (Stripe)';
                          return 'Chapa';
                        })()}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(orderGroup.order_status)}`}>
                        {(() => {
                          const label = getDisplayStatus(orderGroup.order_status, orderGroup.orders?.[0]?.delivery_method);
                          return label.charAt(0).toUpperCase() + label.slice(1);
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {orderGroup.orders.map((order: any) => (
                    <div key={order.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start space-x-4">
                        {/* Product Image */}
                        <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                      {order.product?.images && order.product.images.length > 0 ? (
                        <img
                          src={order.product.images[0].image_url}
                          alt={order.product.title}
                              width={96}
                              height={96}
                          className="w-full h-full object-center object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-medium text-gray-900 mb-2">
                          <button 
                            onClick={() => router.push(`/products/${order.product?.id}`)}
                                  className="hover:text-green-600 transition-colors"
                          >
                            {order.product?.title || 'Product Unavailable'}
                          </button>
                        </h3>
                              
                              {/* Product Specifications */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                  <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-medium w-20">Quantity:</span>
                                    <span>{order.quantity}</span>
                      </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-medium w-20">Price:</span>
                                    <span>
                                      {(() => {
                                        const paymentRef = orderGroup.payment_reference;
                                        const isStripe = paymentRef?.startsWith('cs_test_') || paymentRef?.startsWith('cs_live_');
                                        const priceETB = order.product?.price;
                                        const priceUSD = convertETBToUSD(priceETB);
                                        
                                        if (isStripe && priceETB) {
                                          return `ETB ${priceETB} ($${priceUSD} USD)`;
                                        } else {
                                          return `ETB ${priceETB}`;
                                        }
                                      })()}
                                    </span>
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-medium w-20">Total:</span>
                                    <span className="font-semibold text-gray-900">
                                      {(() => {
                                        const paymentRef = orderGroup.payment_reference;
                                        const isStripe = paymentRef?.startsWith('cs_test_') || paymentRef?.startsWith('cs_live_');
                                        const totalETB = order.total_price?.toFixed(2) || '0.00';
                                        const totalUSD = convertETBToUSD(order.total_price || 0);
                                        
                                        if (isStripe) {
                                          return `ETB ${totalETB} ($${totalUSD} USD)`;
                                        } else {
                                          return `ETB ${totalETB}`;
                                        }
                                      })()}
                                    </span>
                                  </div>
                                  {order.selected_variant_sku && (
                                    <div className="flex items-center text-sm text-gray-600">
                                      <span className="font-medium w-20">SKU:</span>
                                      <span>{order.selected_variant_sku}</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  {order.selected_size && (
                                    <div className="flex items-center text-sm text-gray-600">
                                      <span className="font-medium w-20">Size:</span>
                                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{order.selected_size}</span>
                                    </div>
                                  )}
                                  {order.selected_color && (
                                    <div className="flex items-center text-sm text-gray-600">
                                      <span className="font-medium w-20">Color:</span>
                                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{order.selected_color}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-medium w-20">Delivery:</span>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                      {order.delivery_method ? order.delivery_method.replace('_', ' ').toUpperCase() : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Seller Information */}
                              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Seller Information</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Name:</span> {order.product?.seller?.store_settings?.name || 
                                   order.product?.seller?.full_name || 
                                   'Unknown Seller'}
                        </p>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Email:</span> {order.product?.seller?.store_settings?.email || 'N/A'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Phone:</span> {order.product?.seller?.store_settings?.phone || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Addresses */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Store Address */}
                                {order.product?.seller?.store_settings?.address && (
                                  <div className="bg-blue-50 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                      </svg>
                                      Store Address
                                    </h4>
                                    {(() => {
                                      const address = order.product.seller.store_settings.address;
                                      const streetAddressParts = [];
                                      let i = 0;
                                      while (address[i] !== undefined) {
                                        streetAddressParts.push(address[i]);
                                        i++;
                                      }
                                      const streetAddress = streetAddressParts.join('');
                                      
                                      const addressParts = [
                                        address.houseNo && `House No. ${address.houseNo}`,
                                        streetAddress,
                                        address.landmark && `Near: ${address.landmark}`,
                                        address.kebele && `Kebele ${address.kebele}`,
                                        address.wereda && `Wereda ${address.wereda}`,
                                        address.subCity,
                                        address.city
                                      ].filter(Boolean);
                                      
                                      return (
                                        <div className="text-sm text-blue-800 space-y-1">
                                          {addressParts.map((part, index) => (
                                            <p key={index} className="text-xs">
                                              {part}
                                            </p>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Delivery Address */}
                                {order.delivery_address && (
                                  <div className="bg-green-50 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-green-900 mb-2 flex items-center">
                                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      Delivery Address
                                    </h4>
                                    {(() => {
                                      let deliveryAddress;
                                      try {
                                        deliveryAddress = typeof order.delivery_address === 'string' 
                                          ? JSON.parse(order.delivery_address) 
                                          : order.delivery_address;
                                      } catch (e) {
                                        deliveryAddress = { address: order.delivery_address };
                                      }

                                      if (deliveryAddress.address) {
                                        return (
                                          <p className="text-sm text-green-800 text-xs">
                                            {deliveryAddress.address}
                                          </p>
                                        );
                                      } else if (deliveryAddress.city || deliveryAddress.subCity) {
                                        const addressParts = [
                                          deliveryAddress.houseNo && `House No. ${deliveryAddress.houseNo}`,
                                          deliveryAddress.streetAddress,
                                          deliveryAddress.landmark && `Near: ${deliveryAddress.landmark}`,
                                          deliveryAddress.kebele && `Kebele ${deliveryAddress.kebele}`,
                                          deliveryAddress.wereda && `Wereda ${deliveryAddress.wereda}`,
                                          deliveryAddress.subCity,
                                          deliveryAddress.city
                                        ].filter(Boolean);

                                        return (
                                          <div className="text-sm text-green-800 space-y-1">
                                            {addressParts.map((part, index) => (
                                              <p key={index} className="text-xs">
                                                {part}
                                              </p>
                                            ))}
                          </div>
                                        );
                                      } else {
                                        return (
                                          <p className="text-sm text-green-800 text-xs">
                                            Address not available
                                          </p>
                                        );
                                      }
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
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
                      ) : orderGroup.orders[0].order_status === 'picked up' ? (
                        <span className="flex items-center text-green-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Picked up on {formatDate(orderGroup.orders[0].updated_at)}
                        </span>
                      ) : orderGroup.orders[0].order_status === 'shipped' ? (
                        <span className="flex items-center text-purple-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2a1 1 0 00.9-.5l1.08-1.5-3.7-3.7A1 1 0 0010.46 4H3z" />
                          </svg>
                          {orderGroup.orders[0].delivery_method === 'store_pickup' ? 'Ready for pickup' : 'Shipped'} on {formatDate(orderGroup.orders[0].updated_at)}
                        </span>
                      ) : (
                        <span>
                          {orderGroup.orders[0].order_status === 'cancelled' ? 'Cancelled' : 'Processing your order'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      {/* Add Track Delivery Button */}
                      {orderGroup.orders[0].delivery_method === 'home_delivery' && 
                       orderGroup.orders[0].order_status !== 'cancelled' && (
                        <button
                          onClick={() => handleTrackingOpen(orderGroup.orders[0])}
                          className={`inline-flex items-center px-3 py-1 border shadow-sm text-sm font-medium rounded-md ${
                            orderGroup.orders[0].order_status === 'delivered' 
                              ? 'border-green-600 text-green-600 bg-white hover:bg-green-50'
                              : 'border-blue-600 text-blue-600 bg-white hover:bg-blue-50'
                          }`}
                        >
                          <TruckIcon className="h-4 w-4 mr-2" />
                          {orderGroup.orders[0].order_status === 'delivered' ? 'View Delivery' : 'Track Delivery'}
                        </button>
                      )}
                      
                      {orderGroup.orders[0].pickup_code && (
                        <button
                          onClick={() => {
                            setSelectedPickupOrder(orderGroup.orders[0]);
                            setIsPickupCodeModalOpen(true);
                          }}
                          className="inline-flex items-center px-3 py-1 border border-green-600 shadow-sm text-sm font-medium rounded-md text-green-600 bg-white hover:bg-green-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                          </svg>
                          Show Pickup Code
                        </button>
                      )}
                      
                      {orderGroup.receipt_url && (
                        <button
                          onClick={() => handleDownloadReceipt(orderGroup.receipt_url, orderGroup.tx_ref)}
                          className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                          <span>View Receipt</span>
                        </button>
                      )}
                      
                      {orderGroup.orders[0].order_status !== 'cancelled' && orderGroup.orders[0].order_status !== 'delivered' && orderGroup.orders[0].order_status !== 'picked up' && (
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

      {/* Pickup Code Modal */}
      <Transition.Root show={isPickupCodeModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setIsPickupCodeModalOpen}>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={() => setIsPickupCodeModalOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  {selectedPickupOrder && (
                    <div className="text-center">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                        Pickup Code
                      </Dialog.Title>
                      
                      <div className="mt-4">
                        <PickupCodeDisplay
                          code={selectedPickupOrder.pickup_code}
                          verified={selectedPickupOrder.pickup_code_verified}
                          verifiedAt={selectedPickupOrder.pickup_code_verified_at}
                          className="mx-auto"
                        />
                      </div>

                      <div className="mt-6 text-sm text-gray-500">
                        <p>Show this code to the seller when picking up your order.</p>
                        {selectedPickupOrder.pickup_code_verified ? (
                          <p className="text-green-600 mt-2">✓ Code verified on {new Date(selectedPickupOrder.pickup_code_verified_at).toLocaleDateString()}</p>
                        ) : (
                          <p className="mt-2">Code not yet verified</p>
                        )}
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Delivery Tracking Modal */}
      <Transition.Root show={isTrackingModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={setIsTrackingModalOpen}>
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

          <div className="fixed inset-0 z-[9999] overflow-y-auto">
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={() => setIsTrackingModalOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  {selectedTrackingOrder && (
                    <div className="space-y-6">
                      <div>
                        <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                          Delivery Tracking
                        </Dialog.Title>
                        <p className="mt-1 text-sm text-gray-500">
                          Order #{selectedTrackingOrder.id.substring(0, 8)} • {selectedTrackingOrder.product?.title}
                        </p>
                      </div>

                      {trackingLoading ? (
                        <div className="flex justify-center py-8">
                          <LoadingSpinner />
                        </div>
                      ) : (
                        <>
                          {/* Delivery Person Info - Now handled by DeliveryMap component */}

                          {/* Enhanced Tracking Timeline */}
                          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h4 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </div>
                              Delivery Progress
                            </h4>
                            <div className="space-y-6">
                              {generateTrackingSteps(selectedTrackingOrder, deliveryStatuses).map((step, index) => (
                                <div key={step.status} className="relative">
                                  {/* Connection line */}
                                  {index < generateTrackingSteps(selectedTrackingOrder, deliveryStatuses).length - 1 && (
                                    <div className={`absolute left-4 top-8 w-0.5 h-8 ${
                                      step.completed ? 'bg-green-200' : 'bg-gray-200'
                                    }`}></div>
                                  )}
                                  
                                  <div className="flex items-start space-x-4">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                                      step.completed 
                                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' 
                                        : step.current 
                                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white animate-pulse'
                                          : 'bg-gray-200 text-gray-400'
                                    }`}>
                                      {step.completed ? (
                                        <CheckCircleIcon className="h-5 w-5" />
                                      ) : (
                                        <step.icon className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`p-4 rounded-xl ${
                                        step.completed 
                                          ? 'bg-green-50 border border-green-200' 
                                          : step.current 
                                            ? 'bg-blue-50 border border-blue-200'
                                            : 'bg-gray-50 border border-gray-200'
                                      }`}>
                                        <p className={`text-sm font-semibold ${
                                          step.completed 
                                            ? 'text-green-900' 
                                            : step.current 
                                              ? 'text-blue-900'
                                              : 'text-gray-500'
                                        }`}>
                                          {step.title}
                                        </p>
                                        <p className={`text-sm mt-1 ${
                                          step.completed 
                                            ? 'text-green-700' 
                                            : step.current 
                                              ? 'text-blue-700'
                                              : 'text-gray-500'
                                        }`}>
                                          {step.description}
                                        </p>
                                        {step.timestamp && (
                                          <p className={`text-xs mt-2 ${
                                            step.completed 
                                              ? 'text-green-600' 
                                              : step.current 
                                                ? 'text-blue-600'
                                                : 'text-gray-400'
                                          }`}>
                                            {formatTimestamp(step.timestamp)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Enhanced Delivery Map Section */}
                          <div className="mb-6">
                            <DeliveryMap
                              storeLocation={selectedTrackingOrder.product?.seller?.store_settings?.address ? {
                                latitude: selectedTrackingOrder.product.seller.store_settings.address.coordinates?.lat || 
                                         selectedTrackingOrder.product.seller.store_settings.address.latitude || 
                                         selectedTrackingOrder.product.seller.store_settings.address.lat || 0,
                                longitude: selectedTrackingOrder.product.seller.store_settings.address.coordinates?.lng || 
                                          selectedTrackingOrder.product.seller.store_settings.address.longitude || 
                                          selectedTrackingOrder.product.seller.store_settings.address.lng || 0,
                                address: selectedTrackingOrder.product.seller.store_settings.address
                              } : undefined}
                              deliveryLocation={selectedTrackingOrder.delivery_address ? {
                                latitude: typeof selectedTrackingOrder.delivery_address === 'string' 
                                  ? (() => {
                                      try {
                                        const parsed = JSON.parse(selectedTrackingOrder.delivery_address);
                                        return parsed.latitude || parsed.lat || 0;
                                      } catch {
                                        return 0;
                                      }
                                    })()
                                  : selectedTrackingOrder.delivery_address?.latitude || 
                                    selectedTrackingOrder.delivery_address?.lat || 0,
                                longitude: typeof selectedTrackingOrder.delivery_address === 'string' 
                                  ? (() => {
                                      try {
                                        const parsed = JSON.parse(selectedTrackingOrder.delivery_address);
                                        return parsed.longitude || parsed.lng || 0;
                                      } catch {
                                        return 0;
                                      }
                                    })()
                                  : selectedTrackingOrder.delivery_address?.longitude || 
                                    selectedTrackingOrder.delivery_address?.lng || 0,
                                address: typeof selectedTrackingOrder.delivery_address === 'string' 
                                  ? (() => {
                                      try {
                                        return JSON.parse(selectedTrackingOrder.delivery_address);
                                      } catch {
                                        return { address: selectedTrackingOrder.delivery_address };
                                      }
                                    })()
                                  : selectedTrackingOrder.delivery_address
                              } : undefined}
                              currentLocation={deliveryStatuses.length > 0 ? {
                                latitude: deliveryStatuses[deliveryStatuses.length - 1].latitude || 0,
                                longitude: deliveryStatuses[deliveryStatuses.length - 1].longitude || 0
                              } : undefined}
                              deliveryStatus={selectedTrackingOrder.order_status}
                              deliveryPerson={getDeliveryPersonInfo() || undefined}
                              estimatedDeliveryTime="30-60 minutes"
                              className="w-full"
                            />
                          </div>

                          {/* Enhanced Delivery Proof Image */}
                          {(deliveryStatuses.length > 0 && deliveryStatuses[deliveryStatuses.length - 1].proof_image) || 
                           (selectedTrackingOrder.order_status === 'delivered' && selectedTrackingOrder.delivery_proof_image) ? (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 shadow-sm border border-green-200">
                              <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mr-3">
                                  <CheckCircleIcon className="h-5 w-5 text-white" />
                                </div>
                                Delivery Proof
                              </h4>
                              
                              <div className="relative bg-white rounded-xl overflow-hidden shadow-lg border border-green-200">
                                <img
                                  src={cleanImageUrl(
                                    deliveryStatuses.length > 0 && deliveryStatuses[deliveryStatuses.length - 1].proof_image
                                      ? deliveryStatuses[deliveryStatuses.length - 1].proof_image
                                      : selectedTrackingOrder.delivery_proof_image
                                  )}
                                  alt="Delivery proof"
                                  className="w-full h-64 object-cover"
                                  onError={(e) => {
                                    const imageUrl = deliveryStatuses.length > 0 && deliveryStatuses[deliveryStatuses.length - 1].proof_image
                                      ? deliveryStatuses[deliveryStatuses.length - 1].proof_image
                                      : selectedTrackingOrder.delivery_proof_image;
                                    console.error('Failed to load delivery proof image (img tag):', imageUrl);
                                    console.error('Cleaned URL:', cleanImageUrl(imageUrl));
                                    console.error('Error event:', e);
                                    // Show error message
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const container = target.parentElement;
                                    if (container) {
                                      container.innerHTML = `
                                        <div class="flex items-center justify-center h-64 bg-gray-100">
                                          <div class="text-center">
                                            <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p class="mt-3 text-sm text-gray-500">Failed to load image</p>
                                            <p class="text-xs text-gray-400 mt-1">${imageUrl}</p>
                                          </div>
                                        </div>
                                      `;
                                    }
                                  }}
                                  onLoad={() => {
                                    console.log('Delivery proof image loaded successfully (img tag)');
                                  }}
                                />
                                
                                {/* Overlay with timestamp */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                                  <p className="text-white text-sm font-medium">
                                    Proof captured on {formatTimestamp(
                                      deliveryStatuses.length > 0 && deliveryStatuses[deliveryStatuses.length - 1].proof_image
                                        ? deliveryStatuses[deliveryStatuses.length - 1].created_at
                                        : selectedTrackingOrder.updated_at || selectedTrackingOrder.created_at
                                    )}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="mt-4 flex items-center justify-center">
                                <div className="flex items-center space-x-2 text-green-700">
                                  <CheckCircleIcon className="h-5 w-5" />
                                  <span className="text-sm font-medium">Delivery confirmed with photo proof</span>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {/* Enhanced Latest Status Notes */}
                          {deliveryStatuses.length > 0 && deliveryStatuses[deliveryStatuses.length - 1].notes && (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-sm border border-blue-200">
                              <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </div>
                                Latest Update
                              </h4>
                              <div className="bg-white rounded-xl p-4 border border-blue-100">
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {deliveryStatuses[deliveryStatuses.length - 1].notes}
                                </p>
                                <div className="mt-3 flex items-center space-x-2 text-blue-600">
                                  <ClockIcon className="h-4 w-4" />
                                  <span className="text-xs font-medium">
                                    {formatTimestamp(deliveryStatuses[deliveryStatuses.length - 1].created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Enhanced Delivery Completion Message */}
                          {selectedTrackingOrder.order_status === 'delivered' && (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 shadow-sm border border-green-200">
                              <div className="text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                                  <CheckCircleIcon className="h-8 w-8 text-white" />
                                </div>
                                <h4 className="text-xl font-bold text-green-900 mb-2">
                                  🎉 Delivery Completed Successfully!
                                </h4>
                                <p className="text-sm text-green-700 mb-4">
                                  Your order has been delivered and signed for. Thank you for choosing our service!
                                </p>
                                <div className="bg-white rounded-xl p-4 border border-green-200">
                                  <div className="flex items-center justify-center space-x-4 text-sm text-green-700">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span>Package received</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span>Proof captured</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span>Order complete</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
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