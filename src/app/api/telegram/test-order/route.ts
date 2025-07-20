import { NextResponse } from 'next/server';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    // Get Telegram configuration
    const config = await getTelegramConfig();
    const bot = new TelegramBot(config);

    // Test order data
    const testOrderData = {
      id: 'test-order-123',
      product: { title: 'Test Fashion Product' },
      total_price: 2500,
      order_status: 'confirmed',
      buyer: { 
        full_name: 'Test Customer', 
        phone: '+251912345678' 
      },
      created_at: new Date().toISOString()
    };

    // Send test notification
    await bot.sendOrderNotification('test-user', testOrderData);

    return NextResponse.json({ 
      success: true, 
      message: 'Test order notification sent successfully',
      orderData: testOrderData
    });

  } catch (error) {
    console.error('Error sending test order notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
} 