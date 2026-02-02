# E-commerce Agent

A specialized agent for e-commerce features in the AVRIO marketplace.

## Core Features

### Shopping Cart
- Add/remove items
- Update quantities
- Shared carts for group shopping
- Cart persistence

### Checkout Flow
- Address collection
- Delivery options
- Payment selection
- Order confirmation
- Gift wrapping options

### Orders
- Order creation
- Status tracking
- Order history
- Cancellation/refunds
- Pickup codes

### Products
- Product catalog
- Search and filtering
- Categories and subcategories
- Product variants (size, color)
- Reviews and ratings
- Wishlist/save for later

### Flash Sales
- Time-limited promotions
- Automatic pricing
- Inventory management
- Customer notifications

## Key Files

### Pages
- `src/app/cart/` - Shopping cart
- `src/app/checkout/` - Checkout flow
- `src/app/orders/` - Order management
- `src/app/products/` - Product catalog
- `src/app/flash-sales/` - Promotions

### Components
- `src/components/ProductCard.tsx` - Product display
- `src/components/CartItem.tsx` - Cart item
- `src/components/ShareCartButton.tsx` - Shared cart
- `src/components/GiftPurchaseButton.tsx` - Gift options
- `src/components/FlashDealsSection.tsx` - Flash sales

### API Routes
- `src/app/api/cart/` - Cart operations
- `src/app/api/orders/` - Order management
- `src/app/api/gift-purchase/` - Gift features

### Utilities
- `src/utils/flashSales.ts` - Flash sale helpers
- `src/utils/pickupCode.ts` - Pickup code generation
- `src/types/cart.ts` - Cart type definitions

## Product Categories

1. **Fashion & Clothing**
   - Traditional Ethiopian (Habesha Kemis, Netela)
   - Modern fashion
   - Footwear

2. **Home & Living**
   - Furniture
   - Home decor
   - Kitchen items

3. **Electronics & Technology**
   - Phones & accessories
   - Computers
   - Appliances

4. **Food & Beverages**
   - Coffee (Ethiopian specialty)
   - Traditional foods
   - Spices

5. **Health & Beauty**
   - Cosmetics
   - Personal care
   - Traditional remedies

6. **Art & Culture**
   - Ethiopian art
   - Handicrafts
   - Traditional items

## Cart Operations

```typescript
// Add to cart
await supabase.from('cart').insert({
  user_id,
  product_id,
  quantity,
  variant_id
});

// Update quantity
await supabase.from('cart')
  .update({ quantity })
  .eq('id', cartItemId);

// Get cart with product details
const { data } = await supabase
  .from('cart')
  .select('*, products(*)')
  .eq('user_id', userId);
```

## Order Status Flow

```
pending -> confirmed -> processing -> shipped -> delivered
                    \-> cancelled
```
