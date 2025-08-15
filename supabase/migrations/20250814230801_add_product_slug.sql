-- Add slug column to products table
ALTER TABLE public.products ADD COLUMN slug TEXT;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS products_slug_idx ON public.products USING btree (slug);

-- Create unique constraint for slugs (allowing nulls)
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique_idx ON public.products (slug) WHERE slug IS NOT NULL;

-- Function to generate product slug from title
CREATE OR REPLACE FUNCTION generate_product_slug(product_title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(
      regexp_replace(product_title, '[^a-zA-Z0-9\s-]', '', 'g'), -- Remove special chars
      '\s+', '-', 'g'                                             -- Replace spaces with hyphens
    ),
    '-+', '-', 'g'                                                 -- Replace multiple hyphens with single
  ));
END;
$$ LANGUAGE plpgsql;

-- Function to ensure unique slug
CREATE OR REPLACE FUNCTION ensure_unique_product_slug(base_slug TEXT, product_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  final_slug TEXT;
  counter INTEGER := 1;
  temp_slug TEXT;
BEGIN
  final_slug := base_slug;
  
  -- Check if slug exists (excluding current product if updating)
  WHILE EXISTS (
    SELECT 1 FROM products 
    WHERE slug = final_slug 
    AND (product_id IS NULL OR id != product_id)
  ) LOOP
    temp_slug := base_slug || '-' || counter;
    final_slug := temp_slug;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate slug on insert/update
CREATE OR REPLACE FUNCTION auto_generate_product_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate slug if title has changed or slug is null
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.title != NEW.title OR NEW.slug IS NULL)) THEN
    IF NEW.title IS NOT NULL AND NEW.title != '' THEN
      NEW.slug := ensure_unique_product_slug(
        generate_product_slug(NEW.title),
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto slug generation
DROP TRIGGER IF EXISTS trigger_auto_generate_product_slug ON products;
CREATE TRIGGER trigger_auto_generate_product_slug
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_product_slug();
