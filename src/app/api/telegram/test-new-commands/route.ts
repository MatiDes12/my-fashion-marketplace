import { NextRequest, NextResponse } from 'next/server';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const config = await getTelegramConfig();
    const bot = new TelegramBot(config);
    
    const { chatId, command } = await request.json();
    
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    let result;
    switch (command) {
      case 'search':
        await bot['sendSearchInstructions'](chatId);
        result = 'Search instructions sent';
        break;
      case 'categories':
        await bot['sendCategories'](chatId);
        result = 'Categories sent';
        break;
      case 'deals':
        await bot['sendAllDeals'](chatId);
        result = 'All deals sent';
        break;
      case 'products':
        await bot['sendProductsOverview'](chatId);
        result = 'Products overview sent';
        break;
      default:
        return NextResponse.json({ error: 'Invalid command' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: result,
      command,
      chatId 
    });

  } catch (error) {
    console.error('Error testing new commands:', error);
    return NextResponse.json({ 
      error: 'Failed to test commands',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 