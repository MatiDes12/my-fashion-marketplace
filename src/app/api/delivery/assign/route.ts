import { createRouteClient } from '@/lib/supabase-route';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
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

    if ((orderData as any).products.owner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the delivery account belongs to the seller
    const { data: accountData, error: accountError } = await supabase
      .from('delivery_accounts')
      .select('seller_id, is_active, delivery_person_name, phone_number')
      .eq('id', deliveryAccountId)
      .single();

    if (accountError || !accountData) {
      return NextResponse.json({ error: 'Delivery account not found' }, { status: 404 });
    }

    if (accountData.seller_id !== user.id) {
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

    // Create initial delivery status entry for customer tracking
    const { error: statusError } = await supabase
      .from('delivery_statuses')
      .insert({
        order_id: orderId,
        delivery_account_id: deliveryAccountId,
        status: 'confirmed',
        notes: `Delivery assigned to ${accountData.delivery_person_name}`,
        delivery_person_name: accountData.delivery_person_name,
        delivery_person_phone: accountData.phone_number
      });

    if (statusError) {
      console.error('Error creating delivery status entry:', statusError);
      // Don't return error here as delivery tracking was already created
    }

    // Update order status to confirmed
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ order_status: 'confirmed' })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.error('Error updating order status:', orderUpdateError);
      // Don't return error here as delivery tracking was already created
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