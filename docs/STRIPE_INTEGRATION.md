# Stripe Integration Guide

This document explains how to set up and use Stripe payments in the Fashion Marketplace application.

## Overview

Stripe integration allows customers to pay with international credit/debit cards in USD. The system automatically converts ETB prices to USD for international customers.

## Features

- ✅ Credit/Debit card payments in USD
- ✅ Automatic ETB to USD conversion
- ✅ Secure payment processing via Stripe Checkout
- ✅ Webhook handling for payment status updates
- ✅ Integration with existing order management system
- ✅ Flash sale pricing support
- ✅ Seller payout calculations

## Setup Instructions

### 1. Create Stripe Account

1. Sign up for a Stripe account at [stripe.com](https://stripe.com)
2. Complete account verification
3. Get your API keys from the Stripe dashboard

### 2. Environment Variables

Add the following to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. Webhook Configuration

1. In your Stripe dashboard, go to Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/payments/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the webhook secret to your environment variables

### 4. Database Migration

Run the included migration to add Stripe settings to the payment_settings table:

```sql
-- This is automatically included in the migration files
```

## Currency Conversion

The system uses a fixed conversion rate (configurable in `src/lib/stripe.ts`):

- 1 ETB = 0.018 USD (approximate)
- 1 USD = 55.56 ETB (approximate)

**Note**: In production, you should use a real-time currency API for accurate rates.

## Payment Flow

1. Customer selects Stripe payment method
2. System converts ETB total to USD
3. Creates temporary orders in database
4. Redirects to Stripe Checkout
5. Customer completes payment
6. Stripe webhook confirms payment
7. System creates final orders and updates inventory
8. Customer is redirected to success page

## File Structure

```
src/
├── lib/stripe.ts                 # Stripe configuration and utilities
├── app/api/payments/stripe/
│   ├── create-checkout-session/  # Create payment session
│   ├── success/                  # Handle successful payments
│   └── webhook/                  # Handle Stripe webhooks
├── components/PaymentMethodModal.tsx  # Payment UI
└── app/dashboard/payment-settings/   # Seller settings
```

## Testing

Use Stripe's test card numbers:

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires Authentication**: 4000 0025 0000 3155

## Security Notes

- Never expose secret keys in client-side code
- Always validate webhook signatures
- Use HTTPS in production
- Implement proper error handling
- Log payment attempts for debugging

## Troubleshooting

### Common Issues

1. **Webhook signature verification failed**
   - Check that STRIPE_WEBHOOK_SECRET is correct
   - Ensure webhook URL is accessible

2. **Currency conversion errors**
   - Verify conversion rates in stripe.ts
   - Check for floating point precision issues

3. **Order creation failures**
   - Check database permissions
   - Verify temporary_orders table structure

### Debugging

Enable debug logging by adding to your API routes:

```typescript
console.log('Stripe debug:', { /* your debug data */ });
```

## Production Considerations

1. **Currency Rates**: Implement real-time currency conversion
2. **Stripe Connect**: For marketplace payments to sellers
3. **Tax Handling**: Consider international tax requirements
4. **Refunds**: Implement refund handling via Stripe API
5. **Reporting**: Set up Stripe Dashboard for transaction monitoring

## Support

For Stripe-specific issues, refer to:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)

For application-specific issues, check the main README.md file.
