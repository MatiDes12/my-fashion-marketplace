import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deliveryAccountId } = await request.json();

    if (!deliveryAccountId) {
      return NextResponse.json({ error: 'Delivery account ID is required' }, { status: 400 });
    }

    // Verify the delivery account belongs to the authenticated seller
    const { data: deliveryAccount, error: accountError } = await supabase
      .from('delivery_accounts')
      .select('id, delivery_person_name, phone_number')
      .eq('id', deliveryAccountId)
      .eq('seller_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (accountError || !deliveryAccount) {
      return NextResponse.json({ error: 'Delivery account not found or not active' }, { status: 404 });
    }

    // Generate a unique access token
    const accessToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store the access token in the database
    const { data: tokenData, error: tokenError } = await supabase
      .from('delivery_access_tokens')
      .insert({
        delivery_account_id: deliveryAccountId,
        access_token: accessToken,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (tokenError) {
      console.error('Error creating access token:', tokenError);
      return NextResponse.json({ error: 'Failed to generate access token' }, { status: 500 });
    }

    // Create the access link
    const accessLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.avrioxshop.com'}/delivery/login?token=${accessToken}`;

    return NextResponse.json({
      success: true,
      accessToken,
      accessLink,
      expiresAt: expiresAt.toISOString(),
      deliveryPerson: {
        name: deliveryAccount.delivery_person_name,
        phone: deliveryAccount.phone_number
      }
    });

  } catch (error) {
    console.error('Error generating delivery access token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 