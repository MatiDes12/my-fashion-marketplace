import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { pusherServer } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isOnline, statusMessage } = body;

    // Update user status in database
    const { error: statusError } = await supabase
      .from('user_chat_status')
      .upsert({
        user_id: user.id,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        status_message: statusMessage || null
      }, { onConflict: 'user_id' });

    if (statusError) {
      console.error('Error updating user status:', statusError);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    // Trigger Pusher event to notify all connected clients
    await pusherServer.trigger('user-status', 'status_update', {
      userId: user.id,
      isOnline,
      lastSeen: new Date().toISOString(),
      statusMessage
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 