import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tools } from '@/utils/tools';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TelebirrNotification {
  merch_order_id: string;
  out_trade_no: string;
  trans_amount: string;
  trans_currency: string;
  trans_status: 'SUCCESS' | 'FAILED' | 'PENDING';
  trans_id: string;
  sign: string;
  sign_type: string;
  nonce_str: string;
  timestamp: string;
}

export async function POST(request: Request) {
  try {
    console.log('Received Telebirr notification');
    const payload = await request.json() as TelebirrNotification;
    
    console.log('Notification payload:', {
      ...payload,
      sign: payload.sign ? `${payload.sign.substring(0, 20)}...` : undefined
    });

    // Get payment settings
    const { data: settings, error: settingsError } = await supabase
      .from('admin_payment_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      throw new Error('Payment settings not found');
    }

    // Verify signature
    const calculatedSign = tools.signRequestObject(
      {
        merch_order_id: payload.merch_order_id,
        out_trade_no: payload.out_trade_no,
        trans_amount: payload.trans_amount,
        trans_currency: payload.trans_currency,
        trans_status: payload.trans_status,
        trans_id: payload.trans_id,
        nonce_str: payload.nonce_str,
        timestamp: payload.timestamp
      },
      settings.private_key
    );

    if (calculatedSign !== payload.sign) {
      throw new Error('Invalid signature');
    }

    // Update transaction status
    const { error: txError } = await supabase
      .from('transactions')
      .update({
        payment_status: payload.trans_status,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', payload.merch_order_id);

    if (txError) {
      throw new Error('Failed to update transaction status');
    }

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        payment_status: payload.trans_status,
        order_status: payload.trans_status === 'SUCCESS' ? 'confirmed' : 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.merch_order_id);

    if (orderError) {
      throw new Error('Failed to update order status');
    }

    // If payment failed, notify relevant parties
    if (payload.trans_status === 'FAILED') {
      // Get order details for notifications
      const { data: order } = await supabase
        .from('orders')
        .select(`
          *,
          product:products(title, owner_id),
          buyer:users!user_id(full_name)
        `)
        .eq('id', payload.merch_order_id)
        .single();

      if (order) {
        await Promise.all([
          // Notify buyer
          supabase.from('notifications').insert({
            user_id: order.user_id,
            type: 'payment_failed',
            title: 'Payment Failed',
            message: `Your payment for ${order.product.title} has failed. Please try again.`,
            metadata: {
              order_id: order.id,
              amount: payload.trans_amount
            }
          }),
          // Notify seller
          supabase.from('notifications').insert({
            user_id: order.product.owner_id,
            type: 'payment_failed',
            title: 'Order Payment Failed',
            message: `Payment failed for order of ${order.product.title}`,
            metadata: {
              order_id: order.id,
              amount: payload.trans_amount
            }
          })
        ]);
      }
    }

    console.log('Successfully processed notification for order:', payload.merch_order_id);

    return NextResponse.json(
      { success: true, message: 'Notification processed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Notification processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process notification'
      },
      { status: 500 }
    );
  }
}
