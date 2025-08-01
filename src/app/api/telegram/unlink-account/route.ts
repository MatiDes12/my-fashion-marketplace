import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    // Create a Supabase client with the user's token
    const supabaseWithAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verify user exists and matches the authenticated user
    const { data: { user: authUser }, error: authError } = await supabaseWithAuth.auth.getUser();
    
    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the userId matches the authenticated user
    if (authUser.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to unlink this account' },
        { status: 403 }
      );
    }

    // Get the current Telegram link before unlinking
    const { data: currentLink, error: linkError } = await supabaseWithAuth
      .from('telegram_users')
      .select('chat_id, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (linkError || !currentLink) {
      return NextResponse.json(
        { error: 'No active Telegram link found' },
        { status: 404 }
      );
    }

    // Unlink Telegram account by setting is_active to false
    const { error: unlinkError } = await supabaseWithAuth
      .from('telegram_users')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (unlinkError) {
      console.error('Error unlinking Telegram account:', unlinkError);
      return NextResponse.json(
        { success: false, error: 'Failed to unlink account', details: unlinkError },
        { status: 500 }
      );
    }

    console.log('API - Telegram account unlinked successfully for user:', userId);

    // Send goodbye notification to the user (optional - don't fail if this doesn't work)
    try {
      // Dynamically import to avoid issues with environment variables
      const { getTelegramConfig, TelegramBot } = await import('@/lib/telegram');
      
      const config = await getTelegramConfig();
      const bot = new TelegramBot(config);
      
      // Get user details for personalized message
      const { data: userDetails } = await supabaseWithAuth
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      const goodbyeMessage = `
👋 <b>Goodbye from AVRIO!</b>

Hi ${userDetails?.full_name || 'there'},

Your Telegram account has been successfully unlinked from your AVRIO account.

<b>What you'll miss:</b>
📦 Real-time order updates
💳 Payment confirmations
🚚 Delivery tracking
🎯 Flash sale alerts
🆘 Quick customer support

<b>To re-enable notifications:</b>
1. Visit your profile page
2. Click "Link Telegram Account"
3. Follow the instructions

🔗 <b>Visit our shop:</b>
<a href="https://www.avrioxshop.com">AVRIO Marketplace</a>

We hope to see you back soon! 🛍️

🏆 Best Marketplace 2023 | ⭐ 4.9/5 Rating | 🔒 Secure Payments | 🚚 Fast Delivery
      `;

      await bot.sendMessage({
        chat_id: currentLink.chat_id,
        text: goodbyeMessage,
        parse_mode: 'HTML'
      });

      console.log('Goodbye notification sent successfully to chat ID:', currentLink.chat_id);

    } catch (notificationError) {
      console.error('Failed to send goodbye notification (this is optional):', notificationError);
      // Don't fail the entire request if notification fails
      // This is expected behavior if bot is not configured or Telegram API is down
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram account unlinked successfully' 
    });

  } catch (error) {
    console.error('Error unlinking Telegram account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unlink account' },
      { status: 500 }
    );
  }
} 