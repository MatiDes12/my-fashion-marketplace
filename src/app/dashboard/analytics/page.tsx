'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    const redirect = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
        router.push('/login?message=Please login to access analytics');
          return;
        }
        
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_plan')
        .eq('id', session.user.id)
        .single();

      const plan = userData?.subscription_plan || 'basic';
      router.push(`/dashboard/analytics/${plan === 'basic' ? 'basic' : 'advanced'}`);
    };

    redirect();
  }, []);

  return <LoadingSpinner />;
} 