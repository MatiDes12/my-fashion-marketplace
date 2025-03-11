import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TelebirrPayment } from '@/lib/telebirr';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();

    // Get admin settings to verify the notification
    const { data: adminSettings } = await supabase
      .from('admin_payment_settings')
      .select('*')
      .single();

    if (!adminSettings) {
      throw new Error('Admin settings not found');
    }

    // Initialize Telebirr with admin credentials
    const telebirr = new TelebirrPayment({
      appId: adminSettings.merchant_app_id,
      appSecret: adminSettings.app_secret,
      shortCode: adminSettings.short_code,
      publicKey: adminSettings.public_key,
      privateKey: adminSettings.private_key,
    });

    // Verify the notification
    const isValid = telebirr.verifyNotification(body);
    if (!isValid) {
      throw new Error('Invalid notification signature');
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'completed',
        payment_confirmed_at: new Date().toISOString()
      })
      .eq('id', body.outTradeNo);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json({ error: 'Failed to process notification' }, { status: 500 });
  }
} 