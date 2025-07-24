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

    // First, get all room IDs where the user is involved
    const { data: userRooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select('id')
      .or(`seller_id.eq.${user.id},admin_id.eq.${user.id},customer_id.eq.${user.id}`);

    if (roomsError) {
      console.error('Error fetching user rooms:', roomsError);
      return NextResponse.json({ error: 'Failed to fetch user rooms' }, { status: 500 });
    }

    if (!userRooms || userRooms.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    // Get room IDs
    const roomIds = userRooms.map(room => room.id);

    // Count unread messages in these rooms (excluding user's own messages)
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .in('room_id', roomIds)
      .eq('is_read', false)
      .neq('sender_id', user.id);

    if (error) {
      console.error('Error fetching unread count:', error);
      return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
    }

    return NextResponse.json({ 
      count: count || 0 
    });

  } catch (error) {
    console.error('Error in GET /api/chat/unread-count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 