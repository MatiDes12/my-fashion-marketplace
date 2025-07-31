import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTelegramConfig, TelegramBot } from '@/lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin operations
);

export async function POST(request: Request) {
  try {
    const { userId, username } = await request.json();

    if (!userId || !username) {
      return NextResponse.json(
        { error: 'userId and username are required' },
        { status: 400 }
      );
    }

    // Remove @ symbol if present
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    console.log('Username API - Attempting to link Telegram account by username:', { userId, username: cleanUsername });

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Username API - User not found:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if username is already linked to another account
    const { data: existingLink, error: existingError } = await supabase
      .from('telegram_users')
      .select('user_id, chat_id, username')
      .eq('username', cleanUsername)
      .eq('is_active', true)
      .single();

    if (existingLink && existingLink.user_id !== userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Username already linked to another account',
          details: 'This Telegram username is already connected to a different AVRIO account'
        },
        { status: 409 }
      );
    }

    // If username is already linked to this user, return success
    if (existingLink && existingLink.user_id === userId) {
      return NextResponse.json({ 
        success: true, 
        message: 'Username already linked to this account',
        data: existingLink
      });
    }

    // Try to get chat ID from Telegram API using username
    try {
      const config = await getTelegramConfig();
      const bot = new TelegramBot(config);

      // Note: Telegram Bot API doesn't provide a direct way to get chat_id from username
      // This would require the user to send a message to the bot first
      // For now, we'll store the username and wait for the user to interact with the bot

      // Store the username link request
      const { data: linkData, error: linkError } = await supabase
        .from('telegram_users')
        .upsert({
          user_id: userId,
          chat_id: `pending_${cleanUsername}`, // Temporary chat_id until user interacts
          username: cleanUsername,
          first_name: user.full_name?.split(' ')[0] || null,
          last_name: user.full_name?.split(' ').slice(1).join(' ') || null,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select();

      if (linkError) {
        console.error('Username API - Error storing username link:', linkError);
        return NextResponse.json(
          { success: false, error: 'Failed to store username link', details: linkError },
          { status: 500 }
        );
      }

      console.log('Username API - Username link stored successfully:', linkData);

      return NextResponse.json({ 
        success: true, 
        message: 'Username link request stored. Please send a message to @Avrioxshop_bot to complete the connection.',
        data: linkData,
        nextStep: 'Send a message to @Avrioxshop_bot to complete the connection'
      });

    } catch (telegramError) {
      console.error('Username API - Telegram API error:', telegramError);
      return NextResponse.json(
        { success: false, error: 'Failed to process username link', details: telegramError },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Username API - Error linking Telegram account by username:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to link account by username' },
      { status: 500 }
    );
  }
}

// GET method to check if a username is available
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'username parameter is required' },
        { status: 400 }
      );
    }

    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    // Check if username is already linked
    const { data: existingLink, error: existingError } = await supabase
      .from('telegram_users')
      .select('user_id, username, is_active')
      .eq('username', cleanUsername)
      .eq('is_active', true)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Username check error:', existingError);
      return NextResponse.json(
        { error: 'Failed to check username availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      username: cleanUsername,
      available: !existingLink,
      linked: !!existingLink,
      linkedUserId: existingLink?.user_id || null
    });

  } catch (error) {
    console.error('Username check error:', error);
    return NextResponse.json(
      { error: 'Failed to check username availability' },
      { status: 500 }
    );
  }
} 