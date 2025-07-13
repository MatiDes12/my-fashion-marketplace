-- Fix cart_items table to allow multiple items of the same product with different variants

-- Drop the existing unique constraints if they exist (this will work even if constraints don't exist)
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS unique_user_product;
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_user_product_variant_unique;

-- Create a new unique constraint that handles both variant and non-variant products
-- For products without variants: unique on (user_id, product_id) where all variant fields are null
-- For products with variants: unique on (user_id, product_id, selected_size, selected_color, selected_variant_sku)
CREATE UNIQUE INDEX cart_items_user_product_unique ON cart_items (user_id, product_id) 
WHERE selected_size IS NULL AND selected_color IS NULL AND selected_variant_sku IS NULL;

CREATE UNIQUE INDEX cart_items_user_product_variant_unique ON cart_items (user_id, product_id, selected_size, selected_color, selected_variant_sku) 
WHERE selected_size IS NOT NULL OR selected_color IS NOT NULL OR selected_variant_sku IS NOT NULL; 