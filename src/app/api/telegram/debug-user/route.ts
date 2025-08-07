export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseServerAnon } from '@/lib/supabase-server';

const supabase = supabaseServerAnon;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId parameter is required' },
        { status: 400 }
      );
    }

    // Check telegram_users table - first try to get active user
    const { data: telegramUser, error: telegramError } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .single();

    // Check all telegram_users for this chat_id (including inactive)
    const { data: allTelegramUsers, error: allUsersError } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('chat_id', chatId);

    // Check users table if we have a user_id
    let userProfile = null;
    if (telegramUser?.user_id) {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, email, created_at')
        .eq('id', telegramUser.user_id)
        .single();
      
      userProfile = profile;
    }

    return NextResponse.json({
      success: true,
      chatId,
      telegramUser,
      allTelegramUsers,
      userProfile,
      errors: {
        telegramError: telegramError?.message,
        allUsersError: allUsersError?.message
      }
    });

  } catch (error) {
    console.error('Error debugging user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to debug user' },
      { status: 500 }
    );
  }
} 