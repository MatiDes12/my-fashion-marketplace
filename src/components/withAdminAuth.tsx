'use client';

import { useEffect, useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export function withAdminAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function AdminAuthWrapper(props: P) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClientComponent();

    useEffect(() => {
      const checkAdminAccess = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            router.push('/login?message=Please login to access admin panel');
            return;
          }

          const { data: userData, error } = await supabase
            .from('users')
            .select('role, is_admin')
            .eq('id', session.user.id)
            .single();

          if (error || !userData?.is_admin) {
            router.push('/?message=Access denied');
            return;
          }

          setLoading(false);
        } catch (error) {
          console.error('Error checking admin access:', error);
          router.push('/login');
        }
      };

      checkAdminAccess();
    }, [router]);

    if (loading) {
      return <LoadingSpinner />;
    }

    return <WrappedComponent {...props} />;
  };
} 