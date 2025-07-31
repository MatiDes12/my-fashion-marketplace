import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for direct access
);

export async function POST(request: Request) {
  try {
    const { userId, chatId, username, firstName, lastName } = await request.json();

    if (!userId || !chatId) {
      return NextResponse.json(
        { error: 'userId and chatId are required' },
        { status: 400 }
      );
    }

    console.log('Direct API - Attempting to link Telegram account:', { userId, chatId, username, firstName, lastName });

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Direct API - User not found:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Link Telegram account directly using service role
    const { data: linkData, error: linkError } = await supabase
      .from('telegram_users')
      .upsert({
        user_id: userId,
        chat_id: chatId,
        username: username || null,
        first_name: firstName || null,
        last_name: lastName || null,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select();

    if (linkError) {
      console.error('Direct API - Error linking Telegram account:', linkError);
      return NextResponse.json(
        { success: false, error: 'Failed to link account', details: linkError },
        { status: 500 }
      );
    }

    console.log('Direct API - Telegram account linked successfully:', linkData);

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram account linked successfully',
      data: linkData
    });

  } catch (error) {
    console.error('Direct API - Error linking Telegram account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to link account' },
      { status: 500 }
    );
  }
} 