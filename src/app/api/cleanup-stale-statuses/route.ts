import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user to verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, is_admin')
      .eq('id', user.id)
      .single();

    if (!userProfile || (!userProfile.is_admin && userProfile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Clean up stale online statuses (users who haven't been active for 30 minutes)
    const { data: cleanedUsers, error: cleanupError } = await supabase
      .from('user_chat_status')
      .update({
        is_online: false,
        status_message: 'Offline',
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('is_online', true)
      .lt('last_seen', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // 30 minutes ago
      .select('user_id');

    if (cleanupError) {
      console.error('Error cleaning up stale statuses:', cleanupError);
      return NextResponse.json({ error: 'Failed to cleanup stale statuses' }, { status: 500 });
    }

    console.log(`Cleaned up ${cleanedUsers?.length || 0} stale online statuses`);

    return NextResponse.json({ 
      success: true, 
      cleanedCount: cleanedUsers?.length || 0 
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 