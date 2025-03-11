'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

export default function MarketingPage() {
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
        <h1 className="text-2xl font-semibold text-gray-900">Marketing Tools</h1>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Marketing Tools Coming Soon</h3>
              <p className="mt-1 text-sm text-gray-500">
                Our marketing tools are currently under development.
              </p>
              <p className="mt-3 text-sm text-gray-500">
                Soon you'll be able to create promotions, discount codes, and email campaigns to boost your sales.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 