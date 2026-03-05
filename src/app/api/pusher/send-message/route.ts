import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route';
import { pusherServer } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, senderId, senderType, message, messageType = 'text' } = body;

    if (!roomId || !senderId || !senderType || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user has access to this room
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
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

    // Save message to database
    const { data: savedMessage, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: senderId,
        sender_type: senderType,
        message: message,
        message_type: messageType
      })
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey(id, email, full_name, created_at)
      `)
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Update room's last_message_at timestamp
    const { error: roomUpdateError } = await supabase
      .from('chat_rooms')
      .update({ last_message_at: savedMessage.created_at })
      .eq('id', roomId);

    if (roomUpdateError) {
      console.error('Error updating room timestamp:', roomUpdateError);
      // Don't fail the request for this, just log it
    }

    // Trigger Pusher event
    await pusherServer.trigger(`room-${roomId}`, 'new_message', {
      id: savedMessage.id,
      room_id: roomId,
      sender_id: senderId,
      sender_type: senderType,
      message: message,
      message_type: messageType,
      is_read: false,
      created_at: savedMessage.created_at,
      sender: savedMessage.sender
    });

    return NextResponse.json({ success: true, message: savedMessage });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 