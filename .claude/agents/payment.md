# Payment Integration Agent

A specialized agent for payment gateway integrations in the AVRIO marketplace.

## Supported Payment Methods

### International
- **Stripe** - Credit/debit cards, Apple Pay, Google Pay
- **Chapa** - Ethiopian online payments

### Ethiopian Local
- **Telebirr** - Ethio Telecom mobile money
- **M-Pesa** - Safaricom mobile money
- **CBE Birr** - Commercial Bank of Ethiopia mobile banking

### Traditional
- **Cash on Delivery (COD)** - Pay on receipt

## Key Files

### Libraries
- `src/lib/stripe.ts` - Stripe SDK configuration
- `src/lib/telebirr/` - Telebirr integration
- `src/lib/mpesa.ts` - M-Pesa integration

### API Routes
- `src/app/api/payments/stripe/` - Stripe checkout
- `src/app/api/telebirr/` - Telebirr endpoints (7+)
- `src/app/api/payments/chapa/` - Chapa integration
- `src/app/api/mpesa/` - M-Pesa callbacks
- `src/app/api/payments/cash/` - COD verification

### Components
- `src/components/PaymentMethodModal.tsx` - Payment selection UI
- `src/components/PaymentMethods.tsx` - Display available methods

### Utilities
- `src/utils/telebirr-payment.ts` - Telebirr helpers
- `src/utils/currency.ts` - ETB/USD conversion (1 ETB = 0.0071 USD)

## Testing Payment Flows

### Stripe Test Mode
```bash
# Test card numbers
4242424242424242 - Success
4000000000000002 - Declined
```

### Telebirr Sandbox
- Use sandbox credentials from admin panel
- Test phone: Use registered test numbers

### Webhook Testing
```bash
# Stripe webhook testing
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook

# Chapa webhook testing
ngrok http 3000
# Update callback URL in Chapa dashboard
```

## Payment Flow Architecture

1. Customer selects payment method
2. Create payment intent/session via API
3. Redirect to gateway or show inline form
4. Handle webhook callback
5. Update order status in database
6. Send confirmation (email + Telegram)

## Split Payments

The platform supports group/split payments:
- `split_payment_groups` table tracks participants
- Each participant pays their share
- Order confirmed when all shares paid

## Currency Handling

```typescript
import { convertToUSD, convertToETB, formatCurrency } from '@/utils/currency';

const usdPrice = convertToUSD(1000); // 1000 ETB -> 7.10 USD
const etbPrice = convertToETB(10);   // 10 USD -> 1408.45 ETB
```
