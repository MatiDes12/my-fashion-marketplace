export const dynamic = 'force-dynamic';

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

    // Get room ID from query params
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    // Verify user has access to this room
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('seller_id, admin_id, customer_id')
      .eq('id', roomId)
      .eq('is_active', true)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if user has access to this room
    const hasAccess = room.seller_id === user.id || 
                     room.admin_id === user.id || 
                     room.customer_id === user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get messages for the room
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey(id, email, full_name, created_at)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Mark messages as read for the current user
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Error in GET /api/chat/messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 