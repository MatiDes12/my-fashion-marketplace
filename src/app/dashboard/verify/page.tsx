'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import SellerVerificationForm from '@/components/SellerVerificationForm';

export default function VerifyPage() {
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

        // Check if verification is pending
        const { data: verificationData } = await supabase
          .from('seller_verification')
          .select('status')
          .eq('user_id', session.user.id)
          .single();

        if (verificationData?.status === 'pending') {
          router.push('/dashboard/verification-pending');
          return;
        }

      } catch (error) {
        console.error('Error checking verification status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [router]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Seller Verification Required</h1>
          <p className="mt-2 text-gray-600">
            Please complete the verification process to access your dashboard
          </p>
        </div>
        <SellerVerificationForm />
      </div>
    </div>
  );
} 