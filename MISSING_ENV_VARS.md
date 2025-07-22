# 🔧 Missing Environment Variables - Build Fix Required

Your CI/CD build is failing because GitHub Actions doesn't have access to your local environment variables. You need to add these to your GitHub Secrets.

## 🚨 **Current Error**
```
Error: supabaseUrl is required.
```

## ✅ **Required Environment Variables**

You need to add these secrets to your GitHub repository:

### **1. Supabase Configuration**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://qrigmytqvxuzvrbphpcl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### **2. Site Configuration**
```bash
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## 🔑 **How to Get These Values**

### **From Your Local .env.local File**
1. Open your `.env.local` file
2. Copy the values for the variables above
3. Add them to GitHub Secrets

### **From Supabase Dashboard**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

## 📝 **How to Add to GitHub Secrets**

1. Go to your GitHub repository
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each variable:

| Secret Name | Value |
|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qrigmytqvxuzvrbphpcl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key from Supabase |
| `NEXT_PUBLIC_SITE_URL` | Your production URL (e.g., `https://yourdomain.com`) |

## 🚀 **After Adding Secrets**

Once you've added these secrets:

1. **Push a commit** to trigger the workflow again:
```bash
git add .
git commit -m "fix: Add environment variables to CI/CD workflows"
git push origin master
```

2. **Check the Actions tab** - the build should now succeed!

## 🔍 **Optional: Additional Environment Variables**

If you want to add more environment variables for full functionality, you can also add:

```bash
# Payment Gateways
MERCHANT_APP_ID=your_merchant_app_id
FABRIC_APP_ID=your_fabric_app_id
APP_SECRET=your_app_secret
CHAPA_SECRET_KEY=your_chapa_secret_key
MPESA_CONSUMER_KEY=your_mpesa_consumer_key

# Email
RESEND_API_KEY=your_resend_api_key

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

## ⚠️ **Important Notes**

- **Never commit** `.env.local` to your repository
- **Use different values** for production vs development
- **Keep secrets secure** - don't share them publicly
- **Test locally** before pushing to ensure everything works

## 🎯 **Quick Fix**

The **minimum required** to fix the build error is:
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`

Add these three and your build should work! 🚀 