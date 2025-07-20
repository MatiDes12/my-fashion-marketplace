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
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      throw error;
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
    } catch (error) {
      console.error('Error sending order notification:', error);
    }
  }

  async sendOrderConfirmation(userId: string, orderData: any): Promise<void> {
    try {
      const { data: user } = await supabase
        .from('telegram_users')
        .select('chat_id')
        .eq('user_id', userId)
        .single();

      if (!user?.chat_id) return;

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

      await this.sendMessage({
        chat_id: user.chat_id,
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
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
      
      // Add receipt button if available
      if (paymentData.receiptUrl) {
        inlineKeyboard.push([
          {
            text: '📄 View Receipt',
            url: paymentData.receiptUrl
          }
        ]);
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

      await this.sendMessage({
        chat_id: user.chat_id,
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
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
    } catch (error) {
      console.error('Error sending delivery update:', error);
    }
  }

  async sendAdminAlert(message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    try {
      const emoji = type === 'error' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️';
      await this.sendMessage({
        chat_id: this.config.adminChatId,
        text: `${emoji} <b>Admin Alert</b>\n\n${message}`,
        parse_mode: 'HTML'
      });
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
      await this.sendMessage({
        chat_id: user.chat_id,
        text: message,
        parse_mode: 'HTML'
      });
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

      if (!user?.chat_id) return;

      const message = this.formatReceipt(receiptData);
      await this.sendMessage({
        chat_id: user.chat_id,
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📄 Download Receipt',
                url: receiptData.receiptUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/api/receipts/${receiptData.paymentMethod.toLowerCase()}/${receiptData.txRef}`
              },
              {
                text: '📦 Track Order',
                callback_data: `track_${receiptData.orderId}`
              }
            ],
            [
              {
                text: '🛒 Continue Shopping',
                url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`
              }
            ]
          ]
        }
      });
    } catch (error) {
      console.error('Error sending receipt:', error);
    }
  }

  // Message formatting methods
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
    
    return `
🎉 <b>Order Confirmed - AVRIO</b>

📦 <b>Order Details:</b>
Order ID: <code>${orderData.orderId}</code>
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
${orderData.deliveryAddress ? `📍 Address: ${orderData.deliveryAddress}` : ''}
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
    
    let message = `
💳 <b>Payment Confirmation - AVRIO</b>

🎯 <b>Order Details:</b>
Order ID: <code>${paymentData.orderId || paymentData.order_id}</code>
Product: ${paymentData.productName || 'Product'}
Amount: <b>${amount} ETB</b>

💳 <b>Payment Info:</b>
Method: ${paymentData.paymentMethod || paymentData.method}
Status: ${status}
Transaction Ref: <code>${paymentData.txRef || paymentData.tx_ref || 'N/A'}</code>
${paymentData.reference ? `Reference: <code>${paymentData.reference}</code>` : ''}

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
    const subtotal = typeof receiptData.subtotal === 'number' ? receiptData.subtotal.toLocaleString() : receiptData.subtotal;
    const serviceFee = typeof receiptData.serviceFee === 'number' ? receiptData.serviceFee.toLocaleString() : receiptData.serviceFee;
    const deliveryFee = typeof receiptData.deliveryFee === 'number' ? receiptData.deliveryFee.toLocaleString() : receiptData.deliveryFee;
    
    return `
🧾 <b>Payment Receipt - AVRIO</b>

📋 <b>Receipt Details:</b>
Receipt No: <code>${receiptData.txRef || 'N/A'}</code>
Order ID: <code>${receiptData.orderId || 'N/A'}</code>
Date: ${new Date(receiptData.createdAt || Date.now()).toLocaleString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

👤 <b>Customer Information:</b>
Name: ${receiptData.customerName || 'Customer'}
Email: ${receiptData.customerEmail || 'N/A'}
Phone: ${receiptData.customerPhone || 'N/A'}

🛍️ <b>Order Summary:</b>
Product: ${receiptData.productName || 'Product'}
Quantity: ${receiptData.quantity || 1}
Subtotal: ${subtotal} ETB

💰 <b>Payment Breakdown:</b>
Subtotal: ${subtotal} ETB
Service Fee: ${serviceFee} ETB
Delivery Fee: ${deliveryFee} ETB
<b>Total Amount: ${amount} ETB</b>

💳 <b>Payment Information:</b>
Method: ${receiptData.paymentMethod || 'N/A'}
Status: ✅ Paid
Transaction Ref: <code>${receiptData.txRef || 'N/A'}</code>

🚚 <b>Delivery Information:</b>
Method: ${receiptData.deliveryMethod === 'home_delivery' ? '🏠 Home Delivery' : 
         receiptData.deliveryMethod === 'store_pickup' ? '🏪 Store Pickup' : 
         receiptData.deliveryMethod || 'Standard Delivery'}
${receiptData.deliveryAddress ? `📍 Address: ${receiptData.deliveryAddress}` : ''}
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

    if (!text) return;

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, message.from);
      return;
    }

    // Handle regular messages (for support chat)
    if (chatId.toString() === this.config.supportChatId) {
      await this.handleSupportMessage(message);
    }
  }

  private async handleCommand(chatId: number, command: string, from: any): Promise<void> {
    switch (command) {
      case '/start':
        await this.sendWelcomeMessage(chatId, from);
        break;
      case '/help':
        await this.sendHelpMessage(chatId);
        break;
      case '/orders':
        await this.sendOrdersList(chatId, from.id);
        break;
      case '/tracking':
        await this.sendTrackingOverview(chatId, from.id);
        break;
      case '/profile':
        await this.sendProfileInfo(chatId, from.id);
        break;
      case '/support':
        await this.sendSupportMessage(chatId);
        break;
      default:
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Unknown command. Use /help to see available commands.'
        });
    }
  }

  private async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    if (data.startsWith('order_')) {
      const orderId = data.replace('order_', '');
      await this.sendOrderDetails(chatId, orderId);
    } else if (data.startsWith('track_')) {
      const orderId = data.replace('track_', '');
      await this.sendDeliveryTracking(chatId, orderId);
    } else if (data.startsWith('delivery_')) {
      const orderId = data.replace('delivery_', '');
      await this.sendDeliveryTracking(chatId, orderId);
    } else if (data === 'orders_list') {
      // Get user ID from telegram_users table
      const { data: user } = await supabaseService
        .from('telegram_users')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .eq('is_active', true)
        .single();
      
      if (user) {
        await this.sendOrdersList(chatId, user.user_id);
      }
    }
  }

  private async sendWelcomeMessage(chatId: number, from: any): Promise<void> {
    const message = `
🎉 <b>Welcome to AVRIO!</b>

Hi ${from.first_name}! 👋

I'm your personal AVRIO shopping assistant. Discover amazing Ethiopian products & more!

📋 <b>Available Commands:</b>
/orders - View your recent orders
/profile - Your account information
/support - Contact customer support
/help - Show this help message

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

<b>Account & Orders:</b>
/start - Welcome message
/orders - View your recent orders
/tracking - View delivery tracking for all orders
/profile - Your account information

<b>Support:</b>
/support - Contact customer support
/help - Show this help message

<b>Features:</b>
• Real-time order updates
• Delivery tracking
• Payment confirmations
• Flash sale alerts
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

  private async sendOrdersList(chatId: number, userId: number): Promise<void> {
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
        .order('created_at', { ascending: false })
        .limit(5);

      if (!orders || orders.length === 0) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'You haven\'t placed any orders yet. Start shopping at our website!'
        });
        return;
      }

      let message = '📋 <b>Your Recent Orders:</b>\n\n';
      const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

      orders.forEach((order, index) => {
        // Format delivery method
        const deliveryMethodText = order.delivery_method === 'home_delivery' ? '🏠 Home Delivery' : 
                                   order.delivery_method === 'store_pickup' ? '🏪 Store Pickup' : 
                                   order.delivery_method || 'N/A';

        message += `${index + 1}. <b>${(order.product as any)?.title || 'Product'}</b>\n`;
        message += `   Order ID: <code>${order.id}</code>\n`;
        message += `   Status: ${order.order_status}\n`;
        message += `   Amount: ${order.total_price} ETB\n`;
        message += `   Delivery: ${deliveryMethodText}\n`;
        message += `   Date: ${new Date(order.created_at).toLocaleDateString()}\n\n`;

        keyboard.push([
          {
            text: `Order ${index + 1}`,
            callback_data: `order_${order.id}`
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

  private async sendTrackingOverview(chatId: number, userId: number): Promise<void> {
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
      const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

      orders.forEach((order, index) => {
        const orderStatuses = statusesByOrder[order.id] || [];
        const latestStatus = orderStatuses.length > 0 ? orderStatuses[orderStatuses.length - 1] : null;
        
        // Format delivery method
        const deliveryMethodText = order.delivery_method === 'home_delivery' ? '🏠 Home Delivery' : 
                                   order.delivery_method === 'store_pickup' ? '🏪 Store Pickup' : 
                                   order.delivery_method || 'N/A';

        // Get status emoji and text
        const statusInfo = this.getStatusInfo(order.order_status, latestStatus?.status);
        
        message += `${index + 1}. <b>${(order.product as any)?.title || 'Product'}</b>\n`;
        message += `   Order ID: <code>${order.id}</code>\n`;
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

  private async sendOrderDetails(chatId: number, orderId: string): Promise<void> {
    try {
      const { data: order } = await supabaseService
        .from('orders')
        .select(`
          *,
          product:products(title, description, images),
          buyer:users!user_id(full_name, email, phone)
        `)
        .eq('id', orderId)
        .single();

      if (!order) {
        await this.sendMessage({
          chat_id: chatId.toString(),
          text: 'Order not found.'
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
        deliveryInfo = `📍 Address: ${order.delivery_address}`;
      } else if (order.delivery_method === 'store_pickup' && order.pickup_code) {
        deliveryInfo = `🔑 Pickup Code: <code>${order.pickup_code}</code>`;
      }

      const message = `
📦 <b>Order Details</b>

Order ID: <code>${order.id}</code>
Product: ${order.product?.title || 'N/A'}
Status: ${order.order_status}
Payment: ${order.payment_status}

💰 <b>Pricing:</b>
Amount: ${order.total_price} ETB
Platform Fee: ${order.platform_fee || 0} ETB
Service Fee: ${order.service_fee || 0} ETB
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

Order ID: <code>${orderId}</code>
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

  private async sendProfileInfo(chatId: number, userId: number): Promise<void> {
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
• Phone: +251 XXX XXX XXX
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

export async function linkTelegramUser(userId: string, chatId: string): Promise<void> {
  const { error } = await supabaseService
    .from('telegram_users')
    .upsert({
      user_id: userId,
      chat_id: chatId,
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