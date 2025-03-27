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
  const tx_ref = searchParams.get('trx_ref');
  const status = searchParams.get('status');

  try {
    console.log('[CHAPA CALLBACK] Starting callback processing:', { tx_ref, status });

    if (!tx_ref || status !== 'success') {
      throw new Error('Invalid callback parameters');
    }

    // First, get the order to get customer name and owner's phone
    let { data: orders, error: ordersError } = await supabase
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
      .eq('tx_ref', tx_ref)
      .single();

    if (ordersError || !orders) {
      throw new Error('Order not found');
    }

    // Split customer name
    const fullName = orders.customer?.full_name || 'Unknown Customer';
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ') || 'Unknown';

    // Get owner's alternative phone
    let customerPhone = null;
    if (orders.product?.owner?.store_settings) {
      const ownerSettings = orders.product.owner.store_settings;
      if (typeof ownerSettings === 'string') {
        const settings = JSON.parse(ownerSettings);
        customerPhone = settings.alternativePhone;
      } else {
        customerPhone = ownerSettings.alternativePhone;
      }
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
      const receiptUrl = verifyData.data?.receipt_url || 
                        verifyData.data?.receipt ||
                        (reference ? `https://checkout.chapa.co/checkout/test-payment-receipt/${reference}` : null);

      // Calculate fees
      const platformFee = orders.platform_fee || 0;    // 5%
      const serviceFee = orders.service_fee || 0;      // 2%
      const vatAmount = orders.ethiopia_tax || 0;      // 15%
      const deliveryFee = orders.delivery_fee || 0;
      const sellerAmount = orders.total_price - (platformFee + serviceFee + vatAmount + deliveryFee);

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          order_id: orders.id,
          payment_method: 'CHAPA',
          payment_status: 'paid',
          subtotal: orders.total_price,
          vat_amount: vatAmount,
          platform_fee: platformFee,
          service_fee: serviceFee,
          delivery_fee: deliveryFee,
          total_amount: orders.total_price,
          seller_id: orders.product?.owner?.id,
          seller_payout_amount: sellerAmount,
          platform_revenue: platformFee + serviceFee,
          seller_payout_status: 'pending',     // Waiting for admin approval
          platform_payout_status: 'completed', // Platform fees already received
          customer_name: fullName,
          customer_email: orders.customer?.email,
          customer_phone: customerPhone
        });

      if (transactionError) {
        console.error('[CHAPA CALLBACK] Transaction error:', transactionError);
        throw transactionError;
      }

      // Update orders
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          payment_status: 'paid',
          order_status: 'confirmed',
          payment_reference: reference,
          receipt_url: receiptUrl,
          updated_at: new Date().toISOString()
        })
        .eq('tx_ref', tx_ref);

      if (updateError) {
        console.error('[CHAPA CALLBACK] Update error:', updateError);
        throw updateError;
      }

      console.log('[CHAPA CALLBACK] Order and transaction updated successfully');

      // Redirect to orders page
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