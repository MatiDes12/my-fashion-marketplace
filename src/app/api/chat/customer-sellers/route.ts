import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // Verify the current user is the customer
    if (user.id !== customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if user is a customer
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || userProfile.role !== 'customer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get sellers that this customer has purchased from
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        order_status,
        product_id
      `)
      .eq('user_id', user.id)
      .in('order_status', ['confirmed', 'shipped', 'delivered', 'picked up']);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Get unique product IDs from orders
    const productIds = [...new Set(orders?.map(order => order.product_id).filter(Boolean) || [])];

    if (productIds.length === 0) {
      return NextResponse.json({ sellers: [] });
    }

    // Get products to find seller IDs
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, owner_id')
      .in('id', productIds);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // Get unique seller IDs from products
    const sellerIds = [...new Set(products?.map(product => product.owner_id).filter(Boolean) || [])];

    if (sellerIds.length === 0) {
      return NextResponse.json({ sellers: [] });
    }

    // Get seller details
    const { data: sellers, error: sellersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        user_chat_status (
          is_online,
          last_seen
        )
      `)
      .in('id', sellerIds)
      .eq('role', 'owner');

    if (sellersError) {
      console.error('Error fetching sellers:', sellersError);
      return NextResponse.json({ error: 'Failed to fetch sellers' }, { status: 500 });
    }

    // Get chat rooms for these sellers
    const { data: chatRooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select(`
        id,
        seller_id,
        last_message_at
      `)
      .eq('room_type', 'customer_seller')
      .eq('customer_id', user.id)
      .in('seller_id', sellerIds)
      .order('last_message_at', { ascending: false });

    if (!roomsError && chatRooms) {
      // Get latest messages for rooms that have messages
      const roomIds = chatRooms.map(room => room.id);
      if (roomIds.length > 0) {
        const { data: messages, error: messagesError } = await supabase
          .from('chat_messages')
          .select(`
            id,
            room_id,
            message,
            created_at
          `)
          .in('room_id', roomIds)
          .order('created_at', { ascending: false });

        if (!messagesError && messages) {
          // Enhance sellers with chat info
          const enhancedSellers = sellers?.map(seller => {
            const sellerRoom = chatRooms.find(room => room.seller_id === seller.id);
            const roomMessages = messages?.filter(msg => msg.room_id === sellerRoom?.id) || [];
            const latestMessage = roomMessages[0]; // Already sorted by created_at desc

            return {
              ...seller,
              latest_message: latestMessage?.message || '',
              latest_message_time: latestMessage?.created_at || '',
              room_id: sellerRoom?.id || ''
            };
          }) || [];

          return NextResponse.json({ sellers: enhancedSellers });
        }
      }
    }

    return NextResponse.json({ sellers: sellers || [] });

  } catch (error) {
    console.error('Error in customer-sellers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 