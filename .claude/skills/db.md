# /db - Database Operations

Perform Supabase database operations including migrations, queries, and schema management.

## Usage

```
/db migrate          # Run pending migrations
/db reset            # Reset database (destructive!)
/db backup           # Create database backup
/db schema           # Show current schema
/db query <table>    # Query a specific table
```

## Examples

### Run migrations
```bash
npm run db:migrate
```

### Reset database
```bash
npm run db:reset
```

### Check schema
```bash
# List all tables
npx supabase db dump --schema public --data-only=false | grep "CREATE TABLE"
```

### Query data
```bash
# Using Supabase CLI
npx supabase db query "SELECT * FROM products LIMIT 10"
```

## Migration Files

Migrations are stored in `supabase/migrations/` with timestamp prefixes:
```
supabase/migrations/
├── 20240101000000_create_users.sql
├── 20240102000000_create_products.sql
├── 20240103000000_create_orders.sql
└── ...
```

## Creating a New Migration

1. Create file with timestamp prefix:
```bash
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_migration_name.sql
```

2. Write SQL:
```sql
-- Create table
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view own data" ON new_table
  FOR SELECT USING (auth.uid() = user_id);
```

3. Run migration:
```bash
npm run db:migrate
```

## Key Tables

- `users` - User accounts
- `products` - Product catalog
- `orders` - Order records
- `cart` - Shopping carts
- `stores` - Seller stores
- `chat_messages` - Chat history
- `delivery_tracking` - Delivery status
- `payment_settings` - Payment configs
