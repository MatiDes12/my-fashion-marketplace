import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get request body
    const { deliveryId, status, deliveryNotes, deliveryAccountId, proofImages } = await request.json();

    if (!deliveryId || !status || !deliveryAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the delivery belongs to this delivery person
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('delivery_tracking')
      .select('delivery_account_id')
      .eq('id', deliveryId)
      .single();

    if (deliveryError || !deliveryData) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
    }

    if (deliveryData.delivery_account_id !== deliveryAccountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the delivery account is active
    const { data: accountData, error: accountError } = await supabase
      .from('delivery_accounts')
      .select('is_active')
      .eq('id', deliveryAccountId)
      .single();

    if (accountError || !accountData) {
      return NextResponse.json({ error: 'Delivery account not found' }, { status: 404 });
    }

    if (!accountData.is_active) {
      return NextResponse.json({ error: 'Delivery account is not active' }, { status: 400 });
    }

    // Prepare update data
    const updateData: any = {
      status,
      delivery_notes: deliveryNotes || null,
      proof_images: proofImages || []
    };

    // Add timestamps based on status
    if (status === 'picked_up') {
      updateData.picked_up_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Update delivery tracking
    const { data: updatedDelivery, error: updateError } = await supabase
      .from('delivery_tracking')
      .update(updateData)
      .eq('id', deliveryId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating delivery status:', updateError);
      return NextResponse.json({ error: 'Failed to update delivery status' }, { status: 500 });
    }

    // If status is delivered, also update the order status
    if (status === 'delivered') {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .update({ 
          order_status: 'delivered',
          updated_at: new Date().toISOString(),
          delivery_proof_image: proofImages?.[0] || null,
          payment_status: 'paid'
        })
        .eq('id', updatedDelivery.order_id)
        .select()
        .single();

      if (orderError) {
        console.error('Error updating order status:', orderError);
        // Don't fail the entire request, just log the error
      } else {
        console.log('Order status updated to delivered:', orderData);
      }

      // Update transaction if it exists
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .update({
          payment_status: 'paid',
          platform_payout_status: 'completed',
          seller_payout_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('order_id', updatedDelivery.order_id)
        .select();

      if (transactionError) {
        console.error('Error updating transaction:', transactionError);
        // Don't fail the entire request, just log the error
      } else {
        console.log('Transaction updated for delivered order:', transactionData);
      }
    }

    return NextResponse.json({ 
      success: true, 
      delivery: updatedDelivery 
    });

  } catch (error) {
    console.error('Error in delivery status update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 