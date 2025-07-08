-- Add phone_verified column to users table to track phone verification status
ALTER TABLE public.users ADD COLUMN phone_verified boolean NOT NULL DEFAULT false; 