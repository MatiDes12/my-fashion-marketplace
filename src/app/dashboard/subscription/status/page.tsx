'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';

export default function SubscriptionStatusPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const txRef = searchParams.get('tx_ref');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payments/chapa/subscription-status?tx_ref=${txRef}`);
        const data = await response.json();

        if (data.status === 'success') {
          setStatus('success');
          setMessage('Your subscription has been activated successfully!');
        } else if (data.status === 'pending') {
          setStatus('loading');
          setMessage('Processing your payment...');
          // Check again in 5 seconds
          setTimeout(checkStatus, 5000);
        } else {
          setStatus('error');
          setMessage('Payment failed. Please try again.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Failed to verify payment status.');
      }
    };

    if (txRef) {
      checkStatus();
    }
  }, [txRef]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
            <h2 className="mt-4 text-xl font-semibold">Processing Payment</h2>
            <p className="mt-2 text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto h-12 w-12 text-green-500">✓</div>
            <h2 className="mt-4 text-xl font-semibold text-green-600">Payment Successful</h2>
            <p className="mt-2 text-gray-600">{message}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto h-12 w-12 text-red-500">✕</div>
            <h2 className="mt-4 text-xl font-semibold text-red-600">Payment Failed</h2>
            <p className="mt-2 text-gray-600">{message}</p>
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="mt-6 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
} 