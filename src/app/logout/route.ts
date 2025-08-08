import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { pusherServer } from '@/lib/pusher';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user before signing out
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Update user status to offline before signing out
      try {
        await supabase
          .from('user_chat_status')
          .upsert({
            user_id: user.id,
            is_online: false,
            last_seen: new Date().toISOString(),
            status_message: 'Offline'
          }, { onConflict: 'user_id' });

        // Trigger Pusher event to notify all connected clients
        await pusherServer.trigger('user-status', 'status_update', {
          userId: user.id,
          isOnline: false,
          lastSeen: new Date().toISOString(),
          statusMessage: 'Offline'
        });

        console.log(`User ${user.id} status set to offline during logout`);
      } catch (error) {
        console.error('Error updating user status during logout:', error);
        // Don't fail the logout if status update fails
      }
    }

    // Sign out the user
    await supabase.auth.signOut();
    
    // Create a response that redirects to the home page
    const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    // Clear all cookies related to authentication
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      if (cookie.name.includes('supabase') || cookie.name.includes('auth') || cookie.name.includes('sb-')) {
        response.cookies.delete(cookie.name);
      }
    }
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user before signing out
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Update user status to offline before signing out
      try {
        await supabase
          .from('user_chat_status')
          .upsert({
            user_id: user.id,
            is_online: false,
            last_seen: new Date().toISOString(),
            status_message: 'Offline'
          }, { onConflict: 'user_id' });

        // Trigger Pusher event to notify all connected clients
        await pusherServer.trigger('user-status', 'status_update', {
          userId: user.id,
          isOnline: false,
          lastSeen: new Date().toISOString(),
          statusMessage: 'Offline'
        });

        console.log(`User ${user.id} status set to offline during logout`);
      } catch (error) {
        console.error('Error updating user status during logout:', error);
        // Don't fail the logout if status update fails
      }
    }

    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}