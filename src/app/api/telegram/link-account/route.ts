import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { linkTelegramUser, getTelegramConfig, TelegramBot } from '@/lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
        { error: 'Unauthorized to link this account' },
        { status: 403 }
      );
    }

    // Verify user exists in users table
    const { data: user, error: userError } = await supabaseWithAuth
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

    // Link Telegram account using the authenticated client
    console.log('API - Attempting to link Telegram account:', { userId, chatId, username, firstName, lastName });
    
    const { data: linkData, error: linkError } = await supabaseWithAuth
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
      console.error('Error linking Telegram account:', linkError);
      return NextResponse.json(
        { success: false, error: 'Failed to link account', details: linkError },
        { status: 500 }
      );
    }

    console.log('API - Telegram account linked successfully:', linkData);

    // Send welcome notification to the user
    try {
      const config = await getTelegramConfig();
      const bot = new TelegramBot(config);
      
      // Get user details for personalized message
      const { data: userDetails } = await supabaseWithAuth
        .from('users')
        .select('full_name, email')
        .eq('id', userId)
        .single();

      const welcomeMessage = `
🎉 <b>Welcome to AVRIO!</b>

Hi ${userDetails?.full_name || 'there'}! 👋

Your Telegram account has been successfully linked to your AVRIO account.
${username ? `\n📱 Username: @${username}` : ''}

<b>What you'll receive:</b>
📦 Order updates and tracking
💳 Payment confirmations
🚚 Delivery notifications
🎯 Flash sale alerts
🆘 Customer support

<b>Quick Commands:</b>
/start - Welcome message
/orders - View your orders
/profile - Your account info
/help - Show all commands
/support - Contact support

🔗 <b>Visit our shop:</b>
<a href="https://www.avrioxshop.com">AVRIO Marketplace</a>

🏆 Best Marketplace 2023 | ⭐ 4.9/5 Rating | 🔒 Secure Payments | 🚚 Fast Delivery

Thank you for choosing AVRIO! 🛍️
      `;

      await bot.sendMessage({
        chat_id: chatId,
        text: welcomeMessage,
        parse_mode: 'HTML'
      });

      console.log('Welcome notification sent successfully to chat ID:', chatId);

    } catch (notificationError) {
      console.error('Failed to send welcome notification:', notificationError);
      // Don't fail the entire request if notification fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram account linked successfully',
      data: linkData
    });

  } catch (error) {
    console.error('Error linking Telegram account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to link account' },
      { status: 500 }
    );
  }
} 