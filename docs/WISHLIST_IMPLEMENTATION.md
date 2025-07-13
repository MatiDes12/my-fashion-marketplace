# Wishlist Implementation

## Overview

This document describes the implementation of a wishlist system that separates "likes" from "wishlist" functionality. Users can now like products (showing appreciation) and add them to their wishlist (saving for later) independently.

## Database Changes

### New Table: `wishlist`

```sql
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);
```

### Migration File
- `supabase/migrations/20250102000000_create_wishlist_table.sql`

## Key Features

### 1. Wishlist Popup
When a user clicks the heart button on a product that's not in their wishlist, a popup appears asking:
- "Yes, add to wishlist" - Adds to both wishlist and likes tables
- "No, just like it" - Adds only to likes table
- "Cancel" - Does nothing

### 2. Separate Functionality
- **Likes**: Show appreciation and track favorites
- **Wishlist**: Save for later viewing and easy access

### 3. Smart Behavior
- If a product is already in the wishlist, liking it only adds to the likes table
- Unliking only removes from the likes table, not the wishlist
- Removing from wishlist only removes from wishlist table

## Components

### WishlistPopup Component
- Location: `src/components/WishlistPopup.tsx`
- Features:
  - Modal popup with three options
  - Handles both wishlist and likes operations
  - Updates navigation wishlist count
  - Error handling and loading states

### Updated Components

#### Products Page (`src/app/products/page.tsx`)
- Integrated wishlist popup
- Updated like functionality to check wishlist status
- Maintains backward compatibility

#### Product Detail Page (`src/app/products/[id]/page.tsx`)
- Integrated wishlist popup
- Updated like functionality
- Enhanced user experience

#### ProductCard Component (`src/components/ProductCard.tsx`)
- Integrated wishlist popup
- Updated like functionality
- Maintains existing UI/UX

#### Wishlist Page (`src/app/wishlist/page.tsx`)
- Now uses `wishlist` table instead of `likes` table
- Properly handles wishlist-only items
- Maintains existing functionality

#### Navigation Component (`src/components/Navigation.tsx`)
- Updated to fetch wishlist count from `wishlist` table
- Maintains real-time updates

## Utility Functions

### Wishlist Utilities (`src/utils/wishlist.ts`)
- `checkWishlistStatus()` - Check if product is in user's wishlist
- `addToWishlist()` - Add product to wishlist
- `removeFromWishlist()` - Remove product from wishlist

## User Flow

### Scenario 1: New Product Like
1. User clicks heart button
2. System checks if product is in wishlist
3. If not in wishlist, shows popup
4. User chooses:
   - "Yes" → Added to both wishlist and likes
   - "No" → Added only to likes
   - "Cancel" → No action

### Scenario 2: Product Already in Wishlist
1. User clicks heart button
2. System finds product in wishlist
3. Directly adds to likes (no popup)
4. Shows success message

### Scenario 3: Unlike Product
1. User clicks heart button (already liked)
2. System removes from likes table only
3. Wishlist status unchanged

### Scenario 4: Remove from Wishlist
1. User goes to wishlist page
2. Clicks remove button
3. System removes from wishlist table only
4. Like status unchanged

## Database Migration

To apply the database changes:

1. **If using Supabase locally:**
   ```bash
   npx supabase db push
   ```

2. **If using Supabase cloud:**
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Run the migration SQL manually

3. **Manual SQL execution:**
   ```sql
   -- Create wishlist table
   CREATE TABLE IF NOT EXISTS wishlist (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(user_id, product_id)
   );

   -- Create index for better performance
   CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
   CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);

   -- Enable Row Level Security
   ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

   -- Create RLS policies
   CREATE POLICY "Users can view their own wishlist items" ON wishlist
     FOR SELECT USING (auth.uid() = user_id);

   CREATE POLICY "Users can insert their own wishlist items" ON wishlist
     FOR INSERT WITH CHECK (auth.uid() = user_id);

   CREATE POLICY "Users can delete their own wishlist items" ON wishlist
     FOR DELETE USING (auth.uid() = user_id);

   -- Grant permissions
   GRANT ALL ON wishlist TO authenticated;
   ```

## Testing

### Test Cases
1. **New user likes a product** → Should show popup
2. **User adds to wishlist** → Should appear in wishlist page
3. **User just likes** → Should not appear in wishlist page
4. **User unlikes** → Should remain in wishlist if added there
5. **User removes from wishlist** → Should remain liked if previously liked
6. **Product already in wishlist** → Should not show popup when liking

### Manual Testing Steps
1. Create a new account or use existing account
2. Go to products page
3. Click heart button on a product
4. Verify popup appears
5. Test all three options
6. Check wishlist page
7. Test unlike functionality
8. Test wishlist removal

## Benefits

1. **Better User Experience**: Clear distinction between liking and wishlisting
2. **Flexible System**: Users can like without wishlisting and vice versa
3. **Data Integrity**: Separate tables prevent conflicts
4. **Scalability**: Easy to extend with additional features
5. **Backward Compatibility**: Existing likes functionality preserved

## Future Enhancements

1. **Wishlist Sharing**: Allow users to share wishlists
2. **Wishlist Analytics**: Track popular wishlist items
3. **Wishlist Notifications**: Notify when wishlist items go on sale
4. **Wishlist Categories**: Organize wishlist items by category
5. **Bulk Operations**: Add/remove multiple items at once 