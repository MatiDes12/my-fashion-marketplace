import { NextResponse } from 'next/server';
import { supabaseServerAnon } from '@/lib/supabase-server';

const supabase = supabaseServerAnon;

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Update transaction status
    const { error: txError } = await supabase
      .from('transactions')
      .update({
        seller_payout_status: payload.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.transaction_id);

    if (txError) {
      throw new Error('Failed to update transaction');
    }

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: payload.seller_id,
      type: 'withdrawal_status',
      title: 'Withdrawal Status Update',
      message: `Your withdrawal status has been updated to: ${payload.status}`,
      metadata: {
        transaction_id: payload.transaction_id,
        status: payload.status
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Withdrawal notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process withdrawal notification' },
      { status: 500 }
    );
  }
}
