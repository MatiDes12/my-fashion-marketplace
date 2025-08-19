import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      productId,
      quantity = 1,
      selectedSize,
      selectedColor,
      selectedVariantSku,
      giftWrapping = false,
      giftMessage,
      wrappingOptionId,
      recipientEmail,
      recipientName,
      expiresInDays = 30
    } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, title, price, delivery_fee')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get user info
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', session.user.id)
      .single();

    // Calculate gift wrapping fee
    let giftWrappingFee = 0;
    if (giftWrapping && wrappingOptionId) {
      const { data: wrappingOption } = await supabase
        .from('gift_wrapping_options')
        .select('price')
        .eq('id', wrappingOptionId)
        .eq('is_active', true)
        .single();

      if (wrappingOption) {
        giftWrappingFee = wrappingOption.price;
      }
    }

    // Calculate total amount
    const basePrice = product.price * quantity;
    const deliveryFee = product.delivery_fee || 0;
    const totalAmount = basePrice + deliveryFee + giftWrappingFee;

    // Generate link code using the database function
    const { data: linkCodeData, error: linkCodeError } = await supabase
      .rpc('generate_gift_purchase_link');

    if (linkCodeError) {
      throw linkCodeError;
    }

    const linkCode = linkCodeData;

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create gift purchase record
    const { data: giftPurchase, error: insertError } = await supabase
      .from('gift_purchases')
      .insert({
        purchaser_id: session.user.id,
        purchaser_email: userData?.email || session.user.email,
        purchaser_name: userData?.full_name || 'Anonymous',
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        product_id: productId,
        quantity,
        selected_size: selectedSize,
        selected_color: selectedColor,
        selected_variant_sku: selectedVariantSku,
        gift_wrapping: giftWrapping,
        gift_message: giftMessage,
        gift_wrapping_fee: giftWrappingFee,
        total_amount: totalAmount,
        link_code: linkCode,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Generate the share URL
    const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/gift-purchase/${linkCode}`;

    return NextResponse.json({
      success: true,
      giftPurchase,
      shareUrl,
      linkCode,
      message: 'Gift purchase link created successfully'
    });

  } catch (error) {
    console.error('Error creating gift purchase:', error);
    return NextResponse.json(
      { error: 'Failed to create gift purchase link' },
      { status: 500 }
    );
  }
}
