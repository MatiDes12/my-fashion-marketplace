import { NextResponse } from 'next/server';
import { supabaseServerAnon } from '@/lib/supabase-server';
import { tools } from '@/utils/tools';
import { sanitizeForLog } from '@/utils/security';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('Telebirr webhook received:', sanitizeForLog(JSON.stringify({
      merch_order_id: payload?.merch_order_id,
      trans_status: payload?.trans_status,
    })));

    // Validate required fields
    if (!payload?.merch_order_id || !payload?.sign) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Get payment settings for signature verification
    const { data: settings, error: settingsError } = await supabaseServerAnon
      .from('admin_payment_settings')
      .select('private_key')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings?.private_key) {
      console.error('Webhook: Payment settings not found');
      return NextResponse.json({ success: false, error: 'Configuration error' }, { status: 500 });
    }

    // Verify webhook signature to prevent forged callbacks
    const fieldsToVerify: Record<string, string> = {};
    const signableFields = ['merch_order_id', 'out_trade_no', 'trans_amount', 'trans_currency', 'trans_status', 'trans_id', 'nonce_str', 'timestamp'];
    for (const field of signableFields) {
      if (payload[field] !== undefined) {
        fieldsToVerify[field] = String(payload[field]);
      }
    }

    const calculatedSign = tools.signRequestObject(fieldsToVerify, settings.private_key);
    if (calculatedSign !== payload.sign) {
      console.warn('Webhook: Invalid signature for order:', sanitizeForLog(payload.merch_order_id));
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 403 });
    }

    // Signature verified — process the webhook
    console.log('Webhook signature verified for order:', sanitizeForLog(payload.merch_order_id));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
