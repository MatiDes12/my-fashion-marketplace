import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Add export config to explicitly mark this as a dynamic route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { baseTxRef, userId } = await request.json();

    if (!baseTxRef || !userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing baseTxRef or userId'
      }, { status: 400 });
    }

    // Fetch all orders created with the base transaction reference
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .like('tx_ref', `${baseTxRef}%`)
      .eq('user_id', userId);

    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'No orders found for the given transaction reference'
      }, { status: 404 });
    }

    // Get user details for notifications
    const { data: user } = await supabase
      .from('users')
      .select('full_name, email, store_settings')
      .eq('id', userId)
      .single();

    // Send Telegram notifications for each order
    const config = await getTelegramConfig();
    const bot = new TelegramBot(config);

    for (const order of orders) {
      try {
        // Get product details with proper error handling
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('title, price')
          .eq('id', order.product_id)
          .single();

        if (productError) {
          console.error('[CASH NOTIFY] Error fetching product:', productError);
        }

        // Use product title, fallback to 'Product' if missing
        const productName = product?.title || 'Product';
        console.log('[CASH NOTIFY] Product details for order:', order.id, {
          productId: order.product_id,
          productName: productName,
          productData: product
        });

                              // Send payment notification (similar to Chapa)
                      const paymentData = {
                        orderId: order.id,
                        txRef: order.tx_ref,
                        amount: order.total_price,
                        paymentMethod: 'CASH',
                        status: 'paid',
                        customerName: user?.full_name || 'Customer',
                        customerEmail: user?.email || '',
                        productName: productName,
                        receiptUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/receipts/cash/${baseTxRef}`,
                        orderStatus: order.order_status,
                        createdAt: order.created_at,
                        reference: order.tx_ref
                      };

        await bot.sendPaymentNotification(userId, paymentData);
        console.log('[CASH NOTIFY] Telegram payment notification sent for order:', order.id);

        // Send order confirmation notification
        const orderData = {
          orderId: order.id,
          productName: productName,
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
        
        await bot.sendOrderConfirmation(userId, orderData);
        console.log('[CASH NOTIFY] Telegram order confirmation sent for order:', order.id);

        // Send receipt notification with correct URL format
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
          productName: productName,
          quantity: order.quantity,
          deliveryMethod: order.delivery_method,
          deliveryAddress: order.delivery_address,
          pickupCode: order.pickup_code,
          receiptUrl: `/api/receipts/cash/${baseTxRef}`, // Use the base transaction reference
          createdAt: order.created_at
        };
        
        await bot.sendReceipt(userId, receiptData);
        console.log('[CASH NOTIFY] Telegram receipt sent for order:', order.id);
      } catch (orderError) {
        console.error('[CASH NOTIFY] Error sending notifications for order:', order.id, orderError);
        // Continue with other orders even if one fails
      }
    }

    return NextResponse.json({
      status: 'success',
      message: `Telegram notifications sent for ${orders.length} orders`
    });

  } catch (error) {
    console.error('[CASH NOTIFY] Error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to send notifications'
      },
      { status: 500 }
    );
  }
} 