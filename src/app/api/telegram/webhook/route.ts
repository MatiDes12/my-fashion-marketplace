import { NextResponse } from 'next/server';
import { TelegramBot, TelegramUpdate, getTelegramConfig } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    // Log the incoming request for debugging
    console.log('Telegram webhook received');
    
    const update: TelegramUpdate = await request.json();
    console.log('Update data:', JSON.stringify(update, null, 2));
    
    // Get Telegram configuration with better error handling
    let config;
    try {
      config = await getTelegramConfig();
      console.log('Telegram config loaded successfully');
    } catch (configError) {
      console.error('Failed to load Telegram config:', configError);
      
      // Fallback to environment variables directly
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      
      if (!botToken || !adminChatId) {
        throw new Error('Telegram configuration not available');
      }
      
      config = {
        botToken,
        botUsername: process.env.TELEGRAM_BOT_USERNAME || 'Avrioxshop_bot',
        webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
        adminChatId,
        supportChatId: process.env.TELEGRAM_SUPPORT_CHAT_ID || adminChatId
      };
      console.log('Using fallback config from environment variables');
    }

    const bot = new TelegramBot(config);

    // Handle the update
    await bot.handleUpdate(update);
    console.log('Update handled successfully');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    
    // Return a more detailed error response for debugging
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 