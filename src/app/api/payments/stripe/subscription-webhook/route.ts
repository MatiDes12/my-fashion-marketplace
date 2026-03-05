import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = await createRouteClient();

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, supabase);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, supabase);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, supabase);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, supabase: any) {
  try {
    const { subscription_order_id, user_id, plan_id, period, tx_ref } = session.metadata!;

    if (!subscription_order_id) {
      console.error('No subscription_order_id in session metadata');
      return;
    }

    // Update subscription order status to completed
    const { error: updateError } = await supabase
      .from('subscription_orders')
      .update({
        status: 'completed',
        transaction_reference: session.payment_intent as string,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription_order_id);

    if (updateError) {
      console.error('Error updating subscription order:', updateError);
      return;
    }

    // Update user's subscription plan
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ subscription_plan: plan_id })
      .eq('id', user_id);

    if (userUpdateError) {
      console.error('Error updating user subscription plan:', userUpdateError);
    }

    console.log(`Subscription completed: ${plan_id} plan for user ${user_id}`);

  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  try {
    // Find subscription order by payment intent ID
    const { data: subscriptionOrder, error: fetchError } = await supabase
      .from('subscription_orders')
      .select('id, status, plan_id, user_id')
      .eq('transaction_reference', paymentIntent.id)
      .single();

    if (fetchError || !subscriptionOrder) {
      console.error('Subscription order not found for payment intent:', paymentIntent.id);
      return;
    }

    // Update subscription order status if not already completed
    if (subscriptionOrder.status !== 'completed') {
      const { error: updateError } = await supabase
        .from('subscription_orders')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionOrder.id);

      if (updateError) {
        console.error('Error updating subscription order:', updateError);
        return;
      }

      // Update user's subscription plan
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ subscription_plan: subscriptionOrder.plan_id })
        .eq('id', subscriptionOrder.user_id);

      if (userUpdateError) {
        console.error('Error updating user subscription plan:', userUpdateError);
      }

      console.log(`Payment succeeded for subscription: ${subscriptionOrder.plan_id} plan`);
    }

  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  try {
    // Find subscription order by payment intent ID
    const { data: subscriptionOrder, error: fetchError } = await supabase
      .from('subscription_orders')
      .select('id, status, plan_id')
      .eq('transaction_reference', paymentIntent.id)
      .single();

    if (fetchError || !subscriptionOrder) {
      console.error('Subscription order not found for payment intent:', paymentIntent.id);
      return;
    }

    // Update subscription order status to failed
    const { error: updateError } = await supabase
      .from('subscription_orders')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionOrder.id);

    if (updateError) {
      console.error('Error updating subscription order to failed:', updateError);
    } else {
      console.log(`Payment failed for subscription: ${subscriptionOrder.plan_id} plan`);
    }

  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
}
