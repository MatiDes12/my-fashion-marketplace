# API Development Agent

A specialized agent for API route development and debugging in the AVRIO marketplace.

## API Architecture

Next.js 15 App Router API routes with Supabase backend.

### Route Structure
```
src/app/api/
├── admin/                    # Admin operations
├── cart/                     # Cart management
├── chat/                     # Messaging (7 endpoints)
├── delivery/                 # Logistics (9 endpoints)
├── orders/                   # Order processing
├── payments/                 # Payment gateways
│   ├── stripe/              # Stripe checkout
│   ├── chapa/               # Chapa integration
│   └── cash/                # COD verification
├── telebirr/                # Telebirr (7+ endpoints)
├── telegram/                # Bot webhook (19+ endpoints)
├── mpesa/                   # M-Pesa integration
├── gift-purchase/           # Gift features
├── cron/                    # Scheduled tasks
├── seller/                  # Seller registration
└── stores/                  # Store endpoints
```

## API Route Template

### Basic GET Route
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### POST Route with Body
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { field1, field2 } = body;

    // Validate input
    if (!field1 || !field2) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process request
    const { data, error } = await supabase
      .from('table_name')
      .insert({ field1, field2 })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Dynamic Route
```typescript
// src/app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Fetch product by ID
}
```

## Authentication

### Get Current User
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // User is authenticated
}
```

### Check Admin Role
```typescript
const { data: userData } = await supabase
  .from('users')
  .select('is_admin')
  .eq('id', user.id)
  .single();

if (!userData?.is_admin) {
  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 }
  );
}
```

## Error Handling

```typescript
try {
  // API logic
} catch (error) {
  // Log for debugging
  console.error('API Error:', {
    endpoint: '/api/endpoint',
    error: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString()
  });

  // Return appropriate error
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

## Rate Limiting

The middleware implements rate limiting:
- 100 requests per minute per IP
- Returns 429 Too Many Requests when exceeded

## Security Middleware

Located in `src/middleware.ts`:
- SQL injection detection
- XSS pattern detection
- Malicious user agent blocking
- HTTPS enforcement

## Webhook Handlers

### Stripe Webhook
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // Handle successful payment
      break;
    case 'payment_intent.payment_failed':
      // Handle failed payment
      break;
  }

  return NextResponse.json({ received: true });
}
```

## Testing APIs

```bash
# Test with curl
curl -X GET http://localhost:3000/api/products

# Test POST
curl -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"product_id": "123", "quantity": 1}'

# Test with authentication
curl -X GET http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```
