import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Add export config to explicitly mark this as a dynamic route
export const dynamic = 'force-dynamic';

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

// Use NextRequest instead of Request
export async function GET(request: NextRequest) {
  try {
    // Use NextRequest's nextUrl property instead of URL constructor
    const tx_ref = request.nextUrl.searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Fetch the cash order status
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tx_ref', tx_ref)
      .single();

    if (error) throw error;

    // Add validation after fetching order
    try {
      validateOrderUpdate(order);
    } catch (error) {
      console.error('[CASH VERIFY] Validation error:', error);
      return NextResponse.json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Order validation failed'
      }, { status: 400 });
    }

    // Send Telegram notification for cash payment confirmation
    try {
      const config = await getTelegramConfig();
      const bot = new TelegramBot(config);
      
      // Get user details for notification
      const { data: user } = await supabase
        .from('users')
        .select('full_name, email, store_settings')
        .eq('id', order.user_id)
        .single();

      // Get product details
      const { data: product } = await supabase
        .from('products')
        .select('name, price')
        .eq('id', order.product_id)
        .single();

      const paymentData = {
        orderId: order.id,
        txRef: order.tx_ref,
        amount: order.total_price,
        paymentMethod: 'Cash Payment',
        status: order.payment_status,
        customerName: user?.full_name || 'Customer',
        customerEmail: user?.email || '',
        productName: product?.name || 'Product',
        receiptUrl: order.receipt_url,
        orderStatus: order.order_status,
        createdAt: order.created_at
      };

      await bot.sendPaymentNotification(order.user_id, paymentData);
      console.log('[CASH VERIFY] Telegram payment notification sent for order:', order.id);
      
      // Also send order confirmation notification
      const orderData = {
        orderId: order.id,
        productName: product?.name || 'Product',
        quantity: order.quantity,
        amount: order.total_price,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        customerName: user?.full_name || 'Customer',
        customerEmail: user?.email || '',
        deliveryMethod: order.delivery_method,
        deliveryAddress: order.delivery_address,
        pickupCode: order.pickup_code,
        createdAt: order.created_at
      };
      
      await bot.sendOrderConfirmation(order.user_id, orderData);
      console.log('[CASH VERIFY] Telegram order confirmation sent for order:', order.id);

      // Send receipt notification
      const receiptData = {
        orderId: order.id,
        txRef: order.tx_ref,
        amount: order.total_price,
        subtotal: order.total_price - (order.delivery_fee || 0),
        serviceFee: order.service_fee || 0,
        deliveryFee: order.delivery_fee || 0,
        paymentMethod: 'CASH',
        customerName: user?.full_name || 'Customer',
        customerEmail: user?.email || '',
        customerPhone: user?.store_settings?.phone || 'N/A',
        productName: product?.name || 'Product',
        quantity: order.quantity,
        deliveryMethod: order.delivery_method,
        deliveryAddress: order.delivery_address,
        pickupCode: order.pickup_code,
        receiptUrl: order.receipt_url,
        createdAt: order.created_at
      };
      
      await bot.sendReceipt(order.user_id, receiptData);
      console.log('[CASH VERIFY] Telegram receipt sent for order:', order.id);
    } catch (telegramError) {
      console.error('[CASH VERIFY] Error sending Telegram notification:', telegramError);
      // Don't fail the verification if Telegram notification fails
    }

    return NextResponse.json({
      status: 'success',
      data: {
        status: order.payment_status,
        tx_ref: order.tx_ref,
        receipt_url: order.receipt_url
      }
    });

  } catch (error) {
    console.error('[CASH VERIFY] Error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Verification failed'
      },
      { status: 500 }
    );
  }
} 