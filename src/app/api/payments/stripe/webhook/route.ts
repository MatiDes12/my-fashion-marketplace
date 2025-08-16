import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;
    if (!stripe) {
      console.error('Stripe is not initialized');
      return NextResponse.json(
        { error: 'Stripe is not initialized' },
        { status: 500 }
      );
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Update payment status in database if needed
        if (session.metadata?.tx_ref) {
          // Update orders table
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              payment_reference: session.id
            })
            .eq('tx_ref', session.metadata.tx_ref);

          // Update transactions table by finding orders with this tx_ref first
          const { data: ordersWithTxRef } = await supabase
            .from('orders')
            .select('id')
            .eq('tx_ref', session.metadata.tx_ref);

          if (ordersWithTxRef && ordersWithTxRef.length > 0) {
            const orderIds = ordersWithTxRef.map(order => order.id);
            await supabase
              .from('transactions')
              .update({
                payment_status: 'paid',
                stripe_session_id: session.id,
                stripe_payment_intent_id: typeof session.payment_intent === 'string' 
                  ? session.payment_intent 
                  : session.payment_intent?.id
              })
              .in('order_id', orderIds);
          }
        }
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Additional processing if needed
        console.log('Payment succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        
        // Handle failed payments
        console.log('Payment failed:', failedPayment.id);
        
        // Update order status to failed if needed
        if (failedPayment.metadata?.tx_ref) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'failed',
              order_status: 'cancelled'
            })
            .eq('tx_ref', failedPayment.metadata.tx_ref);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
