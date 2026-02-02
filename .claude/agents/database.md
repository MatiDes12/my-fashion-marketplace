# Database Agent

A specialized agent for Supabase database operations in the AVRIO marketplace.

## Database Files

- `supabase/schema.sql` - Complete database schema (5,795 lines)
- `supabase/data.sql` - Database data dump (5MB)
- `supabase/config.toml` - Supabase CLI configuration

## Database Tables (41 tables)

### User Management
| Table | Description |
|-------|-------------|
| `users` | User accounts with roles (customer, owner, admin) |
| `seller_verification` | Seller verification requests and status |
| `delivery_accounts` | Delivery personnel accounts |
| `delivery_access_tokens` | Auth tokens for delivery app |

### Products & Catalog
| Table | Description |
|-------|-------------|
| `products` | Product catalog with pricing, inventory |
| `product_images` | Product image URLs and metadata |
| `custom_categories` | User-defined product categories |
| `flash_sales` | Flash sale campaigns |
| `flash_sale_products` | Products in flash sales |

### Shopping & Orders
| Table | Description |
|-------|-------------|
| `cart_items` | Shopping cart contents |
| `orders` | Order records with status |
| `temporary_orders` | Pending/incomplete orders |
| `subscription_orders` | Recurring subscription orders |
| `transactions` | Payment transactions |

### Wishlist & Engagement
| Table | Description |
|-------|-------------|
| `wishlist` | Saved/bookmarked products |
| `saved_items` | Alternative saved items |
| `likes` | Product likes |
| `ratings` | Product reviews and ratings |

### Communication
| Table | Description |
|-------|-------------|
| `chat_rooms` | Conversation channels |
| `chat_messages` | Message history |
| `user_chat_status` | Online/typing status |
| `notifications` | In-app notifications |
| `contact_messages` | Contact form submissions |
| `support_tickets` | Customer support tickets |

### Telegram Integration
| Table | Description |
|-------|-------------|
| `telegram_users` | Linked Telegram accounts |
| `telegram_notifications` | Telegram notification logs |
| `admin_telegram_settings` | Bot configuration |

### Delivery & Logistics
| Table | Description |
|-------|-------------|
| `delivery_tracking` | Real-time delivery locations |
| `delivery_statuses` | Delivery status history |

### Payments & Transactions
| Table | Description |
|-------|-------------|
| `payment_settings` | Seller payment configurations |
| `admin_payment_settings` | Platform payment settings |
| `platform_withdrawals` | Seller withdrawal requests |
| `split_payment_groups` | Group payment sessions |
| `split_payment_participants` | Participants in split payments |

### Gifts & Sharing
| Table | Description |
|-------|-------------|
| `gift_purchases` | Gift order records |
| `gift_wrapping_options` | Available gift wrap styles |
| `shared_carts` | Shared shopping carts |

### Marketing & Analytics
| Table | Description |
|-------|-------------|
| `email_subscribers` | Newsletter subscribers |
| `email_campaigns` | Marketing email campaigns |
| `seller_tutorials` | Onboarding content for sellers |
| `client_logs` | Client-side error/debug logs |

## Key Functions

The database includes several stored functions:

### `add_to_cart(p_user_id, p_product_id, p_quantity)`
Adds item to cart with upsert logic (updates quantity if exists).

```sql
SELECT add_to_cart('user-uuid', 'product-uuid', 2);
```

## Commands

```bash
# Pull latest schema from remote
export SUPABASE_ACCESS_TOKEN="your_token"
supabase db dump -f supabase/schema.sql

# Pull data
supabase db dump -f supabase/data.sql --data-only

# Link project (first time)
supabase link --project-ref qrigmytqvxuzvrbphpcl

# Start local database
supabase start

# Push migrations to remote
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > src/types/database.types.ts
```

## Supabase Client Usage

```typescript
import { supabase } from '@/lib/supabase';

// Query products
const { data: products } = await supabase
  .from('products')
  .select('*, product_images(*)')
  .eq('is_active', true)
  .order('created_at', { ascending: false });

// Insert order
const { data: order } = await supabase
  .from('orders')
  .insert({
    user_id,
    total_amount,
    status: 'pending'
  })
  .select()
  .single();

// Real-time subscription
const channel = supabase
  .channel('orders')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'orders',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('Order updated:', payload.new);
  })
  .subscribe();
```

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:
- Users can only read/write their own data
- Admins have full access
- Sellers can manage their own products/orders
- Public read access for products catalog

## Project Reference

- **Project Ref:** `qrigmytqvxuzvrbphpcl`
- **PostgreSQL Version:** 15
- **Region:** (check Supabase dashboard)
