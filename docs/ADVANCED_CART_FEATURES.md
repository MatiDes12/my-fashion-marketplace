# Advanced Cart Features

This document outlines the advanced cart features that have been implemented to enhance the shopping experience.

## 🎯 Features Overview

### 1. Save for Later
- **Description**: Users can save items for later purchase without removing them from their cart
- **Implementation**: Items are marked with `saved_for_later` flag in the database
- **UI**: Toggle button on each cart item to save/unsave
- **Benefits**: 
  - Keep items for future purchase
  - Organize shopping priorities
  - Reduce cart abandonment

### 2. Share Cart
- **Description**: Users can share their cart with friends via email or link
- **Implementation**: Generates unique share codes and URLs
- **UI**: Share button in cart header with modal for recipient details
- **Benefits**:
  - Collaborative shopping
  - Gift suggestions
  - Social shopping experience

### 3. Gift Wrapping
- **Description**: Add gift wrapping to any cart item with custom messages
- **Implementation**: Multiple wrapping options with different prices
- **UI**: Gift wrap button on each item with modal for options
- **Benefits**:
  - Enhanced gift-giving experience
  - Additional revenue stream
  - Professional presentation

### 4. Gift Purchase Links
- **Description**: Create shareable links for others to purchase items as gifts
- **Implementation**: Unique link codes with expiration dates
- **UI**: "Gift This Item" button on product pages
- **Benefits**:
  - International gift purchases
  - No account required for purchasers
  - Automatic order tracking for original requester

## 🗄️ Database Schema

### New Tables

#### `saved_items`
```sql
CREATE TABLE public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  selected_size TEXT,
  selected_color TEXT,
  selected_variant_sku TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT saved_items_user_product_unique UNIQUE (user_id, product_id, selected_size, selected_color, selected_variant_sku)
);
```

#### `gift_wrapping_options`
```sql
CREATE TABLE public.gift_wrapping_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ETB',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `gift_purchases`
```sql
CREATE TABLE public.gift_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  purchaser_email TEXT NOT NULL,
  purchaser_name TEXT NOT NULL,
  recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  selected_size TEXT,
  selected_color TEXT,
  selected_variant_sku TEXT,
  gift_wrapping BOOLEAN DEFAULT FALSE,
  gift_message TEXT,
  gift_wrapping_fee NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ETB',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'purchased', 'delivered', 'cancelled', 'expired')),
  payment_method TEXT,
  payment_reference TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  link_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Updated Tables

#### `cart_items` (New Columns)
```sql
ALTER TABLE public.cart_items 
ADD COLUMN saved_for_later BOOLEAN DEFAULT FALSE,
ADD COLUMN gift_wrapping BOOLEAN DEFAULT FALSE,
ADD COLUMN gift_message TEXT,
ADD COLUMN gift_wrapping_fee NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN split_payment_id UUID,
ADD COLUMN gift_purchase_id UUID,
ADD COLUMN gift_purchaser_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN gift_purchaser_email TEXT,
ADD COLUMN gift_purchaser_name TEXT,
ADD COLUMN gift_purchase_link TEXT,
ADD COLUMN gift_purchase_expires_at TIMESTAMP WITH TIME ZONE;
```

## 🔧 API Endpoints

### Save for Later
- **POST** `/api/cart/save-for-later` - Save item for later
- **DELETE** `/api/cart/save-for-later` - Move item back to cart

### Share Cart
- **POST** `/api/cart/share` - Share cart with recipient

### Gift Wrapping
- **GET** `/api/cart/gift-wrapping` - Get wrapping options
- **POST** `/api/cart/gift-wrapping` - Update gift wrapping

### Gift Purchase
- **POST** `/api/gift-purchase/create` - Create gift purchase link
- **GET** `/api/gift-purchase/[linkCode]` - Get gift purchase details
- **POST** `/api/gift-purchase/[linkCode]` - Complete gift purchase

## 🎨 UI Components

### SaveForLaterButton
- Toggle button for saving/unsaving items
- Visual feedback with loading states
- Integrates with cart state management

### ShareCartButton
- Modal for entering recipient details
- Option to send email or copy link
- Shows cart item count

### GiftWrappingModal
- Multiple wrapping style options
- Custom gift message input
- Price calculation and summary

