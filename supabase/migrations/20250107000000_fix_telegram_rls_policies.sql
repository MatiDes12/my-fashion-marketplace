-- Fix RLS policies for telegram_users table
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own telegram links" ON telegram_users;
DROP POLICY IF EXISTS "Users can insert their own telegram links" ON telegram_users;
DROP POLICY IF EXISTS "Users can update their own telegram links" ON telegram_users;

-- Recreate policies with proper authentication checks
CREATE POLICY "Users can view their own telegram links" ON telegram_users
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Users can insert their own telegram links" ON telegram_users
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Users can update their own telegram links" ON telegram_users
    FOR UPDATE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Add policy for deleting own telegram links
CREATE POLICY "Users can delete their own telegram links" ON telegram_users
    FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Ensure RLS is enabled
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY; 