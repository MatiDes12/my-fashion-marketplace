import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: Request,
  { params }: { params: { txRef: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectUrl = searchParams.get('redirect');
    
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
            .button-container { text-align: center; margin-top: 30px; }
            .view-orders-btn {
              background-color: #2563eb;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 6px;
              font-weight: 500;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;
            }
            .view-orders-btn:hover {
              background-color: #1d4ed8;
            }
          </style>
          <script>
            // Add auto-redirect after 5 seconds if redirect URL is provided
            ${redirectUrl ? `
              setTimeout(() => {
                window.location.href = "${decodeURIComponent(redirectUrl)}";
              }, 5000);
            ` : ''}
          </script>
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
                <span>ETB ${order.product.price}</span>
              </div>
              <div class="row">
                <span>Subtotal:</span>
                <span>ETB ${(order.quantity * order.product.price).toFixed(2)}</span>
              </div>
              <div class="row">
                <span>Service Fee:</span>
                <span>ETB 0.00</span>
              </div>
              <div class="row">
                <span>Delivery Fee:</span>
                <span>ETB ${order.delivery_fee.toFixed(2)}</span>
              </div>
              <div class="row total">
                <span>Total:</span>
                <span>ETB ${order.total_price.toFixed(2)}</span>
              </div>
            </div>
            <div class="status">
              <p>✓ Payment Status: ${order.payment_status.toUpperCase()}</p>
              <p>Order Status: ${order.order_status.toUpperCase()}</p>
            </div>
            
            <div class="button-container">
              <a href="/orders" class="view-orders-btn">
                View My Orders
              </a>
            </div>
            
            ${redirectUrl ? `
              <div class="mt-4 text-center text-gray-500">
                Redirecting to orders page in 5 seconds...
              </div>
            ` : ''}
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