# Telegram Bot Agent

A specialized agent for Telegram bot integration in the AVRIO marketplace.

## Bot Features

### Customer Features
- Order notifications
- Delivery updates
- Payment confirmations
- Customer support chat
- Order history lookup

### Seller Features
- New order alerts
- Low stock notifications
- Daily sales summaries
- Customer inquiries

### Admin Features
- Platform alerts
- Verification requests
- Support escalations
- System notifications

## Key Files

### Main Library
- `src/lib/telegram.ts` - Core bot logic (714KB)

### API Routes
- `src/app/api/telegram/` - 19+ webhook endpoints
  - `/webhook` - Main webhook handler
  - `/send` - Send message
  - `/link` - Link account
  - `/unlink` - Unlink account

### Components
- `src/components/TelegramIntegration.tsx` - Account linking UI

### Database Tables
- `telegram_users` - User-Telegram account mapping
- `telegram_notifications` - Notification history

## Bot Setup

### Environment Variables
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
```

### Webhook Registration
```typescript
const registerWebhook = async () => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: TELEGRAM_WEBHOOK_URL,
      secret_token: TELEGRAM_WEBHOOK_SECRET
    })
  });
};
```

## Account Linking

### Link Flow
1. User clicks "Link Telegram" in profile
2. Generate unique linking code
3. User sends code to bot
4. Bot verifies and links accounts

### Implementation
```typescript
// Generate link code
const linkCode = crypto.randomBytes(16).toString('hex');

await supabase
  .from('telegram_link_codes')
  .insert({
    user_id: userId,
    code: linkCode,
    expires_at: new Date(Date.now() + 15 * 60 * 1000) // 15 min
  });

// Bot handler
if (message.startsWith('/link ')) {
  const code = message.split(' ')[1];

  const { data } = await supabase
    .from('telegram_link_codes')
    .select('user_id')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (data) {
    await supabase
      .from('telegram_users')
      .insert({
        user_id: data.user_id,
        telegram_id: chatId,
        telegram_username: username
      });

    await sendMessage(chatId, '✅ Account linked successfully!');
  }
}
```

## Sending Messages

### Basic Message
```typescript
import { sendTelegramMessage } from '@/lib/telegram';

await sendTelegramMessage(telegramId, 'Hello from AVRIO!');
```

### Rich Message with Buttons
```typescript
await sendTelegramMessage(telegramId, 'New order received!', {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '✅ Accept', callback_data: `accept_${orderId}` },
        { text: '❌ Reject', callback_data: `reject_${orderId}` }
      ],
      [
        { text: '📦 View Details', url: `https://avrio.com/orders/${orderId}` }
      ]
    ]
  }
});
```

### Order Notification Template
```typescript
const orderNotification = (order: Order) => `
🛒 *New Order #${order.id.slice(0, 8)}*

📦 Items:
${order.items.map(i => `• ${i.name} x${i.quantity}`).join('\n')}

💰 Total: ${formatCurrency(order.total, 'ETB')}
📍 Delivery: ${order.delivery_address}

🕐 Placed: ${formatDate(order.created_at)}
`;
```

## Webhook Handler

```typescript
// src/app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update = await request.json();

  // Handle different update types
  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(message: any) {
  const { chat, text } = message;

  if (text.startsWith('/')) {
    await handleCommand(chat.id, text);
  } else {
    await handleText(chat.id, text);
  }
}

async function handleCommand(chatId: number, command: string) {
  switch (command.split(' ')[0]) {
    case '/start':
      await sendWelcomeMessage(chatId);
      break;
    case '/link':
      await handleLinkCommand(chatId, command);
      break;
    case '/orders':
      await sendOrderHistory(chatId);
      break;
    case '/help':
      await sendHelpMessage(chatId);
      break;
  }
}
```

## Notification Types

### Order Updates
```typescript
const notifyOrderStatus = async (order: Order) => {
  const { data: telegramUser } = await supabase
    .from('telegram_users')
    .select('telegram_id')
    .eq('user_id', order.customer_id)
    .single();

  if (telegramUser) {
    const statusEmoji = {
      confirmed: '✅',
      processing: '🔄',
      shipped: '🚚',
      delivered: '📦',
      cancelled: '❌'
    };

    await sendTelegramMessage(
      telegramUser.telegram_id,
      `${statusEmoji[order.status]} Order #${order.id.slice(0, 8)} is now ${order.status}`
    );
  }
};
```

### Delivery Updates
```typescript
const notifyDeliveryUpdate = async (tracking: DeliveryTracking) => {
  const messages = {
    picking_up: '🛵 Driver is heading to pick up your order',
    picked_up: '📦 Your order has been picked up',
    in_transit: '🚚 Your order is on the way',
    arriving: '📍 Driver is arriving at your location',
    delivered: '✅ Your order has been delivered!'
  };

  await sendTelegramMessage(
    customerTelegramId,
    `${messages[tracking.status]}\n\n🔑 Pickup Code: ${tracking.pickup_code}`
  );
};
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and account status |
| `/link <code>` | Link Telegram to AVRIO account |
| `/unlink` | Unlink account |
| `/orders` | View recent orders |
| `/track <order_id>` | Track specific order |
| `/help` | Show available commands |
| `/support` | Contact customer support |
