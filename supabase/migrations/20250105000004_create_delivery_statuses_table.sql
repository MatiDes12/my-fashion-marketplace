-- Create delivery_statuses table for tracking delivery progress
CREATE TABLE IF NOT EXISTS delivery_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_account_id UUID REFERENCES delivery_accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered')),
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  notes TEXT,
  delivery_person_name TEXT,
  delivery_person_phone TEXT,
  proof_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_delivery_statuses_order_id ON delivery_statuses(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_statuses_delivery_account_id ON delivery_statuses(delivery_account_id);
CREATE INDEX IF NOT EXISTS idx_delivery_statuses_status ON delivery_statuses(status);
CREATE INDEX IF NOT EXISTS idx_delivery_statuses_created_at ON delivery_statuses(created_at);

-- Add RLS policies
ALTER TABLE delivery_statuses ENABLE ROW LEVEL SECURITY;

-- Policy for sellers to view delivery statuses for their orders
CREATE POLICY "Sellers can view delivery statuses for their orders" ON delivery_statuses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = delivery_statuses.order_id
      AND p.owner_id = auth.uid()
    )
  );

-- Policy for customers to view delivery statuses for their orders
CREATE POLICY "Customers can view delivery statuses for their orders" ON delivery_statuses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = delivery_statuses.order_id
      AND o.user_id = auth.uid()
    )
  );

-- Policy for delivery persons to update delivery statuses
CREATE POLICY "Delivery persons can update delivery statuses" ON delivery_statuses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM delivery_access_tokens dat
      JOIN delivery_accounts da ON dat.delivery_account_id = da.id
      JOIN delivery_tracking dt ON dt.delivery_account_id = da.id
      WHERE dt.order_id = delivery_statuses.order_id
      AND dat.access_token = current_setting('request.headers')::json->>'authorization'
      AND dat.expires_at > NOW()
      AND NOT dat.is_used
    )
  );

-- Policy for delivery persons to insert delivery statuses
CREATE POLICY "Delivery persons can insert delivery statuses" ON delivery_statuses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM delivery_access_tokens dat
      JOIN delivery_accounts da ON dat.delivery_account_id = da.id
      JOIN delivery_tracking dt ON dt.delivery_account_id = da.id
      WHERE dt.order_id = delivery_statuses.order_id
      AND dat.access_token = current_setting('request.headers')::json->>'authorization'
      AND dat.expires_at > NOW()
      AND NOT dat.is_used
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_delivery_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_delivery_statuses_updated_at
  BEFORE UPDATE ON delivery_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_statuses_updated_at(); 