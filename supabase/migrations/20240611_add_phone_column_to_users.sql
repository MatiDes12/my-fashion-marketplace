ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON public.users (phone) WHERE phone IS NOT NULL; 