'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function VerificationRejectedPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponent();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: verificationData } = await supabase
        .from('seller_verification')
        .select('rejection_reason, status')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!verificationData || verificationData.status !== 'rejected') {
        router.push('/dashboard');
        return;
      }

      setRejectionReason(verificationData.rejection_reason);
      setLoading(false);
    } catch (error) {
      console.error('Error checking verification:', error);
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Verification Rejected
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            We regret to inform you that your seller verification was not approved.
          </p>
          {rejectionReason && (
            <div className="mt-4 text-sm text-gray-500">
              <div className="mb-4 p-4 bg-red-50 rounded-md">
                <h3 className="font-medium text-red-800">Rejection Reason:</h3>
                <p className="mt-1 text-red-700">{rejectionReason}</p>
              </div>
              <p>Common reasons for rejection include:</p>
            </div>
          )}
          <div className="mt-4 text-sm text-gray-500">
            <ul className="mt-2 list-disc list-inside">
              <li>Incomplete or incorrect documentation</li>
              <li>Unclear or unreadable documents</li>
              <li>Mismatched business information</li>
              <li>Expired licenses or certificates</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 space-y-4">
          <Link
            href="/dashboard/verify"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Submit New Verification
          </Link>
          <Link
            href="/support"
            className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
} 