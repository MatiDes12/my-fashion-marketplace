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

    // Get user role
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let unreadCount = 0;

    if (userProfile.role === 'customer') {
      // For customers: count unread messages in customer_seller and customer_admin rooms
      const { data: customerRooms, error: customerRoomsError } = await supabase
        .from('chat_rooms')
        .select('id')
        .or(`customer_id.eq.${user.id}`)
        .in('room_type', ['customer_seller', 'customer_admin']);

      if (!customerRoomsError && customerRooms && customerRooms.length > 0) {
        const roomIds = customerRooms.map(room => room.id);
        const { data: unreadMessages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id')
          .in('room_id', roomIds)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        if (!messagesError && unreadMessages) {
          unreadCount = unreadMessages.length;
        }
      }
    } else if (userProfile.role === 'owner') {
      // For sellers: count unread messages in customer_seller rooms
      const { data: sellerRooms, error: sellerRoomsError } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('seller_id', user.id)
        .eq('room_type', 'customer_seller');

      if (!sellerRoomsError && sellerRooms && sellerRooms.length > 0) {
        const roomIds = sellerRooms.map(room => room.id);
        const { data: unreadMessages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id')
          .in('room_id', roomIds)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        if (!messagesError && unreadMessages) {
          unreadCount = unreadMessages.length;
        }
      }
    } else if (userProfile.role === 'admin') {
      // For admins: count unread messages in admin_seller and customer_admin rooms
      const { data: adminRooms, error: adminRoomsError } = await supabase
        .from('chat_rooms')
        .select('id')
        .or(`admin_id.eq.${user.id}`)
        .in('room_type', ['admin_seller', 'customer_admin']);

      if (!adminRoomsError && adminRooms && adminRooms.length > 0) {
        const roomIds = adminRooms.map(room => room.id);
        const { data: unreadMessages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id')
          .in('room_id', roomIds)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        if (!messagesError && unreadMessages) {
          unreadCount = unreadMessages.length;
        }
      }
    }

    return NextResponse.json({ unreadCount });

  } catch (error) {
    console.error('Error in unread-count API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 