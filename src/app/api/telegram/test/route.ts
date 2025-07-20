import { NextResponse } from 'next/server';
import { getTelegramConfig } from '@/lib/telegram';

export async function GET() {
  try {
    console.log('Testing Telegram configuration...');
    
    // Test environment variables
    const envVars = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Not set',
      TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID ? 'Set' : 'Not set',
      TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL ? 'Set' : 'Not set',
      TELEGRAM_SUPPORT_CHAT_ID: process.env.TELEGRAM_SUPPORT_CHAT_ID ? 'Set' : 'Not set',
    };
    
    console.log('Environment variables:', envVars);
    
    // Test configuration loading
    const config = await getTelegramConfig();
    console.log('Configuration loaded successfully:', {
      botToken: config.botToken ? 'Set' : 'Not set',
      adminChatId: config.adminChatId,
      webhookUrl: config.webhookUrl,
      supportChatId: config.supportChatId
    });
    
    return NextResponse.json({
      success: true,
      message: 'Telegram configuration is working',
      config: {
        botToken: config.botToken ? 'Set' : 'Not set',
        adminChatId: config.adminChatId,
        webhookUrl: config.webhookUrl,
        supportChatId: config.supportChatId
      },
      environment: envVars
    });
    
  } catch (error) {
    console.error('Telegram test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Not set',
        TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID ? 'Set' : 'Not set',
        TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL ? 'Set' : 'Not set',
        TELEGRAM_SUPPORT_CHAT_ID: process.env.TELEGRAM_SUPPORT_CHAT_ID ? 'Set' : 'Not set',
      }
    }, { status: 500 });
  }
} 