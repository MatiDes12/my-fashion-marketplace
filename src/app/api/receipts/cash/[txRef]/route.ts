import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { escapeHtml, isValidIdentifier } from '@/utils/security';

// Validate redirect URL - only allow relative paths to prevent open redirect
function sanitizeRedirectUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const decoded = decodeURIComponent(url);
    // Only allow relative paths starting with /
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
      // Remove any script injection attempts
      const sanitized = decoded.replace(/[<>"'`]/g, '');
      return sanitized;
    }
    return '/orders'; // Default safe redirect
  } catch {
    return '/orders';
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ txRef: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const rawRedirectUrl = searchParams.get('redirect');
    const redirectUrl = sanitizeRedirectUrl(rawRedirectUrl);

    const resolvedParams = await params;
    const txRef = resolvedParams.txRef;

    // Validate txRef format to prevent injection
    if (!txRef || !isValidIdentifier(txRef, 100)) {
      return new NextResponse('Invalid transaction reference', { status: 400 });
    }
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get all orders with this tx_ref or tx_refs that start with the base tx_ref
    // Extract the base CASH reference: CASH-timestamp-random
    const txRefParts = txRef.split('-');
    const baseTxRef = txRefParts.length >= 3 
      ? `${txRefParts[0]}-${txRefParts[1]}-${txRefParts[2]}`
      : txRef;
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        product:products(
          id,
          title,
          price,
          owner_id,
          available_variants,
          owner:users!products_owner_id_fkey(
            id,
            full_name,
            store_settings
          )
        ),
        user:users!orders_user_id_fkey(*),
        transaction:transactions(*)
      `)
      .or(`tx_ref.eq.${txRef},tx_ref.like.${baseTxRef}-%`);
      
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

    // Function to format item display with transaction data
    const formatItemDisplay = (order: any) => {
      const transaction = order.transaction && order.transaction.length > 0 ? order.transaction[0] : null;
      const itemSubtotal = transaction?.subtotal || (order.quantity * order.product.price);
      const itemTotal = transaction?.total_amount || order.total_price;
      const hasFlashSale = transaction?.flash_sale_applied;
      
      return `
        <div class="item">
          <div class="item-title">${order.product.title}</div>
          <div class="item-store">
            Store: ${order.product.owner?.store_settings?.name || order.product.owner?.full_name}
          </div>
          <div class="item-delivery">
            Method: ${order.delivery_method === 'home_delivery' ? 'HOME DELIVERY' : 'STORE PICKUP'}
          </div>
          ${(order.selected_size || order.selected_color || order.selected_variant_sku) ? `
            <div class="item-variant">
              ${order.selected_variant_sku ? `Variant: ${order.selected_variant_sku}` : ''}
              ${order.selected_size ? `Size: ${order.selected_size}` : ''}
              ${order.selected_color ? `Color: ${order.selected_color}` : ''}
            </div>
          ` : ''}
          <div class="item-details">
            <span>Qty: ${order.quantity}</span>
            ${hasFlashSale ? `
              <span>
                <span class="original-price">@ ETB ${transaction.original_price?.toFixed(2)}</span>
                <span class="flash-sale-price">@ ETB ${transaction.flash_sale_price?.toFixed(2)}</span>
                <span class="flash-sale-badge">FLASH SALE</span>
              </span>
            ` : `
              <span>@ ETB ${order.product.price?.toFixed(2)}</span>
            `}
          </div>
          <div class="item-details">
            <span>Subtotal:</span>
            ${hasFlashSale ? `
              <span>
                <span class="original-price">ETB ${(order.quantity * transaction.original_price)?.toFixed(2)}</span>
                <span class="flash-sale-price">ETB ${itemSubtotal?.toFixed(2)}</span>
              </span>
            ` : `
              <span>ETB ${itemSubtotal?.toFixed(2)}</span>
            `}
          </div>
          ${order.delivery_fee > 0 ? `
            <div class="item-details">
              <span>Delivery Fee:</span>
              <span>ETB ${order.delivery_fee?.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="item-details">
            <span>Item Total:</span>
            <span>ETB ${itemTotal?.toFixed(2)}</span>
          </div>
          ${hasFlashSale ? `
            <div class="item-details" style="font-size: 10px; color: #e53e3e; margin-top: 5px;">
              <span>Flash Sale: ${transaction.flash_sale_title} (${transaction.flash_sale_discount_percentage}% off)</span>
            </div>
          ` : ''}
          ${order.delivery_method === 'store_pickup' && order.pickup_code ? `
            <div class="pickup-code">
              <div class="pickup-code-title">Pickup Code:</div>
              <div class="pickup-code-value">${order.pickup_code}</div>
              <div class="pickup-code-info">Show this code to the seller when picking up your order</div>
            </div>
          ` : ''}
        </div>
      `;
    };
    
    // Generate HTML receipt
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${escapeHtml(txRef)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              background: white;
              color: black;
              line-height: 1.3;
              font-size: 14px;
            }
            .receipt { 
              max-width: 500px; 
              margin: 0 auto; 
              background: white;
              padding: 25px;
              border: 1px solid #ccc; 
            }
            .header { 
              text-align: center; 
              margin-bottom: 25px;
              border-bottom: 1px solid #000;
              padding-bottom: 15px;
            }
            .store-name { 
              font-size: 22px; 
              font-weight: bold;
              margin-bottom: 8px;
            }
            .store-info { 
              font-size: 12px;
              margin-bottom: 6px;
            }
            .divider { 
              border-top: 1px solid #000; 
              margin: 15px 0;
            }
            .transaction-info {
              margin-bottom: 20px;
            }
            .transaction-info div {
              margin-bottom: 5px;
              font-size: 14px;
            }
            .items-section {
              margin-bottom: 20px;
            }
            .item {
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px dotted #ccc;
            }
            .item-title {
              font-weight: bold;
              margin-bottom: 5px;
              font-size: 16px;
            }
            .item-store {
              font-size: 12px;
              color: #333;
              margin-bottom: 4px;
              font-style: italic;
            }
            .item-delivery {
              font-size: 12px;
              color: #666;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .item-variant {
              font-size: 12px;
              color: #666;
              margin-bottom: 4px;
            }
            .item-details {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin-bottom: 3px;
            }
            .original-price {
              text-decoration: line-through;
              color: #999;
              font-size: 11px;
            }
            .flash-sale-price {
              color: #e53e3e;
              font-weight: bold;
            }
            .flash-sale-badge {
              background: #e53e3e;
              color: white;
              padding: 2px 6px;
              font-size: 10px;
              border-radius: 3px;
              margin-left: 8px;
            }
            .totals-section {
              border-top: 2px solid #000;
              padding-top: 15px;
              margin-bottom: 20px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              font-size: 14px;
            }
            .grand-total {
              font-weight: bold;
              font-size: 16px;
              border-top: 1px solid #000;
              padding-top: 8px;
            }
            .status-section {
              text-align: center;
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #000;
              font-size: 14px;
            }
            .status-section div {
              margin-bottom: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 25px;
              font-size: 12px;
              color: #666;
            }
            .footer div {
              margin-bottom: 5px;
            }
            .button-container { 
              text-align: center; 
              margin-top: 25px; 
            }
            .view-orders-btn {
              background: #000;
              color: white;
              padding: 12px 25px;
              border: none;
              font-family: 'Courier New', monospace;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;
              font-size: 14px;
            }
            @media print {
              .button-container { display: none; }
              body { background: white; }
            }
            .pickup-code {
              margin-top: 10px;
              padding: 10px;
              border: 2px dashed #000;
              text-align: center;
            }
            .pickup-code-title {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 5px;
            }
            .pickup-code-value {
              font-family: monospace;
              font-size: 24px;
              font-weight: bold;
              letter-spacing: 2px;
              margin: 5px 0;
            }
            .pickup-code-info {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }
          </style>
          ${redirectUrl ? `
            <script>
              setTimeout(() => {
                window.location.href = ${JSON.stringify(redirectUrl)};
              }, 8000);
            </script>
          ` : ''}
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="store-name">AVRIO SHOP</div>
              <div class="store-info">Online Marketplace for all your needs</div>
              <div class="store-info">www.avrioxshop.com</div>
              <div class="store-info">support@avrioxshop.com</div>
            </div>

            <div class="divider"></div>

            <div class="transaction-info">
              <div>Date: ${new Date(orders[0].created_at).toLocaleDateString('en-US', { 
                month: '2-digit', 
                day: '2-digit', 
                year: 'numeric'
              })}</div>
              <div>Time: ${new Date(orders[0].created_at).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit'
              })}</div>
              <div>Transaction: ${escapeHtml(txRef)}</div>
              <div>Customer: ${orders[0].user?.full_name || 'N/A'}</div>
              <div>Payment Method: CASH</div>
                </div>
                
            <div class="divider"></div>

            <div class="items-section">
              ${Object.values(ordersBySellerMap).map((sellerData: any) => `
                ${sellerData.orders.map((order: any) => `
                  ${formatItemDisplay(order)}
                `).join('')}
              `).join('')}
              </div>

            <div class="totals-section">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>ETB ${orders.reduce((sum, order) => {
                  const transaction = order.transaction && order.transaction.length > 0 ? order.transaction[0] : null;
                  return sum + (transaction?.subtotal || (order.quantity * order.product.price));
                }, 0).toFixed(2)}</span>
              </div>
              <div class="total-row">
                      <span>Delivery Fee:</span>
                <span>ETB ${orders.reduce((sum, order) => sum + (order.delivery_fee || 0), 0).toFixed(2)}</span>
              </div>
              <div class="total-row grand-total">
                <span>TOTAL:</span>
                <span>ETB ${orders.reduce((sum, order) => {
                  const transaction = order.transaction && order.transaction.length > 0 ? order.transaction[0] : null;
                  return sum + (transaction?.total_amount || order.total_price || 0);
                }, 0).toFixed(2)}</span>
              </div>
              </div>

            <div class="divider"></div>

            <div class="status-section">
              <div>PAYMENT STATUS: PENDING</div>
              <div>ORDER STATUS: CONFIRMED</div>
              <div>Please prepare cash for delivery/pickup</div>
            </div>

            <div class="divider"></div>

            <div class="footer">
              <div>Thank you for your purchase!</div>
              <div>For support, contact us at support@avrioxshop.com</div>
              <div>Visit www.avrioxshop.com for more products</div>
            </div>
            
            <div class="button-container">
              <a href="/orders" class="view-orders-btn">
                VIEW MY ORDERS
              </a>
            ${redirectUrl ? `
                <div style="text-align: center; margin-top: 10px; font-size: 10px; color: #666;">
                  Redirecting to orders page in 8 seconds...
              </div>
            ` : ''}
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