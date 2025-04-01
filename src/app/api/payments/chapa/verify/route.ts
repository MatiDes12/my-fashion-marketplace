import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Check if this is a cash payment
    if (tx_ref.startsWith('CASH-')) {
      // For cash payments, just fetch the order status from our database
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
    }

    // For Chapa payments, verify with Chapa API
    const verifyResponse = await fetch(
      `https://api.chapa.co/v1/transaction/verify/${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const verifyData = await verifyResponse.json();
    console.log('[CHAPA VERIFY] Full verification response:', verifyData);

    if (!verifyResponse.ok || verifyData.status !== 'success') {
      throw new Error('Payment verification failed');
    }

    // Get receipt URL
    const receiptUrl = verifyData.data?.reference 
      ? `https://checkout.chapa.co/checkout/test-payment-receipt/${verifyData.data.reference}`
      : null;

    console.log('[CHAPA VERIFY] Receipt URL:', receiptUrl);

    return NextResponse.json({
      status: 'success',
      data: {
        ...verifyData.data,
        receipt_url: receiptUrl
      }
    });

  } catch (error) {
    console.error('[CHAPA VERIFY] Error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Verification failed'
      },
      { status: 500 }
    );
  }
} 