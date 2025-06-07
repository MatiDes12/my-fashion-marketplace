'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function VerificationReconsiderationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();
  const [reconsiderationReason, setReconsiderationReason] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const checkVerificationStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) {
            setError('Please log in to access this page');
            router.push('/login');
          }
          return;
        }

        const { data: verificationData, error: verificationError } = await supabase
          .from('seller_verification')
          .select('status, reconsideration_reason')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!mounted) return;

        if (verificationError) {
          console.error('Verification check error:', verificationError);
          setError('Failed to check verification status');
          setLoading(false);
          return;
        }

        if (!verificationData || verificationData.status !== 'needs_reconsideration') {
          setError('You do not have access to this page');
          router.push('/dashboard');
          return;
        }

        setIsAuthorized(true);
        setReconsiderationReason(verificationData.reconsideration_reason);
        setLoading(false);
      } catch (error) {
        if (mounted) {
          console.error('Error checking verification:', error);
          setError('An error occurred while checking verification status');
          setLoading(false);
        }
      }
    };

    checkVerificationStatus();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Verification Needs Review
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Your seller verification status requires reconsideration. Your store and products have been temporarily hidden from buyers.
          </p>
          {reconsiderationReason && (
            <div className="mt-4 text-sm text-gray-500">
              <div className="mb-4 p-4 bg-yellow-50 rounded-md">
                <h3 className="font-medium text-yellow-800">Reason for Reconsideration:</h3>
                <p className="mt-1 text-yellow-700">{reconsiderationReason}</p>
              </div>
            </div>
          )}
          <div className="mt-8 space-y-4">
            <Link
              href="/dashboard/verify"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Submit New Verification
            </Link>
            <Link
              href="/support"
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Contact Support
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Please submit a new verification with updated information and documentation.
          </p>
        </div>
      </div>
    </div>
  );
} 