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

    // Get request body
    const { orderId, deliveryAccountId } = await request.json();

    if (!orderId || !deliveryAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the order belongs to the seller
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        product_id,
        products!inner(owner_id)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if ((orderData as any).products.owner_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the delivery account belongs to the seller
    const { data: accountData, error: accountError } = await supabase
      .from('delivery_accounts')
      .select('seller_id, is_active')
      .eq('id', deliveryAccountId)
      .single();

    if (accountError || !accountData) {
      return NextResponse.json({ error: 'Delivery account not found' }, { status: 404 });
    }

    if (accountData.seller_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!accountData.is_active) {
      return NextResponse.json({ error: 'Delivery account is not active' }, { status: 400 });
    }

    // Check if delivery is already assigned
    const { data: existingDelivery, error: existingError } = await supabase
      .from('delivery_tracking')
      .select('id')
      .eq('order_id', orderId)
      .single();

    if (existingDelivery) {
      return NextResponse.json({ error: 'Delivery already assigned' }, { status: 400 });
    }

    // Create delivery tracking record
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('delivery_tracking')
      .insert({
        order_id: orderId,
        delivery_account_id: deliveryAccountId,
        status: 'assigned'
      })
      .select()
      .single();

    if (deliveryError) {
      console.error('Error creating delivery tracking:', deliveryError);
      return NextResponse.json({ error: 'Failed to assign delivery' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      delivery: deliveryData 
    });

  } catch (error) {
    console.error('Error in delivery assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 