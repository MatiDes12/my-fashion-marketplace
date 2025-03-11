'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-hot-toast';

export default function MockTelebirrPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const amount = searchParams.get('amount');
  const orderId = searchParams.get('orderId');
  const title = searchParams.get('title');

  const handlePayment = async (status: 'success' | 'failed') => {
    try {
      setIsProcessing(true);

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please login to complete checkout');
      }

      if (status === 'success') {
        // Get cart items first
        const { data: cartItems, error: cartError } = await supabase
          .from('cart_items')
          .select(`
            *,
            product:products(*)
          `)
          .eq('user_id', session.user.id);

        if (cartError) throw cartError;
        if (!cartItems?.length) throw new Error('Cart is empty');

        // Create orders for each cart item
        const orders = cartItems.map(item => ({
          user_id: session.user.id,
          product_id: item.product_id,
          quantity: item.quantity,
          total_price: item.quantity * item.product.price,
          order_status: 'pending',
          platform_fee: (item.quantity * item.product.price) * 0.05, // 5%
          service_fee: (item.quantity * item.product.price) * 0.02,  // 2%
          ethiopia_tax: (item.quantity * item.product.price) * 0.15, // 15%
          delivery_fee: item.delivery_fee || 0
        }));

        // Insert orders
        const { error: orderError } = await supabase
          .from('orders')
          .insert(orders);

        if (orderError) throw orderError;

        // Clear cart after successful order creation
        const { error: clearCartError } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', session.user.id);

        if (clearCartError) {
          console.error('Failed to clear cart:', clearCartError);
          // Don't throw here, as the order was created successfully
        }
      }

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to completion page with status
      router.push(`/payment/complete?status=${status}&orderId=${orderId}`);
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Mock Telebirr Payment
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Development testing only
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="font-medium">Order: {title}</p>
              <p className="text-2xl font-bold mt-2">ETB {amount}</p>
              <p className="text-sm text-gray-500 mt-1">Order ID: {orderId}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handlePayment('success')}
              disabled={isProcessing}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              Simulate Success
            </button>
            <button
              onClick={() => handlePayment('failed')}
              disabled={isProcessing}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              Simulate Failure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 