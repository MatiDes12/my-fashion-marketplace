-- Add Stripe settings to payment_settings table
-- This migration adds Stripe configuration to existing payment settings

-- Check if the stripe_settings column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_settings' 
        AND column_name = 'stripe_settings'
    ) THEN
        ALTER TABLE payment_settings 
        ADD COLUMN stripe_settings JSONB DEFAULT '{
            "is_active": false,
            "account_id": "",
            "email": ""
        }'::jsonb;
    END IF;
END $$;

-- Update existing records to include default Stripe settings
UPDATE payment_settings 
SET stripe_settings = '{
    "is_active": false,
    "account_id": "",
    "email": ""
}'::jsonb
WHERE stripe_settings IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN payment_settings.stripe_settings IS 'Stripe payment configuration including account ID and email for international payments';

-- Update RLS policies to include stripe_settings if needed
-- (The existing policies should already cover the new column since they use wildcard permissions)
