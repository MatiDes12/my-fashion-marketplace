import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route';
import { supabaseServer } from '@/lib/supabase-server';
import { transferToSeller } from '@/utils/telebirr-transfer';
import { auditLog } from '@/lib/audit-logger';

type TransactionRow = {
  id: string;
  seller_id: string;
  seller_payout_amount: number | string | null;
};

export async function POST(request: Request) {
  try {
    // Verify admin authentication
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { transactionId } = await request.json();

    // Get transaction details
    const { data: transaction, error: txError } = await supabaseServer
      .from('transactions')
      .select('id, seller_id, seller_payout_amount')
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

    auditLog({
      level: 'info',
      category: 'admin',
      action: 'payout.approved',
      message: `Admin approved payout of ${amount} ETB to seller ${sellerId}`,
      user_id: user.id,
      metadata: { transaction_id: txId, amount, seller_id: sellerId },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    auditLog({
      level: 'error',
      category: 'admin',
      action: 'payout.approve.failed',
      message: `Payout approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    console.error('Payout approval error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process payout' },
      { status: 500 }
    );
  }
} 