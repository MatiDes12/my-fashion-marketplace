import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Use centralized Supabase client
const supabase = supabaseServer;

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
          is_active,
          delivery_person_name,
          phone_number
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

    // Map delivery_tracking status to delivery_statuses status
    const statusMapping: { [key: string]: string } = {
      'assigned': 'confirmed',
      'picked_up': 'in_transit',
      'in_transit': 'in_transit',
      'out_for_delivery': 'in_transit', // Map to in_transit since we combine them
      'delivered': 'delivered',
      'failed': 'cancelled'
    };

    const deliveryStatus = statusMapping[status] || status;

    // Create entry in delivery_statuses table for customer tracking
    const { error: statusError } = await supabase
      .from('delivery_statuses')
      .insert({
        order_id: deliveryData.order_id,
        delivery_account_id: deliveryData.delivery_account_id,
        status: deliveryStatus,
        notes: deliveryNotes,
        delivery_person_name: deliveryData.delivery_accounts?.delivery_person_name,
        delivery_person_phone: deliveryData.delivery_accounts?.phone_number,
        proof_image: proofImages && proofImages.length > 0 ? proofImages[0] : null
      });

    if (statusError) {
      console.error('Error creating delivery status entry:', statusError);
      // Don't return error here as delivery status was already updated
    }

    // Update order status based on delivery status
    const orderStatusMapping: { [key: string]: string } = {
      'assigned': 'confirmed',
      'picked_up': 'shipped',
      'in_transit': 'shipped',
      'out_for_delivery': 'shipped', // Keep as shipped since we combine with in_transit
      'delivered': 'delivered',
      'failed': 'cancelled'
    };

    const orderStatus = orderStatusMapping[status];
    if (orderStatus) {
      // Update order with status and delivery proof image
      const updateData: any = {
        order_status: orderStatus,
        updated_at: new Date().toISOString()
      };

      // Add delivery proof image if provided and status is delivered
      if (status === 'delivered' && proofImages && proofImages.length > 0) {
        updateData.delivery_proof_image = proofImages[0];
      }

      // Update payment status to paid for delivered orders
      if (status === 'delivered') {
        updateData.payment_status = 'paid';
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', deliveryData.order_id);

      if (orderError) {
        console.error('Error updating order status:', orderError);
        // Don't return error here as delivery status was already updated
      } else {
        console.log('Order status updated successfully:', { orderId: deliveryData.order_id, status: orderStatus });
      }

      // If status is delivered, also update the transaction
      if (status === 'delivered') {
        console.log('Updating transaction for delivered order:', deliveryData.order_id);
        
        const { data: transactionData, error: transactionError } = await supabase
          .from('transactions')
          .update({
            payment_status: 'paid',
            platform_payout_status: 'completed',
            seller_payout_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', deliveryData.order_id)
          .select();

        if (transactionError) {
          console.error('Transaction update error:', transactionError);
          // Don't throw error here, just log it
        } else {
          console.log('Transaction updated successfully for order:', deliveryData.order_id, 'Updated rows:', transactionData);
        }
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