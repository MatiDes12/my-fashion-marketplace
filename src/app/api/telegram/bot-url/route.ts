import { NextResponse } from 'next/server';
import { getTelegramBotUrl } from '@/lib/telegram';

export async function GET() {
  try {
    console.log('Getting Telegram bot URL...');
    const botUrl = await getTelegramBotUrl();
    console.log('Bot URL retrieved:', botUrl);
    
    return NextResponse.json({ 
      success: true, 
      botUrl 
    });
  } catch (error) {
    console.error('Error getting bot URL:', error);
    // Fallback to default URL
    return NextResponse.json({ 
      success: true, 
      botUrl: 'https://t.me/Avrioxshop_bot' 
    });
  }
} 