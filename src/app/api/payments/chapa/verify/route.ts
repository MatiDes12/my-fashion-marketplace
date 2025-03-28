import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Transaction reference is required');
    }

    // Verify with Chapa
    const verifyResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
        'Content-Type': 'application/json'
      }
    });

    const verifyData = await verifyResponse.json();
    console.log('[CHAPA VERIFY] Full verification response:', verifyData);

    if (verifyResponse.ok && verifyData.status === 'success') {
      // Check for receipt URL in different possible locations
      const reference = verifyData.data?.reference;
      const receiptUrl = verifyData.data?.receipt_url || 
                        verifyData.data?.receipt ||
                        (reference ? `https://checkout.chapa.co/checkout/test-payment-receipt/${reference}` : null);

      console.log('[CHAPA VERIFY] Receipt URL:', receiptUrl);

      return NextResponse.json({
        status: verifyData.data.status === 'success' ? 'success' : 'pending',
        data: {
          ...verifyData.data,
          receipt_url: receiptUrl
        }
      });
    }

    throw new Error('Payment verification failed');
  } catch (error) {
    console.error('[CHAPA VERIFY] Error:', error);
    return NextResponse.json(
      { 
        status: 'failed',
        error: error instanceof Error ? error.message : 'Verification failed' 
      },
      { status: 500 }
    );
  }
} 