### GiftPurchaseButton
- Product page integration
- Comprehensive gift configuration
- Link generation and sharing

## 💰 Pricing & Fees

### Gift Wrapping Options
1. **Standard Gift Wrap** - ETB 50.00
2. **Premium Gift Wrap** - ETB 100.00
3. **Birthday Gift Wrap** - ETB 75.00
4. **Wedding Gift Wrap** - ETB 120.00
5. **Holiday Gift Wrap** - ETB 80.00

### Fee Calculation
- Gift wrapping fees are added to individual items
- Fees are included in cart totals
- Fees are passed through to orders

## 🔄 Workflows

### Save for Later Workflow
1. User clicks "Save for Later" on cart item
2. Item is marked as saved in database
3. Item moves to saved section in cart
4. User can toggle back to active cart

### Share Cart Workflow
1. User clicks "Share Cart" button
2. Modal opens for recipient details
3. System generates unique share code
4. Link is created and shared via email or copied

### Gift Wrapping Workflow
1. User clicks "Gift Wrap" on cart item
2. Modal opens with wrapping options
3. User selects style and adds message
4. Fee is calculated and added to item
5. Changes are saved to database

### Gift Purchase Workflow
1. User clicks "Gift This Item" on product page
2. Modal opens for gift configuration
3. User sets recipient, wrapping, and message
4. System generates unique purchase link
5. Link is shared with intended purchaser
6. Purchaser completes purchase via link
7. Order is created and linked to original requester

## 🛡️ Security & Privacy

### Row Level Security (RLS)
- All new tables have RLS enabled
- Users can only access their own data
- Gift purchases have appropriate access controls

### Data Protection
- Gift messages are stored securely
- Personal information is protected
- Expired links are automatically cleaned up

### Rate Limiting
- API endpoints include rate limiting
- Prevents abuse of gift purchase links
- Protects against spam

## 🧹 Maintenance

### Automatic Cleanup
- Expired gift purchase links are marked as expired
- Daily cron job runs cleanup function
- Reduces database bloat

### Monitoring
- Track gift purchase success rates
- Monitor wrapping option popularity
- Analyze save for later usage

## 🚀 Future Enhancements

### Planned Features
1. **Split Payments** - Allow multiple people to contribute to a purchase
2. **Wishlist Integration** - Connect saved items with wishlists
3. **Social Sharing** - Integrate with social media platforms
4. **Gift Cards** - Digital gift card system
5. **Subscription Gifts** - Recurring gift purchases

### Analytics
- Gift purchase conversion rates
- Most popular wrapping styles
- Cart sharing effectiveness
- Save for later to purchase conversion

## 📝 Usage Examples

### Creating a Gift Purchase Link
```typescript
// User creates gift purchase link
const giftPurchase = await fetch('/api/gift-purchase/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'product-123',
    quantity: 1,
    giftWrapping: true,
    giftMessage: 'Happy Birthday!',
    recipientName: 'John Doe',
    expiresInDays: 30
  })
});
```

### Sharing Cart
```typescript
// User shares cart with friend
const shareResult = await fetch('/api/cart/share', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipientEmail: 'friend@example.com',
    message: 'Check out my shopping cart!'
  })
});
```

### Adding Gift Wrapping
```typescript
// User adds gift wrapping to cart item
const wrappingResult = await fetch('/api/cart/gift-wrapping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cartItemId: 'cart-item-123',
    giftWrapping: true,
    giftMessage: 'Happy Birthday!',
    wrappingOptionId: 'wrapping-option-1'
  })
});
```

## 🔗 Related Files

- `supabase/migrations/20241201000000_advanced_cart_features.sql`
- `src/components/SaveForLaterButton.tsx`
- `src/components/ShareCartButton.tsx`
- `src/components/GiftWrappingModal.tsx`
- `src/components/GiftPurchaseButton.tsx`
- `src/app/gift-purchase/[linkCode]/page.tsx`
- `src/app/api/cart/save-for-later/route.ts`
- `src/app/api/cart/share/route.ts`
- `src/app/api/cart/gift-wrapping/route.ts`
- `src/app/api/gift-purchase/create/route.ts`
- `src/app/api/gift-purchase/[linkCode]/route.ts`
