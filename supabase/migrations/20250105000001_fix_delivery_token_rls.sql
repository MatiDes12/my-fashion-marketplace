-- Drop existing RLS policies for delivery_access_tokens
DROP POLICY IF EXISTS "Sellers can manage their delivery access tokens" ON delivery_access_tokens;
DROP POLICY IF EXISTS "Delivery persons can view their own tokens" ON delivery_access_tokens;

-- Create new RLS policies that allow service role access
CREATE POLICY "Allow service role full access" ON delivery_access_tokens
  FOR ALL USING (true);

-- Also allow authenticated users to manage their own delivery tokens
CREATE POLICY "Sellers can manage their delivery access tokens" ON delivery_access_tokens
  FOR ALL USING (
    delivery_account_id IN (
      SELECT id FROM delivery_accounts WHERE seller_id = auth.uid()
    )
  ); 