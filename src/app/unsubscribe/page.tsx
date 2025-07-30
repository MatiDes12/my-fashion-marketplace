'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import Image from 'next/image';

export default function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const supabase = createClientComponent();

  useEffect(() => {
    const unsubscribe = async () => {
      try {
        const email = searchParams.get('email');
        const type = searchParams.get('type');

        console.log('Attempting to unsubscribe:', { email, type });

        if (!email || !type) {
          setStatus('error');
          setMessage('Invalid unsubscribe link. Please check your email and try again.');
          return;
        }

        // First, check if the subscription exists
        const { data: existingSubscription, error: checkError } = await supabase
          .from('email_subscribers')
          .select('*')
          .eq('email', email)
          .eq('subscription_type', type)
          .single();

        console.log('Existing subscription:', existingSubscription);
        console.log('Check error:', checkError);

        if (checkError) {
          if (checkError.code === 'PGRST116') {
            setStatus('error');
            setMessage('No subscription found for this email.');
            return;
          }
          throw checkError;
        }

        if (!existingSubscription) {
          setStatus('error');
          setMessage('No subscription found for this email.');
          return;
        }

        if (!existingSubscription.is_active) {
          setStatus('success');
          setMessage('This email was already unsubscribed.');
          return;
        }

        // Simple update without additional conditions
        const { error: updateError } = await supabase
          .from('email_subscribers')
          .update({ is_active: false })
          .eq('id', existingSubscription.id);

        console.log('Update error:', updateError);

        if (updateError) {
          throw updateError;
        }

        // Final verification
        const { data: verifyUpdate, error: verifyError } = await supabase
          .from('email_subscribers')
          .select('is_active')
          .eq('id', existingSubscription.id)
          .single();

        console.log('Verify update:', verifyUpdate);
        console.log('Verify error:', verifyError);

        if (verifyError) {
          throw verifyError;
        }

        if (verifyUpdate.is_active) {
          throw new Error('Failed to update subscription status');
        }

        setStatus('success');
        setMessage(
          type === 'notify_me'
            ? 'You have been successfully unsubscribed from launch notifications.'
            : 'You have been successfully unsubscribed from our newsletter.'
        );

      } catch (error) {
        console.error('Detailed error:', error);
        setStatus('error');
        setMessage(
          error instanceof Error 
            ? error.message 
            : 'Something went wrong. Please try again later or contact support.'
        );
      }
    };

    unsubscribe();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/images/brand/logo.png"
            alt="Avrio Shop"
            width={80}
            height={80}
            className="mx-auto"
          />
        </div>

        {status === 'loading' ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="space-y-4">
              {status === 'success' ? (
                <>
                  <div className="w-24 h-24 mx-auto">
                    <svg
                      className="w-full h-full text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Successfully Unsubscribed
                  </h2>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 mx-auto">
                    <svg
                      className="w-full h-full text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Oops! Something went wrong
                  </h2>
                </>
              )}
              <p className="text-lg text-gray-600">{message}</p>
              <div className="mt-8">
                <Link
                  href="/"
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  ← Return to Homepage
                </Link>
              </div>
              {status === 'success' && (
                <p className="mt-4 text-sm text-gray-500">
                  Changed your mind?{' '}
                  <Link
                    href="/#newsletter"
                    className="text-red-600 hover:text-red-700"
                  >
                    Subscribe again
                  </Link>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 