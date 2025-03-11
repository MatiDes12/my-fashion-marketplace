import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TelebirrPayment } from '@/server/telebirr';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { title, amount, sellerId } = await request.json();

    if (!sellerId) {
      return NextResponse.json({ error: 'Seller ID is required' }, { status: 400 });
    }

    // Get seller's payment settings
    const { data: settings, error: settingsError } = await supabase
      .from('payment_settings')
      .select('telebirr_settings')
      .eq('user_id', sellerId)
      .single();

    if (settingsError || !settings?.telebirr_settings) {
      console.error('Settings error:', settingsError);
      return NextResponse.json(
        { error: 'Seller payment settings not found' }, 
        { status: 404 }
      );
    }

    // Initialize Telebirr with seller's settings
    const telebirr = new TelebirrPayment({
      fabricAppId: settings.telebirr_settings.fabric_app_id,
      appSecret: settings.telebirr_settings.app_secret,
      merchantAppId: settings.telebirr_settings.merchant_app_id,
      shortCode: settings.telebirr_settings.short_code,
      privateKey: settings.telebirr_settings.private_key,
      notifyUrl: settings.telebirr_settings.notify_url,
      redirectUrl: settings.telebirr_settings.redirect_url
    });

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const checkoutUrl = await telebirr.createOrder({
      title,
      total_amount: amount,
      merch_order_id: orderId,
      callback_info: JSON.stringify({
        order_id: orderId,
        amount: amount,
        seller_id: sellerId
      })
    });

    return NextResponse.json({ url: checkoutUrl });

  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 }
    );
  }
} 