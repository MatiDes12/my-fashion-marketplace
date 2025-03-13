import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyTelebirrSignature } from '@/utils/telebirr-utils';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const signature = payload.sign;
    const merchantOrderId = payload.merch_order_id;

    const supabase = createRouteHandlerClient({ cookies });

    // First get the order to find the seller
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('seller_id')
      .eq('id', merchantOrderId)
      .single();

    if (orderError || !order) {
      console.error('Order lookup error:', orderError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get seller's payment settings to access their private key
    const { data: settings, error: settingsError } = await supabase
      .from('payment_settings')
      .select('telebirr_settings')
      .eq('user_id', order.seller_id)
      .single();

    if (settingsError || !settings?.telebirr_settings) {
      console.error('Settings error:', settingsError);
      return NextResponse.json({ error: 'Payment settings not found' }, { status: 404 });
    }

    // Verify signature using seller's private key
    if (!verifyTelebirrSignature(payload, signature, settings.telebirr_settings.private_key)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    
    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: payload.trade_status,
        payment_id: payload.payment_order_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', merchantOrderId);

    if (updateError) {
      console.error('Order update error:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Success' });
  } catch (error: unknown) {
    console.error('Callback error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}