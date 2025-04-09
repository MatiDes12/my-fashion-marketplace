'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailPage() {
  const [message, setMessage] = useState('Please check your email for the verification link.');
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.email_confirmed_at) {
        // Email is already verified
        router.push('/dashboard');
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white/70 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Verify Your Email</h1>
        <p className="text-gray-600 mb-4">{message}</p>
        
        <div className="animate-pulse flex justify-center">
          <div className="w-8 h-8 border-t-2 border-red-500 rounded-full animate-spin"></div>
        </div>
        
        <p className="mt-4 text-sm text-gray-500">
          Didn't receive an email? Check your spam folder or{' '}
          <button 
            onClick={async () => {
              try {
                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: (await supabase.auth.getUser()).data.user?.email || '',
                });
                
                if (error) throw error;
                setMessage('Verification email resent! Please check your inbox.');
              } catch (error) {
                console.error('Error resending verification:', error);
                setMessage('Failed to resend verification email. Please try again.');
              }
            }}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            click here to resend
          </button>
        </p>
      </div>
    </div>
  );
} 