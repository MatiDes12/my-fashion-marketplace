// Test version of Telegram integration for development
// This allows you to test the integration without a real bot

export interface TestTelegramConfig {
  botToken: string;
  webhookUrl: string;
  adminChatId: string;
  supportChatId: string;
}

export interface TestTelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  timestamp?: string;
}

export class TestTelegramBot {
  private config: TestTelegramConfig;
  private messageLog: TestTelegramMessage[] = [];

  constructor(config: TestTelegramConfig) {
    this.config = config;
  }

  async sendMessage(message: TestTelegramMessage): Promise<any> {
    // Log the message instead of sending it
    this.messageLog.push({
      ...message,
      timestamp: new Date().toISOString()
    });

    console.log('🔔 Test Telegram Message:', {
      to: message.chat_id,
      text: message.text,
      timestamp: new Date().toISOString()
    });

    // Simulate API response
    return {
      ok: true,
      result: {
        message_id: Math.floor(Math.random() * 1000),
        date: Math.floor(Date.now() / 1000),
        text: message.text,
        chat: { id: message.chat_id }
      }
    };
  }

  async sendOrderNotification(userId: string, orderData: any): Promise<void> {
    const message = this.formatOrderNotification(orderData);
    await this.sendMessage({
      chat_id: this.config.adminChatId, // Send to admin for testing
      text: message,
      parse_mode: 'HTML'
    });
  }

  async sendPaymentNotification(userId: string, paymentData: any): Promise<void> {
    const message = this.formatPaymentNotification(paymentData);
    await this.sendMessage({
      chat_id: this.config.adminChatId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async sendDeliveryUpdate(userId: string, deliveryData: any): Promise<void> {
    const message = this.formatDeliveryUpdate(deliveryData);
    await this.sendMessage({
      chat_id: this.config.adminChatId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async sendAdminAlert(message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    const emoji = type === 'error' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️';
    await this.sendMessage({
      chat_id: this.config.adminChatId,
      text: `${emoji} <b>Admin Alert</b>\n\n${message}`,
      parse_mode: 'HTML'
    });
  }

  async sendSellerNotification(sellerId: string, notificationData: any): Promise<void> {
    const message = this.formatSellerNotification(notificationData);
    await this.sendMessage({
      chat_id: this.config.adminChatId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  // Get message log for testing
  getMessageLog(): TestTelegramMessage[] {
    return this.messageLog;
  }

  // Clear message log
  clearMessageLog(): void {
    this.messageLog = [];
  }

  // Message formatting methods (same as real bot)
  private formatOrderNotification(orderData: any): string {
    return `
🛍️ <b>New Order Received!</b>

Order ID: <code>${orderData.id}</code>
Product: ${orderData.product?.title || 'N/A'}
Amount: ${orderData.total_price} ETB
Status: ${orderData.order_status}

Customer: ${orderData.buyer?.full_name || 'N/A'}
Phone: ${orderData.buyer?.phone || 'N/A'}

Order Date: ${new Date(orderData.created_at).toLocaleString()}
    `;
  }

  private formatPaymentNotification(paymentData: any): string {
    const status = paymentData.status === 'SUCCESS' ? '✅ Successful' : '❌ Failed';
    return `
💳 <b>Payment ${paymentData.status === 'SUCCESS' ? 'Successful' : 'Failed'}</b>

Order ID: <code>${paymentData.order_id}</code>
Amount: ${paymentData.amount} ETB
Method: ${paymentData.method}
Status: ${status}

${paymentData.status === 'SUCCESS' ? 'Your order has been confirmed and is being processed!' : 'Please try again or contact support.'}
    `;
  }

  private formatDeliveryUpdate(deliveryData: any): string {
    const statusEmoji: Record<string, string> = {
      'assigned': '📋',
      'picked_up': '📦',
      'in_transit': '🚚',
      'delivered': '✅',
      'failed': '❌'
    };

    return `
${statusEmoji[deliveryData.status] || '📦'} <b>Delivery Update</b>

Order ID: <code>${deliveryData.order_id}</code>
Status: ${deliveryData.status.toUpperCase()}
${deliveryData.notes ? `Notes: ${deliveryData.notes}` : ''}

Updated: ${new Date(deliveryData.updated_at).toLocaleString()}
    `;
  }

  private formatSellerNotification(notificationData: any): string {
    return `
💰 <b>Seller Notification</b>

Type: ${notificationData.type}
${notificationData.message}

${notificationData.amount ? `Amount: ${notificationData.amount} ETB` : ''}
${notificationData.order_id ? `Order ID: ${notificationData.order_id}` : ''}

Date: ${new Date().toLocaleString()}
    `;
  }
}

// Test configuration
export const getTestTelegramConfig = (): TestTelegramConfig => {
  return {
    botToken: 'test_bot_token',
    webhookUrl: 'https://yourdomain.com/api/telegram/webhook',
    adminChatId: '5265283795', // Your actual chat ID
    supportChatId: '5265283795'
  };
}; 