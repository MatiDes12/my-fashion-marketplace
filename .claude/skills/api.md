# /api - API Development

Create and debug API routes.

## Usage

```
/api create <path>     # Create new API route
/api test <endpoint>   # Test an endpoint
/api debug <endpoint>  # Debug API issues
```

## API Route Template

### Basic GET
```typescript
// src/app/api/example/route.ts
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
      .eq('id', id);

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

### POST with Body
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.field) {
      return NextResponse.json(
        { error: 'Missing required field' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('table_name')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### With Authentication
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Proceed with authenticated request
}
```

## Testing APIs

### Using curl
```bash
# GET
curl http://localhost:3000/api/products

# POST
curl -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"product_id": "123", "quantity": 1}'
```

### Using fetch
```typescript
const response = await fetch('/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Product' })
});
const data = await response.json();
```

## API Route Structure

```
src/app/api/
├── admin/           # Admin operations
├── cart/            # Cart management
├── chat/            # Messaging
├── delivery/        # Logistics
├── orders/          # Order processing
├── payments/        # Payment gateways
├── telebirr/        # Telebirr API
├── telegram/        # Bot webhook
└── stores/          # Store endpoints
```

## Error Handling

```typescript
try {
  // API logic
} catch (error) {
  console.error('API Error:', {
    endpoint: request.url,
    method: request.method,
    error: error instanceof Error ? error.message : error
  });

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

## Response Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error
