'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { formatCurrency } from '@/utils/currency';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }
        
        // Check role
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (error || data?.role !== 'owner') {
          router.push('/');
          return;
        }
      } catch (error) {
        setError('Failed to verify access permissions');
      } finally {
        setLoading(false);
      }
    };
    
    checkAccess();
  }, [router]);

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Analytics Coming Soon</h3>
              <p className="mt-1 text-sm text-gray-500">
                Our advanced analytics dashboard is currently under development.
              </p>
              <p className="mt-3 text-sm text-gray-500">
                Check back soon for insights on your sales, customer behavior, and product performance.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 