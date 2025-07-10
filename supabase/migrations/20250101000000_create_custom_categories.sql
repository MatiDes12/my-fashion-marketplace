-- Create custom_categories table
CREATE TABLE IF NOT EXISTS custom_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Add RLS policies
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read custom categories
CREATE POLICY "Allow authenticated users to read custom categories" ON custom_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert custom categories
CREATE POLICY "Allow authenticated users to insert custom categories" ON custom_categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own custom categories
CREATE POLICY "Allow users to update their own custom categories" ON custom_categories
  FOR UPDATE USING (auth.uid() = created_by);

-- Allow users to delete their own custom categories
CREATE POLICY "Allow users to delete their own custom categories" ON custom_categories
  FOR DELETE USING (auth.uid() = created_by);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_custom_categories_name ON custom_categories(name);
CREATE INDEX IF NOT EXISTS idx_custom_categories_created_by ON custom_categories(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_categories_active ON custom_categories(is_active);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_custom_categories_updated_at 
    BEFORE UPDATE ON custom_categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 