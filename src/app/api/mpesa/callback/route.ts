import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Extract relevant data from callback
    const {
      Body: {
        stkCallback: {
          MerchantRequestID,
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata
        }
      }
    } = payload;

    if (ResultCode === 0) {
      // Payment successful
      const amount = CallbackMetadata.Item.find((item: any) => item.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = CallbackMetadata.Item.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = CallbackMetadata.Item.find((item: any) => item.Name === 'TransactionDate')?.Value;
      const phoneNumber = CallbackMetadata.Item.find((item: any) => item.Name === 'PhoneNumber')?.Value;

      // Update orders and transactions
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'completed',
          order_status: 'confirmed',
          payment_reference: mpesaReceiptNumber
        })
        .eq('tx_ref', MerchantRequestID.split('-')[1]);

      if (orderError) throw orderError;

      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          payment_status: 'completed',
          transaction_reference: mpesaReceiptNumber,
          transaction_date: new Date(transactionDate).toISOString()
        })
        .eq('tx_ref', MerchantRequestID.split('-')[1]);

      if (transactionError) throw transactionError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('M-PESA callback error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 