'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        const code = searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user?.user_metadata?.role === 'owner') {
            router.push('/dashboard');
          } else {
            router.push('/products');
          }
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