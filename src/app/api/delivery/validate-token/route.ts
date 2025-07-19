import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client without authentication for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    // Find the access token in the database
    const { data: tokenData, error: tokenError } = await supabase
      .from('delivery_access_tokens')
      .select(`
        *,
        delivery_accounts!inner(
          id,
          delivery_person_name,
          phone_number,
          is_active
        )
      `)
      .eq('access_token', accessToken)
      .eq('is_used', false)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    
    if (now > expiresAt) {
      return NextResponse.json({ error: 'Access token has expired' }, { status: 401 });
    }

    // Check if delivery account is still active
    if (!tokenData.delivery_accounts.is_active) {
      return NextResponse.json({ error: 'Delivery account is not active' }, { status: 401 });
    }

    // Mark token as used
    await supabase
      .from('delivery_access_tokens')
      .update({ 
        is_used: true, 
        used_at: new Date().toISOString() 
      })
      .eq('id', tokenData.id);

    return NextResponse.json({
      success: true,
      deliveryAccount: {
        id: tokenData.delivery_accounts.id,
        name: tokenData.delivery_accounts.delivery_person_name,
        phone: tokenData.delivery_accounts.phone_number
      }
    });

  } catch (error) {
    console.error('Error validating delivery access token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 