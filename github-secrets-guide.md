# GitHub Secrets Setup Guide

## 🎯 **Step-by-Step Instructions**

### **Step 1: Go to Your Repository**
```
https://github.com/MatiDes12/my-fashion-marketplace
```

### **Step 2: Click Settings Tab**
- Look for the **Settings** tab in the top navigation
- It's usually the last tab (after Issues, Pull requests, etc.)

### **Step 3: Find Secrets Section**
- In the left sidebar, scroll down and click **Secrets and variables**
- Then click **Actions**

### **Step 4: Add Each Secret**

#### **Secret #1: VERCEL_TOKEN**
1. Click **New repository secret**
2. **Name**: `VERCEL_TOKEN`
3. **Value**: `************************`
4. Click **Add secret**

#### **Secret #2: VERCEL_ORG_ID**
1. Click **New repository secret**
2. **Name**: `VERCEL_ORG_ID`
3. **Value**: `************************`
4. Click **Add secret**

#### **Secret #3: VERCEL_PROJECT_ID**
1. Click **New repository secret**
2. **Name**: `VERCEL_PROJECT_ID`
3. **Value**: `************************`
4. Click **Add secret**

#### **Secret #4: SUPABASE_ACCESS_TOKEN**
1. Click **New repository secret**
2. **Name**: `SUPABASE_ACCESS_TOKEN`
3. **Value**: `************************`
4. Click **Add secret**

#### **Secret #5: SUPABASE_PROJECT_REF**
1. Click **New repository secret**
2. **Name**: `SUPABASE_PROJECT_REF`
3. **Value**: `************************`
4. Click **Add secret**

## 📋 **Quick Reference Table**

| Secret Name | Secret Value |
|-------------|--------------|
| `VERCEL_TOKEN` | `************************` |
| `VERCEL_ORG_ID` | `************************` |
| `VERCEL_PROJECT_ID` | `************************` |
| `SUPABASE_ACCESS_TOKEN` | `************************` |
| `SUPABASE_PROJECT_REF` | `************************` |

## ✅ **Verification Steps**

### **After Adding All Secrets:**
1. You should see 5 secrets listed in the repository secrets section
2. The names should be exactly as shown above
3. The values will be hidden with dots (••••••••)

### **Test the Setup:**
1. Go to the **Actions** tab in your repository
2. You should see workflows running or completed
3. Look for green checkmarks ✅ indicating success

## 🚨 **Important Notes**

- **Never share these tokens publicly**
- **The values will be hidden after you add them**
- **You can't see the values again, only update them**
- **Make sure to copy the values exactly as shown**

## 🆘 **Need Help?**

If you get stuck:
1. Make sure you're in the correct repository
2. Check that you're in the Settings → Secrets and variables → Actions section
3. Verify the secret names are exactly as shown (case-sensitive)
4. Copy the values exactly as provided

## 🎉 **Success!**

Once all 5 secrets are added:
- Your CI/CD workflows will work automatically
- Deployments will happen on every push
- Security scans will run
- Database migrations will be applied 