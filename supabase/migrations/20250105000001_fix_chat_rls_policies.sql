-- Drop existing RLS policies for user_chat_status
DROP POLICY IF EXISTS "Users can view all chat statuses" ON user_chat_status;
DROP POLICY IF EXISTS "Users can manage their own chat status" ON user_chat_status;

-- Create new policies that allow server operations
-- Allow all users to view chat statuses (for online/offline indicators)
CREATE POLICY "Users can view all chat statuses" ON user_chat_status
    FOR SELECT USING (true);

-- Allow authenticated users to manage their own chat status
CREATE POLICY "Users can manage their own chat status" ON user_chat_status
    FOR ALL USING (user_id = auth.uid());

-- Allow server to manage all chat statuses (for socket server operations)
CREATE POLICY "Server can manage all chat statuses" ON user_chat_status
    FOR ALL USING (true);

-- Also fix the chat_rooms and chat_messages policies to be more permissive for server operations
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view chat rooms they are part of" ON chat_rooms;
DROP POLICY IF EXISTS "Sellers can create chat rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Admins can create chat rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Users can update chat rooms they are part of" ON chat_rooms;

DROP POLICY IF EXISTS "Users can view messages in their chat rooms" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their chat rooms" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;

-- Create new policies for chat_rooms
CREATE POLICY "Users can view chat rooms they are part of" ON chat_rooms
    FOR SELECT USING (
        seller_id = auth.uid() OR 
        admin_id = auth.uid() OR 
        customer_id = auth.uid()
    );

CREATE POLICY "Users can create chat rooms" ON chat_rooms
    FOR INSERT WITH CHECK (
        seller_id = auth.uid() OR 
        admin_id = auth.uid()
    );

CREATE POLICY "Users can update chat rooms they are part of" ON chat_rooms
    FOR UPDATE USING (
        seller_id = auth.uid() OR 
        admin_id = auth.uid() OR 
        customer_id = auth.uid()
    );

-- Create new policies for chat_messages
CREATE POLICY "Users can view messages in their chat rooms" ON chat_messages
    FOR SELECT USING (
        room_id IN (
            SELECT id FROM chat_rooms 
            WHERE seller_id = auth.uid() OR 
                  admin_id = auth.uid() OR 
                  customer_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their chat rooms" ON chat_messages
    FOR INSERT WITH CHECK (
        room_id IN (
            SELECT id FROM chat_rooms 
            WHERE seller_id = auth.uid() OR 
                  admin_id = auth.uid() OR 
                  customer_id = auth.uid()
        ) AND sender_id = auth.uid()
    );

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (sender_id = auth.uid());

-- Allow server to manage all chat data (for socket server operations)
CREATE POLICY "Server can manage all chat rooms" ON chat_rooms
    FOR ALL USING (true);

CREATE POLICY "Server can manage all chat messages" ON chat_messages
    FOR ALL USING (true); 