-- Drop the existing constraint
ALTER TABLE public.users 
DROP CONSTRAINT users_verification_status_check;

-- Add the new constraint with 'needs_reconsideration'
ALTER TABLE public.users 
ADD CONSTRAINT users_verification_status_check 
CHECK (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'needs_reconsideration'::text]));

-- Drop the existing constraint for seller_verification table if it exists
ALTER TABLE public.seller_verification 
DROP CONSTRAINT IF EXISTS seller_verification_status_check;

-- Add the new constraint to seller_verification table
ALTER TABLE public.seller_verification 
ADD CONSTRAINT seller_verification_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'needs_reconsideration'::text])); 