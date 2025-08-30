'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function SubscriptionStatusPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [message, setMessage] = useState('');
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const sessionId = searchParams.get('session_id');
        const txRef = searchParams.get('tx_ref');
        const cancelled = searchParams.get('cancelled');

        if (cancelled === 'true') {
          setStatus('error');
          setMessage('Payment was cancelled. Your subscription was not processed.');
          return;
        }

        if (!sessionId && !txRef) {
          setStatus('error');
          setMessage('Invalid payment session. Please try again.');
          return;
        }

        // Check if this is a Stripe payment
        if (sessionId) {
          await checkStripePayment(sessionId);
        } else if (txRef) {
          await checkChapaPayment(txRef);
        }

      } catch (error) {
        console.error('Error checking payment status:', error);
        setStatus('error');
        setMessage('Failed to verify payment status. Please contact support.');
      }
    };

    checkPaymentStatus();
  }, [searchParams]);

  const checkStripePayment = async (sessionId: string) => {
    try {
      console.log('Checking Stripe payment for session:', sessionId);
      
      const response = await fetch(`/api/payments/stripe/verify-session?session_id=${sessionId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stripe verification failed:', response.status, errorText);
        throw new Error(`Failed to verify Stripe session: ${response.status}`);
      }

      const data = await response.json();
      console.log('Stripe verification response:', data);
      
      if (data.status === 'completed') {
        setStatus('success');
        setMessage('Payment successful! Your subscription has been activated.');
        setSubscriptionDetails(data.subscription);
      } else if (data.status === 'pending') {
        setStatus('pending');
        setMessage('Payment is being processed. Please wait a moment...');
        
        // Retry after 3 seconds if still pending
        setTimeout(() => {
          if (status === 'pending') {
            checkStripePayment(sessionId);
          }
        }, 3000);
      } else if (data.status === 'failed') {
        setStatus('error');
        setMessage('Payment failed. Please try again.');
      } else {
        setStatus('error');
        setMessage(`Unknown payment status: ${data.status}`);
      }
    } catch (error) {
      console.error('Stripe verification error:', error);
      setStatus('error');
      setMessage('Failed to verify payment. Please contact support.');
    }
  };

  const checkChapaPayment = async (txRef: string) => {
    try {
      // Get subscription order details
      const { data: subscriptionOrder, error } = await supabase
        .from('subscription_orders')
        .select('*')
        .eq('tx_ref', txRef)
        .single();

      if (error || !subscriptionOrder) {
        setStatus('error');
        setMessage('Subscription order not found.');
        return;
      }

      setSubscriptionDetails(subscriptionOrder);

      if (subscriptionOrder.status === 'completed') {
        setStatus('success');
        setMessage('Payment successful! Your subscription has been activated.');
      } else if (subscriptionOrder.status === 'pending') {
        setStatus('pending');
        setMessage('Payment is being processed. Please wait a moment...');
      } else {
        setStatus('error');
        setMessage('Payment failed or was cancelled.');
      }
    } catch (error) {
      console.error('Chapa verification error:', error);
      setStatus('error');
      setMessage('Failed to verify payment. Please contact support.');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-12 w-12 text-green-500" />;
      case 'error':
        return <XCircleIcon className="h-12 w-12 text-red-500" />;
      case 'pending':
        return <ClockIcon className="h-12 w-12 text-yellow-500" />;
      default:
        return <LoadingSpinner />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Verifying payment status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {getStatusIcon()}
          
          <h2 className={`mt-4 text-xl font-semibold ${getStatusColor()}`}>
            {status === 'success' && 'Payment Successful!'}
            {status === 'error' && 'Payment Failed'}
            {status === 'pending' && 'Payment Processing'}
          </h2>
          
          <p className="mt-2 text-gray-600">{message}</p>

          {subscriptionDetails && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Subscription Details</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="font-medium capitalize">{subscriptionDetails.plan_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-medium">ETB {subscriptionDetails.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Period:</span>
                  <span className="font-medium capitalize">{subscriptionDetails.period}ly</span>
                </div>
                {subscriptionDetails.subscription_end_date && (
                  <div className="flex justify-between">
                    <span>End Date:</span>
                    <span className="font-medium">
                      {new Date(subscriptionDetails.subscription_end_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 space-y-3">
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Subscription
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 