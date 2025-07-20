import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { linkTelegramUser } from '@/lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId, chatId } = await request.json();

    if (!userId || !chatId) {
      return NextResponse.json(
        { error: 'userId and chatId are required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Link Telegram account
    await linkTelegramUser(userId, chatId);

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram account linked successfully' 
    });

  } catch (error) {
    console.error('Error linking Telegram account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to link account' },
      { status: 500 }
    );
  }
} 