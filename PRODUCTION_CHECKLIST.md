# 🚀 Production Deployment Checklist

## ✅ **REQUIRED CHANGES for Production:**

### **1. 🔑 Switch to Live Stripe Keys**

**In your production environment variables:**

```bash
# CHANGE FROM TEST to LIVE:
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_publishable_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_publishable_key
STRIPE_SECRET_KEY=sk_live_your_live_stripe_secret_key
```

**Get Live Keys:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle from "Test mode" to "Live mode" (top right)
3. Go to Developers → API keys
4. Copy your Live keys

---

### **2. 🔗 Set Up Production Webhook**

**Create Live Webhook Endpoint:**
1. In Stripe Dashboard (Live mode)
2. Go to Developers → Webhooks
3. Click "+ Add endpoint"
4. **Endpoint URL**: `https://yourdomain.com/api/payments/stripe/webhook`
5. **Events**: Select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
6. Click "Add endpoint"
7. **Copy the webhook secret** → Add to your production env:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
```

---

### **3. 🌐 Update Site URLs**

**In production environment:**
```bash
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
```

---

### **4. 🔒 Enable Stripe Security Features**

**In Stripe Dashboard (Live mode):**

1. **Radar Rules** (Fraud Detection):
   - Go to Radar → Rules
   - Enable recommended fraud rules
   - Set risk thresholds

2. **3D Secure** (SCA Compliance):
   - Go to Settings → Payment methods
   - Enable 3D Secure for cards

3. **Dispute Protection**:
   - Review dispute settings
   - Set up automated responses

---

## ✅ **VERIFICATION STEPS:**

### **Test Production Setup:**

1. **Small Test Payment** ($0.50):
   ```bash
   # Use live Stripe test card in live mode:
   # 4000 0000 0000 0002 (Visa - always successful)
   ```

2. **Check Database**:
   ```sql
   -- Verify data is saved correctly
   SELECT payment_method, payment_status FROM orders WHERE payment_reference LIKE 'cs_live_%';
   SELECT payment_method, payment_status FROM transactions WHERE payment_method = 'STRIPE';
   ```

3. **Test Receipt**:
   - Complete payment → Should redirect to receipt
   - Receipt should show all details correctly
   - Auto-redirect to orders page should work

4. **Test Webhook**:
   - Check Stripe Dashboard → Webhooks → Your endpoint
   - Should show successful deliveries
   - Check server logs for webhook processing

---

## 📊 **MONITORING SETUP:**

### **1. Stripe Dashboard Monitoring**
- **Payments**: Monitor successful/failed payments
- **Disputes**: Set up email alerts
- **Webhooks**: Monitor delivery success rate

### **2. Application Monitoring**
- **Error Logs**: Check for payment processing errors
- **Database**: Monitor order/transaction creation
- **Rate Limiting**: Check for unusual traffic patterns

### **3. Customer Experience**
- **Receipt Delivery**: Ensure customers receive receipts
- **Payment Flow**: Test complete user journey
- **Error Handling**: Verify graceful failure handling

---

## 🚨 **SECURITY FINAL CHECK:**

### **Production Security Essentials:**
✅ Live Stripe keys properly secured  
✅ Webhook signature verification enabled  
✅ HTTPS enforced for all payment endpoints  
✅ Rate limiting active  
✅ User authentication verified  
✅ Error messages don't expose sensitive data  
✅ Database RLS (Row Level Security) enabled  

---

## 🎯 **DEPLOYMENT STEPS:**

### **1. Environment Setup**
```bash
# Set production environment variables
NODE_ENV=production
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### **2. Database Migration**
```bash
# Ensure Stripe settings column exists
# (Already done via migration)
```

### **3. Deploy Application**
```bash
# Deploy your Next.js app
# Configure webhook endpoint
# Test payment flow
```

### **4. Go Live! 🚀**
```bash
# Enable Stripe payments in your app
# Monitor first few transactions
# Customer support ready
```

---

## ⚠️ **IMPORTANT NOTES:**

1. **Test vs Live**: Test keys start with `pk_test_/sk_test_`, Live keys start with `pk_live_/sk_live_`

2. **Webhook Security**: Always verify webhook signatures in production

3. **Currency**: Your app converts ETB to USD at fixed rate (0.018). Consider updating this rate periodically.

4. **Customer Support**: Have a plan for handling payment issues and refunds

5. **Backup**: Keep your previous payment methods (Cash/Chapa) active during transition

---

## 🎉 **YOU'RE READY!**

Your Stripe integration is **production-ready** with:
- ✅ Secure payment processing
- ✅ Complete database integration  
- ✅ Custom receipt generation
- ✅ Webhook handling
- ✅ Error management
- ✅ Rate limiting protection

Just update the keys and webhook, then you're live! 🚀💳
