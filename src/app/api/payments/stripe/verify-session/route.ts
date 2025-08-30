import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get subscription order details from metadata
    const { subscription_order_id, user_id, plan_id } = session.metadata || {};

    if (!subscription_order_id) {
      return NextResponse.json({ error: 'Subscription order not found' }, { status: 404 });
    }

    // Get subscription order from database
    const { data: subscriptionOrder, error: orderError } = await supabase
      .from('subscription_orders')
      .select('*')
      .eq('id', subscription_order_id)
      .single();

    if (orderError || !subscriptionOrder) {
      return NextResponse.json({ error: 'Subscription order not found' }, { status: 404 });
    }

    // Determine status based on Stripe session payment status
    let status = 'pending';
    let shouldUpdateDatabase = false;
    
    if (session.payment_status === 'paid') {
      status = 'completed';
      // If database status is not completed yet, update it
      if (subscriptionOrder.status !== 'completed') {
        shouldUpdateDatabase = true;
      }
    } else if (session.payment_status === 'unpaid') {
      status = 'failed';
      // If database status is not failed yet, update it
      if (subscriptionOrder.status !== 'failed') {
        shouldUpdateDatabase = true;
      }
    }

    // Update database if needed
    if (shouldUpdateDatabase) {
      try {
        const { error: updateError } = await supabase
          .from('subscription_orders')
          .update({
            status: status,
            transaction_reference: session.payment_intent as string,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription_order_id);

        if (updateError) {
          console.error('Error updating subscription order:', updateError);
        } else {
          // If payment is completed, also update user's subscription plan
          if (status === 'completed' && plan_id) {
            const { error: userUpdateError } = await supabase
              .from('users')
              .update({ subscription_plan: plan_id })
              .eq('id', user_id);

            if (userUpdateError) {
              console.error('Error updating user subscription plan:', userUpdateError);
            }
          }
          
          console.log(`Updated subscription order ${subscription_order_id} to status: ${status}`);
        }
      } catch (updateError) {
        console.error('Error updating subscription order:', updateError);
      }
    }

    return NextResponse.json({
      status,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        customer_email: session.customer_email,
        amount_total: session.amount_total,
        currency: session.currency,
        created: session.created
      },
      subscription: subscriptionOrder
    });

  } catch (error) {
    console.error('Error verifying Stripe session:', error);
    return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
  }
}
