import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyPickupCode } from '@/utils/pickupCodeServer';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';
import { sanitizeForLog, isValidIdentifier } from '@/utils/security';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, orderId } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Pickup code is required'
      }, { status: 400 });
    }

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required'
      }, { status: 400 });
    }

    // Validate orderId format to prevent injection
    if (!isValidIdentifier(orderId, 50)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid order ID format'
      }, { status: 400 });
    }

    // Validate code format (alphanumeric, max 20 chars)
    if (!/^[A-Za-z0-9]{1,20}$/.test(code.trim())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid pickup code format'
      }, { status: 400 });
    }

    // Normalize the code
    const normalizedCode = code.trim().toUpperCase();

    const result = await verifyPickupCode(normalizedCode, orderId);
    console.log('Verification result for order:', sanitizeForLog(orderId), 'success:', result.success);

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to verify pickup code'
      }, { status: 400 });
    }

    // Fire Telegram notification for store pickup (store_pickup)
    try {
      const supabase = createRouteHandlerClient({ cookies });
      // Fetch order to get user_id and product title if not provided
      const { data: orderRow } = await supabase
        .from('orders')
        .select('id, user_id, delivery_method, product:products(title)')
        .eq('id', orderId)
        .single();

      if (orderRow?.user_id && (orderRow as any)?.delivery_method === 'store_pickup') {
        const config = await getTelegramConfig();
        const bot = new TelegramBot(config);
        await bot.sendDeliveryUpdate(orderRow.user_id, {
          order_id: orderId,
          status: 'picked_up',
          updated_at: new Date().toISOString(),
          product_name: (orderRow as any)?.product?.title || undefined,
          notes: 'Pickup verified by code at store'
        });
      }
    } catch (notifyError) {
      console.error('[PICKUP_NOTIFY] Failed to send Telegram pickup notification:', notifyError);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Pickup code verified successfully',
      order: result.order
    });

  } catch (error) {
    console.error('Error in verify-pickup API:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      success: false,
      error: 'Failed to verify pickup code'
    }, { status: 500 });
  }
} 