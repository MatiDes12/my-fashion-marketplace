'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { formatCurrency } from '@/utils/currency';
import { createChapaPayment } from '@/lib/chapa';
import SubscriptionPaymentSelector from '@/components/SubscriptionPaymentSelector';
import { toast } from 'react-hot-toast';

type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  period: 'month' | 'year';
  features: string[];
  productLimit: number;
  aiCredits?: number;
  analyticsAccess: 'standard' | 'detailed' | 'advanced';
  highlighted?: boolean;
  storageLimit: number;
  flashSalesLimit: {
    monthly: number;  // -1 for unlimited
    isEnabled: boolean;
  };
};

type PaymentMethod = string;

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 0,
    period: 'month',
    features: [
      'List up to 20 products',
      '5GB storage',
      'Standard analytics',
      'Email support',
      'No access to flash sales',
      'Free forever'
    ],
    productLimit: 20,
    storageLimit: 5,
    aiCredits: 0,
    analyticsAccess: 'standard',
    flashSalesLimit: {
      monthly: 0,
      isEnabled: false
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 999.99,
    period: 'month',
    features: [
      'List up to 75 products',
      '15GB storage',
      'Detailed analytics dashboard',
      'Priority support',
      'AI features',
      '5 flash sales per month'
    ],
    productLimit: 75,
    storageLimit: 15,
    aiCredits: 100,
    analyticsAccess: 'detailed',
    highlighted: true,
    flashSalesLimit: {
      monthly: 5,
      isEnabled: true
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1999.99,
    period: 'month',
    features: [
      'Unlimited products',
      'Unlimited storage',
      'Advanced AI & SEO features',
      'Custom branding',
      'Email support',
      'Advanced analytics',
      'Unlimited flash sales'
    ],
    productLimit: Infinity,
    storageLimit: Infinity,
    aiCredits: 500,
    analyticsAccess: 'advanced',
    flashSalesLimit: {
      monthly: -1,
      isEnabled: true
    }
  }
];

