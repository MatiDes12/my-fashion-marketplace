-- Create delivery-proofs bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
UPDATE storage.buckets
SET public = false
WHERE name = 'delivery-proofs';

-- Create policies for delivery-proofs bucket
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-proofs');

CREATE POLICY "Allow authenticated users to upload delivery proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'delivery-proofs' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

CREATE POLICY "Allow service role full access"
ON storage.objects FOR ALL USING (
  bucket_id = 'delivery-proofs'
); 