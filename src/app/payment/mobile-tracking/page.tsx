'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { clientLog } from '@/utils/clientLog';

export default function MobilePaymentTracking() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  const supabase = createClientComponent();
  const tx_ref = searchParams.get('tx_ref');

  useEffect(() => {
    if (!tx_ref) {
      toast.error('Invalid payment reference');
      router.push('/cart');
      return;
    }

    const pendingPayment = localStorage.getItem('pendingPayment');
    if (!pendingPayment) {
      toast.error('Payment information not found');
      router.push('/cart');
      return;
    }

    const paymentData = JSON.parse(pendingPayment);
    console.log('[MOBILE TRACKING] Payment data from localStorage:', paymentData);
    clientLog('[MOBILE TRACKING] Payment data from localStorage', paymentData);

    const checkPaymentStatus = async () => {
      try {
        const transactionRef = tx_ref || paymentData.tx_ref;
        console.log('[MOBILE TRACKING] Using transaction reference:', transactionRef);
        clientLog('[MOBILE TRACKING] Using transaction reference', { transactionRef });

        if (!transactionRef) {
          throw new Error('No transaction reference found');
        }

        // First verify with Chapa directly
        const verifyResponse = await fetch(`/api/payments/chapa/verify?tx_ref=${transactionRef}`);
        const verifyData = await verifyResponse.json();

        console.log('[MOBILE TRACKING] Chapa verification response:', verifyData);
        clientLog('[MOBILE TRACKING] Chapa verification response', verifyData);

        // Check if payment is successful
        if (verifyData.status === 'success' && verifyData.data?.status === 'success') {
          // Get order details first
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
              *,
              customer:users!orders_user_id_fkey (
                id,
                full_name,
                email,
                store_settings
              ),
              product:products (
                id,
                owner:users (
                  id,
                  store_settings
                )
              )
            `)
            .eq('tx_ref', transactionRef)
            .single();

          if (ordersError || !orders) {
            console.error('[MOBILE TRACKING] Order fetch error:', ordersError);
            clientLog('[MOBILE TRACKING] Order fetch error', ordersError, 'error');
            return false;
          }

          // Get customer details
          const fullName = orders.customer?.full_name || 'Unknown Customer';
          let customerPhone = null;
          
          if (orders.product?.owner?.store_settings) {
            const ownerSettings = orders.product.owner.store_settings;
            if (typeof ownerSettings === 'string') {
              const settings = JSON.parse(ownerSettings);
              customerPhone = settings.alternativePhone;
            } else {
              customerPhone = ownerSettings.alternativePhone;
            }
          }

          // Calculate fees
          const platformFee = orders.platform_fee || 0;
          const serviceFee = orders.service_fee || 0;
          const vatAmount = orders.ethiopia_tax || 0;
          const deliveryFee = orders.delivery_fee || 0;
          const sellerAmount = orders.total_price - (platformFee + serviceFee + vatAmount + deliveryFee);

          // Create transaction record
          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              order_id: orders.id,
              payment_method: 'CHAPA',
              payment_status: 'paid',
              subtotal: orders.total_price,
              vat_amount: vatAmount,
              platform_fee: platformFee,
              service_fee: serviceFee,
              delivery_fee: deliveryFee,
              total_amount: orders.total_price,
              seller_id: orders.product?.owner?.id,
              seller_payout_amount: sellerAmount,
              platform_revenue: platformFee + serviceFee,
              seller_payout_status: 'pending',
              platform_payout_status: 'completed',
              customer_name: fullName,
              customer_email: orders.customer?.email,
              customer_phone: customerPhone
            });

          if (transactionError) {
            console.error('[MOBILE TRACKING] Transaction creation error:', transactionError);
            clientLog('[MOBILE TRACKING] Transaction creation error', transactionError, 'error');
            return false;
          }

          // Update order status
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              order_status: 'confirmed',
              payment_reference: verifyData.data?.reference,
              receipt_url: verifyData.data?.receipt_url || 
                          verifyData.data?.receipt ||
                          (verifyData.data?.reference ? 
                            `https://checkout.chapa.co/checkout/payment-receipt/${verifyData.data.reference}` : 
                            null),
              updated_at: new Date().toISOString()
            })
            .eq('tx_ref', transactionRef);

          if (updateError) {
            console.error('[MOBILE TRACKING] Order update error:', updateError);
            clientLog('[MOBILE TRACKING] Order update error', updateError, 'error');
            return false;
          }

          console.log('[MOBILE TRACKING] Payment processed successfully');
          clientLog('[MOBILE TRACKING] Payment processed successfully');
          localStorage.removeItem('pendingPayment');
          toast.success('Payment successful! Redirecting to your orders in 30 seconds...');
          setTimeout(() => {
            router.push('/orders');
          }, 30000); // 30 seconds delay
          return true;
        } else if (verifyData.status === 'pending') {
          // Payment is still processing
          console.log('[MOBILE TRACKING] Payment is still pending');
          clientLog('[MOBILE TRACKING] Payment is still pending');
          return false;
        } else {
          // Payment failed or other status
          console.error('[MOBILE TRACKING] Payment verification failed:', verifyData);
          clientLog('[MOBILE TRACKING] Payment verification failed', verifyData, 'error');
          return false;
        }
      } catch (error) {
        console.error('[MOBILE TRACKING] Error:', error);
        clientLog('[MOBILE TRACKING] Error', error, 'error');
        return false;
      }
    };

    // Start polling
    const pollInterval = setInterval(async () => {
      const isComplete = await checkPaymentStatus();
      if (isComplete) {
        clearInterval(pollInterval);
      }
    }, 3000);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
    };
  }, [tx_ref, router]);

  // Update the handleRetryPayment function
  const handleRetryPayment = () => {
    try {
      const pendingPayment = localStorage.getItem('pendingPayment');
      if (!pendingPayment) {
        toast.error('Payment information not found');
        return;
      }

      const paymentData = JSON.parse(pendingPayment);
      if (!paymentData.checkout_url) {
        toast.error('Payment URL not found');
        return;
      }

      // Try window.open first
      const newWindow = window.open(paymentData.checkout_url, '_blank');
      
      if (!newWindow) {
        // If blocked, try click event
        const link = document.createElement('a');
        link.href = paymentData.checkout_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success('Opening payment window...');
    } catch (error) {
      console.error('Error retrying payment:', error);
      toast.error('Failed to open payment window');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
          Processing Your Payment
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please complete your payment in the new tab. This page will automatically
          redirect you once the payment is confirmed.
        </p>
        <div className="mt-6 space-y-4">
          <button
            onClick={handleRetryPayment}
            className="w-full px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Open Payment Window Again
          </button>
          <button
            onClick={() => router.push('/cart')}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors"
          >
            Return to Cart
          </button>
        </div>
      </div>
    </div>
  );
} 