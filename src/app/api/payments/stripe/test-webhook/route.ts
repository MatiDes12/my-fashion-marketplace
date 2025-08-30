import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    console.log('Webhook test - Body length:', body.length);
    console.log('Webhook test - Signature:', signature ? 'Present' : 'Missing');
    console.log('Webhook test - Secret configured:', webhookSecret ? 'Yes' : 'No');

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('Webhook test - Event constructed successfully:', event.type);
    } catch (err) {
      console.error('Webhook test - Signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Webhook test - Processing event:', event.type);

    return NextResponse.json({ 
      received: true, 
      event_type: event.type,
      message: 'Webhook test successful'
    });

  } catch (error) {
    console.error('Webhook test error:', error);
    return NextResponse.json({ error: 'Webhook test failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Stripe webhook test endpoint',
    webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
    stripe_key_configured: !!process.env.STRIPE_SECRET_KEY
  });
}
