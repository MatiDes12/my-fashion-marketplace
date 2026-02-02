# /payment - Payment Testing

Test and debug payment integrations.

## Usage

```
/payment test <gateway>    # Test payment gateway
/payment webhook           # Test webhook handlers
/payment status <id>       # Check payment status
```

## Supported Gateways

| Gateway | Test Mode | Production |
|---------|-----------|------------|
| Stripe | ✅ | ✅ |
| Telebirr | ✅ | ✅ |
| Chapa | ✅ | ✅ |
| M-Pesa | ✅ | ✅ |
| CBE Birr | ✅ | ✅ |

## Stripe Testing

### Test Card Numbers
```
4242424242424242  - Successful payment
4000000000000002  - Declined
4000000000009995  - Insufficient funds
4000000000000069  - Expired card
```

### Test Webhook
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

### Create Test Payment
```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: 'Test Product' },
      unit_amount: 1000, // $10.00
    },
    quantity: 1,
  }],
  mode: 'payment',
  success_url: 'http://localhost:3000/success',
  cancel_url: 'http://localhost:3000/cancel',
});
```

## Telebirr Testing

### Sandbox Mode
Use sandbox credentials from admin panel.

### Test Numbers
Use registered test phone numbers provided by Telebirr.

### Test Flow
1. Initialize payment via `/api/telebirr/init`
2. Redirect to Telebirr sandbox
3. Complete test payment
4. Webhook callback to `/api/telebirr/callback`

## Chapa Testing

### Test Keys
Use test API keys from Chapa dashboard.

### Test Transaction
```bash
curl -X POST https://api.chapa.co/v1/transaction/initialize \
  -H "Authorization: Bearer CHAPA_TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100",
    "currency": "ETB",
    "email": "test@example.com",
    "tx_ref": "test-tx-123"
  }'
```

## Webhook Testing

### Using ngrok
```bash
# Expose local server
ngrok http 3000

# Use ngrok URL for webhook callbacks
# https://abc123.ngrok.io/api/payments/stripe/webhook
```

### Verify Webhook Signature
```typescript
// Stripe
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
);

// Verify Telebirr
const isValid = verifyTelebirrSignature(body, signature);
```

## Payment Flow

```
1. Customer selects payment method
2. Create payment intent/session (API)
3. Redirect to gateway or show form
4. Customer completes payment
5. Gateway sends webhook
6. Update order status
7. Send confirmation
```

## Debugging

### Check Payment Status
```typescript
const { data } = await supabase
  .from('orders')
  .select('payment_status, payment_method, payment_id')
  .eq('id', orderId)
  .single();
```

### View Webhook Logs
```typescript
const { data } = await supabase
  .from('payment_webhooks')
  .select('*')
  .eq('order_id', orderId)
  .order('created_at', { ascending: false });
```
