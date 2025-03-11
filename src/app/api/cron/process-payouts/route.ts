import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { transferToSeller, transferToAdmin } from '@/utils/telebirr-transfer';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  // Get pending transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
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
} 