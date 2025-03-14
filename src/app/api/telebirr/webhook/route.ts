import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyWebhookSignature } from '@/utils/telebirr-utils';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const payload = await request.json();
    const signature = request.headers.get('x-telebirr-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Get admin settings to verify signature
    const { data: adminSettings } = await supabase
      .from('admin_payment_settings')
      .select('*')
      .single();

    if (!adminSettings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 500 });
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(
      payload,
      signature,
      adminSettings.public_key
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const {
      transactionId,
      orderId,
      status,
      amount,
      paymentTime,
      msisdn // phone number
    } = payload;

    // Update transaction status
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({
        payment_status: status,
        payment_time: paymentTime,
        last_updated: new Date().toISOString(),
        metadata: payload // Store full webhook payload
      })
      .eq('transaction_id', transactionId)
      .eq('order_id', orderId);

    if (transactionError) {
      console.error('Transaction update error:', transactionError);
      throw transactionError;
    }

    // If payment is successful, update related orders
    if (status === 'COMPLETED' || status === 'SUCCESS') {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'completed',
          order_status: 'confirmed',
          payment_confirmed_at: paymentTime
        })
        .eq('transaction_id', transactionId);

      if (orderError) {
        console.error('Order update error:', orderError);
        // Log but don't throw as transaction was updated
      }

      // Notify seller(s) about new order
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          seller:users!seller_id (
            id,
            email,
            full_name,
            notification_preferences
          )
        `)
        .eq('transaction_id', transactionId);

      // Send notifications to sellers
      if (orders) {
        const uniqueSellers = new Set(orders.map(order => order.seller.id));
        
        for (const sellerId of uniqueSellers) {
          const sellerOrders = orders.filter(order => order.seller.id === sellerId);
          const seller = sellerOrders[0].seller;

          // Create notification
          await supabase.from('notifications').insert({
            user_id: sellerId,
            type: 'new_order',
            title: 'New Order Received',
            message: `You have received ${sellerOrders.length} new order(s)`,
            metadata: {
              orderId,
              transactionId,
              orderCount: sellerOrders.length
            }
          });

          // TODO: Send email notification if seller has enabled it
          if (seller.notification_preferences?.email) {
            // Implement email notification
          }
        }
      }
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      // Handle failed payments
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled',
          cancelled_at: paymentTime,
          cancel_reason: `Payment ${status.toLowerCase()}`
        })
        .eq('transaction_id', transactionId);

      if (orderError) {
        console.error('Order cancellation error:', orderError);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
} 