import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipientEmail, recipientName, message, shareMethod } = await request.json();

    // Get user's cart items (only active items, not saved for later)
    const { data: cartItems, error: fetchError } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products(
          id,
          title,
          price,
          delivery_fee,
          images:product_images(*),
          owner:users(
            id,
            full_name
          )
        )
      `)
      .eq('user_id', session.user.id)
      .eq('saved_for_later', false);

    if (fetchError) {
      throw fetchError;
    }

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Get user info
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', session.user.id)
      .single();

    // Prepare cart data
    const cartData = {
      sender: {
        name: userData?.full_name || 'Anonymous',
        email: userData?.email || session.user.email
      },
      message: message || 'Check out my shopping cart!',
      items: cartItems.map(item => ({
        productId: item.product_id,
        title: item.product?.title,
        price: item.price,
        quantity: item.quantity,
        selected_size: item.selected_size,
        selected_color: item.selected_color,
        selected_variant_sku: item.selected_variant_sku,
        delivery_method: item.delivery_method,
        delivery_address: item.delivery_address,
        gift_wrapping: item.gift_wrapping,
        gift_message: item.gift_message,
        gift_wrapping_fee: item.gift_wrapping_fee,
        image: item.product?.images?.[0]?.image_url,
        seller: item.product?.owner?.full_name
      })),
      totalItems: cartItems.length,
      totalValue: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      sharedAt: new Date().toISOString()
    };

    // Generate unique share code
    const { data: shareCodeData, error: shareCodeError } = await supabase
      .rpc('generate_share_code');

    if (shareCodeError) {
      throw shareCodeError;
    }

    const shareCode = shareCodeData;

    // Store in shared_carts table
    const { data: sharedCart, error: insertError } = await supabase
      .from('shared_carts')
      .insert({
        share_code: shareCode,
        user_id: session.user.id,
        recipient_email: recipientEmail || null,
        recipient_name: recipientName || null,
        message: message || 'Check out my shopping cart!',
        cart_data: cartData,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/cart/shared/${shareCode}`;

    // Handle different sharing methods
    if (shareMethod === 'email' && recipientEmail) {
      try {
        await sendShareEmail(recipientEmail, recipientName, userData?.full_name, shareUrl, cartData);
        return NextResponse.json({
          success: true,
          shareUrl,
          shareCode,
          message: 'Cart shared via email successfully'
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Still return the share URL even if email fails
        return NextResponse.json({
          success: true,
          shareUrl,
          shareCode,
          message: 'Share link generated, but email delivery failed'
        });
      }
    } else if (shareMethod === 'telegram') {
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message || 'Check out my shopping cart!')}`;
      return NextResponse.json({
        success: true,
        shareUrl,
        telegramUrl,
        shareCode,
        message: 'Cart shared via Telegram'
      });
    } else {
      // Default: return share link
      return NextResponse.json({
        success: true,
        shareUrl,
        shareCode,
        message: 'Share link generated successfully'
      });
    }

  } catch (error) {
    console.error('Error sharing cart:', error);
    return NextResponse.json(
      { error: 'Failed to share cart' },
      { status: 500 }
    );
  }
}

async function sendShareEmail(recipientEmail: string, recipientName: string, senderName: string, shareUrl: string, cartData: any) {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Shopping Cart Shared</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .item { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #10b981; }
        .total { font-weight: bold; font-size: 18px; margin-top: 20px; padding-top: 15px; border-top: 2px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 Shopping Cart Shared</h1>
        </div>
        <div class="content">
          <p>Hi ${recipientName || 'there'},</p>
          
          <p><strong>${senderName || 'Someone'}</strong> has shared their shopping cart with you!</p>
          
          <p><em>"${cartData.message}"</em></p>
          
          <h3>Cart Items (${cartData.totalItems}):</h3>
          ${cartData.items.map((item: any) => `
            <div class="item">
              <strong>${item.title}</strong><br>
              Quantity: ${item.quantity} | Price: ETB ${item.price.toFixed(2)}<br>
              ${item.selected_size ? `Size: ${item.selected_size} | ` : ''}
              ${item.selected_color ? `Color: ${item.selected_color}` : ''}
            </div>
          `).join('')}
          
          <div class="total">
            Total Value: ETB ${cartData.totalValue.toFixed(2)}
          </div>
          
          <p>You can view and purchase these items using the link below:</p>
          
          <a href="${shareUrl}" class="button">View Shared Cart</a>
          
          <p><small>This link will expire in 7 days.</small></p>
          
          <p>Best regards,<br>The Fashion Marketplace Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: 'Fashion Marketplace <noreply@yourdomain.com>',
    to: recipientEmail,
    subject: `${senderName || 'Someone'} shared their shopping cart with you!`,
    html: emailHtml
  });
}
