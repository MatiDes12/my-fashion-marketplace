import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY!;
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/verify/';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { tx_ref } = payload;

    // Verify payment with Chapa
    const response = await fetch(`${CHAPA_API_URL}${tx_ref}`, {
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`
      }
    });

    const verifyData = await response.json();

    if (!verifyData.data?.status || verifyData.data.status !== 'success') {
      throw new Error('Payment verification failed');
    }

    // Get subscription order details
    const { data: subscription, error: subError } = await supabase
      .from('subscription_orders')
      .select(`
        *,
        user:users(
          id,
          full_name,
          email,
          subscription_plan
        )
      `)
      .eq('tx_ref', tx_ref)
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription order not found');
    }

    // Update subscription order status
    const { error: updateError } = await supabase
      .from('subscription_orders')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('tx_ref', tx_ref);

    if (updateError) {
      throw new Error('Failed to update subscription status');
    }

    // Update user's subscription plan
    const { error: userError } = await supabase
      .from('users')
      .update({
        subscription_plan: subscription.plan_id,
        subscription_end_date: subscription.subscription_end_date,
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
        payment_method: 'chapa',
        payment_status: 'completed',
        payment_type: 'subscription',
        total_amount: Number(verifyData.data.amount),
        platform_revenue: Number(verifyData.data.amount),
        customer_name: subscription.user.full_name,
        customer_email: subscription.user.email,
        payment_reference: verifyData.data.reference
      });

    // Send Telegram notifications
    try {
      const { TelegramBot, getTelegramConfig } = await import('@/lib/telegram');
      const config = await getTelegramConfig();
      const bot = new TelegramBot(config);

      // Send subscription confirmation
      const subscriptionData = {
        orderId: subscription.id,
        txRef: subscription.tx_ref,
        amount: Number(verifyData.data.amount),
        paymentMethod: 'CHAPA',
        status: 'paid',
        customerName: subscription.user.full_name,
        customerEmail: subscription.user.email,
        productName: `${subscription.plan_id} Subscription`,
        receiptUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/receipts/chapa/${subscription.tx_ref}`,
        orderStatus: 'completed',
        createdAt: subscription.created_at,
        reference: verifyData.data.reference
      };

      await bot.sendPaymentNotification(subscription.user_id, subscriptionData);

      // Send receipt
      const receiptData = {
        orderId: subscription.id,
        txRef: subscription.tx_ref,
        amount: Number(verifyData.data.amount),
        subtotal: Number(verifyData.data.amount),
        serviceFee: 0,
        deliveryFee: 0,
        paymentMethod: 'CHAPA',
        customerName: subscription.user.full_name,
        customerEmail: subscription.user.email,
        customerPhone: 'N/A',
        productName: `${subscription.plan_id} Subscription`,
        quantity: 1,
        deliveryMethod: 'digital',
        deliveryAddress: 'Digital Service',
        pickupCode: null,
        receiptUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/receipts/chapa/${subscription.tx_ref}`,
        createdAt: subscription.created_at
      };

      await bot.sendReceipt(subscription.user_id, receiptData);
    } catch (telegramError) {
      console.error('Error sending Telegram notifications:', telegramError);
      // Don't fail the subscription if Telegram notification fails
    }

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
          end_date: subscription.subscription_end_date
        }
      }),
      // Notify admin
      supabase.from('notifications').insert({
        user_id: null, // Admin notification
        type: 'new_subscription',
        title: 'New Subscription',
        message: `New ${subscription.plan_id} subscription by ${subscription.user.full_name}`,
        metadata: {
          subscription_id: subscription.id,
          user_id: subscription.user_id,
          amount: verifyData.data.amount
        }
      })
    ]);

    return NextResponse.json(
      { success: true, message: 'Subscription payment processed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Chapa subscription callback error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process subscription payment'
      },
      { status: 500 }
    );
  }
} 