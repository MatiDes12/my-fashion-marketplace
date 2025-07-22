-- Create chat rooms table
CREATE TABLE chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('admin_seller', 'customer_seller')),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_type, seller_id, admin_id, customer_id)
);

-- Create chat messages table
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('admin', 'seller', 'customer')),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user chat status table
CREATE TABLE user_chat_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status_message VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add indexes for better performance
CREATE INDEX idx_chat_rooms_seller_id ON chat_rooms(seller_id);
CREATE INDEX idx_chat_rooms_admin_id ON chat_rooms(admin_id);
CREATE INDEX idx_chat_rooms_customer_id ON chat_rooms(customer_id);
CREATE INDEX idx_chat_rooms_room_type ON chat_rooms(room_type);
CREATE INDEX idx_chat_rooms_last_message_at ON chat_rooms(last_message_at);
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_user_chat_status_user_id ON user_chat_status(user_id);
CREATE INDEX idx_user_chat_status_is_online ON user_chat_status(is_online);

-- Add RLS policies
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chat_status ENABLE ROW LEVEL SECURITY;

-- Policies for chat_rooms
CREATE POLICY "Users can view chat rooms they are part of" ON chat_rooms
    FOR SELECT USING (
        seller_id = auth.uid() OR 
        admin_id = auth.uid() OR 
        customer_id = auth.uid()
    );

CREATE POLICY "Sellers can create chat rooms" ON chat_rooms
    FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Admins can create chat rooms" ON chat_rooms
    FOR INSERT WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Users can update chat rooms they are part of" ON chat_rooms
    FOR UPDATE USING (
        seller_id = auth.uid() OR 
        admin_id = auth.uid() OR 
        customer_id = auth.uid()
    );

-- Policies for chat_messages
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

-- Policies for user_chat_status
CREATE POLICY "Users can view all chat statuses" ON user_chat_status
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own chat status" ON user_chat_status
    FOR ALL USING (user_id = auth.uid());

-- Add trigger to update updated_at
CREATE TRIGGER update_chat_rooms_updated_at
    BEFORE UPDATE ON chat_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_chat_status_updated_at
    BEFORE UPDATE ON user_chat_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_message_at when a message is inserted
CREATE OR REPLACE FUNCTION update_chat_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_rooms 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_room_last_message_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_room_last_message(); 