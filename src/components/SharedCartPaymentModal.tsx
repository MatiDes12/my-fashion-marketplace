'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { XMarkIcon, CreditCardIcon, BanknotesIcon } from '@heroicons/react/24/outline';

interface SharedCartPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (data: any) => void;
  totalAmount: number;
  shareCode: string;
  purchaserEmail: string;
  purchaserName: string;
  deliveryMethod: string;
  deliveryAddress: any;
  subtotal?: number;
  giftWrappingFee?: number;
}

export default function SharedCartPaymentModal({
  isOpen,
  onClose,
  onPaymentComplete,
  totalAmount,
  shareCode,
  purchaserEmail,
  purchaserName,
  deliveryMethod,
  deliveryAddress,
  subtotal,
  giftWrappingFee
}: SharedCartPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'CHAPA' | 'STRIPE' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

                const paymentMethods = [
                {
                  id: 'CHAPA',
                  name: 'Chapa Payment',
                  description: 'Pay with Chapa (ETB)',
                  icon: CreditCardIcon,
                  color: 'bg-blue-500',
                  enabled: true
                },
                {
                  id: 'STRIPE',
                  name: 'Stripe Payment',
                  description: 'Pay with Stripe (USD)',
                  icon: CreditCardIcon,
                  color: 'bg-purple-500',
                  enabled: true
                }
              ];

  const handlePayment = async (methodId: string) => {
    if (!purchaserEmail || !purchaserName) {
      toast.error('Please fill in your details');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    setIsProcessing(true);

    try {
      if (methodId === 'STRIPE') {
        await handleStripePayment();
      } else if (methodId === 'CHAPA') {
        await handleChapaPayment();
      } else {
        throw new Error('Invalid payment method');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStripePayment = async () => {
    try {
      // Import Stripe utilities
      const { convertETBToUSD } = await import('@/lib/stripe');
      
      const totalAmountUSD = convertETBToUSD(totalAmount);
      const txRef = `stripe-shared-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Create temporary shared cart order
      const tempOrderResponse = await fetch('/api/orders/shared-cart/temporary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareCode,
          purchaserEmail,
          purchaserName,
          paymentMethod: 'STRIPE',
          deliveryMethod,
          deliveryAddress,
          txRef
        }),
      });

      if (!tempOrderResponse.ok) {
        const errorData = await tempOrderResponse.json();
        throw new Error(errorData.error || 'Failed to create temporary order');
      }

      // Initialize Stripe payment
      const response = await fetch('/api/payments/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_usd: totalAmountUSD,
          amount_etb: totalAmount,
          email: purchaserEmail,
          full_name: purchaserName,
          tx_ref: txRef,
          success_url: `${window.location.origin}/api/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/cart/shared/${shareCode}?cancelled=true`,
          metadata: {
            tx_ref: txRef,
            share_code: shareCode,
            purchaser_email: purchaserEmail,
            purchaser_name: purchaserName,
            is_shared_cart: 'true'
          }
        }),
      });

      const data = await response.json();
      
      if (data.success && data.sessionId) {
        // Load Stripe.js and redirect to checkout
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
        
        if (stripe) {
          // Close modal before redirecting
          onClose();
          
          // Redirect to Stripe Checkout
          const { error } = await stripe.redirectToCheckout({
            sessionId: data.sessionId
          });
          
          if (error) {
            throw new Error(error.message);
          }
        } else {
          throw new Error('Failed to load Stripe');
        }
      } else {
        throw new Error(data.message || 'Payment initialization failed');
      }

    } catch (error) {
      console.error('Stripe payment error:', error);
      throw error;
    }
  };

  const handleChapaPayment = async () => {
    try {
      const txRef = `tx-shared-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Create temporary shared cart order
      const tempOrderResponse = await fetch('/api/orders/shared-cart/temporary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareCode,
          purchaserEmail,
          purchaserName,
          paymentMethod: 'CHAPA',
          deliveryMethod,
          deliveryAddress,
          txRef
        }),
      });

      if (!tempOrderResponse.ok) {
        const errorData = await tempOrderResponse.json();
        throw new Error(errorData.error || 'Failed to create temporary order');
      }

      // Initialize Chapa payment
      const response = await fetch('/api/payments/chapa/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount.toString(),
          email: purchaserEmail,
          full_name: purchaserName,
          tx_ref: txRef,
          callback_url: `${window.location.origin}/api/payments/chapa/callback`,
          return_url: `${window.location.origin}/api/payments/chapa/callback?trx_ref=${txRef}&status=success`,
          customization: {
            title: 'Shared Cart',
            description: `Payment for shared cart items`
          }
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.data.checkout_url) {
        // Close modal
        onClose();

        // Redirect to Chapa checkout
        window.location.href = data.data.checkout_url;
      } else {
        throw new Error(data.message || 'Payment initialization failed');
      }

    } catch (error) {
      console.error('Chapa payment error:', error);
      throw error;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Select Payment Method</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Price Breakdown</h4>
            <div className="space-y-2 text-sm">
              {subtotal !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">ETB {subtotal.toFixed(2)}</span>
                </div>
              )}
              {giftWrappingFee !== undefined && giftWrappingFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Gift Wrapping:</span>
                  <span className="text-gray-900">ETB {giftWrappingFee.toFixed(2)}</span>
                </div>
              )}
              {deliveryMethod === 'delivery' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery Fee:</span>
                  <span className="text-gray-900">ETB 300.00</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-lg font-semibold text-gray-900">ETB {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id as any)}
              disabled={!method.enabled || isProcessing}
              className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                selectedMethod === method.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${!method.enabled || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${method.color}`}>
                  <method.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{method.name}</h4>
                  <p className="text-sm text-gray-600">{method.description}</p>
                </div>
                {selectedMethod === method.id && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={() => selectedMethod && handlePayment(selectedMethod)}
            disabled={!selectedMethod || isProcessing}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </div>
            ) : (
              'Complete Payment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
