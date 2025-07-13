-- Add pickup code and verification fields to orders table
ALTER TABLE orders 
ADD COLUMN pickup_code VARCHAR(8),
ADD COLUMN pickup_code_verified BOOLEAN DEFAULT false,
ADD COLUMN pickup_code_verified_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster pickup code lookups
CREATE INDEX idx_orders_pickup_code ON orders(pickup_code) WHERE pickup_code IS NOT NULL;

-- Add trigger to update pickup_code_verified_at when pickup_code_verified is set to true
CREATE OR REPLACE FUNCTION update_pickup_code_verified_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pickup_code_verified = true AND OLD.pickup_code_verified = false THEN
        NEW.pickup_code_verified_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_pickup_code_verified_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_pickup_code_verified_at();

-- Add comment explaining the pickup code system
COMMENT ON COLUMN orders.pickup_code IS 'Unique code generated for store pickup orders that customers must show to verify their identity';
COMMENT ON COLUMN orders.pickup_code_verified IS 'Whether the pickup code has been verified by the seller';
COMMENT ON COLUMN orders.pickup_code_verified_at IS 'Timestamp when the pickup code was verified'; 