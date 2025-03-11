'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { formatCurrency } from '@/utils/currency';

type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  period: 'month' | 'year';
  features: string[];
  productLimit: number;
  aiCredits: number;
  analyticsAccess: boolean;
  highlighted?: boolean;
};

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 499.99,
    period: 'month',
    features: [
      'List up to 20 products',
      'Basic AI product description generation',
      'Standard analytics',
      'Email support'
    ],
    productLimit: 20,
    aiCredits: 50,
    analyticsAccess: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 999.99,
    period: 'month',
    features: [
      'List up to 100 products',
      'Advanced AI product descriptions & SEO',
      'AI-powered pricing suggestions',
      'Detailed analytics dashboard',
      'Priority support'
    ],
    productLimit: 100,
    aiCredits: 200,
    analyticsAccess: true,
    highlighted: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1999.99,
    period: 'month',
    features: [
      'Unlimited products',
      'Full AI suite with custom model training',
      'Advanced analytics with market insights',
      'Dedicated account manager',
      'API access',
      'Custom branding'
    ],
    productLimit: 999999,
    aiCredits: 500,
    analyticsAccess: true
  }
];

export default function SubscriptionPage() {
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month');
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      try {
        setLoading(true);
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }
        
        // Check role first (this should always work)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (userError) {
          console.error('Error fetching user role:', userError);
          throw new Error('Failed to verify user role');
        }
        
        if (userData?.role !== 'owner') {
          router.push('/');
          return;
        }
        
        // Try to get subscription plan, but handle the case where column doesn't exist yet
        try {
          const { data: planData } = await supabase
            .from('users')
            .select('subscription_plan')
            .eq('id', session.user.id)
            .single();
            
          setCurrentPlan(planData?.subscription_plan || 'basic');
        } catch (planError) {
          console.warn('Subscription plan column may not exist yet:', planError);
          // Default to basic plan if column doesn't exist
          setCurrentPlan('basic');
        }
      } catch (error) {
        console.error('Subscription page error:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    checkAccessAndLoadData();
  }, [router]);

  const handleChangePlan = async (planId: string) => {
    try {
      setLoading(true);
      
      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      // Try to update subscription plan, but handle case where column doesn't exist
      try {
        const { error } = await supabase
          .from('users')
          .update({ subscription_plan: planId })
          .eq('id', session.user.id);
        
        if (error) {
          if (error.code === '42703') { // Column doesn't exist error
            console.warn('Subscription plan column does not exist yet. Please run the migration.');
            // We'll still update the UI to show the selected plan
            setCurrentPlan(planId);
            return;
          }
          throw error;
        }
        
        setCurrentPlan(planId);
      } catch (updateError) {
        console.error('Error updating subscription:', updateError);
        throw new Error('Failed to update subscription plan');
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      setError('Failed to update subscription plan');
    } finally {
      setLoading(false);
    }
  };

  const getPriceDisplay = (plan: SubscriptionPlan) => {
    // Calculate yearly price with proper rounding to avoid floating point issues
    const yearlyPrice = Math.round(plan.price * 10 * 100) / 100; // 10 months (2 months free) with 2 decimal precision
    const price = billingPeriod === 'year' ? yearlyPrice : plan.price;
    
    return (
      <>
        <span className="text-4xl font-extrabold text-gray-900">
          {formatCurrency(price)}
        </span>
        <span className="text-base font-medium text-gray-500">/{billingPeriod}</span>
      </>
    );
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Subscription Plans</h1>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <>
            <div className="sm:flex sm:flex-col sm:align-center mb-8">
              <div className="relative self-center bg-gray-100 rounded-lg p-0.5 flex sm:mt-8">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('month')}
                  className={`${
                    billingPeriod === 'month' 
                      ? 'bg-white border-gray-200 shadow-sm text-gray-900' 
                      : 'border border-transparent text-gray-700'
                  } relative w-1/2 rounded-md py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-green-500 focus:z-10 sm:w-auto sm:px-8`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('year')}
                  className={`${
                    billingPeriod === 'year' 
                      ? 'bg-white border-gray-200 shadow-sm text-gray-900' 
                      : 'border border-transparent text-gray-700'
                  } ml-0.5 relative w-1/2 rounded-md py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-green-500 focus:z-10 sm:w-auto sm:px-8`}
                >
                  Yearly <span className="text-green-500 font-bold">Save 17%</span>
                </button>
              </div>
            </div>
            
            <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
              {subscriptionPlans.map((plan) => (
                <div key={plan.id} className={`${
                  plan.highlighted ? 'border-2 border-green-500 shadow-xl' : 'border border-gray-200'
                } rounded-lg shadow-sm divide-y divide-gray-200 bg-white`}>
                  <div className="p-6">
                    <h2 className="text-lg leading-6 font-medium text-gray-900">{plan.name}</h2>
                    <p className="mt-4 text-sm text-gray-500">
                      {getPriceDisplay(plan)}
                    </p>
                    <p className="mt-4 text-sm text-gray-500">
                      {plan.name === 'Basic' 
                        ? 'Perfect for new sellers' 
                        : plan.name === 'Pro' 
                          ? 'For growing businesses' 
                          : 'For established businesses'}
                    </p>
                    
                    <button
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={currentPlan === plan.id}
                      className={`${
                        currentPlan === plan.id
                          ? 'bg-gray-100 text-gray-800 cursor-default'
                          : plan.highlighted
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-800 text-white hover:bg-gray-900'
                      } mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium`}
                    >
                      {currentPlan === plan.id ? 'Current Plan' : 'Upgrade'}
                    </button>
                  </div>
                  <div className="pt-6 pb-8 px-6">
                    <h3 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                      What's included
                    </h3>
                    <ul className="mt-6 space-y-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex">
                          <svg className="flex-shrink-0 h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="ml-3 text-gray-500">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
        <div className="mt-12 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-8 bg-gradient-to-r from-green-50 to-blue-50 sm:p-10 sm:pb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Need a custom plan?
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  Contact our sales team for a tailored solution that meets your specific business requirements.
                </p>
              </div>
            </div>
            <div className="mt-6 sm:flex sm:items-center sm:justify-end">
              <a
                href="mailto:sales@habeshamarket.com"
                className="mt-3 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-green-700 bg-white hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto"
              >
                Contact Sales
              </a>
            </div>
          </div>
          <div className="px-6 pt-6 pb-8 bg-gray-50 sm:p-10 sm:pt-6">
            <h3 className="text-sm font-medium text-gray-900">
              Frequently Asked Questions
            </h3>
            <div className="mt-6">
              <dl className="space-y-8">
                <div>
                  <dt className="text-sm font-medium text-gray-900">
                    Can I change my plan later?
                  </dt>
                  <dd className="mt-2 text-sm text-gray-500">
                    Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-900">
                    What payment methods do you accept?
                  </dt>
                  <dd className="mt-2 text-sm text-gray-500">
                    We accept all major credit cards, TeleBirr, CBE, and Amole. For enterprise plans, we also offer invoice-based payments.
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-900">
                    What happens if I exceed my product limit?
                  </dt>
                  <dd className="mt-2 text-sm text-gray-500">
                    You'll need to upgrade to a higher plan to add more products. We'll notify you when you're approaching your limit.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 