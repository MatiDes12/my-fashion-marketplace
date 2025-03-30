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
          return; // Exit silently if no search params
        }

        const code = searchParams.get('code');
        // If no code is present, check if user is already authenticated
        if (!code) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            // User is already authenticated, redirect based on role
            const { data: userData } = await supabase
              .from('users')
              .select('role')
              .eq('id', session.user.id)
              .single();

            if (userData?.role === 'owner') {
              router.push('/dashboard');
            } else {
              router.push('/products');
            }
          } else {
            router.push('/login');
          }
          return;
        }

        // Process verification code
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

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

      } catch (error) {
        console.error('Error during email confirmation:', error);
        // Only redirect to login with error if there was a code but verification failed
        if (searchParams.get('code')) {
          router.push('/login?error=Verification failed');
        }
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