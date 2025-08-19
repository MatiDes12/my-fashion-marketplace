-- Add columns to cart_items table for shared cart functionality
ALTER TABLE public.cart_items 
ADD COLUMN IF NOT EXISTS purchased_by TEXT,
ADD COLUMN IF NOT EXISTS purchased_by_name TEXT,
ADD COLUMN IF NOT EXISTS shared_cart_id UUID REFERENCES public.shared_carts(id) ON DELETE SET NULL;

-- Create index for shared cart tracking
CREATE INDEX IF NOT EXISTS idx_cart_items_shared_cart_id ON public.cart_items(shared_cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_purchased_by ON public.cart_items(purchased_by);
