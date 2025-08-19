import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { 
      shareCode, 
      purchaserEmail, 
      purchaserName, 
      paymentMethod, 
      deliveryMethod, 
      deliveryAddress,
      txRef
    } = await request.json();

    if (!shareCode || !purchaserEmail || !purchaserName || !paymentMethod || !txRef) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get shared cart data
    const { data: sharedCart, error: fetchError } = await supabase
      .from('shared_carts')
      .select('*')
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

    const cartItems = sharedCart.cart_data.items;
    const originalUserId = sharedCart.user_id;

    // Clean up expired temporary orders first
    const { error: cleanupError } = await supabase
      .from('temporary_orders')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (cleanupError) {
      console.error('Error cleaning up expired orders:', cleanupError);
    }

    // Create temporary orders for each item
    for (const item of cartItems) {
      // Get the product owner (seller) from the products table
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('owner_id')
        .eq('id', item.productId)
        .single();

      if (productError || !productData) {
        console.error('Error fetching product owner:', productError);
        throw new Error(`Failed to fetch product owner for product ${item.productId}`);
      }

      // Calculate amounts
      const itemSubtotal = Number((item.quantity * item.price).toFixed(2));
      const serviceFee = Number((itemSubtotal * 0.03).toFixed(2)); // 3% service fee
      const itemDeliveryFee = deliveryMethod === 'delivery' ? 300 : 0; // Default delivery fee
      const itemTotal = Number((itemSubtotal + itemDeliveryFee + (item.gift_wrapping_fee || 0)).toFixed(2));

      // Create temporary order
      const { error: tempOrderError } = await supabase
        .from('temporary_orders')
        .insert({
          tx_ref: txRef,
          user_id: originalUserId, // Order goes to original user's account
          product_id: item.productId,
          quantity: item.quantity,
          total_price: itemTotal,
          platform_fee: 0,
          service_fee: serviceFee,
          ethiopia_tax: 0,
          delivery_fee: itemDeliveryFee,
          delivery_method: deliveryMethod === 'delivery' ? 'home_delivery' : 'store_pickup',
          delivery_address: deliveryAddress,
          selected_size: item.selected_size,
          selected_color: item.selected_color,
          selected_variant_sku: item.selected_variant_sku,
          customer_phone: null,
          seller_id: productData.owner_id, // Use the product owner as seller
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes expiry
          // Add shared cart metadata
          metadata: {
            is_shared_cart: true,
            share_code: shareCode,
            purchaser_email: purchaserEmail,
            purchaser_name: purchaserName,
            shared_cart_id: sharedCart.id
          }
        });

      if (tempOrderError) {
        console.error('Temporary order creation error:', tempOrderError);
        throw new Error(`Failed to create temporary order: ${tempOrderError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Temporary shared cart orders created successfully',
      txRef,
      shareCode,
      paymentMethod
    });

  } catch (error) {
    console.error('Temporary shared cart order creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create temporary shared cart orders' },
      { status: 500 }
    );
  }
}
