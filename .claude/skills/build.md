# /build - Build Project

Build the Next.js application for production.

## Usage

```
/build             # Build for production
/build dev         # Start development server
/build start       # Start production server
/build analyze     # Analyze bundle size
```

## Commands

### Production build
```bash
npm run build
```

### Development server
```bash
npm run dev
```

### Start production server
```bash
npm start
```

### Full CI build
```bash
npm run ci:build  # npm ci && npm run build
```

## Build Process

1. **Type checking** - Verifies TypeScript
2. **Linting** - Checks code quality
3. **Compilation** - Builds Next.js app
4. **Optimization** - Minifies and optimizes
5. **Static generation** - Pre-renders pages

## Build Output

```
.next/
├── standalone/        # Standalone server
├── static/           # Static assets
├── server/           # Server components
└── cache/            # Build cache
```

## Standalone Output

The project uses `output: 'standalone'` for self-contained deployments:
```javascript
// next.config.js
module.exports = {
  output: 'standalone',
}
```

## Environment Variables

Required for build:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Build Checks

Before deploying, ensure:
```bash
npm run lint           # No linting errors
npm run type-check     # No type errors
npm run build          # Successful build
```

## Bundle Analysis

To analyze bundle size:
```bash
ANALYZE=true npm run build
```

## Common Build Issues

### Type errors
```bash
# Check types first
npm run type-check
```

### Missing dependencies
```bash
# Reinstall dependencies
rm -rf node_modules
npm ci
```

### Memory issues
```bash
# Increase Node memory
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

## Deployment

After successful build:
```bash
# Vercel deployment
vercel --prod

# Or use Git push (auto-deploys)
git push origin main
```
