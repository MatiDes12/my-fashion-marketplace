import { NextResponse } from 'next/server';
import { TelegramBot, TelegramUpdate, getTelegramConfig } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const update: TelegramUpdate = await request.json();
    
    // Get Telegram configuration
    const config = await getTelegramConfig();
    const bot = new TelegramBot(config);

    // Handle the update
    await bot.handleUpdate(update);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
} 