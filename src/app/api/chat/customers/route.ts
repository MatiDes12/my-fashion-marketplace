export const dynamic = 'force-dynamic';

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
    const sellerId = searchParams.get('sellerId');

    // Check if user is admin or the specified seller
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, is_admin')
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determine if this is an admin request or seller request
    const isAdminRequest = userProfile.role === 'admin' || userProfile.is_admin;
    const isSellerRequest = sellerId && user.id === sellerId && userProfile.role === 'owner';

    if (!isAdminRequest && !isSellerRequest) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get customers based on user type
    let customerIds: string[] = [];
    
    if (isAdminRequest) {
      // Admin: Get customers who have chatted with admin
      const { data: rooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('customer_id')
        .eq('room_type', 'customer_admin')
        .eq('admin_id', user.id);

      if (roomsError) {
        console.error('Error fetching admin rooms:', roomsError);
        return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
      }

      customerIds = [...new Set(rooms?.map(room => room.customer_id) || [])];
    } else {
      // Seller: Get customers who have purchased from this seller
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          user_id,
          products!orders_product_id_fkey(owner_id)
        `)
        .eq('products.owner_id', user.id)
        .in('order_status', ['confirmed', 'shipped', 'delivered', 'picked up']);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
      }

      // Get unique user IDs from orders
      const uniqueUserIds = [...new Set(orders?.map(order => order.user_id))];
      console.log('Orders before unique:', orders?.length);
      console.log('Orders after unique:', uniqueUserIds.length);
      customerIds = uniqueUserIds;
    }

    if (customerIds.length === 0) {
      return NextResponse.json({ customers: [] });
    }

    // Get customer details with uniqueness check
    const { data: customers, error: customersError } = await supabase
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
      .in('id', customerIds)
      .eq('role', 'customer');

    // Ensure uniqueness by ID
    const uniqueCustomers = customers?.reduce((acc: any[], curr: any) => {
      if (!acc.some((c: any) => c.id === curr.id)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    console.log('Customers after query:', uniqueCustomers?.length);
    
    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Log any potential duplicates
    const nameCount: { [key: string]: number } = {};
    uniqueCustomers?.forEach((customer: { full_name: string }) => {
      nameCount[customer.full_name] = (nameCount[customer.full_name] || 0) + 1;
    });
    const duplicates = Object.entries(nameCount).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('Found duplicate names:', duplicates);
      // Log the full customer objects for duplicates
      duplicates.forEach(([name, _]) => {
        console.log('Customers with name:', name, uniqueCustomers?.filter(c => c.full_name === name));
      });
    }

    // For sellers, also get chat rooms and messages for customers who have chatted
    let enhancedCustomers = uniqueCustomers || [];
    
    if (!isAdminRequest) {
      // Get chat rooms for these customers
      const { data: chatRooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          customer_id,
          last_message_at
        `)
        .eq('room_type', 'customer_seller')
        .eq('seller_id', user.id)
        .in('customer_id', customerIds)
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
            // Enhance customers with chat info
            enhancedCustomers = uniqueCustomers?.map(customer => {
              const customerRoom = chatRooms.find(room => room.customer_id === customer.id);
              const roomMessages = messages?.filter(msg => msg.room_id === customerRoom?.id) || [];
              const latestMessage = roomMessages[0]; // Already sorted by created_at desc

              return {
                ...customer,
                latest_message: latestMessage?.message || '',
                latest_message_time: latestMessage?.created_at || '',
                room_id: customerRoom?.id || ''
              };
            }) || [];
          }
        }
      }
    } else {
      // For admins, get chat rooms and messages
      const { data: chatRooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          customer_id,
          last_message_at
        `)
        .eq('room_type', 'customer_admin')
        .eq('admin_id', user.id)
        .in('customer_id', customerIds)
        .order('last_message_at', { ascending: false });

      if (!roomsError && chatRooms) {
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
            enhancedCustomers = uniqueCustomers?.map(customer => {
              const customerRoom = chatRooms.find(room => room.customer_id === customer.id);
              const roomMessages = messages?.filter(msg => msg.room_id === customerRoom?.id) || [];
              const latestMessage = roomMessages[0];

              return {
                ...customer,
                latest_message: latestMessage?.message || '',
                latest_message_time: latestMessage?.created_at || '',
                room_id: customerRoom?.id || ''
              };
            }) || [];
          }
        }
      }
    }

    return NextResponse.json({ customers: enhancedCustomers });

  } catch (error) {
    console.error('Error in customers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 