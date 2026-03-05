import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tools } from '@/utils/tools';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export async function POST(request: Request) {
  try {
    console.log('Received Telebirr subscription callback');
    const payload = await request.json() as TelebirrCallback;
    
    // Get payment settings for signature verification
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

    // Get subscription order details
    const { data: subscription, error: subError } = await supabase
      .from('subscription_orders')
      .select(`
        id,
        tx_ref,
        plan_id,
        period,
        user_id,
        user:users(
          id,
          full_name,
          email,
          subscription_plan
        )
      `)
      .eq('tx_ref', payload.merch_order_id)
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription order not found');
    }

    // Type assertion: Supabase returns single object for foreign key joins with .single()
    const subUser = (subscription as any).user as { id: string; full_name: string; email: string; subscription_plan: string } | null;

    // Update subscription order status
    const { error: updateError } = await supabase
      .from('subscription_orders')
      .update({
        status: payload.trans_status === 'SUCCESS' ? 'completed' : 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('tx_ref', payload.merch_order_id);

    if (updateError) {
      throw new Error('Failed to update subscription status');
    }

    if (payload.trans_status === 'SUCCESS') {
      // Calculate subscription end date
      const endDate = new Date();
      if (subscription.period === 'month') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Update user's subscription plan
      const { error: userError } = await supabase
        .from('users')
        .update({
          subscription_plan: subscription.plan_id,
          subscription_end_date: endDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.user_id);

      if (userError) {
        throw new Error('Failed to update user subscription');
      }

      // Create transaction record
      await supabase
        .from('transactions')
        .insert({
          subscription_id: subscription.id,
          payment_method: 'telebirr',
          payment_status: 'completed',
          payment_type: 'subscription',
          total_amount: Number(payload.trans_amount),
          platform_revenue: Number(payload.trans_amount),
          customer_name: subUser?.full_name,
          customer_email: subUser?.email,
          payment_reference: payload.trans_id
        });

      // Send notifications
      await Promise.all([
        // Notify user
        supabase.from('notifications').insert({
          user_id: subscription.user_id,
          type: 'subscription_activated',
          title: 'Subscription Activated',
          message: `Your ${subscription.plan_id} subscription has been activated successfully`,
          metadata: {
            subscription_id: subscription.id,
            plan_id: subscription.plan_id,
            end_date: endDate.toISOString()
          }
        }),
        // Notify admin
        supabase.from('notifications').insert({
          user_id: null, // Admin notification
          type: 'new_subscription',
          title: 'New Subscription',
          message: `New ${subscription.plan_id} subscription by ${subUser?.full_name}`,
          metadata: {
            subscription_id: subscription.id,
            user_id: subscription.user_id,
            amount: payload.trans_amount
          }
        })
      ]);
    }

    return NextResponse.json(
      { success: true, message: 'Subscription payment processed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Subscription callback error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process subscription payment'
      },
      { status: 500 }
    );
  }
} 