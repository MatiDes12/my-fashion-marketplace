# Seller Dashboard Agent

A specialized agent for seller-related features in the AVRIO marketplace.

## Seller Features

### Store Management
- Store creation and customization
- Store branding (logo, banner, description)
- Store categories
- Operating hours
- Contact information

### Product Management
- Add/edit/delete products
- Product variants (size, color, etc.)
- Inventory tracking
- Product images
- Pricing and discounts

### Order Management
- View incoming orders
- Process orders
- Update order status
- Handle cancellations/refunds
- Pickup code generation

### Analytics
- Sales statistics
- Revenue tracking
- Top products
- Customer insights
- Performance trends

### Communication
- Customer chat
- Order notifications
- Telegram integration

### Subscription Plans
- Basic tier
- Pro tier
- Enterprise tier

## Key Files

### Pages
- `src/app/dashboard/` - Main dashboard (17 sub-pages)
  - `/analytics` - Sales analytics
  - `/products` - Product management
  - `/orders` - Order processing
  - `/delivery` - Delivery tracking
  - `/marketing` - Promotional tools
  - `/settings` - Store settings
  - `/chat` - Customer messaging
  - `/verification` - Seller verification
  - `/subscription` - Plan management

### Components
- `src/components/DashboardStats.tsx` - Analytics widgets
- `src/components/SellerVerificationForm.tsx` - Onboarding
- `src/components/ProductForm.tsx` - Product editing

### API Routes
- `src/app/api/seller/` - Seller registration
- `src/app/api/stores/` - Store operations

## Seller Verification Flow

1. Seller registers account
2. Completes verification form
   - Business name
   - Business type
   - Tax ID (optional)
   - Location
   - Contact details
3. Admin reviews application
4. Status: `pending` -> `verified` or `rejected`
5. Verified sellers can list products

## Product Creation

```typescript
interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string;
  price: number;
  sale_price?: number;
  category: string;
  subcategory: string;
  images: string[];
  variants: ProductVariant[];
  inventory: number;
  status: 'active' | 'draft' | 'out_of_stock';
}

interface ProductVariant {
  id: string;
  name: string;
  options: string[];
  price_modifier?: number;
}
```

## Order Processing Flow

```
1. New order received -> status: 'pending'
2. Seller confirms -> status: 'confirmed'
3. Preparing order -> status: 'processing'
4. Ready for delivery -> status: 'shipped'
5. Delivered -> status: 'delivered'
```

## Analytics Queries

### Daily Sales
```typescript
const { data } = await supabase
  .from('orders')
  .select('total, created_at')
  .eq('store_id', storeId)
  .gte('created_at', startOfDay)
  .lte('created_at', endOfDay);
```

### Top Products
```typescript
const { data } = await supabase
  .from('order_items')
  .select('product_id, quantity, products(name)')
  .eq('store_id', storeId)
  .order('quantity', { ascending: false })
  .limit(10);
```

## Subscription Tiers

| Feature | Basic | Pro | Enterprise |
|---------|-------|-----|------------|
| Products | 50 | 500 | Unlimited |
| Analytics | Basic | Advanced | Full |
| Support | Email | Priority | Dedicated |
| Commission | 10% | 7% | 5% |
| Marketing | - | Basic | Advanced |

## Telegram Integration

Sellers can link Telegram for:
- Order notifications
- Low stock alerts
- Customer messages
- Daily sales summaries
