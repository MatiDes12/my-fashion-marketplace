import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { pusherServer } from '@/lib/pusher';
import { rateLimit } from '@/utils/rate-limit';

// Create a rate limiter that allows 5 requests per 10 seconds
const limiter = rateLimit({
  interval: 10 * 1000, // 10 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per interval
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    try {
      await limiter.check(request, 5, 'UPDATE_STATUS'); // 5 requests per interval
    } catch {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    
    // Try to refresh the session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error in update-status:', sessionError);
      return NextResponse.json({ error: 'Session error' }, { status: 401 });
    }
    
    if (!session) {
      console.error('No session found in update-status');
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }
    
    // Get current user with better error handling
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error in update-status:', authError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!user) {
      console.error('No user found in update-status');
      return NextResponse.json({ error: 'No authenticated user' }, { status: 401 });
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