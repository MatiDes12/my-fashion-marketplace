import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

// Use centralized Supabase client (server-only)
const supabase = supabaseServer;

export async function POST(request: NextRequest) {
  try {
    const { deliveryId, status, deliveryNotes, proofImages, deliveryAccountId } = await request.json();

    if (!deliveryId || !status) {
      return NextResponse.json({ error: 'Delivery ID and status are required' }, { status: 400 });
    }

    if (!deliveryAccountId) {
      return NextResponse.json({ error: 'Delivery account ID is required for authorization' }, { status: 400 });
    }

    // Validate status against allowed values
    const allowedStatuses = ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid delivery status' }, { status: 400 });
    }

    // Verify this delivery belongs to the claimed delivery account (prevents IDOR)
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('delivery_tracking')
      .select(`
        *,
        delivery_accounts:delivery_accounts!inner(
          id,
          is_active,
          delivery_person_name,
          phone_number
        )
      `)
      .eq('id', deliveryId)
      .eq('delivery_account_id', deliveryAccountId)
      .single();

    if (deliveryError || !deliveryData) {
      return NextResponse.json({ error: 'Delivery not found for this account' }, { status: 404 });
    }

    if (!(deliveryData as any).delivery_accounts?.is_active) {
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
        delivery_person_name: (deliveryData as any).delivery_accounts?.delivery_person_name || null,
        delivery_person_phone: (deliveryData as any).delivery_accounts?.phone_number || null,
        proof_image: proofImages && proofImages.length > 0 ? proofImages[0] : null
      });

    if (statusError) {
      console.error('Error creating delivery status entry:', statusError);
      // Don't return error here as delivery status was already updated
    }

    // Update order status based on delivery status
    const orderStatusMapping: { [key: string]: string } = {
      'assigned': 'confirmed',
      'picked_up': 'picked up',
      'in_transit': 'shipped',
      'out_for_delivery': 'shipped', // Combine with in_transit
      'delivered': 'delivered',
      'failed': 'cancelled'
    };

    const orderStatus = orderStatusMapping[status];
    if (orderStatus) {
      // Update order with status and delivery proof image
      const updateData: Record<string, any> = {
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
        .update(updateData as Record<string, unknown>)
        .eq('id', String(deliveryData.order_id));

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
          } as Record<string, unknown>)
          .eq('order_id', String(deliveryData.order_id))
          .select('*');

        if (transactionError) {
          console.error('Transaction update error:', transactionError);
          // Don't throw error here, just log it
        } else {
          console.log('Transaction updated successfully for order:', deliveryData.order_id, 'Updated rows:', transactionData);
        }
      }
    }

    // Send Telegram notification for key delivery status changes
    if (status === 'picked_up' || status === 'delivered') {
      try {
        // Get the order's user to target the Telegram recipient
        const { data: orderRow, error: orderFetchError } = await supabase
          .from('orders')
          .select('id, user_id, delivery_method, product:products(title)')
          .eq('id', String(deliveryData.order_id))
          .single();

        if (!orderFetchError && orderRow?.user_id) {
          const config = await getTelegramConfig();
          const bot = new TelegramBot(config);

          const isHomeDelivery = (orderRow as any)?.delivery_method === 'home_delivery';
          const isStorePickup = (orderRow as any)?.delivery_method === 'store_pickup';

          const shouldNotify = (status === 'delivered' && isHomeDelivery) || (status === 'picked_up' && isStorePickup);

          if (shouldNotify) {
            await bot.sendDeliveryUpdate(String((orderRow as any).user_id), {
              order_id: deliveryData.order_id,
              status,
              notes: deliveryNotes || null,
              updated_at: new Date().toISOString(),
              product_name: (orderRow as any)?.product?.title || undefined
            });
          }
        } else if (orderFetchError) {
          console.error('Failed to fetch order for Telegram delivery update:', orderFetchError);
        }
      } catch (notifyError) {
        console.error('Error sending Telegram delivery update:', notifyError);
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