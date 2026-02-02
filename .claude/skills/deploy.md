# /deploy - Deployment Check

Run pre-deployment checks and deploy to Vercel.

## Usage

```
/deploy check      # Run all pre-deployment checks
/deploy preview    # Deploy to preview environment
/deploy prod       # Deploy to production
/deploy status     # Check deployment status
```

## Pre-deployment Checklist

### 1. Type Check
```bash
npm run type-check
```

### 2. Lint
```bash
npm run lint
```

### 3. Build Test
```bash
npm run build
```

### 4. Security Audit
```bash
npm run security:audit
```

### 5. E2E Tests (optional)
```bash
npm run test:e2e
```

## Full Check Command
```bash
npm run ci:test  # lint && type-check && build
```

## Vercel Deployment

### Preview Deployment
```bash
vercel
```

### Production Deployment
```bash
vercel --prod
```

### Using Git (recommended)
```bash
# Auto-deploys to preview on push
git push origin feature-branch

# Auto-deploys to production on merge to main
git checkout main
git merge feature-branch
git push origin main
```

## Environment Variables

Ensure all required variables are set in Vercel:

### Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Payment Gateways
- `TELEBIRR_*` variables
- `CHAPA_*` variables
- `MPESA_*` variables

### Communication
- `TELEGRAM_BOT_TOKEN`
- `PUSHER_*` variables
- `RESEND_API_KEY`

## Vercel Configuration

Located in `vercel.json`:
```json
{
  "regions": ["fra1"],
  "crons": [{
    "path": "/api/cron/check-subscriptions",
    "schedule": "0 0 * * *"
  }]
}
```

## Post-Deployment

### Check Health
```bash
curl https://your-domain.com/api/health
```

### Monitor Logs
```bash
vercel logs
```

### Rollback if needed
```bash
vercel rollback
```

## Deployment Regions

The app is deployed to Frankfurt (`fra1`) for optimal Ethiopian latency.

## CI/CD Pipeline

GitHub Actions workflow:
1. Push to PR → Lint, Type Check, Build
2. Merge to main → Auto-deploy to Vercel
3. Preview deployments for all branches
