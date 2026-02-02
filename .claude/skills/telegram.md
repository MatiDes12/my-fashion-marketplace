# /telegram - Telegram Bot Operations

Manage and test Telegram bot integration.

## Usage

```
/telegram webhook      # Check/set webhook
/telegram test         # Send test message
/telegram logs         # View notification logs
```

## Webhook Setup

### Check Webhook Status
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

### Set Webhook
```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/telegram/webhook",
    "secret_token": "YOUR_WEBHOOK_SECRET"
  }'
```

### Delete Webhook (for testing)
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

## Test Messages

### Send Test Message
```typescript
const response = await fetch(
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: 'Test message from AVRIO',
      parse_mode: 'Markdown'
    })
  }
);
```

### Send with Buttons
```typescript
await sendTelegramMessage(chatId, 'Choose an option:', {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '✅ Accept', callback_data: 'accept' },
        { text: '❌ Reject', callback_data: 'reject' }
      ]
    ]
  }
});
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome and account status |
| `/link <code>` | Link to AVRIO account |
| `/unlink` | Unlink account |
| `/orders` | View recent orders |
| `/track <id>` | Track order |
| `/help` | Show commands |

## Account Linking

### Generate Link Code
```typescript
const linkCode = crypto.randomBytes(16).toString('hex');

await supabase.from('telegram_link_codes').insert({
  user_id: userId,
  code: linkCode,
  expires_at: new Date(Date.now() + 15 * 60 * 1000)
});
```

### Verify Link Code
```typescript
const { data } = await supabase
  .from('telegram_link_codes')
  .select('user_id')
  .eq('code', code)
  .gt('expires_at', new Date().toISOString())
  .single();
```

## Notification Types

### Order Notification
```typescript
const orderMessage = `
🛒 *New Order #${orderId}*

📦 Items:
${items.map(i => `• ${i.name} x${i.qty}`).join('\n')}

💰 Total: ${total} ETB
📍 Delivery: ${address}
`;
```

### Delivery Update
```typescript
const statusEmoji = {
  picking_up: '🛵',
  picked_up: '📦',
  in_transit: '🚚',
  delivered: '✅'
};
```

## Debug Logs

### View Notification History
```typescript
const { data } = await supabase
  .from('telegram_notifications')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);
```

### Check Linked Users
```typescript
const { data } = await supabase
  .from('telegram_users')
  .select('*, users(email)')
  .order('created_at', { ascending: false });
```

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_URL=https://domain.com/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=your_secret
```
