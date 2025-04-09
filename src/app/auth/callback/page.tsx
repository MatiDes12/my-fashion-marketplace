'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import LoadingPage from '@/components/LoadingPage';
import { EMAIL_CONFIG } from '@/config/email';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponent();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        if (!searchParams) {
          router.push('/login');
          return;
        }

        const code = searchParams.get('code');

        // If no code is present, redirect to login
        if (!code) {
          router.push('/login');
          return;
        }

        // Exchange the code for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('Error exchanging code:', error);
          router.push('/login?error=Failed to verify email');
          return;
        }

        if (!data.session) {
          router.push('/login?error=No session found');
          return;
        }

        // Sign out the user after verification
        await supabase.auth.signOut();

        // Redirect to login with success message and the correct email for support
        router.push(`/login?message=Email verified successfully! Please sign in. If you need help, contact ${EMAIL_CONFIG.SUPPORT}`);

      } catch (error) {
        console.error('Error during email confirmation:', error);
        router.push('/login?error=Verification failed');
      }
    };

    handleEmailConfirmation();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50">
      <div className="bg-white/70 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
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