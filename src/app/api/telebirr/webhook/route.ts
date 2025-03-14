import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyTelebirrSignature } from '@/utils/telebirr-utils';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const signature = request.headers.get('x-telebirr-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Get admin settings for verification
    const supabase = createRouteHandlerClient({ cookies });
    const { data: adminSettings } = await supabase
      .from('admin_payment_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!adminSettings) {
      return NextResponse.json(
        { error: 'Invalid configuration' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const isValid = verifyTelebirrSignature(
      payload,
      signature,
      adminSettings.app_secret
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        order_status: payload.status === 'SUCCESS' ? 'confirmed' : 'failed',
        payment_reference: payload.transactionNo,
        payment_status: payload.status,
        payment_timestamp: new Date(parseInt(payload.timestamp)).toISOString()
      })
      .eq('id', payload.outTradeNo);

    if (orderError) {
      throw orderError;
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
} 