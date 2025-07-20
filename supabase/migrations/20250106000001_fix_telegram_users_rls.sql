-- Fix RLS policies for telegram_users table
-- Enable RLS
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON public.telegram_users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.telegram_users;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.telegram_users;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.telegram_users;

-- Create policies for telegram_users table
CREATE POLICY "Enable read access for all users" ON public.telegram_users
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.telegram_users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users based on user_id" ON public.telegram_users
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for users based on user_id" ON public.telegram_users
    FOR DELETE USING (auth.uid() = user_id);

-- Also create a policy for service role access (for API calls)
CREATE POLICY "Enable service role access" ON public.telegram_users
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT ALL ON public.telegram_users TO service_role;
GRANT ALL ON public.telegram_users TO authenticated;
GRANT SELECT ON public.telegram_users TO anon; 