import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TelebirrPayment } from '@/utils/telebirr-payment';

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
      merchant_code: adminSettings.merchant_app_id,
      app_id: adminSettings.app_id,
      app_key: adminSettings.app_key,
      public_key: adminSettings.public_key,
      private_key: adminSettings.private_key,
      notify_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/telebirr/notify`,
      redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
    });

    // Verify the notification
    const isValid = await telebirr.verifyNotification(body);
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