import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: Request,
  { params }: { params: { txRef: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get order details with transaction info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        product:products(*),
        user:users!orders_user_id_fkey(*),
        transaction:transactions(*)
      `)
      .eq('tx_ref', params.txRef)
      .single();
      
    if (orderError) throw orderError;

    // Update order and transaction if not already updated
    if (order.order_status === 'delivered' && order.payment_status !== 'paid') {
      // Update order payment status
      await supabase
        .from('orders')
        .update({ 
          payment_status: 'paid'
        })
        .eq('id', order.id);

      // Update transaction statuses
      await supabase
        .from('transactions')
        .update({
          payment_status: 'paid',
          platform_payout_status: 'completed',
          seller_payout_status: 'completed'
        })
        .eq('order_id', order.id);
    }
    
    // Generate HTML receipt
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cash Receipt - ${params.txRef}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .details { margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .total { font-weight: bold; border-top: 2px solid #000; padding-top: 10px; }
            .status { text-align: center; color: green; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Cash Payment Receipt</h1>
              <p>Reference: ${params.txRef}</p>
              <p>Date: ${new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <div class="details">
              <div class="row">
                <span>Product:</span>
                <span>${order.product.title}</span>
              </div>
              <div class="row">
                <span>Quantity:</span>
                <span>${order.quantity}</span>
              </div>
              <div class="row">
                <span>Price per item:</span>
                <span>$${order.product.price}</span>
              </div>
              <div class="row">
                <span>Subtotal:</span>
                <span>$${order.transaction.subtotal}</span>
              </div>
              <div class="row">
                <span>Platform Fee:</span>
                <span>$${order.platform_fee}</span>
              </div>
              <div class="row">
                <span>Service Fee:</span>
                <span>$${order.service_fee}</span>
              </div>
              <div class="row">
                <span>VAT:</span>
                <span>$${order.ethiopia_tax}</span>
              </div>
              <div class="row">
                <span>Delivery Fee:</span>
                <span>$${order.delivery_fee}</span>
              </div>
              <div class="row total">
                <span>Total:</span>
                <span>$${order.total_price}</span>
              </div>
            </div>
            <div class="status">
              <p>✓ Payment Completed</p>
              <p>Order Status: ${order.order_status.toUpperCase()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
    
  } catch (error) {
    console.error('Error generating receipt:', error);
    return new NextResponse('Error generating receipt', { status: 500 });
  }
} 