import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyPickupCode } from '@/utils/pickupCodeServer';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, orderId } = body;

    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Pickup code is required' 
      }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID is required' 
      }, { status: 400 });
    }

    // Normalize the code
    const normalizedCode = code.trim().toUpperCase();
    
    const result = await verifyPickupCode(normalizedCode, orderId);
    console.log('Verification result:', result);

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
    console.error('Error in verify-pickup API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to verify pickup code' 
    }, { status: 500 });
  }
} 