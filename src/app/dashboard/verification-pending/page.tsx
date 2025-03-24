'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function VerificationPendingPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }

        // Check if already verified
        const { data: userData } = await supabase
          .from('users')
          .select('is_verified')
          .eq('id', session.user.id)
          .single();

        if (userData?.is_verified) {
          router.push('/dashboard');
          return;
        }

        // Check if verification exists and is pending
        const { data: verificationData } = await supabase
          .from('seller_verification')
          .select('status')
          .eq('user_id', session.user.id)
          .single();

        if (!verificationData || verificationData.status !== 'pending') {
          router.push('/dashboard/verify');
          return;
        }

      } catch (error) {
        console.error('Error checking verification status:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [router]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Verification Pending
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your verification request is being reviewed by our team. This usually takes 1-2 business days.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You'll receive an email once your verification is complete.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 