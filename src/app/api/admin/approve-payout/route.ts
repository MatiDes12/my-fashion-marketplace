import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transferToSeller } from '@/utils/telebirr-transfer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { transactionId } = await request.json();

    // Get transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Transfer money to seller
    await transferToSeller(
      transaction.seller_payout_amount,
      transaction.seller_id,
      transaction.id
    );

    // Update transaction status
    await supabase
      .from('transactions')
      .update({
        seller_payout_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: transaction.seller_id,
      type: 'payout_completed',
      title: 'Payout Completed',
      message: `Your payout of ${transaction.seller_payout_amount} ETB has been processed`,
      metadata: {
        transaction_id: transaction.id,
        amount: transaction.seller_payout_amount
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Payout approval error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process payout' },
      { status: 500 }
    );
  }
} 