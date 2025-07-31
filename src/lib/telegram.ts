import { createClient } from '@supabase/supabase-js';

// Create both anon and service role clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TelegramConfig {
  botToken: string;
  webhookUrl: string;
  adminChatId: string;
  supportChatId: string;
}

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: {
    inline_keyboard?: Array<Array<{
      text: string;
      callback_data?: string;
      url?: string;
    }>>;
    keyboard?: Array<Array<{
      text: string;
      callback_data?: string;
    }>>;
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    date: number;
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
      date: number;
      text: string;
    };
    data?: string;
  };
}

export class TelegramBot {
  private config: TelegramConfig;
  private baseUrl: string;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${config.botToken}`;
  }

  async sendMessage(message: TelegramMessage): Promise<any> {
    try {
      // Log the message being sent for debugging
      console.log('[TELEGRAM] Sending message:', {
        chat_id: message.chat_id,
        text_length: message.text?.length,
        parse_mode: message.parse_mode,
        has_reply_markup: !!message.reply_markup
      });

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TELEGRAM] API error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`Telegram API error: ${response.status} - ${errorData.description || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  async sendPhoto(photoData: {
    chat_id: string;
    photo: string;
    caption?: string;
    parse_mode?: 'HTML' | 'Markdown';
    reply_markup?: {
      inline_keyboard?: Array<Array<{
        text: string;
        callback_data?: string;
        url?: string;
      }>>;
    };
  }): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/sendPhoto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(photoData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram API error:', errorData);
        throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending Telegram photo:', error);
      throw error;
    }
  }

  // Helper method to log notifications to database
  private async logNotification(
    userId: string | null,
    chatId: string,
    notificationType: string,
    messageText: string,
    metadata: any = null,
    status: 'sent' | 'failed' | 'pending' = 'sent',
    errorMessage: string | null = null
  ): Promise<void> {
    try {
      await supabaseService
        .from('telegram_notifications')
        .insert({
          user_id: userId,
          chat_id: chatId,
          notification_type: notificationType,
          message_text: messageText,
          metadata: metadata,
          status: status,
          error_message: errorMessage,
          sent_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging notification to database:', error);
      // Don't throw error to avoid breaking the main notification flow
    }
  }

  async setWebhook(url: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`Failed to set webhook: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error setting webhook:', error);
      throw error;
    }
  }

  async getWebhookInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/getWebhookInfo`);
      return await response.json();
    } catch (error) {
      console.error('Error getting webhook info:', error);
      throw error;
    }
  }

  // Notification methods
  async sendOrderNotification(userId: string, orderData: any): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('chat_id')
        .eq('user_id', userId)
        .single();

      if (!user?.chat_id) return;

      const message = this.formatOrderNotification(orderData);
      
