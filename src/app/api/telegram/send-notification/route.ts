import { NextResponse } from 'next/server';
import { TelegramBot, getTelegramConfig } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const { type, userId, data } = await request.json();

    if (!type || !userId) {
      return NextResponse.json(
        { error: 'Type and userId are required' },
        { status: 400 }
      );
    }

    // Get Telegram configuration
    const config = await getTelegramConfig();
    const bot = new TelegramBot(config);

    // Send notification based on type
    switch (type) {
      case 'order_created':
        await bot.sendOrderNotification(userId, data);
        break;
      case 'order_confirmation':
        await bot.sendOrderConfirmation(userId, data);
        break;
      case 'payment_success':
      case 'payment_failed':
        await bot.sendPaymentNotification(userId, data);
        break;
      case 'delivery_update':
        await bot.sendDeliveryUpdate(userId, data);
        break;
      case 'seller_notification':
        await bot.sendSellerNotification(userId, data);
        break;
      case 'admin_alert':
        await bot.sendAdminAlert(data.message, data.level);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid notification type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 }
    );
  }
} 