'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import LoadingPage from '@/components/LoadingPage';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponent();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        if (!searchParams) {
          throw new Error('No search parameters found');
        }

        const code = searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          const { data: { user } } = await supabase.auth.getUser();
          
          // Check if the user exists and get their role
          if (user) {
            const { data: userData } = await supabase
              .from('users')
              .select('role')
              .eq('id', user.id)
              .single();

            // Redirect based on user role
            if (userData?.role === 'owner') {
              router.push('/dashboard');
            } else {
              router.push('/products');
            }
          } else {
            throw new Error('User not found');
          }
        } else {
          throw new Error('No verification code found');
        }
      } catch (error) {
        console.error('Error during email confirmation:', error);
        router.push('/login?error=Verification failed');
      }
    };

    handleEmailConfirmation();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner />
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Verifying your email...</h2>
        <p className="mt-2 text-gray-600">Please wait while we confirm your email address.</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <CallbackContent />
    </Suspense>
  );
} 