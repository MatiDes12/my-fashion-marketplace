import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { generateUniquePickupCode } from '@/utils/pickupCode';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';
import { sanitizeForLog } from '@/utils/security';

// Validate tx_ref format to prevent path traversal and injection
function isValidTxRef(txRef: string): boolean {
  if (!txRef || typeof txRef !== 'string') return false;
  // Allow alphanumeric, hyphens, underscores only, max 100 chars
  return /^[a-zA-Z0-9_-]{1,100}$/.test(txRef);
}

// Hardcoded Chapa API URL - never accept from user input
const CHAPA_API_BASE = 'https://api.chapa.co/v1';

// Create a Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Add validation function
const validateOrderData = (data: any) => {
  if (!data) throw new Error('Invalid order data');
  if (!data.user_id) throw new Error('Missing user ID');
  if (!data.tx_ref) throw new Error('Missing transaction reference');
  if (!Array.isArray(data.sellers)) throw new Error('Invalid sellers data');
  return true;
};

// Track processed transactions to prevent duplicates
const processedTransactions = new Set<string>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tx_ref = searchParams.get('trx_ref') || searchParams.get('tx_ref');
  const status = searchParams.get('status');
  const headersList = await headers();
  const isAjax = headersList.get('X-Requested-With') === 'XMLHttpRequest';

  console.log('[CHAPA CALLBACK] Starting callback processing:', { tx_ref: sanitizeForLog(tx_ref), status });

  try {
    if (!tx_ref) {
      throw new Error('Missing transaction reference');
    }

    // Validate tx_ref format to prevent SSRF/injection
    if (!isValidTxRef(tx_ref)) {
      console.error('[CHAPA CALLBACK] Invalid tx_ref format:', sanitizeForLog(tx_ref));
      throw new Error('Invalid transaction reference format');
    }

    // Check if we've already processed this transaction
    if (processedTransactions.has(tx_ref)) {
      console.log('[CHAPA CALLBACK] Transaction already processed:', tx_ref);
      return handleRedirect(tx_ref, true, isAjax);
    }

    // Add to processed set immediately to prevent duplicate processing
    processedTransactions.add(tx_ref);

    // Verify with Chapa using hardcoded base URL
    const verifyResponse = await fetch(`${CHAPA_API_BASE}/transaction/verify/${encodeURIComponent(tx_ref)}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
        'Content-Type': 'application/json'
      }
    });

    const verifyData = await verifyResponse.json();
    console.log('[CHAPA CALLBACK] Verification response:', verifyData);

    if (verifyResponse.ok && verifyData.status === 'success') {
      const reference = verifyData.data?.reference;
      const receiptUrl = reference 
        ? `https://checkout.chapa.co/checkout/payment-receipt/${reference}`
        : null;

      // Check if order already exists for this tx_ref
      const { data: existingOrders, error: existingOrdersError } = await supabase
        .from('orders')
        .select('id')
        .eq('tx_ref', tx_ref);

      if (existingOrdersError) {
        throw new Error('Failed to check for existing orders');
      }

      // If orders already exist for this tx_ref, return success
      if (existingOrders && existingOrders.length > 0) {
        console.log('[CHAPA CALLBACK] Order already exists for tx_ref:', tx_ref);
        processedTransactions.add(tx_ref);
        return handleRedirect(tx_ref, true, isAjax);
      }

      // Get temporary orders
      const { data: tempOrders, error: tempOrdersError } = await supabase
        .from('temporary_orders')
        .select('*')
        .eq('tx_ref', tx_ref)
        .gt('expires_at', new Date().toISOString());

      if (tempOrdersError || !tempOrders?.length) {
        throw new Error('Temporary orders not found or expired');
      }

      console.log('[CHAPA CALLBACK] Found temporary orders:', tempOrders);

      // Process each temporary order
      for (const tempOrder of tempOrders) {
        try {
          console.log('[CHAPA CALLBACK] Processing order for product:', tempOrder.product_id);

          // Generate a unique tx_ref for this specific order while maintaining link to original payment
          const variantSuffix = tempOrder.selected_variant_sku 
            ? `-${tempOrder.selected_variant_sku.replace(/[^a-zA-Z0-9]/g, '')}` 
            : tempOrder.selected_size 
              ? `-${tempOrder.selected_size.replace(/[^a-zA-Z0-9]/g, '')}` 
              : tempOrder.selected_color 
                ? `-${tempOrder.selected_color.replace(/[^a-zA-Z0-9]/g, '')}` 
                : '-default';
          
          const uniqueOrderTxRef = `${tx_ref}-${tempOrder.product_id.substring(0, 8)}${variantSuffix}`;
          
          // Check if this specific order was already processed
          const { data: existingOrder, error: existingOrderError } = await supabase
            .from('orders')
            .select('id')
            .eq('tx_ref', uniqueOrderTxRef)
            .single();

          if (existingOrderError && existingOrderError.code !== 'PGRST116') {
            console.error('[CHAPA CALLBACK] Error checking existing order:', existingOrderError);
            continue;
          }

          if (existingOrder) {
            console.log('[CHAPA CALLBACK] Order already exists for product:', tempOrder.product_id, 'with variant:', {
              sku: tempOrder.selected_variant_sku,
              size: tempOrder.selected_size,
              color: tempOrder.selected_color
            });
            continue;
          }

        // Check product availability first
        const { data: product, error: productCheckError } = await supabase
          .from('products')
            .select('quantity, available_variants')
          .eq('id', tempOrder.product_id)
          .single();

        if (productCheckError) {
          console.error('[CHAPA CALLBACK] Error checking product availability:', productCheckError);
          continue;
        }

        if (!product || (product.quantity || 0) < tempOrder.quantity) {
          console.error('[CHAPA CALLBACK] Insufficient quantity available for product:', tempOrder.product_id);
          continue;
        }

          // Create order with unique tx_ref
          const pickupCode = tempOrder.delivery_method === 'store_pickup' 
            ? await generateUniquePickupCode()
            : null;

        // Check if this is a shared cart order
        const isSharedCart = tempOrder.metadata?.is_shared_cart;
        const shareCode = tempOrder.metadata?.share_code;
        const purchaserEmail = tempOrder.metadata?.purchaser_email;
        const purchaserName = tempOrder.metadata?.purchaser_name;
        const sharedCartId = tempOrder.metadata?.shared_cart_id;

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: tempOrder.user_id,
            product_id: tempOrder.product_id,
            quantity: tempOrder.quantity,
            total_price: tempOrder.total_price,
            platform_fee: tempOrder.platform_fee,
            service_fee: tempOrder.service_fee,
            ethiopia_tax: tempOrder.ethiopia_tax,
            delivery_fee: tempOrder.delivery_fee,
              tx_ref: uniqueOrderTxRef,
            payment_status: 'paid',
            order_status: 'confirmed',
            payment_reference: reference,
            receipt_url: receiptUrl,
            delivery_method: tempOrder.delivery_method,
            delivery_address: tempOrder.delivery_address,
            selected_size: tempOrder.selected_size,
            selected_color: tempOrder.selected_color,
              selected_variant_sku: tempOrder.selected_variant_sku,
              pickup_code: pickupCode,
              // Add shared cart fields if applicable
              ...(isSharedCart && {
                purchased_by: purchaserEmail,
                purchased_by_name: purchaserName,
                shared_cart_id: sharedCartId
              })
          })
          .select()
          .single();

        if (orderError) {
          console.error('[CHAPA CALLBACK] Error creating order:', orderError);
            throw orderError;
        }

          console.log('[CHAPA CALLBACK] Created order:', order);

        // Update product quantity - only if not already updated
        const { data: currentProduct, error: currentProductError } = await supabase
          .from('products')
          .select('quantity, available_variants')
          .eq('id', tempOrder.product_id)
          .single();

        if (!currentProductError && currentProduct) {
          // Check if quantity has already been reduced (to prevent double updates)
          const expectedQuantity = (product.quantity || 0) - tempOrder.quantity;
          if (currentProduct.quantity === expectedQuantity) {
            console.log('[CHAPA CALLBACK] Product quantity already updated for product:', tempOrder.product_id);
          } else {
            let newQuantity = Math.max(0, (currentProduct.quantity || 0) - tempOrder.quantity);
            let newVariants = currentProduct.available_variants;

            // Update variant quantity if applicable
            if (tempOrder.selected_variant_sku && Array.isArray(newVariants)) {
              newVariants = newVariants.map((variant: any) => {
                if (variant.sku === tempOrder.selected_variant_sku) {
                  return {
                    ...variant,
                    quantity: Math.max(0, (variant.quantity || 0) - tempOrder.quantity)
                  };
                }
                return variant;
              });
            }
          
            const { error: quantityUpdateError } = await supabase
              .from('products')
              .update({ 
                quantity: newQuantity,
                available_variants: newVariants,
                updated_at: new Date().toISOString()
              })
              .eq('id', tempOrder.product_id);

            if (quantityUpdateError) {
              console.error('[CHAPA CALLBACK] Error updating product quantity:', quantityUpdateError);
            } else {
              console.log('[CHAPA CALLBACK] Successfully updated product quantity for product:', tempOrder.product_id, 'New quantity:', newQuantity);
            }
          }
        }

        // Create transaction
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            order_id: order.id,
            payment_method: 'CHAPA',
            payment_status: 'paid',
              payment_type: 'order',
            subtotal: tempOrder.total_price - tempOrder.delivery_fee,
            platform_fee: tempOrder.platform_fee,
            service_fee: tempOrder.service_fee,
            vat_amount: tempOrder.ethiopia_tax,
            delivery_fee: tempOrder.delivery_fee,
            total_amount: tempOrder.total_price,
            seller_id: tempOrder.seller_id,
            customer_name: verifyData.data.first_name + ' ' + verifyData.data.last_name,
            customer_email: verifyData.data.email,
            customer_phone: tempOrder.customer_phone,
            seller_payout_amount: tempOrder.total_price - tempOrder.service_fee,
            seller_payout_status: 'pending',
            platform_payout_status: 'completed'
          });

        if (transactionError) {
          console.error('[CHAPA CALLBACK] Error creating transaction:', transactionError);
        }

        // Send Telegram notification for Chapa payment confirmation
        try {
          const config = await getTelegramConfig();
          const bot = new TelegramBot(config);
          
          // Get user details for notification
          const { data: user } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', tempOrder.user_id)
            .single();

          // Get product details
          const { data: product } = await supabase
            .from('products')
            .select('title, price')
            .eq('id', tempOrder.product_id)
            .single();

          const paymentData = {
            orderId: order.id,
            txRef: uniqueOrderTxRef,
            amount: tempOrder.total_price,
            paymentMethod: 'CHAPA',
            status: 'paid',
            customerName: user?.full_name || verifyData.data.first_name + ' ' + verifyData.data.last_name,
            customerEmail: user?.email || verifyData.data.email,
            productName: product?.title || 'Product',
            receiptUrl: receiptUrl,
            orderStatus: 'confirmed',
            createdAt: order.created_at,
            reference: reference
          };

          await bot.sendPaymentNotification(tempOrder.user_id, paymentData);
          console.log('[CHAPA CALLBACK] Telegram payment notification sent for order:', order.id);
          
          // Also send order confirmation notification
          const orderData = {
            orderId: order.id,
            productName: product?.title || 'Product',
            quantity: tempOrder.quantity,
            amount: tempOrder.total_price,
            orderStatus: 'confirmed',
            paymentStatus: 'paid',
            customerName: user?.full_name || verifyData.data.first_name + ' ' + verifyData.data.last_name,
            customerEmail: user?.email || verifyData.data.email,
            deliveryMethod: tempOrder.delivery_method,
            deliveryAddress: tempOrder.delivery_address,
            pickupCode: pickupCode,
            createdAt: order.created_at
          };
          
          await bot.sendOrderConfirmation(tempOrder.user_id, orderData);
          console.log('[CHAPA CALLBACK] Telegram order confirmation sent for order:', order.id);

          // Send receipt notification
          const receiptData = {
            orderId: order.id,
            txRef: uniqueOrderTxRef,
            amount: tempOrder.total_price,
            subtotal: tempOrder.total_price - tempOrder.delivery_fee,
            serviceFee: tempOrder.service_fee,
            deliveryFee: tempOrder.delivery_fee,
            paymentMethod: 'CHAPA',
            customerName: user?.full_name || verifyData.data.first_name + ' ' + verifyData.data.last_name,
            customerEmail: user?.email || verifyData.data.email,
            customerPhone: tempOrder.customer_phone || 'N/A',
            productName: product?.title || 'Product',
            quantity: tempOrder.quantity,
            deliveryMethod: tempOrder.delivery_method,
            deliveryAddress: tempOrder.delivery_address,
            pickupCode: pickupCode,
            receiptUrl: receiptUrl,
            createdAt: order.created_at
          };
          
          await bot.sendReceipt(tempOrder.user_id, receiptData);
          console.log('[CHAPA CALLBACK] Telegram receipt sent for order:', order.id);
                  } catch (telegramError) {
            console.error('[CHAPA CALLBACK] Error sending Telegram notification:', telegramError);
            // Don't fail the order creation if Telegram notification fails
          }

          // Note: Product quantities are already updated above in the first quantity update block
          // No need to update again here to prevent double quantity decrease

          console.log('[CHAPA CALLBACK] Successfully processed order for product:', tempOrder.product_id);
        } catch (error) {
          console.error('[CHAPA CALLBACK] Error processing order:', error);
          // Continue with next order even if this one fails
          continue;
        }
      }

      // Delete temporary orders only after all are processed
      const { error: deleteError } = await supabase
        .from('temporary_orders')
        .delete()
        .eq('tx_ref', tx_ref);

      if (deleteError) {
        console.error('[CHAPA CALLBACK] Error deleting temporary orders:', deleteError);
      }

      // Handle shared cart cleanup if applicable
      const firstTempOrder = tempOrders[0];
      if (firstTempOrder?.metadata?.is_shared_cart) {
        const shareCode = firstTempOrder.metadata.share_code;
        const sharedCartId = firstTempOrder.metadata.shared_cart_id;
        
        console.log('[CHAPA CALLBACK] Processing shared cart cleanup for shared_cart_id:', sharedCartId);
        
        // Mark shared cart as used
        if (sharedCartId) {
          const { error: updateError } = await supabase
            .from('shared_carts')
            .update({
              is_used: true,
              used_at: new Date().toISOString(),
              used_by_email: firstTempOrder.metadata.purchaser_email,
              used_by_name: firstTempOrder.metadata.purchaser_name
            })
            .eq('id', sharedCartId);

          if (updateError) {
            console.error('[CHAPA CALLBACK] Error marking shared cart as used:', updateError);
          } else {
            console.log('[CHAPA CALLBACK] Successfully marked shared cart as used');
          }
        }

        // Remove shared cart items from original user's cart
        if (sharedCartId) {
          console.log('[CHAPA CALLBACK] Removing shared cart items with shared_cart_id:', sharedCartId);
          
          // First, let's check what items exist with shared_cart_id
          const { data: existingSharedItems, error: checkSharedError } = await supabase
            .from('cart_items')
            .select('id, product_id, quantity')
            .eq('shared_cart_id', sharedCartId);

          if (checkSharedError) {
            console.error('[CHAPA CALLBACK] Error checking existing shared cart items:', checkSharedError);
          } else {
            console.log('[CHAPA CALLBACK] Found shared cart items to remove:', existingSharedItems?.length || 0, 'items');
          }

          // Get all product IDs from the shared cart purchase
          const purchasedProductIds = tempOrders.map(order => order.product_id);
          console.log('[CHAPA CALLBACK] Purchased product IDs:', purchasedProductIds);

          // Remove items by shared_cart_id first
          const { data: deletedSharedItems, error: deleteSharedError } = await supabase
            .from('cart_items')
            .delete()
            .eq('shared_cart_id', sharedCartId)
            .select();

          if (deleteSharedError) {
            console.error('[CHAPA CALLBACK] Error removing shared cart items:', deleteSharedError);
          } else {
            console.log('[CHAPA CALLBACK] Successfully removed shared cart items:', deletedSharedItems?.length || 0, 'items');
          }

          // Also remove any cart items for the same products (in case they weren't properly tagged)
          if (purchasedProductIds.length > 0) {
            console.log('[CHAPA CALLBACK] Removing any remaining cart items for purchased products');
            const { data: deletedProductItems, error: deleteProductError } = await supabase
              .from('cart_items')
              .delete()
              .in('product_id', purchasedProductIds)
              .eq('user_id', tempOrders[0].user_id)
              .select();

            if (deleteProductError) {
              console.error('[CHAPA CALLBACK] Error removing product cart items:', deleteProductError);
            } else {
              console.log('[CHAPA CALLBACK] Successfully removed product cart items:', deletedProductItems?.length || 0, 'items');
            }
          }
        }
      } else {
        // Clear cart items for the user (only for regular orders, not shared cart orders)
        console.log('[CHAPA CALLBACK] Clearing regular cart for user_id:', tempOrders[0].user_id);
        const { error: cartError } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', tempOrders[0].user_id);

        if (cartError) {
          console.error('[CHAPA CALLBACK] Error clearing regular cart:', cartError);
        } else {
          console.log('[CHAPA CALLBACK] Successfully cleared regular cart');
        }
      }

      console.log('[CHAPA CALLBACK] Successfully processed all orders and transactions');

      return handleRedirect(tx_ref, true, isAjax);
    }

    throw new Error('Payment verification failed');

  } catch (error) {
    console.error('[CHAPA CALLBACK] Error:', error);
    return handleRedirect(tx_ref, false, isAjax);
  }
}

