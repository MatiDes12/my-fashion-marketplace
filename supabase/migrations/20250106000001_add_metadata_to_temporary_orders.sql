-- Add metadata column to temporary_orders table for shared cart functionality
ALTER TABLE public.temporary_orders 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS idx_temporary_orders_metadata ON public.temporary_orders USING GIN (metadata);

-- Add comment to explain the metadata column
COMMENT ON COLUMN public.temporary_orders.metadata IS 'JSON metadata for storing additional order information like shared cart details';