      try {
        await this.sendMessage({
          chat_id: user.chat_id,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'View Order Details',
                  callback_data: `order_${orderData.id}`
                },
                {
                  text: 'Track Delivery',
                  callback_data: `track_${orderData.id}`
                }
              ]
            ]
          }
        });
        
        // Log successful notification
        await this.logNotification(
          userId,
          user.chat_id,
          'order_notification',
          message,
          { orderData, orderId: orderData.id }
        );
      } catch (sendError) {
        // Log failed notification
        await this.logNotification(
          userId,
          user.chat_id,
          'order_notification',
          message,
          { orderData, orderId: orderData.id },
          'failed',
          sendError instanceof Error ? sendError.message : 'Unknown error'
        );
        throw sendError;
      }
    } catch (error) {
      console.error('Error sending order notification:', error);
    }
  }

  async sendOrderConfirmation(userId: string, orderData: any): Promise<void> {
    try {
      console.log('[TELEGRAM] Attempting to send order confirmation for user:', userId);
      
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('chat_id')
        .eq('user_id', userId)
        .single();

      if (!user?.chat_id) {
        console.log('[TELEGRAM] User not linked to Telegram, skipping order confirmation for user:', userId);
        return;
      }
      
      console.log('[TELEGRAM] User linked to Telegram, sending order confirmation to chat_id:', user.chat_id);
      console.log('[TELEGRAM] Order confirmation data:', {
        orderId: orderData.orderId,
        productName: orderData.productName,
        orderData: orderData
      });

      const message = this.formatOrderConfirmation(orderData);
      
      const inlineKeyboard = [
        [
          {
            text: '📦 Track Order',
            callback_data: `track_${orderData.orderId}`
          },
          {
            text: '🛒 View Orders',
            callback_data: 'orders'
          }
        ],
        [
          {
            text: '💬 Contact Support',
            callback_data: 'support'
          }
        ]
      ];

      try {
        await this.sendMessage({
          chat_id: user.chat_id,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
        
        // Log successful order confirmation
        await this.logNotification(
          userId,
          user.chat_id,
          'order_confirmation',
          message,
          { orderData, orderId: orderData.orderId }
        );
      } catch (sendError) {
        // Log failed order confirmation
        await this.logNotification(
          userId,
          user.chat_id,
          'order_confirmation',
          message,
          { orderData, orderId: orderData.orderId },
          'failed',
          sendError instanceof Error ? sendError.message : 'Unknown error'
        );
        throw sendError;
      }
    } catch (error) {
      console.error('Error sending order confirmation:', error);
    }
  }

  async sendPaymentNotification(userId: string, paymentData: any): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('chat_id')
        .eq('user_id', userId)
        .single();

      if (!user?.chat_id) return;

      const message = this.formatPaymentNotification(paymentData);
      
      // Create inline keyboard with useful actions
      const inlineKeyboard = [];
      
      // Add receipt button if available and not localhost
      if (paymentData.receiptUrl) {
        // Check if the URL contains localhost to avoid Telegram API errors
        const isLocalhost = process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') || 
                           process.env.NEXT_PUBLIC_SITE_URL?.includes('127.0.0.1') ||
                           paymentData.receiptUrl.includes('localhost') ||
                           paymentData.receiptUrl.includes('127.0.0.1');
        
        if (!isLocalhost) {
          inlineKeyboard.push([
            {
              text: '📄 View Receipt',
              url: paymentData.receiptUrl
            }
          ]);
        }
      }
      
      // Add order tracking buttons
      inlineKeyboard.push([
        {
          text: '📦 Track Order',
          callback_data: `track_${paymentData.orderId || paymentData.order_id}`
        },
        {
          text: '🛒 View Orders',
          callback_data: 'orders'
        }
      ]);
      
      // Add support button
      inlineKeyboard.push([
        {
          text: '💬 Contact Support',
          callback_data: 'support'
        }
      ]);

      try {
        await this.sendMessage({
          chat_id: user.chat_id,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
        
        // Log successful notification
        await this.logNotification(
          userId,
          user.chat_id,
          'payment_notification',
          message,
          { paymentData, orderId: paymentData.orderId || paymentData.order_id }
        );
      } catch (sendError) {
        // Log failed notification
        await this.logNotification(
          userId,
          user.chat_id,
          'payment_notification',
          message,
          { paymentData, orderId: paymentData.orderId || paymentData.order_id },
          'failed',
          sendError instanceof Error ? sendError.message : 'Unknown error'
        );
        throw sendError;
      }
    } catch (error) {
      console.error('Error sending payment notification:', error);
    }
  }

  async sendDeliveryUpdate(userId: string, deliveryData: any): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('chat_id')
        .eq('user_id', userId)
        .single();

      if (!user?.chat_id) return;

      const message = this.formatDeliveryUpdate(deliveryData);
      
      try {
        await this.sendMessage({
          chat_id: user.chat_id,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'View Delivery Details',
                  callback_data: `delivery_${deliveryData.order_id}`
                }
              ]
            ]
          }
        });
        
        // Log successful delivery update
        await this.logNotification(
          userId,
          user.chat_id,
          'delivery_update',
          message,
          { deliveryData, orderId: deliveryData.order_id }
        );
      } catch (sendError) {
        // Log failed delivery update
        await this.logNotification(
          userId,
          user.chat_id,
          'delivery_update',
          message,
          { deliveryData, orderId: deliveryData.order_id },
          'failed',
          sendError instanceof Error ? sendError.message : 'Unknown error'
        );
        throw sendError;
      }
    } catch (error) {
      console.error('Error sending delivery update:', error);
    }
  }

  async sendAdminAlert(message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    try {
      const emoji = type === 'error' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️';
      const formattedMessage = `${emoji} <b>Admin Alert</b>\n\n${message}`;
      
      try {
        await this.sendMessage({
          chat_id: this.config.adminChatId,
          text: formattedMessage,
          parse_mode: 'HTML'
        });
        
        // Log successful admin alert
        await this.logNotification(
          null, // No specific user for admin alerts
          this.config.adminChatId,
          'admin_alert',
          formattedMessage,
          { originalMessage: message, type }
        );
      } catch (sendError) {
        // Log failed admin alert
        await this.logNotification(
          null,
          this.config.adminChatId,
          'admin_alert',
          formattedMessage,
          { originalMessage: message, type },
          'failed',
          sendError instanceof Error ? sendError.message : 'Unknown error'
        );
        throw sendError;
      }
    } catch (error) {
      console.error('Error sending admin alert:', error);
    }
  }

  async sendSellerNotification(sellerId: string, notificationData: any): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('chat_id')
        .eq('user_id', sellerId)
        .single();

      if (!user?.chat_id) return;

      const message = this.formatSellerNotification(notificationData);
      
      try {
        await this.sendMessage({
          chat_id: user.chat_id,
          text: message,
          parse_mode: 'HTML'
        });
        
        // Log successful notification
        await this.logNotification(
          sellerId,
          user.chat_id,
          'seller_notification',
          message,
          { notificationData }
        );
      } catch (sendError) {
        // Log failed notification
        await this.logNotification(
          sellerId,
          user.chat_id,
          'seller_notification',
          message,
          { notificationData },
          'failed',
          sendError instanceof Error ? sendError.message : 'Unknown error'
        );
        throw sendError;
      }
    } catch (error) {
      console.error('Error sending seller notification:', error);
    }
  }

  async sendReceipt(userId: string, receiptData: any): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('chat_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!user?.chat_id) {
        console.log('[TELEGRAM] No active Telegram user found for userId:', userId);
        return;
      }

      let message = this.formatReceipt(receiptData);
      
      // Check message length (Telegram limit is 4096 characters)
      if (message.length > 4000) {
        console.warn('[TELEGRAM] Message too long, truncating:', message.length);
        // Truncate message if too long
        message = message.substring(0, 4000) + '\n\n... (message truncated)';
      }
      
      try {
        // Create a simplified message without complex formatting for testing
        const simpleMessage = `
🧾 <b>Payment Receipt - AVRIO</b>

📋 Receipt No: <code>${receiptData.txRef ? receiptData.txRef.slice(-12) : 'N/A'}</code>
Order ID: <code>${receiptData.orderId ? receiptData.orderId.slice(-12) : 'N/A'}</code>
Amount: <b>${receiptData.amount} ETB</b>
Status: ✅ Paid

👤 Customer: ${receiptData.customerName || 'Customer'}
🛍️ Product: ${receiptData.productName || 'Product'}
💳 Method: ${receiptData.paymentMethod || 'N/A'}

🎉 Thank you for your purchase!
        `.trim();

        // Check if we have a valid site URL (not localhost) for the receipt button
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
        const isLocalhost = siteUrl?.includes('localhost') || siteUrl?.includes('127.0.0.1');
        
        let replyMarkup = undefined;
        
        if (!isLocalhost && receiptData.receiptUrl) {
          // Only add receipt button if we have a valid production URL
          let receiptUrl = receiptData.receiptUrl;
          if (!receiptUrl.startsWith('http')) {
            receiptUrl = `${siteUrl}${receiptUrl}`;
          }
          
          replyMarkup = {
            inline_keyboard: [
              [
                {
                  text: '📄 Download Receipt',
                  url: receiptUrl
                }
              ]
            ]
          };
        }

        await this.sendMessage({
          chat_id: user.chat_id,
          text: simpleMessage,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        });
        
        // Log successful receipt
        await this.logNotification(
          userId,
          user.chat_id,
          'receipt',
          simpleMessage,
          { receiptData, orderId: receiptData.orderId }
        );
        
        console.log('[TELEGRAM] Receipt sent successfully to user:', userId);
      } catch (sendError) {
        console.error('[TELEGRAM] Failed to send receipt:', sendError);
        
        // Log failed receipt
        await this.logNotification(
          userId,
          user.chat_id,
          'receipt',
          message,
          { receiptData, orderId: receiptData.orderId },
          'failed',
          sendError instanceof Error ? sendError.message : 'Unknown error'
        );
        
        // Don't throw error to avoid breaking the payment flow
        // Just log it and continue
      }
    } catch (error) {
      console.error('Error in sendReceipt:', error);
      // Don't throw error to avoid breaking the payment flow
    }
  }

  // Message formatting methods
  private formatDeliveryAddress(address: any): string {
    if (!address) return '';
    
    // If address is a string, try to parse it as JSON first
    if (typeof address === 'string') {
      try {
        const parsedAddress = JSON.parse(address);
        if (typeof parsedAddress === 'object') {
          address = parsedAddress;
        } else {
          return address; // Return as is if parsing doesn't result in an object
        }
      } catch (e) {
        return address; // Return as is if JSON parsing fails
      }
    }
    
    // If address is a JSON object, format it nicely
    if (typeof address === 'object') {
      const parts = [];
      
      if (address.houseNo) parts.push(`House ${address.houseNo}`);
      if (address.kebele) parts.push(`Kebele ${address.kebele}`);
      if (address.wereda) parts.push(`Wereda ${address.wereda}`);
      if (address.subCity) parts.push(address.subCity);
      if (address.city) parts.push(address.city);
      if (address.landmark) parts.push(`Near ${address.landmark}`);
      
      return parts.join(', ');
    }
    
    return '';
  }

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

  private formatOrderConfirmation(orderData: any): string {
    const amount = typeof orderData.amount === 'number' ? orderData.amount.toLocaleString() : orderData.amount;
    
    // Format delivery address
    const formattedAddress = this.formatDeliveryAddress(orderData.deliveryAddress);
    const addressLine = formattedAddress ? `📍 Address: ${formattedAddress}` : '';
    
    return `
🎉 <b>Order Confirmed - AVRIO</b>

📦 <b>Order Details:</b>
Order ID: <code>${orderData.orderId.slice(-12)}</code>
Product: ${orderData.productName || 'Product'}
Quantity: ${orderData.quantity || 1}
Total Amount: <b>${amount} ETB</b>

📋 <b>Order Status:</b>
Status: ${orderData.orderStatus || 'Confirmed'}
Payment: ${orderData.paymentStatus || 'Paid'}

👤 <b>Customer:</b>
Name: ${orderData.customerName || 'Customer'}
Email: ${orderData.customerEmail || 'N/A'}

📅 Date: ${new Date(orderData.createdAt || Date.now()).toLocaleString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

🚚 <b>Delivery:</b>
Method: ${orderData.deliveryMethod === 'home_delivery' ? '🏠 Home Delivery' : 
         orderData.deliveryMethod === 'store_pickup' ? '🏪 Store Pickup' : 
         orderData.deliveryMethod || 'Standard Delivery'}
${addressLine}
${orderData.pickupCode ? `🔑 Pickup Code: <code>${orderData.pickupCode}</code>` : ''}

🎯 <b>Next Steps:</b>
• We'll notify you when your order is shipped
• Track your delivery in real-time
• Contact support if you have any questions

🔗 <a href="https://www.avrioxshop.com/orders">View All Orders</a>
    `;
  }

  private formatPaymentNotification(paymentData: any): string {
    const status = paymentData.status === 'paid' || paymentData.status === 'SUCCESS' ? '✅ Successful' : '❌ Failed';
    const amount = typeof paymentData.amount === 'number' ? paymentData.amount.toLocaleString() : paymentData.amount;
    
    // Shorten transaction ref and reference to show only the last section
    const txRef = paymentData.txRef || paymentData.tx_ref || 'N/A';
    const reference = paymentData.reference || '';
    const shortTxRef = txRef !== 'N/A' ? txRef.split('-').pop() || txRef : 'N/A';
    const shortReference = reference ? reference.split('-').pop() || reference : '';
    
    let message = `
💳 <b>Payment Confirmation - AVRIO</b>

🎯 <b>Order Details:</b>
Order ID: <code>${(paymentData.orderId || paymentData.order_id).slice(-12)}</code>
Product: ${paymentData.productName || 'Product'}
Amount: <b>${amount} ETB</b>

💳 <b>Payment Info:</b>
Method: ${paymentData.paymentMethod || paymentData.method}
Status: ${status}
Transaction Ref: <code>${shortTxRef}</code>
${shortReference ? `Reference: <code>${shortReference}</code>` : ''}

👤 <b>Customer:</b>
Name: ${paymentData.customerName || 'Customer'}
Email: ${paymentData.customerEmail || 'N/A'}

📅 Date: ${new Date(paymentData.createdAt || Date.now()).toLocaleString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

${paymentData.receiptUrl ? `📄 <a href="${paymentData.receiptUrl}">View Receipt</a>` : ''}

🎉 <b>Your order has been confirmed and is being processed!</b>

🔗 <a href="https://www.avrioxshop.com/orders">Track Your Order</a>
    `;

    return message;
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

  private formatReceipt(receiptData: any): string {
    const amount = typeof receiptData.amount === 'number' ? receiptData.amount.toLocaleString() : receiptData.amount;
    
    // Format delivery address
    const formattedAddress = this.formatDeliveryAddress(receiptData.deliveryAddress);
    const addressLine = formattedAddress ? `📍 Address: ${formattedAddress}` : '';
    
    return `
🧾 <b>Payment Receipt - AVRIO</b>

📋 <b>Receipt Details:</b>
Receipt No: <code>${receiptData.txRef || 'N/A'}</code>
Order ID: <code>${receiptData.orderId || 'N/A'}</code>
Amount: <b>${amount} ETB</b>
Status: ✅ Paid

👤 <b>Customer Information:</b>
Name: ${receiptData.customerName || 'Customer'}
Email: ${receiptData.customerEmail || 'N/A'}
Phone: ${receiptData.customerPhone || 'N/A'}

🛍️ <b>Product Information:</b>
Product: ${receiptData.productName || 'Product'}
Quantity: ${receiptData.quantity || 1}
Unit Price: ${receiptData.unitPrice || receiptData.amount} ETB

💳 <b>Payment Information:</b>
Method: ${receiptData.paymentMethod || 'N/A'}
Transaction Ref: <code>${receiptData.txRef || 'N/A'}</code>

🚚 <b>Delivery Information:</b>
Method: ${receiptData.deliveryMethod === 'home_delivery' ? '🏠 Home Delivery' : 
         receiptData.deliveryMethod === 'store_pickup' ? '🏪 Store Pickup' : 
         receiptData.deliveryMethod || 'Standard Delivery'}
${addressLine}
${receiptData.pickupCode ? `🔑 Pickup Code: <code>${receiptData.pickupCode}</code>` : ''}

🎉 <b>Thank you for your purchase!</b>
Your order has been confirmed and is being processed.

📞 <b>Need Help?</b>
Contact us: support@avrioxshop.com
    `;
  }

  private getStatusInfo(orderStatus: string, deliveryStatus?: string): { emoji: string; text: string } {
    // Priority: delivery status over order status for more accurate tracking
    const status = deliveryStatus || orderStatus;
    
    switch (status) {
      case 'pending':
        return { emoji: '⏳', text: 'Pending' };
      case 'confirmed':
        return { emoji: '✅', text: 'Confirmed' };
      case 'shipped':
        return { emoji: '📦', text: 'Shipped' };
      case 'in_transit':
        return { emoji: '🚚', text: 'In Transit' };
      case 'out_for_delivery':
        return { emoji: '🚚', text: 'Out for Delivery' };
      case 'delivered':
        return { emoji: '🎉', text: 'Delivered' };
      case 'cancelled':
        return { emoji: '❌', text: 'Cancelled' };
      case 'failed':
        return { emoji: '⚠️', text: 'Delivery Failed' };
      default:
        return { emoji: '📋', text: orderStatus || 'Unknown' };
    }
  }

  // Handle incoming messages
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
      console.error('Error handling Telegram update:', error);
    }
  }

  private async handleMessage(message: any): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text;
    const from = message.from;

    if (!text) return;

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, from);
      return;
    }

    // Handle regular messages (for support chat)
    if (chatId.toString() === this.config.supportChatId) {
      await this.handleSupportMessage(message);
      return;
    }

    // Handle username-based linking
    await this.handleUsernameLinking(chatId, from);
    
    // If no pending link was found, send a helpful message
    const { data: existingUser } = await supabaseService
      .from('telegram_users')
      .select('user_id, username')
      .eq('chat_id', chatId.toString())
      .eq('is_active', true)
      .single();

    if (!existingUser) {
      // Check if there's a pending username link
      let pendingLinkMessage = '';
      if (from.username) {
        const { data: pendingLink } = await supabaseService
          .from('telegram_users')
          .select('user_id, chat_id, username')
          .eq('username', from.username)
          .eq('is_active', true)
          .single();

        if (pendingLink && pendingLink.chat_id.startsWith('pending_')) {
          pendingLinkMessage = `

🎯 <b>Pending Link Detected!</b>
I found a pending link for username @${from.username}. 
Sending any message to this bot should complete the linking process.
          `;
        }
      }

      const helpMessage = `
💬 <b>Thanks for messaging!</b>

I see you're not linked to an AVRIO account yet. To get the most out of our bot, please link your account:${pendingLinkMessage}

🔗 <b>Link Your Account:</b>
• Visit your profile page on AVRIO
• Use the Telegram linking feature
• Or use the /link command for instructions

💡 <b>Need your Chat ID?</b>
• Use /myid to get your Telegram Chat ID
• Copy it and paste it in the profile page

📋 <b>What you'll get:</b>
📦 Order updates and tracking
💳 Payment confirmations  
🚚 Delivery notifications
🎯 Flash sale alerts
🆘 Customer support

<b>Quick Commands:</b>
/start - Welcome message
/help - Show all commands
/myid - Get your Chat ID
/debug - Debug information
/support - Contact support

🔗 <b>Visit our shop:</b>
<a href="https://www.avrioxshop.com">AVRIO Marketplace</a>
      `;

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: helpMessage,
        parse_mode: 'HTML'
      });
    }
  }

  private async handleUsernameLinking(chatId: number, from: any): Promise<void> {
    try {
      console.log(`[USERNAME_LINKING] Processing chat_id: ${chatId}, username: ${from.username}`);
      console.log(`[USERNAME_LINKING] Full from object:`, JSON.stringify(from, null, 2));
      
      // Check if this chat_id is already linked
      const { data: existingUser } = await supabaseService
        .from('telegram_users')
        .select('user_id, username')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (existingUser) {
        console.log(`[USERNAME_LINKING] Chat ID ${chatId} is already linked to user ${existingUser.user_id}`);
        return;
      }

      // Check if there's a pending username link for this user
      if (from.username) {
        console.log(`[USERNAME_LINKING] Looking for pending link with username: ${from.username}`);
        
        const { data: pendingLink } = await supabaseService
          .from('telegram_users')
          .select('user_id, chat_id, username')
          .eq('username', from.username)
          .eq('is_active', true)
          .single();

        console.log(`[USERNAME_LINKING] Found pending link:`, pendingLink);

        if (pendingLink && pendingLink.chat_id.startsWith('pending_')) {
          console.log(`[USERNAME_LINKING] Updating pending link for user ${pendingLink.user_id}`);
          
          // Update the pending link with the actual chat_id
          const { error: updateError } = await supabaseService
            .from('telegram_users')
            .update({
              chat_id: chatId.toString(),
              first_name: from.first_name || null,
              last_name: from.last_name || null,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', pendingLink.user_id)
            .eq('username', from.username);

          if (!updateError) {
            console.log(`[USERNAME_LINKING] Successfully updated chat_id from ${pendingLink.chat_id} to ${chatId}`);
            
            // Send confirmation message
            const confirmationMessage = `
🎉 <b>Account Successfully Linked!</b>

Hi ${from.first_name}! 👋

Your Telegram account (@${from.username}) has been successfully linked to your AVRIO account.

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

            await this.sendMessage({
              chat_id: chatId.toString(),
              text: confirmationMessage,
              parse_mode: 'HTML'
            });

            // Log the successful linking
            await this.logNotification(
              pendingLink.user_id,
              chatId.toString(),
              'account_linked',
              `Username @${from.username} successfully linked to account`,
              { username: from.username, method: 'username_linking' }
            );

            console.log(`[USERNAME_LINKING] Username @${from.username} successfully linked to user ${pendingLink.user_id}`);
          } else {
            console.error(`[USERNAME_LINKING] Error updating pending link:`, updateError);
          }
        } else {
          console.log(`[USERNAME_LINKING] No pending link found for username ${from.username}`);
        }
      } else {
        console.log(`[USERNAME_LINKING] No username provided in message from chat_id ${chatId}`);
      }
    } catch (error) {
      console.error('[USERNAME_LINKING] Error handling username linking:', error);
    }
  }

  private async handleCommand(chatId: number, command: string, from: any): Promise<void> {
    // Get user ID from telegram_users table for logging
    const { data: user } = await supabaseService
      .from('telegram_users')
      .select('user_id')
      .eq('chat_id', chatId.toString())
      .eq('is_active', true)
      .single();

    try {
      switch (command) {
        case '/start':
          await this.sendWelcomeMessage(chatId, from);
          // Log command interaction
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'welcome_message' }
          );
          break;
        case '/help':
          await this.sendHelpMessage(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'help_message' }
          );
          break;
        case '/orders':
          await this.sendOrdersList(chatId, from.id);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'orders_list' }
          );
          break;
        case '/tracking':
          await this.sendTrackingOverview(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'tracking_overview' }
          );
          break;
        case '/flash':
          await this.sendFlashSales(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'flash_sales' }
          );
          break;
        case '/wishlist':
          await this.sendWishlist(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'wishlist' }
          );
          break;
        case '/stores':
          await this.sendStores(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'stores_list' }
          );
          break;
        case '/link':
          await this.sendLinkInstructions(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'link_instructions' }
          );
          break;
        case '/myid':
          await this.sendChatIdInfo(chatId, from);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'chat_id_info' }
          );
          break;
        case '/debug':
          await this.sendDebugInfo(chatId, from);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'debug_info' }
          );
          break;
        case '/profile':
          await this.sendProfileInfo(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'profile_info' }
          );
          break;
        case '/support':
          await this.sendSupportMessage(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'support_message' }
          );
          break;
        case '/search':
          await this.sendSearchInstructions(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'search_instructions' }
          );
          break;
        case '/categories':
          await this.sendCategories(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'categories_list' }
          );
          break;
        case '/deals':
          await this.sendAllDeals(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'all_deals' }
          );
          break;
        case '/products':
          await this.sendProductsOverview(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'products_overview' }
          );
          break;
        case '/receipt':
          await this.sendReceiptInstructions(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'receipt_instructions' }
          );
          break;
        case '/more':
          await this.sendMoreOptions(chatId);
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'more_options' }
          );
          break;
        default:
          const unknownMessage = 'Unknown command. Use /help to see available commands.';
          await this.sendMessage({
            chat_id: chatId.toString(),
            text: unknownMessage
          });
          await this.logNotification(
            user?.user_id || null,
            chatId.toString(),
            'bot_command',
            `User executed: ${command}`,
            { command, from, responseType: 'unknown_command', response: unknownMessage }
          );
      }
    } catch (error) {
      console.error(`Error handling command ${command}:`, error);
      // Log failed command
      await this.logNotification(
        user?.user_id || null,
        chatId.toString(),
        'bot_command',
        `User executed: ${command}`,
        { command, from, error: error instanceof Error ? error.message : 'Unknown error' },
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    // Get user ID from telegram_users table for logging
    const { data: user } = await supabaseService
      .from('telegram_users')
      .select('user_id')
      .eq('chat_id', chatId.toString())
      .eq('is_active', true)
      .single();

    try {
      if (data.startsWith('order_')) {
        const orderId = data.replace('order_', '');
        console.log(`Processing order callback: ${data}, orderId: ${orderId}`);
        await this.sendOrderDetails(chatId, orderId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, orderId, responseType: 'order_details' }
        );
      } else if (data.startsWith('track_')) {
        const orderId = data.replace('track_', '');
        await this.sendDeliveryTracking(chatId, orderId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, orderId, responseType: 'delivery_tracking' }
        );
      } else if (data.startsWith('delivery_')) {
        const orderId = data.replace('delivery_', '');
        await this.sendDeliveryTracking(chatId, orderId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, orderId, responseType: 'delivery_tracking' }
        );
              } else if (data === 'orders_list') {
          if (user) {
            await this.sendOrdersList(chatId);
            await this.logNotification(
              user.user_id,
              chatId.toString(),
              'bot_callback',
              `User clicked: ${data}`,
              { callbackData: data, responseType: 'orders_list' }
            );
          }
      } else if (data.startsWith('flash_')) {
        const flashSaleId = data.replace('flash_', '');
        await this.sendFlashSaleDetails(chatId, flashSaleId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, flashSaleId, responseType: 'flash_sale_details' }
        );
      } else if (data.startsWith('product_')) {
        const productId = data.replace('product_', '');
        await this.sendProductDetails(chatId, productId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, productId, responseType: 'product_details' }
        );
      } else if (data.startsWith('store_')) {
        const storeId = data.replace('store_', '');
        await this.sendStoreDetails(chatId, storeId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, storeId, responseType: 'store_details' }
        );
      } else if (data === 'support') {
        await this.sendSupportMessage(chatId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, responseType: 'support_message' }
        );
      } else if (data === 'flash_sales') {
        await this.sendFlashSales(chatId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, responseType: 'flash_sales' }
        );
      } else if (data === 'stores_list') {
        await this.sendStores(chatId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, responseType: 'stores_list' }
        );
      } else if (data === 'categories') {
        await this.sendCategories(chatId);
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, responseType: 'categories_list' }
        );
      } else {
        // Unknown callback data
        await this.logNotification(
          user?.user_id || null,
          chatId.toString(),
          'bot_callback',
          `User clicked: ${data}`,
          { callbackData: data, responseType: 'unknown_callback' }
        );
      }
    } catch (error) {
      console.error(`Error handling callback query ${data}:`, error);
      // Log failed callback
      await this.logNotification(
        user?.user_id || null,
        chatId.toString(),
        'bot_callback',
        `User clicked: ${data}`,
        { callbackData: data, error: error instanceof Error ? error.message : 'Unknown error' },
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async sendWelcomeMessage(chatId: number, from: any): Promise<void> {
    // Check if there's a pending username link for this user
    let pendingLinkMessage = '';
    if (from.username) {
      const { data: pendingLink } = await supabaseService
        .from('telegram_users')
        .select('user_id, chat_id, username')
        .eq('username', from.username)
        .eq('is_active', true)
        .single();

      if (pendingLink && pendingLink.chat_id.startsWith('pending_')) {
        pendingLinkMessage = `

🔗 <b>Account Linking Detected!</b>
I found a pending link for username @${from.username}. 
Your account will be automatically linked when you send any message to me.

💡 <b>Just send any message (like "hello" or "hi") to complete the linking!</b>
        `;
      }
    }

    const message = `
🎉 <b>Welcome to AVRIO!</b>

Hi ${from.first_name}! 👋

I'm your personal AVRIO shopping assistant. Discover amazing Ethiopian products & more!${pendingLinkMessage}

🔗 <b>First Step:</b>
Use /link to connect your AVRIO account to Telegram

💡 <b>Need your Chat ID?</b>
Use /myid to get your Telegram Chat ID for linking

📋 <b>Available Commands:</b>

<b>🛍️ Shopping & Discovery:</b>
/search - Product search instructions
/categories - Browse products by category
/deals - View all active deals & promotions
/products - Latest products overview
/flash - Quick flash sales overview
/wishlist - Your saved products
/stores - Browse popular stores

<b>📦 Account & Orders:</b>
/orders - View your recent orders
/tracking - Track deliveries
/profile - Your account information
/receipt - Get receipt information

<b>🆘 Support:</b>
/support - Contact customer support
/help - Show detailed help message
/more - View all available options

🔗 <b>Quick Links:</b>
• <a href="https://www.avrioxshop.com">Visit AVRIO Shop</a>
• <a href="https://www.avrioxshop.com/products">Browse Products</a>
• <a href="https://www.avrioxshop.com/support">Get Support</a>

🏆 Best Marketplace 2023 | ⭐ 4.9/5 Rating | 🔒 Secure Payments | 🚚 Fast Delivery

Stay tuned for order updates, delivery notifications, and exclusive AVRIO offers! 🛍️
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private async sendHelpMessage(chatId: number): Promise<void> {
    const message = `
📚 <b>AVRIO Help & Support</b>

Here are all the commands you can use:

<b>🛍️ Shopping & Discovery:</b>
/search - Product search instructions and guidance
/categories - Browse products by category with counts
/deals - View all active deals & promotions (detailed)
/products - Latest products overview with ratings
/flash - Quick flash sales overview
/wishlist - Your saved products
/stores - Browse popular stores

<b>📦 Account & Orders:</b>
                /start - Welcome message
                /link - Link your AVRIO account
                /myid - Get your Telegram Chat ID for linking
                /debug - Debug information (for troubleshooting)
                /orders - View your recent orders
/tracking - View delivery tracking for all orders
/profile - Your account information
/receipt - Get receipt information and access

<b>🆘 Support:</b>
/support - Contact customer support
/help - Show this help message
/more - View all available options and features

<b>💡 Command Differences:</b>
• <code>/flash</code> - Quick overview of active flash sales
• <code>/deals</code> - Comprehensive deals with savings, product counts & details

<b>✨ Features:</b>
• Real-time order updates
• Delivery tracking
• Payment confirmations
• Flash sale alerts
• Product discovery
• Category browsing
• Customer support

Need immediate help? Contact our support team at https://www.avrioxshop.com/support

🏆 Best Marketplace 2023 | ⭐ 4.9/5 Rating | 🔒 Secure Payments | 🚚 Fast Delivery
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private async sendOrdersList(chatId: number, userId?: number): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (!user) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Please link your account first by visiting our website. Go to https://www.avrioxshop.com/profile to connect your Telegram account.'
        });
        return;
      }

      console.log(`Fetching orders for user: ${user.user_id}`);
      const { data: orders, error: ordersError } = await supabaseService
        .from('orders')
        .select(`
          id,
          order_status,
          total_price,
          created_at,
          delivery_method,
          pickup_code,
          product:products(title)
        `)
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) {
        console.error('Orders query error:', ordersError);
      }

      console.log(`Found ${orders?.length || 0} orders for user ${user.user_id}`);
      if (!orders || orders.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'You haven\'t placed any orders yet. Start shopping at our website!'
        });
        return;
      }

      let message = '📋 <b>Your Recent Orders:</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      orders.forEach((order, index) => {
        // Format delivery method
        const deliveryMethodText = order.delivery_method === 'home_delivery' ? '🏠 Home Delivery' : 
                                   order.delivery_method === 'store_pickup' ? '🏪 Store Pickup' : 
                                   order.delivery_method || 'N/A';

        // Shorten the order ID for display (last 12 characters)
        const shortOrderId = order.id.slice(-12);

        message += `${index + 1}. <b>${(order.product as any)?.title || 'Product'}</b>\n`;
        message += `   Order ID: <code>${shortOrderId}</code>\n`;
        message += `   Status: ${order.order_status}\n`;
        message += `   Amount: ${order.total_price} ETB\n`;
        message += `   Delivery: ${deliveryMethodText}\n`;
        message += `   Date: ${new Date(order.created_at).toLocaleDateString()}\n\n`;

        console.log(`Creating button for order ${index + 1}: ${order.id}`);
        keyboard.push([
          {
            text: `Order ${index + 1}`,
            callback_data: `order_${order.id}` // Keep full ID in callback data
          }
        ]);
      });

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch your orders. Please try again later.'
      });
    }
  }

  private async sendTrackingOverview(chatId: number, userId?: number): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (!user) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Please link your account first by visiting our website. Go to https://www.avrioxshop.com/profile to connect your Telegram account.'
        });
        return;
      }

      // Get all orders with delivery tracking information
      const { data: orders } = await supabaseService
        .from('orders')
        .select(`
          id,
          order_status,
          total_price,
          created_at,
          delivery_method,
          pickup_code,
          product:products(title)
        `)
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (!orders || orders.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'You haven\'t placed any orders yet. Start shopping at our website!'
        });
        return;
      }

      // Get delivery statuses for all orders
      const { data: deliveryStatuses } = await supabaseService
        .from('delivery_statuses')
        .select('*')
        .in('order_id', orders.map(o => o.id))
        .order('created_at', { ascending: true });

      // Group delivery statuses by order_id
      const statusesByOrder = deliveryStatuses?.reduce((acc: any, status) => {
        if (!acc[status.order_id]) {
          acc[status.order_id] = [];
        }
        acc[status.order_id].push(status);
        return acc;
      }, {}) || {};

      let message = '🚚 <b>Delivery Tracking Overview</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      orders.forEach((order, index) => {
        const orderStatuses = statusesByOrder[order.id] || [];
        const latestStatus = orderStatuses.length > 0 ? orderStatuses[orderStatuses.length - 1] : null;
        
        // Format delivery method
        const deliveryMethodText = order.delivery_method === 'home_delivery' ? '🏠 Home Delivery' : 
                                   order.delivery_method === 'store_pickup' ? '🏪 Store Pickup' : 
                                   order.delivery_method || 'N/A';

        // Get status emoji and text
        const statusInfo = this.getStatusInfo(order.order_status, latestStatus?.status);
        
        // Shorten the order ID for display (last 12 characters)
        const shortOrderId = order.id.slice(-12);
        
        message += `${index + 1}. <b>${(order.product as any)?.title || 'Product'}</b>\n`;
        message += `   Order ID: <code>${shortOrderId}</code>\n`;
        message += `   Status: ${statusInfo.emoji} ${statusInfo.text}\n`;
        message += `   Delivery: ${deliveryMethodText}\n`;
        message += `   Amount: ${order.total_price} ETB\n`;
        message += `   Date: ${new Date(order.created_at).toLocaleDateString()}\n`;
        
        if (latestStatus) {
          message += `   Last Update: ${new Date(latestStatus.created_at).toLocaleString()}\n`;
        }
        
        message += '\n';

        keyboard.push([
          {
            text: `Track Order ${index + 1}`,
            callback_data: `track_${order.id}`
          }
        ]);
      });

      // Add a "View All Orders" button
      keyboard.push([
        {
          text: '📋 View All Orders',
          callback_data: 'orders_list'
        }
      ]);

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching tracking overview:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch your delivery tracking information. Please try again later.'
      });
    }
  }

  private async sendFlashSales(chatId: number, userId?: number): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (!user) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Please link your account first by visiting our website. Go to https://www.avrioxshop.com/profile to connect your Telegram account.'
        });
        return;
      }

      const now = new Date().toISOString();
      
      // Fetch active flash sales with product details and wishlist counts
      const { data: flashSales } = await supabaseService
        .from('flash_sales')
        .select(`
          *,
          products:flash_sale_products (
            id,
            product_id,
            special_price,
            product:products (
              id,
              title,
              description,
              price,
              product_images (
                id,
                image_url
              ),
              owner:users (
                id,
                store_settings
              ),
              likes (
                count
              )
            )
          )
        `)
        .eq('is_active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .order('end_time', { ascending: true });

      if (!flashSales || flashSales.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: '🔥 No active flash sales at the moment! Check back soon for amazing deals.'
        });
        return;
      }

      let message = '⚡ <b>Active Flash Sales</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      flashSales.forEach((sale, index) => {
        const products = sale.products || [];
        const totalWishlistCount = products.reduce((sum: number, fp: any) => {
          return sum + (fp.product?.likes?.[0]?.count || 0);
        }, 0);

        message += `${index + 1}. <b>${sale.title}</b>\n`;
        message += `   ${sale.description || 'Amazing deals on selected products!'}\n`;
        message += `   🔥 ${sale.discount_percentage}% OFF\n`;
        message += `   📦 ${products.length} products\n`;
        message += `   ❤️ ${totalWishlistCount} total wishlist saves\n`;
        message += `   ⏰ Ends: ${new Date(sale.end_time).toLocaleString()}\n`;
        
        if (sale.free_shipping) {
          message += `   🚚 Free Shipping\n`;
        }
        if (sale.min_order_amount) {
          message += `   💰 Min Order: ETB ${sale.min_order_amount.toLocaleString()}\n`;
        }
        message += '\n';

        keyboard.push([
          {
            text: `View Sale ${index + 1}`,
            callback_data: `flash_${sale.id}`
          }
        ]);
      });

      // Add a "View All Flash Sales" button
      keyboard.push([
        {
          text: '🔥 View All Flash Sales',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/flash-sales`
        }
      ]);

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching flash sales:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch flash sales. Please try again later.'
      });
    }
  }

  private async sendWishlist(chatId: number, userId?: number): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (!user) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Please link your account first by visiting our website. Go to https://www.avrioxshop.com/profile to connect your Telegram account.'
        });
        return;
      }

      // Fetch user's wishlist with product details
      const { data: wishlistItems } = await supabaseService
        .from('wishlist')
        .select(`
          product_id,
          products (
            id,
            title,
            description,
            price,
            category,
            quality,
            product_images (
              id,
              image_url
            ),
            owner:users (
              id,
              store_settings
            ),
            flash_sale_products!left (
              special_price,
              flash_sale:flash_sales!inner (
                id,
                start_time,
                end_time,
                is_active
              )
            ),
            ratings (
              rating
            ),
            likes (
              count
            )
          )
        `)
        .eq('user_id', user.user_id);

      if (!wishlistItems || wishlistItems.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: '💝 Your wishlist is empty! Start saving your favorite products by visiting our website.'
        });
        return;
      }

      let message = '💝 <b>Your Wishlist</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      wishlistItems.forEach((item: any, index) => {
        const product = item.products;
        if (!product) return;

        // Calculate average rating
        const ratings = product.ratings || [];
        const averageRating = ratings.length > 0
          ? ratings.reduce((acc: number, curr: any) => acc + curr.rating, 0) / ratings.length
          : 0;

        // Check for active flash sale
        const now = new Date();
        const activeFlashSale = product.flash_sale_products?.find((fsp: any) => {
          const flashSale = fsp.flash_sale;
          return flashSale.is_active && 
            new Date(flashSale.start_time) <= now && 
            new Date(flashSale.end_time) >= now;
        });

        const flashSalePrice = activeFlashSale?.special_price;
        const storeName = product.owner?.store_settings?.name || 'Unknown Store';

        message += `${index + 1}. <b>${product.title}</b>\n`;
        message += `   🏪 ${storeName}\n`;
        message += `   💰 ${flashSalePrice ? 
          `ETB ${flashSalePrice.toLocaleString()} (FLASH SALE!)` : 
          `ETB ${product.price.toLocaleString()}`}\n`;
        message += `   ⭐ ${averageRating.toFixed(1)} (${ratings.length} reviews)\n`;
        message += `   ❤️ ${product.likes?.[0]?.count || 0} likes\n`;
        message += `   📂 ${product.category}\n`;
        message += `   🏷️ ${product.quality || 'New'}\n\n`;

        keyboard.push([
          {
            text: `View Product ${index + 1}`,
            callback_data: `product_${product.id}`
          }
        ]);
      });

      // Add navigation buttons
      keyboard.push([
        {
          text: '🛒 View All Products',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`
        },
        {
          text: '💝 View Full Wishlist',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/wishlist`
        }
      ]);

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch your wishlist. Please try again later.'
      });
    }
  }

  private async sendStores(chatId: number, userId?: number): Promise<void> {
    try {
      // Fetch verified sellers with metrics
      const { data: sellersData } = await supabaseService
        .from('users')
        .select(`
          id,
          full_name,
          email,
          store_settings,
          created_at,
          is_verified,
          verification_status,
          products (
            id,
            title,
            price,
            created_at,
            ratings (
              id,
              rating,
              created_at
            ),
            likes (
              id,
              created_at
            )
          )
        `)
        .eq('role', 'owner')
        .eq('is_verified', true)
        .neq('verification_status', 'needs_reconsideration')
        .order('created_at', { ascending: false });

      if (!sellersData || sellersData.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: '🏪 No stores available at the moment. Check back soon!'
        });
        return;
      }

      // Calculate metrics for each store
      const formattedSellers = sellersData
        .filter(seller => seller.store_settings)
        .map(seller => {
          const products = seller.products || [];
          
          // Calculate metrics
          const total_products = products.length;
          const allRatings = products.flatMap(product => product.ratings || []);
          const totalRatings = allRatings.length;
          const avgRating = totalRatings > 0
            ? allRatings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
            : 0;
          const allLikes = products.flatMap(product => product.likes || []);
          const totalLikes = allLikes.length;

          // Calculate recent activity (last 30 days)
          const now = new Date();
          const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
          const recentActivity = allRatings.filter(r => 
            now.getTime() - new Date(r.created_at).getTime() < THIRTY_DAYS
          ).length + allLikes.filter(l => 
            now.getTime() - new Date(l.created_at).getTime() < THIRTY_DAYS
          ).length;

          // Calculate trending score
          const trendingScore = 
            (recentActivity * 0.5) + 
            (avgRating * 0.3) + 
            ((totalRatings + totalLikes) * 0.2);

          return {
            id: seller.id,
            full_name: seller.full_name,
            store_settings: seller.store_settings,
            total_products,
            avgRating,
            totalRatings,
            totalLikes,
            recentActivity,
            trendingScore,
            verification_status: seller.verification_status
          };
        })
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 10); // Show top 10 stores

      let message = '🏪 <b>Popular Ethiopian Stores</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      formattedSellers.forEach((seller, index) => {
        const storeName = seller.store_settings?.name || seller.full_name;
        const storeDescription = seller.store_settings?.shortDescription || 
                                seller.store_settings?.description || 
                                'Ethiopian Store';

        message += `${index + 1}. <b>${storeName}</b>\n`;
        message += `   ${storeDescription}\n`;
        message += `   ⭐ ${seller.avgRating.toFixed(1)} (${seller.totalRatings} reviews)\n`;
        message += `   ❤️ ${seller.totalLikes} likes\n`;
        message += `   📦 ${seller.total_products} products\n`;
        message += `   🔥 ${seller.recentActivity} recent activities\n`;
        if (seller.verification_status === 'verified') {
          message += `   ✅ Verified Store\n`;
        }
        message += '\n';

        keyboard.push([
          {
            text: `Visit ${storeName}`,
            callback_data: `store_${seller.id}`
          }
        ]);
      });

      // Add navigation buttons
      keyboard.push([
        {
          text: '🏪 View All Stores',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/stores`
        },
        {
          text: '🛒 Browse Products',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`
        }
      ]);

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching stores:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch stores. Please try again later.'
      });
    }
  }

  private async sendFlashSaleDetails(chatId: number, flashSaleId: string): Promise<void> {
    try {
      const { data: flashSale } = await supabaseService
        .from('flash_sales')
        .select(`
          *,
          products:flash_sale_products (
            id,
            product_id,
            special_price,
            product:products (
              id,
              title,
              description,
              price,
              product_images (
                id,
                image_url
              ),
              owner:users (
                id,
                store_settings
              ),
              likes (
                count
              )
            )
          )
        `)
        .eq('id', flashSaleId)
        .single();

      if (!flashSale) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Flash sale not found.'
        });
        return;
      }

      const products = flashSale.products || [];
      const totalWishlistCount = products.reduce((sum: number, fp: any) => {
        return sum + (fp.product?.likes?.[0]?.count || 0);
      }, 0);

      let message = `⚡ <b>${flashSale.title}</b>\n\n`;
      message += `${flashSale.description || 'Amazing deals on selected products!'}\n\n`;
      message += `🔥 <b>${flashSale.discount_percentage}% OFF</b>\n`;
      message += `📦 ${products.length} products\n`;
      message += `❤️ ${totalWishlistCount} total wishlist saves\n`;
      message += `⏰ Ends: ${new Date(flashSale.end_time).toLocaleString()}\n`;
      
      if (flashSale.free_shipping) {
        message += `🚚 Free Shipping\n`;
      }
      if (flashSale.min_order_amount) {
        message += `💰 Min Order: ETB ${flashSale.min_order_amount.toLocaleString()}\n`;
      }

      message += '\n<b>Products in this sale:</b>\n\n';

      products.forEach((fp: any, index: number) => {
        const product = fp.product;
        if (!product) return;

        const discount = Math.round(((product.price - fp.special_price) / product.price) * 100);
        const storeName = product.owner?.store_settings?.name || 'Unknown Store';

        message += `${index + 1}. <b>${product.title}</b>\n`;
        message += `   🏪 ${storeName}\n`;
        message += `   💰 ETB ${fp.special_price.toLocaleString()} (${discount}% OFF)\n`;
        message += `   ❤️ ${product.likes?.[0]?.count || 0} likes\n\n`;
      });

      const keyboard = [
        [{
          text: '🔥 View on Website',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/flash-sales/${flashSaleId}`
        }],
        [{
          text: '🛒 Browse All Products',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`
        }]
      ];

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching flash sale details:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch flash sale details. Please try again later.'
      });
    }
  }

  private async sendProductDetails(chatId: number, productId: string): Promise<void> {
    try {
      const { data: product } = await supabaseService
        .from('products')
        .select(`
          *,
          product_images (
            id,
            image_url
          ),
          owner:users (
            id,
            store_settings
          ),
          flash_sale_products!left (
            special_price,
            flash_sale:flash_sales!inner (
              id,
              start_time,
              end_time,
              is_active
            )
          ),
          ratings (
            rating
          ),
          likes (
            count
          )
        `)
        .eq('id', productId)
        .single();

      if (!product) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Product not found.'
        });
        return;
      }

      // Calculate average rating
      const ratings = product.ratings || [];
      const averageRating = ratings.length > 0
        ? ratings.reduce((acc: number, curr: any) => acc + curr.rating, 0) / ratings.length
        : 0;

      // Check for active flash sale
      const now = new Date();
      const activeFlashSale = product.flash_sale_products?.find((fsp: any) => {
        const flashSale = fsp.flash_sale;
        return flashSale.is_active && 
          new Date(flashSale.start_time) <= now && 
          new Date(flashSale.end_time) >= now;
      });

      const flashSalePrice = activeFlashSale?.special_price;
      const storeName = product.owner?.store_settings?.name || 'Unknown Store';

      let message = `🛍️ <b>${product.title}</b>\n\n`;
      message += `${product.description}\n\n`;
      message += `🏪 <b>Store:</b> ${storeName}\n`;
      message += `💰 <b>Price:</b> ${flashSalePrice ? 
        `ETB ${flashSalePrice.toLocaleString()} (FLASH SALE!)` : 
        `ETB ${product.price.toLocaleString()}`}\n`;
      message += `⭐ <b>Rating:</b> ${averageRating.toFixed(1)} (${ratings.length} reviews)\n`;
      message += `❤️ <b>Likes:</b> ${product.likes?.[0]?.count || 0}\n`;
      message += `📂 <b>Category:</b> ${product.category}\n`;
      message += `🏷️ <b>Quality:</b> ${product.quality || 'New'}\n`;

      const keyboard = [
        [{
          text: '🛍️ View Product',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/products/${productId}`
        }],
        [{
          text: '🏪 Visit Store',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/stores/${product.owner?.id}`
        }]
      ];

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching product details:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch product details. Please try again later.'
      });
    }
  }

  private async sendStoreDetails(chatId: number, storeId: string): Promise<void> {
    try {
      const { data: seller } = await supabaseService
        .from('users')
        .select(`
          id,
          full_name,
          email,
          store_settings,
          created_at,
          is_verified,
          verification_status,
          products (
            id,
            title,
            price,
            created_at,
            ratings (
              id,
              rating,
              created_at
            ),
            likes (
              id,
              created_at
            )
          )
        `)
        .eq('id', storeId)
        .single();

      if (!seller || !seller.store_settings) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Store not found.'
        });
        return;
      }

      const products = seller.products || [];
      const allRatings = products.flatMap(product => product.ratings || []);
      const totalRatings = allRatings.length;
      const avgRating = totalRatings > 0
        ? allRatings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
        : 0;
      const allLikes = products.flatMap(product => product.likes || []);
      const totalLikes = allLikes.length;

      const storeName = seller.store_settings.name || seller.full_name;
      const storeDescription = seller.store_settings.shortDescription || 
                              seller.store_settings.description || 
                              'Ethiopian Store';

      let message = `🏪 <b>${storeName}</b>\n\n`;
      message += `${storeDescription}\n\n`;
      message += `⭐ <b>Rating:</b> ${avgRating.toFixed(1)} (${totalRatings} reviews)\n`;
      message += `❤️ <b>Total Likes:</b> ${totalLikes}\n`;
      message += `📦 <b>Products:</b> ${products.length}\n`;
      message += `📅 <b>Member since:</b> ${new Date(seller.created_at).toLocaleDateString()}\n`;
      
      if (seller.verification_status === 'verified') {
        message += `✅ <b>Verified Store</b>\n`;
      }

      if (seller.store_settings.phone) {
        message += `📞 <b>Phone:</b> ${seller.store_settings.phone}\n`;
      }

      const keyboard = [
        [{
          text: '🏪 Visit Store',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/stores/${storeId}`
        }],
        [{
          text: '🛒 Browse Products',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/products?store=${storeId}`
        }]
      ];

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching store details:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch store details. Please try again later.'
      });
    }
  }

  private async sendLinkInstructions(chatId: number, userId?: number): Promise<void> {
    try {
      // Check if user is already linked
      const { data: existingUser } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (existingUser) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: '✅ Your Telegram account is already linked to your AVRIO account! You can now use all bot commands.'
        });
        return;
      }

      const message = `
🔗 <b>Link Your AVRIO Account</b>

To use all bot features, you need to link your Telegram account to your AVRIO account.

<b>How to link:</b>

1️⃣ <b>Visit your profile page:</b>
   Go to: ${process.env.NEXT_PUBLIC_SITE_URL}/profile

2️⃣ <b>Find the Telegram section:</b>
   Look for "Connect Telegram Account" or similar

3️⃣ <b>Click the link button:</b>
   This will connect your accounts

4️⃣ <b>Come back here and try:</b>
   /orders - View your orders
   /wishlist - View your wishlist
   /tracking - Track deliveries
   /flash - View flash sales

<b>Your Telegram ID:</b> <code>${chatId}</code>
(You may need this for manual linking)

💡 <b>Quick Tip:</b>
• Use /myid anytime to get your Chat ID
• Use /help to see all available commands

<b>Need help?</b>
Contact support: /support
      `;

      const keyboard = [
        [{
          text: '🌐 Go to Profile Page',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`
        }],
        [{
          text: '📞 Contact Support',
          callback_data: 'support'
        }]
      ];

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error sending link instructions:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t send the linking instructions. Please try again later.'
      });
    }
  }

  private async sendOrderDetails(chatId: number, orderId: string): Promise<void> {
    try {
      // First get the user ID from telegram_users table
      console.log(`Looking up telegram user for chat_id: ${chatId}`);
      const { data: user, error: userError } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (userError) {
        console.error('Telegram user lookup error:', userError);
      }

      if (!user) {
        console.log(`No telegram user found for chat_id: ${chatId}`);
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Please link your account first by visiting our website. Go to https://www.avrioxshop.com/profile to connect your Telegram account.'
        });
        return;
      }

      console.log(`Found telegram user: ${user.user_id} for chat_id: ${chatId}`);

      // Get order details and ensure it belongs to the user
      console.log(`Looking for order: ${orderId} for user: ${user.user_id}`);
      
      // First, let's check if the order exists at all
      const { data: orderCheck, error: orderCheckError } = await supabaseService
        .from('orders')
        .select('id, user_id')
        .eq('id', orderId)
        .single();
        
      if (orderCheckError) {
        console.error('Order check error:', orderCheckError);
      } else if (orderCheck) {
        console.log(`Order exists with user_id: ${orderCheck.user_id}, expected: ${user.user_id}`);
      }
      
      // Try to find the order without user filter first
      const { data: order, error: orderError } = await supabaseService
        .from('orders')
        .select(`
          *,
          product:products(title, description),
          buyer:users!user_id(full_name, email, phone)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Order query error:', orderError);
      }

      if (!order) {
        console.log(`Order not found: ${orderId}`);
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Order not found.'
        });
        return;
      }

      console.log(`Order found: ${order.id} with user_id: ${order.user_id}`);
      
      // Check if the order belongs to the user
      if (order.user_id !== user.user_id) {
        console.log(`Order belongs to different user: ${order.user_id}, expected: ${user.user_id}`);
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'You don\'t have permission to view this order.'
        });
        return;
      }

      // Format delivery method for display
      const deliveryMethodText = order.delivery_method === 'home_delivery' ? '🏠 Home Delivery' : 
                                 order.delivery_method === 'store_pickup' ? '🏪 Store Pickup' : 
                                 order.delivery_method || 'N/A';

      // Format delivery address
      let deliveryInfo = '';
      if (order.delivery_method === 'home_delivery' && order.delivery_address) {
        deliveryInfo = `📍 Address: ${this.formatDeliveryAddress(order.delivery_address)}`;
      } else if (order.delivery_method === 'store_pickup' && order.pickup_code) {
        deliveryInfo = `🔑 Pickup Code: <code>${order.pickup_code}</code>`;
      }

      const message = `
📦 <b>Order Details</b>

Order ID: <code>${order.id.slice(-12)}</code>
Product: ${order.product?.title || 'N/A'}
Status: ${order.order_status}
Payment: ${order.payment_status}


💰 <b>Pricing:</b>
Amount: ${order.total_price} ETB
Platform Fee: ${order.platform_fee || 0} ETB
Delivery Fee: ${order.delivery_fee || 0} ETB

🚚 <b>Delivery:</b>
Method: ${deliveryMethodText}
${deliveryInfo}

📅 <b>Timeline:</b>
Order Date: ${new Date(order.created_at).toLocaleString()}
${order.updated_at ? `Updated: ${new Date(order.updated_at).toLocaleString()}` : ''}

<a href="${process.env.NEXT_PUBLIC_SITE_URL}/orders">View on Website</a>
      `;

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Track Delivery',
                callback_data: `track_${order.id}`
              },
              {
                text: 'Contact Support',
                callback_data: 'support'
              }
            ]
          ]
        }
      });
    } catch (error) {
      console.error('Error fetching order details:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch order details. Please try again later.'
      });
    }
  }

  private async sendDeliveryTracking(chatId: number, orderId: string): Promise<void> {
    try {
      const { data: delivery } = await supabaseService
        .from('delivery_tracking')
        .select(`
          *,
          delivery_account:delivery_accounts(delivery_person_name, phone_number)
        `)
        .eq('order_id', orderId)
        .single();

      if (!delivery) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Delivery tracking information not available yet.'
        });
        return;
      }

      const statusEmoji: Record<string, string> = {
        'assigned': '📋',
        'picked_up': '📦',
        'in_transit': '🚚',
        'delivered': '✅',
        'failed': '❌'
      };

      const message = `
🚚 <b>Delivery Tracking</b>

Order ID: <code>${orderId.slice(-12)}</code>
Status: ${statusEmoji[delivery.status] || '📦'} ${delivery.status.toUpperCase()}

${delivery.delivery_account ? `
Delivery Person: ${delivery.delivery_account.delivery_person_name}
Phone: ${delivery.delivery_account.phone_number}
` : ''}

Assigned: ${new Date(delivery.assigned_at).toLocaleString()}
${delivery.picked_up_at ? `Picked Up: ${new Date(delivery.picked_up_at).toLocaleString()}` : ''}
${delivery.delivered_at ? `Delivered: ${new Date(delivery.delivered_at).toLocaleString()}` : ''}

${delivery.delivery_notes ? `Notes: ${delivery.delivery_notes}` : ''}
      `;

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error fetching delivery tracking:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch delivery tracking. Please try again later.'
      });
    }
  }

  private async sendProfileInfo(chatId: number, userId?: number): Promise<void> {
    try {
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();

      if (!user) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Please link your account first by visiting our website. Go to https://www.avrioxshop.com/profile to connect your Telegram account.'
        });
        return;
      }

      const { data: profile } = await supabaseService
        .from('users')
        .select('full_name, email, phone, subscription_plan, created_at, store_settings')
        .eq('id', user.user_id)
        .single();

      if (!profile) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Profile not found.'
        });
        return;
      }

      // Parse store settings
      let storeSettings = null;
      let phoneFromSettings = null;
      let addressInfo = null;
      
      if (profile.store_settings) {
        try {
          storeSettings = typeof profile.store_settings === 'string' 
            ? JSON.parse(profile.store_settings) 
            : profile.store_settings;
          
          phoneFromSettings = storeSettings.phone;
          addressInfo = storeSettings.address;
        } catch (error) {
          console.error('Error parsing store settings:', error);
        }
      }

      // Format address if available
      let addressText = 'N/A';
      if (addressInfo) {
        const addressParts = [];
        if (addressInfo.houseNo) addressParts.push(`House: ${addressInfo.houseNo}`);
        if (addressInfo.kebele) addressParts.push(`Kebele: ${addressInfo.kebele}`);
        if (addressInfo.wereda) addressParts.push(`Wereda: ${addressInfo.wereda}`);
        if (addressInfo.subCity) addressParts.push(`Sub City: ${addressInfo.subCity}`);
        if (addressInfo.city) addressParts.push(`City: ${addressInfo.city}`);
        if (addressInfo.landmark) addressParts.push(`Landmark: ${addressInfo.landmark}`);
        
        addressText = addressParts.join(', ');
      }

      // Use phone from store settings if available, otherwise use profile phone
      const displayPhone = phoneFromSettings || profile.phone || 'N/A';

      const message = `
👤 <b>Your Profile</b>

Name: ${profile.full_name || 'N/A'}
Email: ${profile.email || 'N/A'}
Phone: ${displayPhone}
Plan: ${profile.subscription_plan || 'Free'}

📍 <b>Address:</b>
${addressText}

${storeSettings?.preferred_language ? `🌍 Language: ${storeSettings.preferred_language}` : ''}

Member since: ${new Date(profile.created_at).toLocaleDateString()}

<a href="${process.env.NEXT_PUBLIC_SITE_URL}/profile">Edit Profile</a>
      `;

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch your profile. Please try again later.'
      });
    }
  }

  private async sendSupportMessage(chatId: number): Promise<void> {
    const message = `
🆘 <b>AVRIO Customer Support</b>

Need help? Here are your options:

📞 <b>Contact Methods:</b>
• Email: support@avrioxshop.com
• Phone: +251 91 284 1237
• Live Chat: Available on our website

⏰ <b>Support Hours:</b>
Monday - Friday: 8:00 AM - 6:00 PM
Saturday: 9:00 AM - 4:00 PM
Sunday: Closed

🔗 <b>Quick Links:</b>
• <a href="https://www.avrioxshop.com/support">Support Center</a>
• <a href="https://www.avrioxshop.com/faq">FAQ</a>
• <a href="https://www.avrioxshop.com/contact">Contact Form</a>

For urgent issues, please call us directly.

🏆 Best Marketplace 2023 | ⭐ 4.9/5 Rating | 🔒 Secure Payments | 🚚 Fast Delivery
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private async handleSupportMessage(message: any): Promise<void> {
    // Forward support messages to admin
    const supportMessage = `
📨 <b>New Support Message</b>

From: ${message.from.first_name} ${message.from.last_name || ''}
Username: @${message.from.username || 'N/A'}
Chat ID: ${message.chat.id}

Message:
${message.text}

Time: ${new Date(message.date * 1000).toLocaleString()}
    `;

    await this.sendMessage({
      chat_id: this.config.adminChatId,
      text: supportMessage,
      parse_mode: 'HTML'
    });
  }

  private async sendSearchInstructions(chatId: number): Promise<void> {
    const message = `
🔍 <b>Product Search</b>

To search for products, please visit our website:

🔗 <a href="https://www.avrioxshop.com/products">Browse All Products</a>

<b>Search Features:</b>
• Search by product name, category, or store
• Filter by price range
• Sort by popularity, price, or newest
• View product details and reviews

<b>Popular Search Terms:</b>
• Traditional Wear
• Modern Fashion
• Home & Living
• Beauty & Personal Care
• Jewelry & Accessories

💡 <b>Tip:</b> Use the search bar on our website for the best results with filters and sorting options.

🏆 Best Marketplace 2023 | ⭐ 4.9/5 Rating | 🔒 Secure Payments | 🚚 Fast Delivery
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private async sendCategories(chatId: number): Promise<void> {
    try {
      // Fetch categories with product counts
      const { data: categories } = await supabaseService
        .from('products')
        .select('category')
        .eq('is_active', true);

      // Count products per category
      const categoryCounts: { [key: string]: number } = {};
      categories?.forEach(product => {
        if (product.category) {
          categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
        }
      });

      // Sort categories by product count
      const sortedCategories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15); // Show top 15 categories

      let message = '📂 <b>Product Categories</b>\n\n';
      message += 'Browse products by category:\n\n';

      sortedCategories.forEach(([category, count], index) => {
        const emoji = this.getCategoryEmoji(category);
        message += `${index + 1}. ${emoji} <b>${category}</b> (${count} products)\n`;
      });

      message += '\n🔗 <a href="https://www.avrioxshop.com/products">View All Categories</a>';

      const keyboard = [
        [
          {
            text: '🛍️ Browse All Products',
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`
          }
        ],
        [
          {
            text: '🔥 Flash Sales',
            callback_data: 'flash_sales'
          },
          {
            text: '🏪 Popular Stores',
            callback_data: 'stores_list'
          }
        ]
      ];

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch categories. Please try again later.'
      });
    }
  }

  private async sendAllDeals(chatId: number): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Fetch all active flash sales and promotions
      const { data: flashSales } = await supabaseService
        .from('flash_sales')
        .select(`
          *,
          products:flash_sale_products (
            id,
            product_id,
            special_price,
            product:products (
              id,
              title,
              price,
              product_images (
                id,
                image_url
              ),
              owner:users (
                id,
                store_settings
              )
            )
          )
        `)
        .eq('is_active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .order('end_time', { ascending: true });

      if (!flashSales || flashSales.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: '🔥 No active deals at the moment! Check back soon for amazing offers.'
        });
        return;
      }

      let message = '🔥 <b>All Active Deals & Promotions</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      flashSales.forEach((sale, index) => {
        const products = sale.products || [];
        const totalSavings = products.reduce((sum: number, fp: any) => {
          const originalPrice = fp.product?.price || 0;
          const salePrice = fp.special_price || 0;
          return sum + (originalPrice - salePrice);
        }, 0);

        message += `${index + 1}. <b>${sale.title}</b>\n`;
        message += `   ${sale.description || 'Amazing deals on selected products!'}\n`;
        message += `   🔥 ${sale.discount_percentage}% OFF\n`;
        message += `   📦 ${products.length} products\n`;
        message += `   💰 Save up to ETB ${totalSavings.toLocaleString()}\n`;
        message += `   ⏰ Ends: ${new Date(sale.end_time).toLocaleString()}\n`;
        
        if (sale.free_shipping) {
          message += `   🚚 Free Shipping\n`;
        }
        if (sale.min_order_amount) {
          message += `   💳 Min Order: ETB ${sale.min_order_amount.toLocaleString()}\n`;
        }
        message += '\n';

        keyboard.push([
          {
            text: `View Deal ${index + 1}`,
            callback_data: `flash_${sale.id}`
          }
        ]);
      });

      // Add navigation buttons
      keyboard.push([
        {
          text: '🔥 View All Flash Sales',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/flash-sales`
        }
      ]);
      keyboard.push([
        {
          text: '🛍️ Browse All Products',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`
        }
      ]);

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching deals:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch deals. Please try again later.'
      });
    }
  }

  private async sendProductsOverview(chatId: number): Promise<void> {
    try {
      // Fetch product statistics
      const { data: products } = await supabaseService
        .from('products')
        .select(`
          id,
          title,
          price,
          category,
          product_images (
            id,
            image_url
          ),
          owner:users (
            id,
            store_settings
          ),
          likes (
            count
          ),
          ratings (
            rating
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!products || products.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'No products available at the moment. Please check back later!'
        });
        return;
      }

      let message = '🛍️ <b>Latest Products</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

      products.forEach((product, index) => {
        const storeName = (product.owner as any)?.store_settings?.name || 'Unknown Store';
        const likeCount = product.likes?.[0]?.count || 0;
        const avgRating = product.ratings?.length > 0 
          ? (product.ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / product.ratings.length).toFixed(1)
          : '0.0';

        message += `${index + 1}. <b>${product.title}</b>\n`;
        message += `   💰 ETB ${product.price?.toLocaleString()}\n`;
        message += `   🏪 ${storeName}\n`;
        message += `   📂 ${product.category || 'Uncategorized'}\n`;
        message += `   ⭐ ${avgRating}/5 (${product.ratings?.length || 0} reviews)\n`;
        message += `   ❤️ ${likeCount} likes\n\n`;

        keyboard.push([
          {
            text: `View ${product.title.substring(0, 20)}${product.title.length > 20 ? '...' : ''}`,
            callback_data: `product_${product.id}`
          }
        ]);
      });

      // Add navigation buttons
      keyboard.push([
        {
          text: '🛍️ Browse All Products',
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`
        }
      ]);
      keyboard.push([
        {
          text: '🔥 Flash Sales',
          callback_data: 'flash_sales'
        },
        {
          text: '📂 Categories',
          callback_data: 'categories'
        }
      ]);

      await this.sendMessage({
        chat_id: chatId.toString(),
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      await this.sendMessage({
        chat_id: chatId.toString(),
        text: 'Sorry, I couldn\'t fetch products. Please try again later.'
      });
    }
  }

  private async sendReceiptInstructions(chatId: number): Promise<void> {
    const message = `
🧾 <b>Receipt Information</b>

To access your payment receipts:

1️⃣ <b>Recent Orders:</b>
   • Use /orders to see your recent orders
   • Click on any order to view details and receipt

2️⃣ <b>Payment Confirmations:</b>
   • Receipts are automatically sent after successful payments
   • Check your recent messages for payment confirmations

3️⃣ <b>Manual Access:</b>
   • Visit our website: <a href="https://www.avrioxshop.com/orders">View Orders</a>
   • Contact support if you need a specific receipt

📞 <b>Need Help?</b>
If you can't find your receipt, contact our support team.

🔗 <a href="https://www.avrioxshop.com/support">Contact Support</a>
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private async sendMoreOptions(chatId: number): Promise<void> {
    const message = `
🔧 <b>More Options & Features</b>

📋 <b>Account Management:</b>
• /profile - View your profile and account details
• /link - Link your Telegram account to your website account
• /myid - Get your Telegram Chat ID for linking

🛍️ <b>Shopping Features:</b>
• /orders - View your recent orders
• /wishlist - View your saved items
• /tracking - Track your deliveries

🏪 <b>Store & Product Features:</b>
• /stores - Browse stores and sellers
• /products - Browse all products
• /categories - Browse by category
• /deals - View current deals and promotions
• /flash - View flash sales

🔍 <b>Search & Discovery:</b>
• /search - Learn how to search for products
• /categories - Browse product categories

📞 <b>Support & Help:</b>
• /support - Get help and contact support
• /help - View all available commands

🎯 <b>Quick Actions:</b>
• Track deliveries in real-time
• Get notified about order updates
• Receive payment confirmations
• Access receipts and order details

🔗 <a href="https://www.avrioxshop.com">Visit Our Website</a>
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private async sendChatIdInfo(chatId: number, from: any): Promise<void> {
    // Debug logging to see what's in the from object
    console.log(`[CHAT_ID_INFO] Debug - from object:`, JSON.stringify(from, null, 2));
    console.log(`[CHAT_ID_INFO] Debug - from.username:`, from.username);
    console.log(`[CHAT_ID_INFO] Debug - from.first_name:`, from.first_name);
    console.log(`[CHAT_ID_INFO] Debug - from.last_name:`, from.last_name);
    
    const message = `
🆔 <b>Your Telegram Information</b>

Hi ${from.first_name}! Here's your Telegram account information:

<b>📱 Chat ID:</b> <code>${chatId}</code>
<b>👤 Username:</b> ${from.username ? `@${from.username}` : 'Not set'}
<b>📝 Name:</b> ${from.first_name}${from.last_name ? ` ${from.last_name}` : ''}

<b>💡 How to use this information:</b>

<b>For Chat ID linking:</b>
• Copy your Chat ID: <code>${chatId}</code>
• Go to your AVRIO profile page
• Paste it in the "Chat ID" field
• Click "Link Account"

<b>For Username linking:</b>
• Your username: ${from.username ? `@${from.username}` : 'Not available'}
• Go to your AVRIO profile page
• Enter your username in the "Username" field
• Click "Link Account"
• Send any message to this bot to complete linking

<b>🔗 Quick Actions:</b>
• <a href="${process.env.NEXT_PUBLIC_SITE_URL}/profile">Go to Profile Page</a>
• Use /link for detailed linking instructions
• Use /help for all available commands

<b>❓ Need help?</b>
• Use /support to contact customer service
• Use /link for step-by-step instructions
• Visit our website for more information

Your Chat ID is unique to your Telegram account and is required for linking your AVRIO account! 🔗
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private async sendDebugInfo(chatId: number, from: any): Promise<void> {
    // Get database info
    const { data: dbUser } = await supabaseService
      .from('telegram_users')
      .select('*')
      .eq('chat_id', chatId.toString())
      .eq('is_active', true)
      .single();

    const { data: pendingLink } = await supabaseService
      .from('telegram_users')
      .select('*')
      .eq('username', from.username || '')
      .eq('is_active', true)
      .single();

    const message = `
🔍 <b>Debug Information</b>

<b>📱 Telegram Data:</b>
• Chat ID: <code>${chatId}</code>
• Username: ${from.username ? `@${from.username}` : 'Not set'}
• First Name: ${from.first_name || 'Not set'}
• Last Name: ${from.last_name || 'Not set'}
• Full from object: <code>${JSON.stringify(from, null, 2)}</code>

<b>🗄️ Database Status:</b>
• Linked User: ${dbUser ? `Yes (${dbUser.user_id})` : 'No'}
• Pending Link: ${pendingLink && pendingLink.chat_id.startsWith('pending_') ? `Yes (${pendingLink.chat_id})` : 'No'}

<b>🔧 Technical Info:</b>
• Environment: ${process.env.NODE_ENV || 'Not set'}
• Site URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'Not set'}

<b>💡 Next Steps:</b>
• If you have a pending link, send any message to complete linking
• Use /myid for your Chat ID
• Use /link for linking instructions
    `;

    await this.sendMessage({
      chat_id: chatId.toString(),
      text: message,
      parse_mode: 'HTML'
    });
  }

  private getCategoryEmoji(category: string): string {
    const emojiMap: { [key: string]: string } = {
      'Traditional Wear': '👘',
      'Modern Fashion': '👗',
      'Home & Living': '🏠',
      'Beauty & Personal Care': '💄',
      'Jewelry & Accessories': '💍',
      'Art & Collectibles': '🎨',
      'Food & Beverages': '🍽️',
      'Electronics': '📱',
      'Books & Media': '📚',
      'Kids & Baby': '👶',
      'Sports & Fitness': '🏃',
      'Health & Wellness': '💊',
      'Musical Instruments': '🎸',
      'Party & Events': '🎉',
      'Pet Supplies': '🐕',
      'Office & Stationery': '📝',
      'Garden & Outdoor': '🌱'
    };

    return emojiMap[category] || '📦';
  }
}

// Utility functions
export async function getTelegramConfig(): Promise<TelegramConfig> {
  try {
    // First try to get from database
    const { data: settings, error } = await supabaseService
      .from('admin_telegram_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.log('Database query failed, falling back to environment variables:', error.message);
    } else if (settings) {
      return {
        botToken: settings.bot_token,
        webhookUrl: settings.webhook_url,
        adminChatId: settings.admin_chat_id,
        supportChatId: settings.support_chat_id
      };
    }
  } catch (dbError) {
    console.log('Database error, falling back to environment variables:', dbError);
  }

  // Fallback to environment variables
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const supportChatId = process.env.TELEGRAM_SUPPORT_CHAT_ID;

  if (!botToken || !adminChatId) {
    throw new Error('Telegram configuration not found in database or environment variables');
  }

  return {
    botToken,
    webhookUrl: webhookUrl || '',
    adminChatId,
    supportChatId: supportChatId || adminChatId
  };
}

export async function linkTelegramUser(userId: string, chatId: string, username?: string, firstName?: string, lastName?: string): Promise<void> {
  const { error } = await supabaseService
    .from('telegram_users')
    .upsert({
      user_id: userId,
      chat_id: chatId,
      username: username || null,
      first_name: firstName || null,
      last_name: lastName || null,
      is_active: true,
      created_at: new Date().toISOString()
    });

  if (error) throw error;
}

export async function unlinkTelegramUser(userId: string): Promise<void> {
  const { error } = await supabaseService
    .from('telegram_users')
    .update({ is_active: false })
    .eq('user_id', userId);

  if (error) throw error;
} 