export default function SubscriptionPage() {
  const { t, language } = useLanguage();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month');
  const [paymentMethods, setPaymentMethods] = useState<{ [key: string]: PaymentMethod }>({
    basic: 'chapa',
    pro: 'chapa',
    enterprise: 'chapa'
  });
  const router = useRouter();
  const supabase = createClientComponent();
  const searchParams = useSearchParams();
  const message = searchParams?.get('message') ?? null;
  const [subscriptionDates, setSubscriptionDates] = useState<{
    startDate: string | null;
    endDate: string | null;
    status: 'active' | 'cancelled' | 'expired' | null;
  } | null>(null);

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      try {
        setLoading(true);
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push(`/login?message=${encodeURIComponent(t('dashboard.error.auth'))}`);
          return;
        }
        
        // Check role first (this should always work)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, subscription_plan')
          .eq('id', session.user.id)
          .single();
        
        if (userError) {
          console.error('Error fetching user role:', userError);
          throw new Error(t('dashboard.error.verifyPermissions'));
        }
        
        if (userData?.role !== 'owner') {
          router.push('/');
          return;
        }
        
        // Get current active subscription
        const { data: activeSubscription, error: subscriptionError } = await supabase
          .from('subscription_orders')
          .select('*')
          .eq('user_id', session.user.id)
          .or('status.eq.completed,status.eq.cancelled,status.eq.expired')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        console.log('Active subscription:', activeSubscription);
        console.log('Subscription error:', subscriptionError);

        if (!subscriptionError && activeSubscription) {
          const endDate = new Date(activeSubscription.subscription_end_date);
          const now = new Date();
          let expired = false;

          if (now > endDate) {
            expired = true;
            // If not already expired or cancelled, update status and downgrade
            if (activeSubscription.status !== 'expired' && activeSubscription.status !== 'cancelled') {
              // Update subscription status to expired
              await supabase
                .from('subscription_orders')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', activeSubscription.id);
              // Downgrade user to basic
              await supabase
                .from('users')
                .update({ subscription_plan: 'basic' })
                .eq('id', session.user.id);
            }
            setCurrentPlan('basic');
            setSubscriptionDates({
              startDate: activeSubscription.created_at,
              endDate: activeSubscription.subscription_end_date,
              status: 'expired',
            });
          } else {
            setSubscriptionDates({
              startDate: activeSubscription.created_at,
              endDate: activeSubscription.subscription_end_date,
              status: activeSubscription.status === 'cancelled' ? 'cancelled' : 'active',
            });
            setCurrentPlan(activeSubscription.plan_id);
          }
        } else {
          // No active subscription, set to basic plan
          setCurrentPlan('basic');
        }
        
      } catch (error) {
        console.error('Subscription page error:', error);
        setError(error instanceof Error ? error.message : t('common.error'));
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
        throw new Error(t('subscription.error.process'));
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      setError(t('subscription.error.process'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    try {
      setLoading(true);
      const paymentMethod = paymentMethods[plan.id];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      if (paymentMethod === 'telebirr') {
        toast.error(t('subscription.toast.telebirrSoon'));
        setLoading(false);
        return;
      }
      
      // Generate unique transaction reference
      const txRef = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate subscription end date
      const endDate = new Date();
      if (billingPeriod === 'month') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Create subscription order
      const { data: order, error: orderError } = await supabase
        .from('subscription_orders')
        .insert({
          user_id: session.user.id,
          plan_id: plan.id,
          amount: plan.price,
          period: billingPeriod,
          status: 'pending',
          tx_ref: txRef,
          subscription_end_date: endDate.toISOString(),
          payment_method: paymentMethod
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Initialize Chapa payment
      const response = await createChapaPayment({
        amount: plan.price.toString(),
        email: session.user.email!,
        tx_ref: txRef,
        callback_url: `${window.location.origin}/api/payments/chapa/subscription-callback`,
        return_url: `${window.location.origin}/dashboard/subscription/status?tx_ref=${txRef}`,
        customization: {
          title: `${plan.name} Plan`,
          description: `${billingPeriod}ly subscription`
        }
      });

      if (!response.data?.checkout_url) {
        throw new Error(response.message || 'Failed to initialize Chapa payment');
      }

      window.location.href = response.data.checkout_url;

    } catch (error) {
      console.error('Subscription error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Get current active subscription order
      const { data: activeSubscription, error: subscriptionError } = await supabase
        .from('subscription_orders')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subscriptionError) {
        throw new Error('No active subscription found');
      }

      // Try to update with cancelled_at first
      const { error: updateError } = await supabase
        .from('subscription_orders')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeSubscription.id);

      // If cancelled_at column doesn't exist, try without it
      if (updateError && updateError.code === 'PGRST204') {
        const { error: fallbackUpdateError } = await supabase
          .from('subscription_orders')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', activeSubscription.id);

        if (fallbackUpdateError) throw fallbackUpdateError;
      } else if (updateError) {
        throw updateError;
      }

      toast.success('Subscription cancelled. You will have access to paid features until the end of your billing period.');
      
      // Update subscription dates to reflect cancellation
      setSubscriptionDates({
        startDate: activeSubscription.created_at,
        endDate: activeSubscription.subscription_end_date,
        status: 'cancelled'
      });

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to cancel subscription');
      toast.error('Failed to cancel subscription');
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
        <span className="text-base font-medium text-gray-500">/{billingPeriod === 'year' ? t('subscription.billing.suffix.year') : t('subscription.billing.suffix.month')}</span>
      </>
    );
  };

  return (
    <div className="py-6">
      {message && (
        <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{message}</p>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mb-6">
        {/* Add subscription dates info */}
        {currentPlan && currentPlan !== 'basic' && subscriptionDates && (
          <div className="mt-6 rounded-lg bg-white shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('subscription.currentDetails.title')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t('subscription.currentDetails.startDate')}</span>
                <span className="font-medium">
                  {new Date(subscriptionDates.startDate!).toLocaleDateString(language === 'am' ? 'am-ET' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t('subscription.currentDetails.endDate')}</span>
                <span className="font-medium">
                  {subscriptionDates.endDate ? new Date(subscriptionDates.endDate).toLocaleDateString(language === 'am' ? 'am-ET' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : t('subscription.date.notSpecified')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t('subscription.currentDetails.status')}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  subscriptionDates.status === 'cancelled'
                    ? 'bg-yellow-100 text-yellow-800'
                    : subscriptionDates.status === 'expired'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-green-100 text-green-800'
                }`}>
                  {subscriptionDates.status === 'cancelled'
                    ? t('subscription.status.cancelled')
                    : subscriptionDates.status === 'expired'
                      ? t('subscription.status.expired')
                      : t('subscription.status.active')}
                </span>
              </div>
              {subscriptionDates.status === 'cancelled' && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">{t('subscription.notice.cancelled')}</p>
                    </div>
                  </div>
                </div>
              )}
              {subscriptionDates.status === 'expired' && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-gray-700">{t('subscription.notice.expired')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('subscription.plans.title')}</h1>
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
                  {t('subscription.billing.monthly')}
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
                  {t('subscription.billing.yearly')} <span className="text-green-500 font-bold">{t('subscription.billing.save17')}</span>
                </button>
              </div>
            </div>
            
            <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-lg shadow-sm divide-y divide-gray-200 ${
                    plan.highlighted ? 'border-2 border-green-500' : 'border border-gray-200'
                  }`}
                >
                  <div className="p-6">
                    <h2 className="text-lg leading-6 font-medium text-gray-900">{plan.name}</h2>
                    <p className="mt-4 text-sm text-gray-500">
                      {getPriceDisplay(plan)}
                    </p>
                    <p className="mt-4 text-sm text-gray-500">
                      {plan.id === 'basic' 
                        ? t('subscription.planDesc.basic') 
                        : plan.id === 'pro' 
                          ? t('subscription.planDesc.pro') 
                          : t('subscription.planDesc.enterprise')}
                    </p>
                  </div>

                  <div className="px-6 pt-6 pb-8">
                    {currentPlan === plan.id ? (
                      <div className="space-y-4">
                        <span className="block w-full bg-green-100 text-green-800 text-center rounded-md px-3 py-2">
                          Current Plan
                        </span>
                        {plan.id !== 'basic' && subscriptionDates?.status !== 'cancelled' && (
                          <button
                            onClick={handleCancelSubscription}
                            className="block w-full bg-red-100 text-red-700 hover:bg-red-200 px-3 py-2 rounded-md text-sm font-medium"
                          >
                            {t('subscription.cancelSubscription')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {plan.id !== 'basic' && (
                          <>
                            {currentPlan !== 'basic' && subscriptionDates && subscriptionDates.status !== 'expired' ? (
                              <div className="rounded-md bg-yellow-50 p-4">
                                <div className="flex">
                                  <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">
                                      {subscriptionDates.status === 'cancelled' ? t('subscription.banner.cancelledTitle') : t('subscription.banner.activeTitle')}
                                    </h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                      <p>
                                        {subscriptionDates.status === 'cancelled' 
                                          ? `${t('subscription.banner.cancelledMessage').replace('{currentPlan}', String(currentPlan)).replace('{planName}', plan.name)}`
                                          : `${t('subscription.banner.activeMessage').replace('{currentPlan}', String(currentPlan)).replace('{planName}', plan.name)}`
                                        }
                                        {subscriptionDates?.endDate ? new Date(subscriptionDates.endDate).toLocaleDateString(language === 'am' ? 'am-ET' : 'en-US', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric'
                                        }) : 'N/A'}.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="mt-4">
                                  <SubscriptionPaymentSelector
                                    selectedMethod={paymentMethods[plan.id]}
                                    onSelect={(method) => {
                                      setPaymentMethods(prev => ({
                                        ...prev,
                                        [plan.id]: method
                                      }));
                                    }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleSubscribe(plan)}
                                  className={`block w-full bg-green-600 text-white rounded-md px-3 py-2 text-sm font-medium 
                                    hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                                    disabled:opacity-50 disabled:cursor-not-allowed mt-4`}
                                  disabled={loading}
                                >
                                  {loading ? t('subscription.actions.processing') : t('subscription.actions.upgradeTo').replace('{planName}', plan.name)}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <div className="pt-6 pb-8 px-6">
                    <h3 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                      {t('subscription.whatsIncluded')}
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
                  {t('subscription.custom.title')}
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  {t('subscription.custom.subtitle')}
                </p>
              </div>
            </div>
            <div className="mt-6 sm:flex sm:items-center sm:justify-end">
              <a
                href="mailto:sales@habeshamarket.com"
                className="mt-3 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-green-700 bg-white hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto"
              >
                {t('subscription.custom.cta')}
              </a>
            </div>
          </div>
          <div className="px-6 pt-6 pb-8 bg-gray-50 sm:p-10 sm:pt-6">
            <h3 className="text-sm font-medium text-gray-900">
              {t('subscription.faq.title')}
            </h3>
            <div className="mt-6">
              <dl className="space-y-8">
                <div>
                  <dt className="text-sm font-medium text-gray-900">
                    {t('subscription.faq.q1')}
                  </dt>
                  <dd className="mt-2 text-sm text-gray-500">
                    {t('subscription.faq.a1')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-900">
                    {t('subscription.faq.q2')}
                  </dt>
                  <dd className="mt-2 text-sm text-gray-500">
                    {t('subscription.faq.a2')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-900">
                    {t('subscription.faq.q3')}
                  </dt>
                  <dd className="mt-2 text-sm text-gray-500">
                    {t('subscription.faq.a3')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="mt-8 max-w-3xl mx-auto text-sm text-gray-500">
          <h3 className="font-medium text-gray-900 mb-2">{t('subscription.info.title')}</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('subscription.info.i1')}</li>
            <li>{t('subscription.info.i2')}</li>
            <li>{t('subscription.info.i3')}</li>
            <li>{t('subscription.info.i4')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 