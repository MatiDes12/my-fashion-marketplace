'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login?message=Please login to access analytics');
        return;
      }

      // Get user's subscription plan
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_plan')
        .eq('id', session.user.id)
        .single();

      const plan = userData?.subscription_plan || 'basic';

      // Redirect based on plan
      if (plan === 'basic' && pathname !== '/dashboard/analytics/basic') {
        router.push('/dashboard/analytics/basic');
      } else if (plan !== 'basic' && pathname === '/dashboard/analytics/basic') {
        router.push('/dashboard/analytics/advanced');
      }
    };

    checkAccess();
  }, [pathname]);

  return <>{children}</>;
} 