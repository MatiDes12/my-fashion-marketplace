import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route';
import Stripe from 'stripe';
import { convertETBToUSD, EXCHANGE_RATES } from '@/utils/currency';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, period } = await request.json();

    if (!planId || !period) {
      return NextResponse.json({ error: 'Missing planId or period' }, { status: 400 });
    }

    // Validate plan and period
    const validPlans = ['basic', 'pro', 'enterprise'];
    const validPeriods = ['month', 'year'];
    
    if (!validPlans.includes(planId)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    // Get plan details
    const planDetails = {
      basic: { price: 0, name: 'Basic' },
      pro: { price: 999.99, name: 'Pro' },
      enterprise: { price: 1999.99, name: 'Enterprise' }
    };

    const plan = planDetails[planId as keyof typeof planDetails];
    
    // Calculate amount based on period
    const amountETB = period === 'year' ? plan.price * 12 * 0.83 : plan.price; // 17% discount for yearly
    
    // Convert ETB to USD for Stripe
    const amountUSD = convertETBToUSD(amountETB);
    const amountInCents = Math.round(amountUSD * 100);

    // Generate unique transaction reference
    const txRef = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create subscription order in database (store original ETB amount)
    const { data: subscriptionOrder, error: orderError } = await supabase
      .from('subscription_orders')
      .insert({
        user_id: session.user.id,
        plan_id: planId,
        amount: amountETB, // Store original ETB amount
        period: period,
        status: 'pending',
        tx_ref: txRef,
        payment_method: 'stripe',
        subscription_end_date: new Date(Date.now() + (period === 'year' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating subscription order:', orderError);
      return NextResponse.json({ error: 'Failed to create subscription order' }, { status: 500 });
    }

    // Create detailed description with currency conversion info
    const periodText = period === 'year' ? '12 months' : '1 month';
    const description = `AvrioxShop ${plan.name} subscription for ${periodText}. Original price: ${amountETB} ETB converted to USD at rate 1 ETB = $${EXCHANGE_RATES.ETB_TO_USD}`;

    // Create Stripe checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd', // Use USD currency for Stripe
            product_data: {
              name: `${plan.name} Subscription (${period}ly)`,
              description: description,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/subscription/status?session_id={CHECKOUT_SESSION_ID}&tx_ref=${txRef}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/subscription?cancelled=true`,
      metadata: {
        subscription_order_id: subscriptionOrder.id,
        user_id: session.user.id,
        plan_id: planId,
        period: period,
        tx_ref: txRef,
        original_amount_etb: amountETB.toString(),
        converted_amount_usd: amountUSD.toString()
      },
      customer_email: session.user.email,
    };

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      txRef: txRef,
      amountETB: amountETB,
      amountUSD: amountUSD
    });

  } catch (error) {
    console.error('Error creating Stripe subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
