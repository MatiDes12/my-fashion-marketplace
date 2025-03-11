'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingPage from '@/components/LoadingPage';

function PaymentCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams?.get('status') || null;
  const orderId = searchParams?.get('orderId') || null;

  useEffect(() => {
    // After 5 seconds, redirect to orders page
    const timer = setTimeout(() => {
      router.push('/orders');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {status === 'success' ? (
          <>
            <h2 className="text-3xl font-extrabold text-green-600">
              Payment Successful!
            </h2>
            <p className="mt-2 text-gray-600">
              Your order {orderId ? `#${orderId}` : ''} has been confirmed.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-extrabold text-red-600">
              Payment Failed
            </h2>
            <p className="mt-2 text-gray-600">
              There was a problem processing your payment.
            </p>
          </>
        )}
        <p className="text-sm text-gray-500 mt-4">
          Redirecting to your orders in 5 seconds...
        </p>
      </div>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <PaymentCompleteContent />
    </Suspense>
  );
} 