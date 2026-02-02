# Security Agent

A specialized agent for security auditing and hardening in the AVRIO marketplace.

## Security Architecture

### Middleware Protection
Located in `src/middleware.ts`:
- Rate limiting (100 requests/minute per IP)
- SQL injection detection
- XSS pattern detection
- Malicious user agent blocking
- HTTPS enforcement

### Security Headers
Configured in `next.config.js`:
```
- HSTS (2 years, includeSubDomains)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy (strict)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (restricted)
```

### Authentication
- Supabase Auth (JWT-based)
- Cookie-based sessions with auto-refresh
- Protected routes via middleware

### Firewall
- Aikido Security WAF (`@aikidosec/firewall`)

## Security Checks

### npm audit
```bash
# Check vulnerabilities
npm run security:audit

# Auto-fix vulnerabilities
npm run security:fix

# Full audit report
npm audit --audit-level=moderate
```

### Common Vulnerabilities

#### SQL Injection
```typescript
// BAD - vulnerable
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD - parameterized
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId);
```

#### XSS Prevention
```typescript
// BAD - vulnerable
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// GOOD - sanitized
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />

// BEST - avoid innerHTML
<div>{userInput}</div>
```

#### CSRF Protection
- Supabase handles CSRF with JWT tokens
- API routes validate auth headers

## Input Validation

### Server-side Validation
```typescript
import { z } from 'zod';

const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  description: z.string().max(5000),
  category: z.enum(['fashion', 'electronics', 'home']),
});

export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = ProductSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: result.error.issues },
      { status: 400 }
    );
  }

  // Process validated data
}
```

### File Upload Validation
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function validateFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('File too large');
  }
}
```

## Authentication Checks

### Protected Route Pattern
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check role if needed
  const { data: userData } = await supabase
    .from('users')
    .select('role, is_admin')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with authorized request
}
```

## Sensitive Data

### Environment Variables
Never expose in client-side code:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- Payment gateway secrets
- JWT secrets

### Client-side Safe
Can be exposed:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Security Checklist

- [ ] All API routes validate authentication
- [ ] Admin routes check `is_admin` flag
- [ ] User input sanitized before display
- [ ] File uploads validated and scanned
- [ ] SQL queries use parameterized statements
- [ ] Sensitive env vars not exposed to client
- [ ] HTTPS enforced in production
- [ ] Rate limiting configured
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies regularly audited
- [ ] RLS policies on all Supabase tables

## Incident Response

1. Identify the vulnerability/breach
2. Contain the damage (disable affected features)
3. Assess impact (affected users/data)
4. Fix the vulnerability
5. Notify affected users if required
6. Post-mortem and prevention measures
