import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Get all telegram users (for debugging purposes)
    const { data: telegramUsers, error } = await supabase
      .from('telegram_users')
      .select(`
        *,
        user:users!telegram_users_user_id_fkey (
          id,
          full_name,
          email,
          role
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching telegram users:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch telegram users' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: telegramUsers?.length || 0,
      users: telegramUsers || []
    });

  } catch (error) {
    console.error('Error in check-users endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 