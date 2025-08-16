import { NextRequest, NextResponse } from 'next/server';
import { stripe, formatAmountForStripe } from '@/lib/stripe';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      amount_usd, 
      amount_etb, 
      email, 
      full_name, 
      tx_ref, 
      success_url, 
      cancel_url, 
      metadata 
    } = body;

    // Validate required fields
    if (!amount_usd || !email || !tx_ref) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate user authentication
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Convert amount to cents for Stripe
    const amountInCents = formatAmountForStripe(amount_usd);

    // Create Stripe checkout session
    const session_stripe = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Fashion Marketplace Order',
              description: `Order payment converted from ${amount_etb} ETB`,
              metadata: {
                original_amount_etb: amount_etb.toString(),
                tx_ref: tx_ref,
              },
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        tx_ref: tx_ref,
        user_id: session.user.id,
        original_amount_etb: amount_etb.toString(),
        ...metadata,
      },
      success_url: success_url || `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_BASE_URL}/checkout?cancelled=true`,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes expiry
    });

    return NextResponse.json({
      success: true,
      sessionId: session_stripe.id,
      url: session_stripe.url,
    });

  } catch (error) {
    console.error('Stripe session creation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Payment session creation failed' 
      },
      { status: 500 }
    );
  }
}
