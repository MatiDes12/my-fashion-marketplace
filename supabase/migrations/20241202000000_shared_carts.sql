-- Create shared_carts table
CREATE TABLE IF NOT EXISTS public.shared_carts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    share_code TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_email TEXT,
    recipient_name TEXT,
    message TEXT,
    cart_data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_email TEXT,
    used_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT shared_carts_pkey PRIMARY KEY (id)
);

-- Create index for share_code
CREATE INDEX IF NOT EXISTS idx_shared_carts_share_code ON public.shared_carts(share_code);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_shared_carts_user_id ON public.shared_carts(user_id);

-- Create index for expires_at
CREATE INDEX IF NOT EXISTS idx_shared_carts_expires_at ON public.shared_carts(expires_at);

-- Add updated_at trigger
CREATE TRIGGER update_shared_carts_updated_at
    BEFORE UPDATE ON public.shared_carts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.shared_carts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own shared carts
CREATE POLICY "Users can view their own shared carts" ON public.shared_carts
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create shared carts
CREATE POLICY "Users can create shared carts" ON public.shared_carts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own shared carts
CREATE POLICY "Users can update their own shared carts" ON public.shared_carts
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Anyone can view shared carts by share_code (for public access)
CREATE POLICY "Anyone can view shared carts by share_code" ON public.shared_carts
    FOR SELECT USING (share_code IS NOT NULL);

-- Function to generate unique share codes
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        -- Generate a 12-character alphanumeric code
        code := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM public.shared_carts WHERE share_code = code) THEN
            RETURN code;
        END IF;
        
        counter := counter + 1;
        IF counter > 100 THEN
            RAISE EXCEPTION 'Unable to generate unique share code after 100 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired shared carts
CREATE OR REPLACE FUNCTION cleanup_expired_shared_carts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.shared_carts 
    WHERE expires_at < NOW() AND is_used = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to cleanup expired shared carts daily
SELECT cron.schedule(
    'cleanup-expired-shared-carts',
    '0 2 * * *', -- Run at 2 AM daily
    'SELECT cleanup_expired_shared_carts();'
);
