# Stripe Setup Instructions

## 1. Create Environment File

Create a `.env.local` file in your project root with the following content:

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_5
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51r
STRIPE_SECRET_KEY=sk_test_51Rw

# Webhook secret (will be added after webhook setup)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_will_go_here

# Add your existing environment variables here
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
# etc...
```

## 2. Set Up Stripe Webhook (Required for Production)

### Steps:

1. **Log into your Stripe Dashboard**
   - Go to [dashboard.stripe.com](https://dashboard.stripe.com)

2. **Navigate to Webhooks**
   - Go to Developers → Webhooks
   - Click "Add endpoint"

3. **Configure Webhook**
   - **Endpoint URL**: `https://yourdomain.com/api/payments/stripe/webhook`
   - For local development: `https://your-ngrok-url.ngrok.io/api/payments/stripe/webhook`

4. **Select Events**
   Add these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

5. **Get Webhook Secret**
   - After creating the webhook, click on it
   - Copy the "Signing secret" (starts with `whsec_`)
   - Add it to your `.env.local` file

## 3. For Local Development (Optional)

If you want to test webhooks locally, use ngrok:

```bash
# Install ngrok (if not already installed)
npm install -g ngrok

# Start your Next.js app
npm run dev

# In another terminal, expose your local server
ngrok http 3000

# Use the ngrok HTTPS URL for your webhook endpoint
```

## 4. Test the Integration

### Test Cards (Stripe Test Mode):

- **Successful Payment**: `4242 4242 4242 4242`
- **Declined Payment**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

### Test Flow:

1. Add items to cart
2. Go to checkout
3. Select "Credit/Debit Card (USD)" payment method
4. Use a test card number
5. Complete the payment process

## 5. Important Notes

- ✅ Your Stripe keys are already configured in the code
- ✅ Currency conversion is set (1 ETB = 0.018 USD)
- ✅ All API endpoints are ready
- ⚠️ You need to set up the webhook for production use
- ⚠️ For production, switch to live keys (pk_live_... and sk_live_...)

## 6. Going Live

When ready for production:

1. Complete Stripe account verification
2. Switch to live API keys in your environment variables
3. Update webhook endpoint to your production domain
4. Test with real (small amount) transactions

## Current Status

✅ **Ready to test in development mode!**

Your Stripe integration is now configured and ready for testing. You can process USD payments immediately using the test card numbers above.
