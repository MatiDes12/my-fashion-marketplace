import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const notification = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    if (notification.trade_status === 'Completed') {
      // Update withdrawal status
      const { error } = await supabase
        .from('platform_withdrawals')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: `Telebirr transfer completed. Transaction ID: ${notification.trans_id}`
        })
        .eq('id', notification.merch_order_id);

      if (error) throw error;
    }

    return NextResponse.json({ result: 'SUCCESS' });
  } catch (error) {
    console.error('Telebirr withdrawal notification error:', error);
    return NextResponse.json({ result: 'FAIL' }, { status: 500 });
  }
} 