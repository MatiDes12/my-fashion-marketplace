-- Create delivery access tokens table
CREATE TABLE IF NOT EXISTS delivery_access_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_account_id UUID NOT NULL REFERENCES delivery_accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_delivery_access_tokens_token ON delivery_access_tokens(access_token);
CREATE INDEX IF NOT EXISTS idx_delivery_access_tokens_account ON delivery_access_tokens(delivery_account_id);

-- Add RLS policies
ALTER TABLE delivery_access_tokens ENABLE ROW LEVEL SECURITY;

-- Policy for sellers to manage their delivery access tokens
CREATE POLICY "Sellers can manage their delivery access tokens" ON delivery_access_tokens
  FOR ALL USING (
    delivery_account_id IN (
      SELECT id FROM delivery_accounts WHERE seller_id = auth.uid()
    )
  );

-- Policy for delivery persons to view their own tokens (for validation)
CREATE POLICY "Delivery persons can view their own tokens" ON delivery_access_tokens
  FOR SELECT USING (
    delivery_account_id IN (
      SELECT id FROM delivery_accounts WHERE phone_number = (
        SELECT phone_number FROM delivery_accounts WHERE id = delivery_account_id
      )
    )
  );

-- Function to generate unique access token
CREATE OR REPLACE FUNCTION generate_delivery_access_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 12-character alphanumeric token
    token := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM delivery_access_tokens WHERE access_token = token) INTO exists;
    
    -- If token doesn't exist, return it
    IF NOT exists THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql; 