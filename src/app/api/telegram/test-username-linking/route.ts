import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

const supabaseService = supabaseServer;

export async function POST(request: Request) {
  try {
    const { username, chatId, firstName, lastName } = await request.json();

    console.log(`[TEST_USERNAME_LINKING] Testing with username: ${username}, chatId: ${chatId}`);

    // Check if this chat_id is already linked
    const { data: existingUser } = await supabaseService
      .from('telegram_users')
      .select('user_id, username')
      .eq('chat_id', chatId.toString())
      .eq('is_active', true)
      .single();

    if (existingUser) {
      console.log(`[TEST_USERNAME_LINKING] Chat ID ${chatId} is already linked to user ${existingUser.user_id}`);
      return NextResponse.json({
        success: false,
        message: 'Already linked',
        existingUser
      });
    }

    // Check if there's a pending username link for this user
    if (username) {
      console.log(`[TEST_USERNAME_LINKING] Looking for pending link with username: ${username}`);
      
      type PendingLink = { user_id: string; username: string | null; chat_id: string };
      const { data: pendingLink } = await supabaseService
        .from('telegram_users')
        .select('user_id, chat_id, username')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      console.log(`[TEST_USERNAME_LINKING] Found pending link:`, pendingLink);

      const pending = pendingLink as unknown as PendingLink | null;
      if (pending && typeof pending.chat_id === 'string' && pending.chat_id.startsWith('pending_')) {
        console.log(`[TEST_USERNAME_LINKING] Would update pending link for user ${pending.user_id}`);
        
        // Simulate the update (don't actually update in test mode)
        const updateData = {
          chat_id: chatId.toString(),
          first_name: firstName || null,
          last_name: lastName || null,
          updated_at: new Date().toISOString()
        };

        return NextResponse.json({
          success: true,
          message: 'Would successfully link',
          pendingLink: pending,
          wouldUpdate: updateData,
          testMode: true
        });
      } else {
        console.log(`[TEST_USERNAME_LINKING] No pending link found for username ${username}`);
        
        return NextResponse.json({
          success: false,
          message: 'No pending link found',
          username,
          chatId
        });
      }
    } else {
      console.log(`[TEST_USERNAME_LINKING] No username provided`);
      return NextResponse.json({
        success: false,
        message: 'No username provided',
        chatId
      });
    }

  } catch (error) {
    console.error('[TEST_USERNAME_LINKING] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 