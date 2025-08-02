import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('[CHECK_PENDING_LINKS] Checking all pending username links');

    // Get all pending links
    const { data: pendingLinks, error } = await supabaseService
      .from('telegram_users')
      .select('user_id, chat_id, username, first_name, last_name, created_at, updated_at')
      .like('chat_id', 'pending_%')
      .eq('is_active', true);

    if (error) {
      console.error('[CHECK_PENDING_LINKS] Error fetching pending links:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message 
        },
        { status: 500 }
      );
    }

    console.log(`[CHECK_PENDING_LINKS] Found ${pendingLinks?.length || 0} pending links`);

    // Get all active links for comparison
    const { data: activeLinks, error: activeError } = await supabaseService
      .from('telegram_users')
      .select('user_id, chat_id, username, first_name, last_name, created_at, updated_at')
      .not('chat_id', 'like', 'pending_%')
      .eq('is_active', true);

    if (activeError) {
      console.error('[CHECK_PENDING_LINKS] Error fetching active links:', activeError);
    }

    return NextResponse.json({
      success: true,
      pendingLinks: pendingLinks || [],
      activeLinks: activeLinks || [],
      summary: {
        totalPending: pendingLinks?.length || 0,
        totalActive: activeLinks?.length || 0
      }
    });

  } catch (error) {
    console.error('[CHECK_PENDING_LINKS] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 