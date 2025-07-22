import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user type from query params
    const { searchParams } = new URL(request.url);
    const userType = searchParams.get('userType') as 'admin' | 'seller' | 'customer';
    const roomType = searchParams.get('roomType') as 'admin_seller' | 'customer_seller';

    if (!userType || !roomType) {
      return NextResponse.json({ error: 'Missing userType or roomType' }, { status: 400 });
    }

    let query = supabase
      .from('chat_rooms')
      .select(`
        *,
        seller:users!chat_rooms_seller_id_fkey(id, email, full_name, created_at),
        admin:users!chat_rooms_admin_id_fkey(id, email, full_name, created_at),
        customer:users!chat_rooms_customer_id_fkey(id, email, full_name, created_at),
        messages:chat_messages(
          id,
          sender_id,
          sender_type,
          message,
          message_type,
          is_read,
          created_at
        )
      `)
      .eq('room_type', roomType)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false });

    // Filter based on user type
    if (userType === 'admin') {
      query = query.eq('admin_id', user.id);
    } else if (userType === 'seller') {
      query = query.eq('seller_id', user.id);
    } else if (userType === 'customer') {
      query = query.eq('customer_id', user.id);
    }

    const { data: rooms, error } = await query;

    if (error) {
      console.error('Error fetching chat rooms:', error);
      return NextResponse.json({ error: 'Failed to fetch chat rooms' }, { status: 500 });
    }

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error in GET /api/chat/rooms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { roomType, sellerId, adminId, customerId } = body;

    if (!roomType || !sellerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate room type
    if (!['admin_seller', 'customer_seller', 'customer_admin'].includes(roomType)) {
      return NextResponse.json({ error: 'Invalid room type' }, { status: 400 });
    }

            // Check if user has permission to create this room
        if (roomType === 'admin_seller') {
          // For admin-seller rooms, the current user must be either the admin or the seller
          if (adminId === user.id || sellerId === user.id) {
            // User is authorized to create this room
          } else {
            return NextResponse.json({ error: 'Unauthorized to create admin-seller room' }, { status: 403 });
          }
        } else if (roomType === 'customer_seller') {
          // For customer-seller rooms, the current user must be either the customer or the seller
          if ((customerId && customerId === user.id) || sellerId === user.id) {
            // User is authorized to create this room
          } else {
            return NextResponse.json({ error: 'Unauthorized to create customer-seller room' }, { status: 403 });
          }
        } else if (roomType === 'customer_admin') {
          // For customer-admin rooms, the current user must be either the customer or the admin
          if ((customerId && customerId === user.id) || (adminId && adminId === user.id)) {
            // User is authorized to create this room
          } else {
            return NextResponse.json({ error: 'Unauthorized to create customer-admin room' }, { status: 403 });
          }
        }

    // Check if room already exists
    const { data: existingRoom } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('room_type', roomType)
      .eq('seller_id', sellerId)
      .eq('admin_id', adminId || null)
      .eq('customer_id', customerId || null)
      .eq('is_active', true)
      .single();

    if (existingRoom) {
      return NextResponse.json({ room: existingRoom });
    }

    // Create new room
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert({
        room_type: roomType,
        seller_id: sellerId,
        admin_id: adminId,
        customer_id: customerId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating chat room:', error);
      return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error in POST /api/chat/rooms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 