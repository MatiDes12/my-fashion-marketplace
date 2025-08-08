-- Clean up any existing stale online statuses
UPDATE user_chat_status 
SET is_online = false, 
    status_message = 'Offline',
    last_seen = NOW(),
    updated_at = NOW()
WHERE is_online = true 
  AND last_seen < NOW() - INTERVAL '1 hour';

-- Create a function to automatically set users offline after inactivity
CREATE OR REPLACE FUNCTION set_inactive_users_offline()
RETURNS void AS $$
BEGIN
  UPDATE user_chat_status 
  SET is_online = false, 
      status_message = 'Offline',
      last_seen = NOW(),
      updated_at = NOW()
  WHERE is_online = true 
    AND last_seen < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run this function every 5 minutes
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('set-inactive-users-offline', '*/5 * * * *', 'SELECT set_inactive_users_offline();');

-- Alternative: Create a trigger to update last_seen on user activity
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_seen when user sends a message
  UPDATE user_chat_status 
  SET last_seen = NOW(),
      updated_at = NOW()
  WHERE user_id = NEW.sender_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on chat_messages table
DROP TRIGGER IF EXISTS update_user_last_seen_trigger ON chat_messages;
CREATE TRIGGER update_user_last_seen_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_seen();

-- Add RLS policies for user_chat_status if not exists
ALTER TABLE user_chat_status ENABLE ROW LEVEL SECURITY;

-- Allow users to read all statuses
DROP POLICY IF EXISTS "Users can view all statuses" ON user_chat_status;
CREATE POLICY "Users can view all statuses" ON user_chat_status
  FOR SELECT USING (true);

-- Allow users to update their own status
DROP POLICY IF EXISTS "Users can update own status" ON user_chat_status;
CREATE POLICY "Users can update own status" ON user_chat_status
  FOR ALL USING (auth.uid() = user_id);

-- Allow users to insert their own status
DROP POLICY IF EXISTS "Users can insert own status" ON user_chat_status;
CREATE POLICY "Users can insert own status" ON user_chat_status
  FOR INSERT WITH CHECK (auth.uid() = user_id); 