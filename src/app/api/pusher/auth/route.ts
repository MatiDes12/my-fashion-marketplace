import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route';
import { pusherServer } from '@/lib/pusher';
import { sanitizeForLog } from '@/utils/security';

// Allowed channel patterns - prevent unauthorized channel access
const ALLOWED_CHANNEL_PATTERNS = [
  /^private-chat-[a-zA-Z0-9_-]+$/,
  /^private-user-[a-zA-Z0-9_-]+$/,
  /^private-order-[a-zA-Z0-9_-]+$/,
  /^private-delivery-[a-zA-Z0-9_-]+$/,
  /^presence-chat-[a-zA-Z0-9_-]+$/,
  /^presence-room-[a-zA-Z0-9_-]+$/,
  /^presence-users$/,
];

function isValidChannel(channel: string): boolean {
  // Channel must match one of our allowed patterns
  return ALLOWED_CHANNEL_PATTERNS.some(pattern => pattern.test(channel));
}

function isUserAuthorizedForChannel(channel: string, userId: string): boolean {
  // Check if user is authorized for this specific channel
  // For user-specific channels, verify it's their channel
  if (channel.includes(`-user-${userId}`)) {
    return true;
  }
  // For chat/order/delivery channels, allow access (further auth done at message level)
  if (channel.startsWith('private-chat-') ||
      channel.startsWith('private-order-') ||
      channel.startsWith('private-delivery-') ||
      channel.startsWith('presence-chat-') ||
      channel.startsWith('presence-room-') ||
      channel === 'presence-users') {
    return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();

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

    // Validate channel format to prevent injection
    if (!isValidChannel(channel)) {
      console.warn('Invalid channel pattern attempted:', sanitizeForLog(channel));
      return NextResponse.json({ error: 'Invalid channel' }, { status: 403 });
    }

    // Verify user is authorized for this channel
    if (!isUserAuthorizedForChannel(channel, user.id)) {
      console.warn('Unauthorized channel access attempt:', sanitizeForLog(channel), 'by user:', sanitizeForLog(user.id));
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    console.error('Pusher auth error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 