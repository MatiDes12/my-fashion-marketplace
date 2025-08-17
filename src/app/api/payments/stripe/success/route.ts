import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateUniquePickupCode } from '@/utils/pickupCode';
import { checkRateLimit } from '@/lib/rateLimiter';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting protection
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('cf-connecting-ip') || 
                     'unknown';
    if (!checkRateLimit(`stripe-success:${clientIP}`, 10, 60000)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    // Enhanced validation: Check session ID format
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return NextResponse.redirect(
        new URL('/checkout?error=invalid_session_id', request.url)
      );
    }
    if (!stripe) {
      return NextResponse.redirect(
        new URL('/checkout?error=stripe_unavailable', request.url)
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    if (!session || session.payment_status !== 'paid') {
      return NextResponse.redirect(
        new URL('/checkout?error=payment_not_completed', request.url)
      );
    }

    const txRef = session.metadata?.tx_ref;
    const userId = session.metadata?.user_id;

    if (!txRef || !userId) {
      return NextResponse.redirect(
        new URL('/checkout?error=invalid_session_data', request.url)
      );
    }

    const supabase = createServerComponentClient({ cookies });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      return NextResponse.redirect(
        new URL('/login?error=unauthorized_payment', request.url)
      );
    }

    // Check if orders have already been created for this session
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_reference', sessionId)
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      // Orders already created, redirect to receipt page
      return NextResponse.redirect(
        new URL(`/api/receipts/stripe/${txRef}?redirect=${encodeURIComponent('/orders?payment_success=true&tx_ref=' + txRef)}`, request.url)
      );
    }

    // Get temporary orders
    const { data: tempOrders, error: tempOrderError } = await supabase
      .from('temporary_orders')
      .select('*')
      .eq('tx_ref', txRef)
      .eq('user_id', userId);

    if (tempOrderError || !tempOrders || tempOrders.length === 0) {
      console.error('Error fetching temporary orders:', tempOrderError);
      return NextResponse.redirect(
        new URL('/checkout?error=orders_not_found', request.url)
      );
    }

    // Create actual orders from temporary orders
    for (const tempOrder of tempOrders) {
      // Check for active flash sale for this product
      const { data: flashSaleData } = await supabase
        .from('flash_sale_products')
        .select(`
          special_price,
          flash_sales!inner (
            id,
            title,
            discount_percentage,
            start_time,
            end_time,
            is_active
          )
        `)
        .eq('product_id', tempOrder.product_id)
        .eq('flash_sales.is_active', true)
        .gte('flash_sales.end_time', new Date().toISOString())
        .lte('flash_sales.start_time', new Date().toISOString())
        .single();

      // Determine pricing
      const originalPrice = tempOrder.total_price / tempOrder.quantity;
      const flashSalePrice = flashSaleData?.special_price ? Number(flashSaleData.special_price) : null;
      const hasFlashSale = flashSalePrice !== null && flashSalePrice < originalPrice;
      const actualPrice = hasFlashSale ? flashSalePrice : originalPrice;
      
      // Calculate amounts
      const itemSubtotal = Number((tempOrder.quantity * actualPrice).toFixed(2));
      const serviceFee = Number((itemSubtotal * 0.03).toFixed(2));
      const itemTotal = Number((itemSubtotal + tempOrder.delivery_fee).toFixed(2));
      const sellerPayoutAmount = Number((itemTotal - serviceFee).toFixed(2));

      // Generate pickup code if needed
      const pickupCode = tempOrder.delivery_method === 'store_pickup' 
        ? await generateUniquePickupCode()
        : null;

                    // Create receipt URL for Stripe payment
      const receiptUrl = `/api/receipts/stripe/${txRef}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: tempOrder.user_id,
          product_id: tempOrder.product_id,
          quantity: tempOrder.quantity,
          total_price: itemTotal,
          platform_fee: 0,
          service_fee: serviceFee,
          ethiopia_tax: 0,
          delivery_fee: tempOrder.delivery_fee,
          order_status: 'confirmed',
          payment_status: 'paid',
          payment_reference: sessionId,
          tx_ref: txRef,
          receipt_url: receiptUrl,
          delivery_method: tempOrder.delivery_method,
          delivery_address: tempOrder.delivery_address,
          selected_size: tempOrder.selected_size,
          selected_color: tempOrder.selected_color,
          selected_variant_sku: tempOrder.selected_variant_sku,
          pickup_code: pickupCode
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        continue;
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          order_id: order.id,
          payment_method: 'STRIPE',
          payment_status: 'paid',
          payment_type: 'order',
          subtotal: itemSubtotal,
          platform_fee: 0,
          service_fee: serviceFee,
          vat_amount: 0,
          delivery_fee: tempOrder.delivery_fee,
          total_amount: itemTotal,
          seller_id: tempOrder.seller_id,
          customer_name: session.customer_details?.name || '',
          customer_email: session.customer_details?.email || '',
          customer_phone: tempOrder.customer_phone,
          seller_payout_amount: sellerPayoutAmount,
          seller_payout_status: 'pending',
          platform_payout_status: 'completed',
          flash_sale_applied: hasFlashSale,
          original_price: hasFlashSale ? originalPrice : null,
          flash_sale_price: hasFlashSale ? flashSalePrice : null,
          flash_sale_discount_percentage: hasFlashSale && flashSaleData?.flash_sales?.[0]?.discount_percentage 
            ? flashSaleData.flash_sales[0].discount_percentage 
            : null,
          flash_sale_title: hasFlashSale && flashSaleData?.flash_sales?.[0]?.title 
            ? flashSaleData.flash_sales[0].title 
            : null
        });

      if (transactionError) {
        console.error('Error creating transaction:', transactionError);
      }

      // Send Telegram notifications for Stripe payment confirmation
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
          txRef: txRef,
          amount: itemTotal,
          paymentMethod: 'STRIPE',
          status: 'paid',
          customerName: session.customer_details?.name || user?.full_name || 'Customer',
          customerEmail: session.customer_details?.email || user?.email || 'N/A',
          productName: product?.title || 'Product',
          receiptUrl: receiptUrl,
          orderStatus: 'confirmed',
          createdAt: order.created_at,
          reference: sessionId
        };

        await bot.sendPaymentNotification(tempOrder.user_id, paymentData);
        console.log('[STRIPE SUCCESS] Telegram payment notification sent for order:', order.id);
        
        // Also send order confirmation notification
        const orderData = {
          orderId: order.id,
          productName: product?.title || 'Product',
          quantity: tempOrder.quantity,
          amount: itemTotal,
          orderStatus: 'confirmed',
          paymentStatus: 'paid',
          customerName: session.customer_details?.name || user?.full_name || 'Customer',
          customerEmail: session.customer_details?.email || user?.email || 'N/A',
          deliveryMethod: tempOrder.delivery_method,
          deliveryAddress: tempOrder.delivery_address,
          pickupCode: pickupCode,
          createdAt: order.created_at
        };
        
        await bot.sendOrderConfirmation(tempOrder.user_id, orderData);
        console.log('[STRIPE SUCCESS] Telegram order confirmation sent for order:', order.id);

        // Send receipt notification
        const receiptData = {
          orderId: order.id,
          txRef: txRef,
          amount: itemTotal,
          subtotal: itemSubtotal,
          serviceFee: serviceFee,
          deliveryFee: tempOrder.delivery_fee,
          paymentMethod: 'STRIPE',
          customerName: session.customer_details?.name || user?.full_name || 'Customer',
          customerEmail: session.customer_details?.email || user?.email || 'N/A',
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
        console.log('[STRIPE SUCCESS] Telegram receipt sent for order:', order.id);
      } catch (telegramError) {
        console.error('[STRIPE SUCCESS] Error sending Telegram notification:', telegramError);
        // Don't fail the order creation if Telegram notification fails
      }

      // Update product quantities manually
      const { data: currentProduct, error: fetchError } = await supabase
        .from('products')
        .select('quantity, available_variants')
        .eq('id', tempOrder.product_id)
        .single();

      if (!fetchError && currentProduct) {
        const newQuantity = Math.max(0, (currentProduct.quantity || 0) - tempOrder.quantity);
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

        await supabase
          .from('products')
          .update({
            quantity: newQuantity,
            available_variants: newVariants,
            updated_at: new Date().toISOString()
          })
          .eq('id', tempOrder.product_id);
      }
    }

    // Clear temporary orders
    await supabase
      .from('temporary_orders')
      .delete()
      .eq('tx_ref', txRef)
      .eq('user_id', userId);

    // Clear user's cart
    await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    // Redirect to receipt page with auto-redirect to orders
    return NextResponse.redirect(
      new URL(`/api/receipts/stripe/${txRef}?redirect=${encodeURIComponent('/orders?payment_success=true&tx_ref=' + txRef)}`, request.url)
    );

  } catch (error) {
    console.error('Stripe success handler error:', error);
    return NextResponse.redirect(
      new URL('/checkout?error=processing_failed', request.url)
    );
  }
}
