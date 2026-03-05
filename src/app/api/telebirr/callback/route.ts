import { NextResponse } from 'next/server';
import { supabaseServerAnon } from '@/lib/supabase-server';
import { tools } from '@/utils/tools';

const supabase = supabaseServerAnon;

interface TelebirrCallback {
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

// Add validation function at the top
const validateOrderUpdate = (order: any) => {
  if (!order) throw new Error('Invalid order data');
  if (order.quantity <= 0) throw new Error('Invalid quantity');
  if (order.total_price <= 0) throw new Error('Invalid total price');
  if (order.service_fee < 0) throw new Error('Invalid service fee');
  if (order.platform_fee < 0) throw new Error('Invalid platform fee');
  if (order.delivery_fee < 0) throw new Error('Invalid delivery fee');
  return true;
};

export async function POST(request: Request) {
  try {
    console.log('Received Telebirr callback');
    const payload = await request.json() as TelebirrCallback;
    
    console.log('Callback payload:', {
      ...payload,
      sign: payload.sign ? `${payload.sign.substring(0, 20)}...` : undefined
    });

    // Get the payment settings
    const { data: settings, error: settingsError } = await supabase
      .from('admin_payment_settings')
      .select('private_key')
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

    // Get order details with product and seller info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_price,
        ethiopia_tax,
        platform_fee,
        service_fee,
        delivery_fee,
        quantity,
        created_at,
        product:products(
          id,
          owner_id,
          price,
          title,
          owner:users(
            id,
            full_name,
            email
          )
        ),
        buyer:users!user_id(
          id,
          full_name,
          email
        )
      `)
      .eq('id', payload.merch_order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Add validation before updating order
    try {
      validateOrderUpdate(order);
    } catch (error) {
      console.error('[TELEBIRR CALLBACK] Validation error:', error);
      throw error;
    }

    // Create transaction record with initial state
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        order_id: order.id,
        payment_method: 'telebirr',
        payment_status: payload.trans_status,
        subtotal: order.total_price,
        vat_amount: order.ethiopia_tax,
        platform_fee: order.platform_fee,
        service_fee: order.service_fee,
        delivery_fee: order.delivery_fee,
        total_amount: Number(payload.trans_amount),
        seller_id: order.product.owner_id,
        seller_payout_amount: order.total_price - (
          order.platform_fee + 
          order.service_fee + 
          order.ethiopia_tax
        ),
        platform_revenue: order.platform_fee + order.service_fee,
        platform_payout_status: 'received', // Money received by platform
        seller_payout_status: 'pending',    // Pending admin approval
        customer_name: order.buyer.full_name,
        customer_email: order.buyer.email,
        customer_phone: order.buyer.phone || null
      })
      .select()
      .single();

    if (transactionError) {
      throw new Error('Failed to create transaction record');
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: payload.trans_status,
        payment_reference: payload.trans_id,
        order_status: payload.trans_status === 'SUCCESS' ? 'confirmed' : 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.merch_order_id);

    if (updateError) {
      throw new Error('Failed to update order status');
    }

    // If payment successful, send notifications
    if (payload.trans_status === 'SUCCESS') {
      await Promise.all([
        // Notify seller
        supabase.from('notifications').insert({
          user_id: order.product.owner_id,
          type: 'new_order',
          title: 'New Order Received',
          message: `You have received a new order for ${order.product.title}`,
          metadata: {
            order_id: order.id,
            amount: order.total_price,
            payout_amount: transaction.seller_payout_amount
          }
        }),
        // Notify buyer
        supabase.from('notifications').insert({
          user_id: order.user_id,
          type: 'order_confirmation',
          title: 'Order Confirmed',
          message: `Your order for ${order.product.title} has been confirmed`,
          metadata: {
            order_id: order.id,
            amount: order.total_price
          }
        }),
        // Notify admin
        supabase.from('notifications').insert({
          user_id: null, // Admin notification
          type: 'pending_payout',
          title: 'New Payout Pending',
          message: `New payout pending for seller ${order.product.owner.full_name}`,
          metadata: {
            order_id: order.id,
            transaction_id: transaction.id,
            seller_id: order.product.owner_id,
            amount: transaction.seller_payout_amount
          }
        })
      ]);

      // Send Telegram notifications
      try {
        const { TelegramBot, getTelegramConfig } = await import('@/lib/telegram');
        const config = await getTelegramConfig();
        const bot = new TelegramBot(config);

        // Send admin notification
        await bot.sendAdminAlert(
          `New order received!\nOrder ID: ${order.id}\nProduct: ${order.product.title}\nAmount: ${order.total_price} ETB\nCustomer: ${order.buyer.full_name}`,
          'info'
        );

        // Send seller notification if they have Telegram linked
        await bot.sendSellerNotification(order.product.owner_id, {
          type: 'new_order',
          message: `You have received a new order for ${order.product.title}`,
          order_id: order.id,
          amount: order.total_price
        });

        // Send buyer notification if they have Telegram linked
        await bot.sendOrderNotification(order.user_id, {
          id: order.id,
          product: order.product,
          total_price: order.total_price,
          order_status: 'confirmed',
          buyer: order.buyer,
          created_at: order.created_at
        });
      } catch (telegramError) {
        console.error('Telegram notification error:', telegramError);
        // Don't fail the payment if Telegram fails
      }
    }

    return NextResponse.json(
      { success: true, message: 'Payment processed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process payment'
      },
      { status: 500 }
    );
  }
}
