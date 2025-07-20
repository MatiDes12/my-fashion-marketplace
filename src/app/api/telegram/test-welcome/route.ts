import { NextResponse } from 'next/server';
import { getTelegramConfig, TelegramBot } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const { chatId, userId } = await request.json();

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      );
    }

    const config = await getTelegramConfig();
    const bot = new TelegramBot(config);

    const welcomeMessage = `
🎉 <b>Welcome to AVRIO!</b>

Hi there! 👋

Your Telegram account has been successfully linked to your AVRIO account.

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

    return NextResponse.json({ 
      success: true, 
      message: 'Welcome message sent successfully' 
    });

  } catch (error) {
    console.error('Error sending test welcome message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send welcome message' },
      { status: 500 }
    );
  }
} 