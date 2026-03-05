import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with service role to bypass RLS
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

export async function POST(request: NextRequest) {
  try {
    
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

    const cartItems = sharedCart.cart_data.items;
    const originalUserId = sharedCart.user_id;

    // Check if temporary orders already exist for this tx_ref
    const { data: existingTempOrders } = await supabase
      .from('temporary_orders')
      .select('id')
      .eq('tx_ref', txRef);

    if (existingTempOrders && existingTempOrders.length > 0) {
      console.log('Temporary orders already exist for tx_ref:', txRef);
      return NextResponse.json({
        success: true,
        message: 'Temporary shared cart orders already exist',
        txRef,
        shareCode,
        paymentMethod
      });
    }

    // Clean up expired temporary orders first (but be less aggressive)
    const { error: cleanupError } = await supabase
      .from('temporary_orders')
      .delete()
      .lt('expires_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Only delete orders expired more than 5 minutes ago

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
            shared_cart_id: sharedCart.id,
            user_id: originalUserId // Include the original user's ID for Stripe metadata
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
