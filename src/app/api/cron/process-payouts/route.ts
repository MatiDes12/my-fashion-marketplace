import { createRouteClient } from '@/lib/supabase-route';
import { transferToSeller, transferToAdmin } from '@/utils/telebirr-transfer';

export async function POST(request: Request) {
  // Secure with CRON_SECRET - only for automated cron jobs
  const authHeader = request.headers.get('Authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable not set');
    return new Response('Server configuration error', { status: 500 });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = await createRouteClient();

  // Get pending transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, seller_payout_status, seller_payout_amount, seller_id, platform_payout_status, platform_revenue')
    .eq('payment_status', 'completed')
    .or('seller_payout_status.eq.pending,platform_payout_status.eq.pending');

  for (const transaction of transactions || []) {
    try {
      // Process seller payout if pending
      if (transaction.seller_payout_status === 'pending') {
        await transferToSeller(
          transaction.seller_payout_amount,
          transaction.seller_id,
          transaction.id
        );
      }

      // Process platform payout if pending
      if (transaction.platform_payout_status === 'pending') {
        await transferToAdmin(
          transaction.platform_revenue,
          transaction.id
        );
      }
    } catch (error) {
      console.error(`Failed to process transaction ${transaction.id}:`, error);
    }
  }

  return new Response(`Processed ${(transactions || []).length} transactions`, { status: 200 });
} 