import { createRouteClient } from '@/lib/supabase-route';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createRouteClient();
    
    // Get the current user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const { orderId } = resolvedParams;

    // Verify the order belongs to the current user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Fetch delivery statuses for the order
    const { data: deliveryStatuses, error: statusError } = await supabase
      .from('delivery_statuses')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    // Also fetch delivery tracking to get proof images
    const { data: deliveryTracking, error: trackingError } = await supabase
      .from('delivery_tracking')
      .select('proof_images, status')
      .eq('order_id', orderId)
      .single();

    // Merge proof images from delivery_tracking into delivery_statuses
    if (deliveryTracking?.proof_images && deliveryTracking.proof_images.length > 0) {
      console.log('Debug - Delivery tracking proof images:', deliveryTracking.proof_images);
      // Find the latest delivery status and add proof image
      if (deliveryStatuses && deliveryStatuses.length > 0) {
        const latestStatus = deliveryStatuses[deliveryStatuses.length - 1];
        if (latestStatus && !latestStatus.proof_image) {
          latestStatus.proof_image = deliveryTracking.proof_images[0];
          console.log('Debug - Added proof image to latest status:', latestStatus.proof_image);
        }
      }
      // Also add proof image to any delivered status if not already present
      if (deliveryStatuses) {
        deliveryStatuses.forEach(status => {
          if (status.status === 'delivered' && !status.proof_image) {
            status.proof_image = deliveryTracking.proof_images[0];
            console.log('Debug - Added proof image to delivered status:', status.proof_image);
          }
        });
      }
    }

    if (statusError) {
      console.error('Error fetching delivery statuses:', statusError);
      return NextResponse.json(
        { error: 'Failed to fetch delivery statuses' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deliveryStatuses || []
    });

  } catch (error) {
    console.error('Error in delivery status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 