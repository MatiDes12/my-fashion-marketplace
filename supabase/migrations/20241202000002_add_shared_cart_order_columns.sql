-- Add columns to orders table for shared cart functionality
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS purchased_by TEXT,
ADD COLUMN IF NOT EXISTS purchased_by_name TEXT,
ADD COLUMN IF NOT EXISTS shared_cart_id UUID REFERENCES public.shared_carts(id) ON DELETE SET NULL;

-- Create index for shared cart tracking in orders
CREATE INDEX IF NOT EXISTS idx_orders_shared_cart_id ON public.orders(shared_cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_purchased_by ON public.orders(purchased_by);
