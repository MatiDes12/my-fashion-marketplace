import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Create a Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tx_ref = searchParams.get('trx_ref') || searchParams.get('tx_ref');
  const status = searchParams.get('status');

  console.log('[CHAPA CALLBACK] Starting callback processing:', { tx_ref, status });

  try {
    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Verify with Chapa
    const verifyResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
        'Content-Type': 'application/json'
      }
    });

    const verifyData = await verifyResponse.json();
    console.log('[CHAPA CALLBACK] Verification response:', verifyData);

    if (verifyResponse.ok && verifyData.status === 'success') {
      const reference = verifyData.data?.reference;
      const receiptUrl = reference 
        ? `https://checkout.chapa.co/checkout/test-payment-receipt/${reference}`
        : null;

      // Get orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:users!orders_user_id_fkey (
            id,
            full_name,
            email,
            store_settings
          ),
          product:products (
            id,
            owner:users (
              id,
              store_settings
            )
          )
        `)
        .eq('tx_ref', tx_ref);

      if (ordersError || !orders?.length) {
        throw new Error('Orders not found');
      }

      // Process each order
      for (const order of orders) {
        // Update order status
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'paid',
            order_status: 'confirmed',
            payment_reference: reference,
            receipt_url: receiptUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateError) {
          console.error('[CHAPA CALLBACK] Error updating order:', updateError);
        }

        // Update transaction status
        const { error: transactionError } = await supabase
          .from('transactions')
          .update({
            payment_status: 'paid',
            platform_payout_status: 'completed',
            seller_payout_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', order.id);

        if (transactionError) {
          console.error('[CHAPA CALLBACK] Error updating transaction:', transactionError);
        }
      }

      console.log('[CHAPA CALLBACK] Successfully processed all orders and transactions');

      return new Response(null, {
        status: 302,
        headers: {
          'Location': `/orders?payment_success=true&tx_ref=${tx_ref}`,
        },
      });
    }

    throw new Error('Payment verification failed');

  } catch (error) {
    console.error('[CHAPA CALLBACK] Error:', error);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/cart?payment_error=true&tx_ref=${tx_ref}`,
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Verify the payment with Chapa
    // Update your database
    const { data, error } = await supabase
      .from('payments')
      .update({ status: 'success' })
      .eq('tx_ref', body.tx_ref)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
} 