import { createRouteClient } from '@/lib/supabase-route';
import { NextResponse } from 'next/server';

// Add validation function at the top
const validateOrderUpdate = (order: any) => {
  if (!order) throw new Error('Invalid order data');
  if (order.quantity <= 0) throw new Error('Invalid quantity');
  if (order.total_price <= 0) throw new Error('Invalid total price');
  if (order.service_fee < 0) throw new Error('Invalid service fee');
  if (order.platform_fee < 0) throw new Error('Invalid platform fee');
  if (order.delivery_fee < 0) throw new Error('Invalid delivery fee');
  return true;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const supabase = await createRouteClient();

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
      // Get order data first
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('quantity, total_price, service_fee, platform_fee, delivery_fee')
        .eq('tx_ref', MerchantRequestID.split('-')[1])
        .single();

      if (fetchError) throw fetchError;

      // Validate order before updating
      try {
        validateOrderUpdate(order);
      } catch (error) {
        console.error('[MPESA CALLBACK] Validation error:', error);
        throw error;
      }

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