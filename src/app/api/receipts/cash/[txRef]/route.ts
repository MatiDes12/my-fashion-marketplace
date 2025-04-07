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
    
    // Get all orders with this tx_ref
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        product:products(
          id,
          title,
          price,
          owner_id,
          owner:users!products_owner_id_fkey(
            id,
            full_name,
            store_settings
          )
        ),
        user:users!orders_user_id_fkey(*),
        transaction:transactions(*)
      `)
      .eq('tx_ref', params.txRef);
      
    if (ordersError) throw ordersError;
    if (!orders?.length) throw new Error('No orders found');

    // Group orders by seller with null check
    const ordersBySellerMap = orders.reduce((acc: any, order) => {
      const sellerId = order.product?.owner?.id;
      if (!sellerId) return acc; // Skip if no seller ID

      if (!acc[sellerId]) {
        acc[sellerId] = {
          seller: order.product.owner,
          orders: [],
          total: 0
        };
      }
      acc[sellerId].orders.push(order);
      acc[sellerId].total += order.total_price || 0;
      return acc;
    }, {});

    // Check if we have any valid sellers
    if (Object.keys(ordersBySellerMap).length === 0) {
      throw new Error('No valid seller information found');
    }

    // Generate HTML receipt
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cash Receipt - ${params.txRef}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .receipt { max-width: 800px; margin: 0 auto; }
            .seller-section { 
              background: white;
              border: 1px solid #ccc; 
              padding: 20px;
              margin-bottom: 20px;
              border-radius: 8px;
            }
            .header { text-align: center; margin-bottom: 20px; }
            .details { margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .total { font-weight: bold; border-top: 2px solid #000; padding-top: 10px; }
            .status { text-align: center; color: green; margin-top: 20px; }
            .seller-name { 
              font-size: 1.2em;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 15px;
            }
            .product-item {
              border-bottom: 1px solid #eee;
              padding: 10px 0;
            }
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
            .grand-total {
              background: white;
              padding: 20px;
              margin-top: 20px;
              border-radius: 8px;
              text-align: right;
              font-size: 1.2em;
              font-weight: bold;
            }
          </style>
          ${redirectUrl ? `
            <script>
              setTimeout(() => {
                window.location.href = "${decodeURIComponent(redirectUrl)}";
              }, 5000);
            </script>
          ` : ''}
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Cash Payment Receipt</h1>
              <p>Reference: ${params.txRef}</p>
              <p>Date: ${new Date(orders[0].created_at).toLocaleDateString()}</p>
            </div>

            ${Object.values(ordersBySellerMap).map((sellerData: any) => `
              <div class="seller-section">
                <div class="seller-name">
                  ${sellerData.seller.store_settings?.name || sellerData.seller.full_name}
                </div>
                
                ${sellerData.orders.map((order: any) => `
                  <div class="product-item">
                    <div class="row">
                      <span>Product:</span>
                      <span>${order.product.title}</span>
                    </div>
                    ${order.selected_size ? `
                      <div class="row">
                        <span>Size:</span>
                        <span>${order.selected_size}</span>
                      </div>
                    ` : ''}
                    ${order.selected_color ? `
                      <div class="row">
                        <span>Color:</span>
                        <span>${order.selected_color}</span>
                      </div>
                    ` : ''}
                    <div class="row">
                      <span>Quantity:</span>
                      <span>${order.quantity}</span>
                    </div>
                    <div class="row">
                      <span>Price per item:</span>
                      <span>ETB ${order.product.price}</span>
                    </div>
                    <div class="row">
                      <span>Delivery Fee:</span>
                      <span>ETB ${order.delivery_fee.toFixed(2)}</span>
                    </div>
                    <div class="row">
                      <span>Item Total:</span>
                      <span>ETB ${order.total_price.toFixed(2)}</span>
                    </div>
                  </div>
                `).join('')}
                
                <div class="row total">
                  <span>Seller Total:</span>
                  <span>ETB ${sellerData.total.toFixed(2)}</span>
                </div>
              </div>
            `).join('')}

            <div class="grand-total">
              Grand Total: ETB ${orders.reduce((sum, order) => sum + order.total_price, 0).toFixed(2)}
            </div>

            <div class="status">
              <p>✓ Payment Status: PENDING</p>
              <p>Order Status: CONFIRMED</p>
            </div>
            
            <div class="button-container">
              <a href="/orders" class="view-orders-btn">
                View My Orders
              </a>
            </div>
            
            ${redirectUrl ? `
              <div style="text-align: center; margin-top: 20px; color: #666;">
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