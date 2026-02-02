import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sanitizeForLog } from '@/utils/security';

const supabase = supabaseServer;

// Hardcoded Chapa API URL - never accept from user input
const CHAPA_API_BASE = 'https://api.chapa.co/v1';

// Validate tx_ref format to prevent path traversal and injection
function isValidTxRef(txRef: string): boolean {
  if (!txRef || typeof txRef !== 'string') return false;
  // Allow alphanumeric, hyphens, underscores only, max 100 chars
  return /^[a-zA-Z0-9_-]{1,100}$/.test(txRef);
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Validate tx_ref format to prevent SSRF/injection
    if (!isValidTxRef(tx_ref)) {
      console.error('[CHAPA VERIFY] Invalid tx_ref format:', sanitizeForLog(tx_ref));
      throw new Error('Invalid transaction reference format');
    }

    // Check if this is a cash payment or Stripe payment
    if (tx_ref.startsWith('CASH-') || tx_ref.startsWith('stripe-')) {
      // For cash/Stripe payments, just fetch the order status from our database
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

    // For Chapa payments, verify with Chapa API using hardcoded base URL
    const verifyResponse = await fetch(
      `${CHAPA_API_BASE}/transaction/verify/${encodeURIComponent(tx_ref)}`,
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
      ? `https://checkout.chapa.co/checkout/payment-receipt/${verifyData.data.reference}`
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