import { NextRequest, NextResponse } from 'next/server';
import { stripe, formatAmountForStripe } from '@/lib/stripe';
import { EXCHANGE_RATES } from '@/utils/currency';
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
      metadata,
      order_details // New field for detailed order information
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

    // Check if Stripe is properly initialized
    if (!stripe) {
      return NextResponse.json(
        { success: false, message: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    // Convert amount to cents for Stripe
    const amountInCents = formatAmountForStripe(amount_usd);

    // Create detailed product description
    const orderSummary = order_details ? 
      order_details.map((item: any) => 
        `${item.product_name} (${item.quantity}x @ ETB ${item.price})${item.variant ? ` - ${item.variant}` : ''}`
      ).join(', ') : 
      'Fashion Marketplace Order';

    const fullDescription = order_details ? 
      `Items: ${orderSummary}. Total: ${amount_etb} ETB converted to USD at rate 1 ETB = $${EXCHANGE_RATES.ETB_TO_USD}` :
      `Order payment converted from ${amount_etb} ETB`;

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
              name: order_details && order_details.length === 1 ? 
                `${order_details[0].product_name}${order_details[0].variant ? ` (${order_details[0].variant})` : ''}` :
                `Fashion Marketplace Order (${order_details?.length || 1} items)`,
              description: fullDescription,
              metadata: {
                original_amount_etb: amount_etb.toString(),
                tx_ref: tx_ref,
                item_count: order_details?.length.toString() || '1',
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
