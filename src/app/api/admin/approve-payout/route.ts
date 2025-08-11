import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { transferToSeller } from '@/utils/telebirr-transfer';

type TransactionRow = {
  id: string;
  seller_id: string;
  seller_payout_amount: number | string | null;
};

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

    // Validate and normalize fields
    const normalized = transaction as unknown as TransactionRow;
    const amountRaw = normalized.seller_payout_amount;
    const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid seller payout amount');
    }

    const sellerId: string = String(normalized.seller_id);
    const txId: string = String(normalized.id);

    // Transfer money to seller
    await transferToSeller(amount, sellerId, txId);

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
      user_id: sellerId,
      type: 'payout_completed',
      title: 'Payout Completed',
      message: `Your payout of ${amount} ETB has been processed`,
      metadata: {
        transaction_id: txId,
        amount
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