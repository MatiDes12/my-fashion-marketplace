import { createRouteClient } from '@/lib/supabase-route';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const supabase = await createRouteClient();
    const { shareCode } = await params;

    if (!shareCode) {
      return NextResponse.json({ error: 'Share code is required' }, { status: 400 });
    }

    // Get shared cart data
    const { data: sharedCart, error: fetchError } = await supabase
      .from('shared_carts')
      .select('id, share_code, user_id, cart_data, expires_at, is_used, created_at')
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

    return NextResponse.json({
      success: true,
      sharedCart
    });

  } catch (error) {
    console.error('Error fetching shared cart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared cart' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const supabase = await createRouteClient();
    const { shareCode } = await params;
    const { purchaserEmail, purchaserName } = await request.json();

    if (!shareCode) {
      return NextResponse.json({ error: 'Share code is required' }, { status: 400 });
    }

    if (!purchaserEmail || !purchaserName) {
      return NextResponse.json({ error: 'Purchaser email and name are required' }, { status: 400 });
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

    // Mark as used
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

    // Add items to the original user's cart (for order tracking)
    const cartItems = sharedCart.cart_data.items;
    const userId = sharedCart.user_id;

    // Create cart items for the original user (these will be marked as purchased by someone else)
    const cartItemsToInsert = cartItems.map((item: any) => ({
      user_id: userId,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
      selected_size: item.selected_size,
      selected_color: item.selected_color,
      selected_variant_sku: item.selected_variant_sku,
      delivery_method: item.delivery_method,
      delivery_address: item.delivery_address,
      gift_wrapping: item.gift_wrapping,
      gift_message: item.gift_message,
      gift_wrapping_fee: item.gift_wrapping_fee,
      purchased_by: purchaserEmail,
      purchased_by_name: purchaserName,
      shared_cart_id: sharedCart.id
    }));

    const { error: insertError } = await supabase
      .from('cart_items')
      .insert(cartItemsToInsert);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: 'Shared cart marked as used successfully',
      cartItems: cartItemsToInsert
    });

  } catch (error) {
    console.error('Error processing shared cart:', error);
    return NextResponse.json(
      { error: 'Failed to process shared cart' },
      { status: 500 }
    );
  }
}
