import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { deliveryAccountId } = await request.json();

    if (!deliveryAccountId) {
      return NextResponse.json({ error: 'Delivery account ID is required' }, { status: 400 });
    }

    // First verify this is a valid delivery account
    const { data: accountData, error: accountError } = await supabaseServer
      .from('delivery_accounts')
      .select('id, is_active')
      .eq('id', deliveryAccountId)
      .single();

    if (accountError || !accountData) {
      return NextResponse.json({ error: 'Invalid delivery account' }, { status: 404 });
    }

    if (!accountData.is_active) {
      return NextResponse.json({ error: 'Delivery account is not active' }, { status: 403 });
    }

    // Fetch deliveries for this delivery person
    const { data: deliveriesData, error: deliveriesError } = await supabaseServer
      .from('delivery_tracking')
      .select(`
        *,
        order:orders(
          id,
          user_id,
          total_price,
          delivery_address,
          delivery_method,
          pickup_code,
          product_id,
          quantity,
          users!inner(full_name, email, phone),
          products!inner(
            id,
            title,
            description,
            price
          )
        ),
        delivery_accounts!inner(
          id,
          delivery_person_name,
          phone_number
        )
      `)
      .eq('delivery_account_id', deliveryAccountId)
      .order('assigned_at', { ascending: false });

    if (deliveriesError) {
      console.error('Error fetching deliveries:', deliveriesError);
      return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deliveries: deliveriesData
    });

  } catch (error) {
    console.error('Error in get-deliveries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 