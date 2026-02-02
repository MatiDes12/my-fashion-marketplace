# /security - Security Audit

Run security audits and checks on the codebase.

## Usage

```
/security audit    # Run full security audit
/security fix      # Auto-fix vulnerabilities
/security deps     # Check dependency vulnerabilities
/security headers  # Check security headers
```

## Commands

### Run npm audit
```bash
npm run security:audit
```

### Auto-fix vulnerabilities
```bash
npm run security:fix
```

### Full audit report
```bash
npm audit
```

### Check for critical issues only
```bash
npm audit --audit-level=critical
```

## Security Checks

### 1. Dependency Audit
```bash
npm audit
```
Reviews all npm packages for known vulnerabilities.

### 2. Type Safety
```bash
npm run type-check
```
TypeScript catches many potential runtime errors.

### 3. Linting
```bash
npm run lint
```
ESLint catches common security anti-patterns.

### 4. Build Test
```bash
npm run build
```
Ensures no broken imports or exposed secrets.

## Security Headers Check

Verify headers in `next.config.js`:
- HSTS
- X-Frame-Options
- X-Content-Type-Options
- Content-Security-Policy
- Referrer-Policy

## Common Vulnerabilities

### SQL Injection
```typescript
// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ Safe (Supabase parameterized)
const { data } = await supabase.from('users').select('*').eq('id', userId);
```

### XSS
```typescript
// ❌ Vulnerable
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Safe
<div>{userInput}</div>
```

### Exposed Secrets
```typescript
// ❌ Never do this
const apiKey = 'sk_live_xxx';

// ✅ Use environment variables
const apiKey = process.env.STRIPE_SECRET_KEY;
```

## Environment Variable Check

Ensure these are NEVER in client-side code:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- Any `*_SECRET_*` variables

## Aikido Security

The project uses `@aikidosec/firewall` for additional protection:
- Request filtering
- Attack detection
- Rate limiting

## Security Checklist

- [ ] Dependencies audited (`npm audit`)
- [ ] No secrets in code
- [ ] API routes authenticate users
- [ ] Admin routes check `is_admin`
- [ ] User input validated
- [ ] File uploads restricted
- [ ] HTTPS enforced
- [ ] Security headers configured
