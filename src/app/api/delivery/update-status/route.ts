import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { deliveryId, status, deliveryNotes, proofImages } = await request.json();

    if (!deliveryId || !status) {
      return NextResponse.json({ error: 'Delivery ID and status are required' }, { status: 400 });
    }

    // First verify this is a valid delivery
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('delivery_tracking')
      .select(`
        *,
        delivery_accounts!inner(
          id,
          is_active
        )
      `)
      .eq('id', deliveryId)
      .single();

    if (deliveryError || !deliveryData) {
      return NextResponse.json({ error: 'Invalid delivery ID' }, { status: 404 });
    }

    if (!deliveryData.delivery_accounts.is_active) {
      return NextResponse.json({ error: 'Delivery account is not active' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {
      status,
      delivery_notes: deliveryNotes
    };

    // Add timestamps based on status
    if (status === 'picked_up') {
      updateData.picked_up_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Add proof images if provided
    if (proofImages && proofImages.length > 0) {
      updateData.proof_images = proofImages;
    }

    // Update delivery status
    const { error: updateError } = await supabase
      .from('delivery_tracking')
      .update(updateData)
      .eq('id', deliveryId);

    if (updateError) {
      console.error('Error updating delivery status:', updateError);
      return NextResponse.json({ error: 'Failed to update delivery status' }, { status: 500 });
    }

    // If status is delivered, also update the order status
    if (status === 'delivered') {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ order_status: 'delivered' })
        .eq('id', deliveryData.order_id);

      if (orderError) {
        console.error('Error updating order status:', orderError);
        // Don't return error here as delivery status was already updated
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery status updated successfully'
    });

  } catch (error) {
    console.error('Error in update-status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 