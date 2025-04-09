import { createClient } from '@supabase/supabase-js';

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY!;
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/verify/';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Transaction reference is required');
    }

    // First verify with Chapa
    const chapaResponse = await fetch(`${CHAPA_API_URL}${tx_ref}`, {
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`
      }
    });

    const chapaData = await chapaResponse.json();

    // If payment is successful, update our database
    if (chapaData.data?.status === 'success') {
      // Get subscription details first
      const { data: subscription, error: subError } = await supabase
        .from('subscription_orders')
        .select('user_id, plan_id')
        .eq('tx_ref', tx_ref)
        .single();

      if (subError) {
        throw subError;
      }

      // Update both subscription order and user in a transaction
      const { error: updateError } = await supabase.rpc('update_subscription_status', {
        p_tx_ref: tx_ref,
        p_transaction_reference: chapaData.data.reference || chapaData.data.trx_ref,
        p_user_id: subscription.user_id,
        p_plan_id: subscription.plan_id
      });

      if (updateError) {
        console.error('Error updating subscription:', updateError);
      }

      return Response.json({ status: 'success' });
    }

    // If payment failed or is pending
    return Response.json({
      status: chapaData.data?.status || 'pending'
    });

  } catch (error) {
    console.error('Subscription status check error:', error);
    return Response.json(
      { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to check subscription status'
      },
      { status: 500 }
    );
  }
} 