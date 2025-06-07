'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';

interface SubscriptionLimits {
  productLimit: number;
  storageLimit: number;
  aiCredits: number;
  analyticsAccess: 'standard' | 'detailed' | 'advanced';
  flashSalesLimit: {
    monthly: number;  // -1 for unlimited
    isEnabled: boolean;
  };
}

const PLAN_LIMITS: { [key: string]: SubscriptionLimits } = {
  basic: {
    productLimit: 20,
    storageLimit: 5,
    aiCredits: 0,
    analyticsAccess: 'standard',
    flashSalesLimit: {
      monthly: 0,
      isEnabled: false
    }
  },
  pro: {
    productLimit: 75,
    storageLimit: 15,
    aiCredits: 100,
    analyticsAccess: 'detailed',
    flashSalesLimit: {
      monthly: 5,
      isEnabled: true
    }
  },
  enterprise: {
    productLimit: Infinity,
    storageLimit: Infinity,
    aiCredits: 500,
    analyticsAccess: 'advanced',
    flashSalesLimit: {
      monthly: -1,
      isEnabled: true
    }
  }
};

export function withSubscriptionLimits(
  WrappedComponent: React.ComponentType,
  requiredFeature: 'products' | 'storage' | 'ai' | 'analytics'
) {
  return function SubscriptionLimitWrapper(props: any) {
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [userPlan, setUserPlan] = useState<string>('basic');
    const router = useRouter();
    const supabase = createClientComponent();

    useEffect(() => {
      const checkLimits = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            router.push('/login');
            return;
          }

          // Get user's plan
          const { data: userData } = await supabase
            .from('users')
            .select('subscription_plan')
            .eq('id', session.user.id)
            .single();

          const currentPlan = userData?.subscription_plan || 'basic';
          setUserPlan(currentPlan);
          const limits = PLAN_LIMITS[currentPlan];

          // Check limits based on feature
          let isAllowed = false;
          let message = '';

          switch (requiredFeature) {
            case 'products':
              const { data: productsCount } = await supabase
                .from('products')
                .select('id', { count: 'exact' })
                .eq('owner_id', session.user.id);
              isAllowed = (productsCount?.length || 0) < limits.productLimit;
              message = 'You have reached your product limit. Please upgrade your plan to add more products.';
              break;
            case 'storage':
              const { data: storageData } = await supabase
                .rpc('calculate_user_storage_usage', { user_id: session.user.id });
              const storageUsed = storageData?.[0]?.total_size_mb || 0;
              isAllowed = storageUsed < (limits.storageLimit * 1024);
              message = 'You have reached your storage limit. Please upgrade your plan to add more images.';
              break;
            case 'ai':
              isAllowed = limits.aiCredits > 0;
              message = 'AI features are not available in your current plan. Please upgrade to access AI features.';
              break;
            case 'analytics':
              // Allow access for all plans, advanced features will be restricted in the component
              isAllowed = true;
              break;
          }

          if (!isAllowed) {
            router.push(`/dashboard/subscription?message=${encodeURIComponent(message)}`);
            return;
          }

          setAllowed(true);
        } catch (error) {
          console.error('Error checking subscription limits:', error);
          router.push('/dashboard/subscription?message=Error checking subscription limits');
        } finally {
          setLoading(false);
        }
      };

      checkLimits();
    }, []);

    if (loading) return <LoadingSpinner />;
    if (!allowed) return null;

    // Pass the user's plan as a prop to the wrapped component
    return <WrappedComponent {...props} userPlan={userPlan} />;
  };
} 