// Helper function to handle redirects based on request type
function handleRedirect(tx_ref: string | null, success: boolean, isAjax: boolean) {
  const redirectUrl = success
    ? `/orders?payment_success=true&tx_ref=${tx_ref}`
    : `/cart?payment_error=true&tx_ref=${tx_ref}`;

  if (isAjax) {
    return NextResponse.json({ success, redirectUrl });
  }

  return NextResponse.redirect(new URL(redirectUrl, process.env.NEXT_PUBLIC_SITE_URL));
}

// Update POST handler to use the same redirect handling
export async function POST(request: Request) {
  const headersList = await headers();
  const isAjax = headersList.get('X-Requested-With') === 'XMLHttpRequest';

  try {
    const body = await request.json();
    const tx_ref = body.tx_ref;

    // Check if already processed
    if (processedTransactions.has(tx_ref)) {
      return handleRedirect(tx_ref, true, isAjax);
    }

    // Validate tx_ref format to prevent SSRF/injection
    if (!isValidTxRef(tx_ref)) {
      console.error('[CHAPA CALLBACK] Invalid tx_ref format in POST:', sanitizeForLog(tx_ref));
      throw new Error('Invalid transaction reference format');
    }

    // Verify the payment with Chapa using hardcoded base URL
    const verifyResponse = await fetch(
      `${CHAPA_API_BASE}/transaction/verify/${encodeURIComponent(tx_ref)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const verifyData = await verifyResponse.json();
    
    if (verifyResponse.ok && verifyData.status === 'success') {
      processedTransactions.add(tx_ref);
      return handleRedirect(tx_ref, true, isAjax);
    }

    throw new Error('Payment verification failed');
  } catch (error) {
    console.error('[CHAPA CALLBACK] Error:', error);
    return handleRedirect(null, false, isAjax);
  }
} 