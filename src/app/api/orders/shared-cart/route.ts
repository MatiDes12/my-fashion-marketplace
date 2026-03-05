import { createRouteClient } from '@/lib/supabase-route';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    
    const { 
      shareCode, 
      purchaserEmail, 
      purchaserName, 
      paymentMethod, 
      deliveryMethod, 
      deliveryAddress 
    } = await request.json();

    if (!shareCode || !purchaserEmail || !purchaserName || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get shared cart data
    const { data: sharedCart, error: fetchError } = await supabase
      .from('shared_carts')
      .select('id, share_code, user_id, cart_data, expires_at, is_used')
      .eq('share_code', shareCode)
      .single();

    if (fetchError || !sharedCart) {
      return NextResponse.json({ error: 'Shared cart not found' }, { status: 404 });
    }

    // Check if expired
    if (new Date(sharedCart.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Shared cart has expired' }, { status: 410 });
    }

    // Check if already used
    if (sharedCart.is_used) {
      return NextResponse.json({ error: 'Shared cart has already been used' }, { status: 410 });
    }

    // Mark shared cart as used
    const { error: updateError } = await supabase
      .from('shared_carts')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        used_by_email: purchaserEmail,
        used_by_name: purchaserName
      })
      .eq('share_code', shareCode);

    if (updateError) {
      throw updateError;
    }

    const cartItems = sharedCart.cart_data.items;
    const originalUserId = sharedCart.user_id;
    const baseTxRef = `SHARED-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create orders for each item
    const orders = [];
    let productIndex = 0;

    for (const item of cartItems) {
      productIndex++;
      
      // Generate unique tx_ref for each product
      const variantSuffix = item.selected_variant_sku 
        ? `-${item.selected_variant_sku.replace(/[^a-zA-Z0-9]/g, '')}` 
        : item.selected_size 
          ? `-${item.selected_size.replace(/[^a-zA-Z0-9]/g, '')}` 
          : item.selected_color 
            ? `-${item.selected_color.replace(/[^a-zA-Z0-9]/g, '')}` 
            : '-default';
      
      const uniqueTxRef = `${baseTxRef}${variantSuffix}-${productIndex}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate amounts
      const itemSubtotal = Number((item.quantity * item.price).toFixed(2));
      const serviceFee = Number((itemSubtotal * 0.03).toFixed(2)); // 3% service fee
      const itemDeliveryFee = deliveryMethod === 'delivery' ? 300 : 0; // Default delivery fee
      const itemTotal = Number((itemSubtotal + itemDeliveryFee + (item.gift_wrapping_fee || 0)).toFixed(2));
      const sellerPayoutAmount = Number((itemTotal - serviceFee).toFixed(2));

      // Generate pickup code if needed
      const pickupCode = deliveryMethod === 'pickup' 
        ? await generateUniquePickupCode(supabase)
        : null;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: originalUserId, // Order goes to original user's account
          product_id: item.productId,
          quantity: item.quantity,
          total_price: itemTotal,
          platform_fee: 0,
          service_fee: serviceFee,
          ethiopia_tax: 0,
          delivery_fee: itemDeliveryFee,
          order_status: 'confirmed',
          payment_status: 'paid',
          payment_reference: uniqueTxRef,
          tx_ref: uniqueTxRef,
          receipt_url: `/api/receipts/${paymentMethod.toLowerCase()}/${uniqueTxRef}`,
          delivery_method: deliveryMethod === 'delivery' ? 'home_delivery' : 'store_pickup',
          delivery_address: deliveryAddress,
          selected_size: item.selected_size,
          selected_color: item.selected_color,
          selected_variant_sku: item.selected_variant_sku,
          pickup_code: pickupCode,
          purchased_by: purchaserEmail,
          purchased_by_name: purchaserName,
          shared_cart_id: sharedCart.id
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      // Get the actual seller ID from the product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('owner_id')
        .eq('id', item.productId)
        .single();

      if (productError) {
        console.error('Error fetching product owner:', productError);
        throw new Error(`Failed to fetch product owner: ${productError.message}`);
      }

      // Create transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          order_id: order.id,
          payment_method: paymentMethod,
          payment_status: 'paid',
          subtotal: itemSubtotal,
          platform_fee: 0,
          service_fee: serviceFee,
          vat_amount: 0,
          delivery_fee: itemDeliveryFee,
          total_amount: itemTotal,
          seller_id: productData.owner_id, // Use actual seller ID from product
          customer_name: purchaserName,
          customer_email: purchaserEmail,
          customer_phone: null,
          seller_payout_amount: sellerPayoutAmount,
          seller_payout_status: 'pending',
          platform_payout_status: 'pending',
          flash_sale_applied: false,
          original_price: null,
          flash_sale_price: null,
          flash_sale_discount_percentage: null,
          flash_sale_title: null
        });

      if (transactionError) {
        console.error('Transaction creation error:', transactionError);
        throw new Error(`Failed to create transaction: ${transactionError.message}`);
      }

             orders.push(order);
     }

     // Remove the shared cart items from the original user's cart
     const { error: removeCartError } = await supabase
       .from('cart_items')
       .delete()
       .eq('shared_cart_id', sharedCart.id);

     if (removeCartError) {
       console.error('Error removing cart items:', removeCartError);
       // Don't throw error here as the order was already created successfully
     }

     return NextResponse.json({
       success: true,
       message: 'Shared cart order created successfully',
       orders,
       baseTxRef,
       shareCode,
       paymentMethod
     });

  } catch (error) {
    console.error('Shared cart order creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create shared cart order' },
      { status: 500 }
    );
  }
}

async function generateUniquePickupCode(supabase: any) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  let attempts = 0;
  
  do {
    code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    attempts++;
    
    if (attempts > 100) {
      throw new Error('Unable to generate unique pickup code');
    }
  } while (await checkPickupCodeExists(supabase, code));
  
  return code;
}

async function checkPickupCodeExists(supabase: any, code: string) {
  const { data } = await supabase
    .from('orders')
    .select('pickup_code')
    .eq('pickup_code', code)
    .single();
  
  return !!data;
}
