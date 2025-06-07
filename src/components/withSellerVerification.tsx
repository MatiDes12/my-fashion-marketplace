'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

interface UserData {
  role: string;
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'rejected' | 'needs_reconsideration';
}

export function withSellerVerification<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function VerificationWrapper(props: P) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClientComponent();

    useEffect(() => {
      const checkVerification = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            router.push('/login');
            return;
          }

          // Check user role and verification status
          const { data: userData, error } = await supabase
            .from('users')
            .select('role, is_verified, verification_status')
            .eq('id', session.user.id)
            .single() as { data: UserData | null; error: any };

          if (error || !userData) {
            router.push('/login');
            return;
          }

          if (userData.role !== 'owner') {
            router.push('/');
            return;
          }

          if (!userData.is_verified || userData.verification_status === 'needs_reconsideration') {
            // Check if verification is pending
            const { data: verificationData } = await supabase
              .from('seller_verification')
              .select('status')
              .eq('user_id', session.user.id)
              .single();

            if (!verificationData) {
              router.push('/dashboard/verify');
              return;
            }

            if (verificationData.status === 'pending') {
              router.push('/dashboard/verification-pending');
              return;
            }

            if (verificationData.status === 'needs_reconsideration') {
              router.push('/dashboard/verification-reconsideration');
              return;
            }
          }

          setLoading(false);
        } catch (error) {
          console.error('Verification check error:', error);
          router.push('/login');
        }
      };

      checkVerification();
    }, [router]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
} 