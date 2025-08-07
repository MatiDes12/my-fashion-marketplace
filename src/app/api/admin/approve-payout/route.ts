import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { transferToSeller } from '@/utils/telebirr-transfer';

export async function POST(request: Request) {
  try {
    const { transactionId } = await request.json();

    // Get transaction details
    const { data: transaction, error: txError } = await supabaseServer
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
    await supabaseServer
      .from('transactions')
      .update({
        seller_payout_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    // Notify seller
    await supabaseServer.from('notifications').insert({
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