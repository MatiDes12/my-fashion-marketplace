import { NextResponse } from 'next/server';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const { webhookUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'webhookUrl is required' },
        { status: 400 }
      );
    }

    // Get Telegram configuration
    const config = await getTelegramConfig();
    const bot = new TelegramBot(config);

    // Set webhook
    const result = await bot.setWebhook(webhookUrl);

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook set successfully',
      result 
    });

  } catch (error) {
    console.error('Error setting webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set webhook' },
      { status: 500 }
    );
  }
} 