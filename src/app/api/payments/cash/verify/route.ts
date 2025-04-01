import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Add export config to explicitly mark this as a dynamic route
export const dynamic = 'force-dynamic';

// Use NextRequest instead of Request
export async function GET(request: NextRequest) {
  try {
    // Use NextRequest's nextUrl property instead of URL constructor
    const tx_ref = request.nextUrl.searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Fetch the cash order status
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tx_ref', tx_ref)
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: 'success',
      data: {
        status: order.payment_status,
        tx_ref: order.tx_ref,
        receipt_url: order.receipt_url
      }
    });

  } catch (error) {
    console.error('[CASH VERIFY] Error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Verification failed'
      },
      { status: 500 }
    );
  }
} 