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

    const body = await request.text();
    const params = new URLSearchParams(body);
    const socketId = params.get('socket_id');
    const channel = params.get('channel_name');

    if (!socketId || !channel) {
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
    }

    // For presence channels, include user_id and user_info
    let authResponse: any;
    if (channel.startsWith('presence-')) {
      authResponse = pusherServer.authorizeChannel(socketId, channel, {
        user_id: user.id,
        user_info: {
          email: user.email,
          name: (user as any).user_metadata?.full_name || (user as any).user_metadata?.name || user.email,
        },
      } as any);
    } else {
      // Private/public channels
      authResponse = pusherServer.authorizeChannel(socketId, channel);
    }
    
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 