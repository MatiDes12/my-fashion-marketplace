import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { linkCode: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { linkCode } = params;

    if (!linkCode) {
      return NextResponse.json({ error: 'Link code is required' }, { status: 400 });
    }

    // Get gift purchase details
    const { data: giftPurchase, error: fetchError } = await supabase
      .from('gift_purchases')
      .select(`
        *,
        product:products(
          id,
          title,
          description,
          price,
          delivery_fee,
          images:product_images(*),
          owner:users(
            id,
            full_name,
            store_settings
          )
        )
      `)
      .eq('link_code', linkCode)
      .single();

    if (fetchError || !giftPurchase) {
      return NextResponse.json({ error: 'Gift purchase not found' }, { status: 404 });
    }

    // Check if gift purchase has expired
    if (giftPurchase.status === 'expired' || new Date(giftPurchase.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Gift purchase link has expired' }, { status: 410 });
    }

    // Check if already purchased
    if (giftPurchase.status === 'purchased') {
      return NextResponse.json({ error: 'This gift has already been purchased' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      giftPurchase
    });

  } catch (error) {
    console.error('Error fetching gift purchase:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gift purchase' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { linkCode: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { linkCode } = params;

    if (!linkCode) {
      return NextResponse.json({ error: 'Link code is required' }, { status: 400 });
    }

    const {
      purchaserEmail,
      purchaserName,
      paymentMethod,
      deliveryAddress,
      deliveryMethod = 'delivery'
    } = await request.json();

    if (!purchaserEmail || !purchaserName) {
      return NextResponse.json({ error: 'Purchaser email and name are required' }, { status: 400 });
    }

    // Get gift purchase details
    const { data: giftPurchase, error: fetchError } = await supabase
      .from('gift_purchases')
      .select(`
        *,
        product:products(
          id,
          title,
          price,
          delivery_fee,
          owner:users(id, full_name)
        )
      `)
      .eq('link_code', linkCode)
      .single();

    if (fetchError || !giftPurchase) {
      return NextResponse.json({ error: 'Gift purchase not found' }, { status: 404 });
    }

    // Check if gift purchase has expired
    if (giftPurchase.status === 'expired' || new Date(giftPurchase.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Gift purchase link has expired' }, { status: 410 });
    }

    // Check if already purchased
    if (giftPurchase.status === 'purchased') {
      return NextResponse.json({ error: 'This gift has already been purchased' }, { status: 409 });
    }

    // Update gift purchase with purchaser details
    const { error: updateError } = await supabase
      .from('gift_purchases')
      .update({
        purchaser_email: purchaserEmail,
        purchaser_name: purchaserName,
        status: 'purchased',
        purchased_at: new Date().toISOString()
      })
      .eq('link_code', linkCode);

    if (updateError) {
      throw updateError;
    }

    // Create order for the gift purchase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: giftPurchase.purchaser_id, // The original purchaser
        product_id: giftPurchase.product_id,
        quantity: giftPurchase.quantity,
        total_price: giftPurchase.total_amount,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress ? JSON.stringify(deliveryAddress) : null,
        delivery_fee: giftPurchase.product.delivery_fee || 0,
        payment_method: paymentMethod,
        payment_status: 'pending',
        order_status: 'pending',
        gift_purchase_id: giftPurchase.id,
        notes: `Gift purchase by ${purchaserName} (${purchaserEmail})`
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Update gift purchase with order ID
    await supabase
      .from('gift_purchases')
      .update({ order_id: order.id })
      .eq('id', giftPurchase.id);

    return NextResponse.json({
      success: true,
      order,
      giftPurchase,
      message: 'Gift purchase completed successfully'
    });

  } catch (error) {
    console.error('Error processing gift purchase:', error);
    return NextResponse.json(
      { error: 'Failed to process gift purchase' },
      { status: 500 }
    );
  }
}
