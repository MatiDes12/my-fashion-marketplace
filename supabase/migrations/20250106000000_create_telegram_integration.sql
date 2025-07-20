-- Create Telegram settings table for admin configuration
CREATE TABLE admin_telegram_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bot_token VARCHAR(255) NOT NULL,
    webhook_url VARCHAR(500),
    admin_chat_id VARCHAR(100) NOT NULL,
    support_chat_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Telegram users table to link user accounts with Telegram chat IDs
CREATE TABLE telegram_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id VARCHAR(100) NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chat_id)
);

-- Create Telegram notification logs table
CREATE TABLE telegram_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    chat_id VARCHAR(100) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_telegram_users_user_id ON telegram_users(user_id);
CREATE INDEX idx_telegram_users_chat_id ON telegram_users(chat_id);
CREATE INDEX idx_telegram_users_is_active ON telegram_users(is_active);
CREATE INDEX idx_telegram_notifications_user_id ON telegram_notifications(user_id);
CREATE INDEX idx_telegram_notifications_chat_id ON telegram_notifications(chat_id);
CREATE INDEX idx_telegram_notifications_sent_at ON telegram_notifications(sent_at);
CREATE INDEX idx_telegram_notifications_type ON telegram_notifications(notification_type);

-- Add RLS policies
ALTER TABLE admin_telegram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for admin_telegram_settings (admin only)
CREATE POLICY "Only admins can manage telegram settings" ON admin_telegram_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policies for telegram_users
CREATE POLICY "Users can view their own telegram links" ON telegram_users
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own telegram links" ON telegram_users
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own telegram links" ON telegram_users
    FOR UPDATE USING (user_id = auth.uid());

-- Policies for telegram_notifications
CREATE POLICY "Users can view their own notifications" ON telegram_notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all notifications" ON telegram_notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Insert default admin telegram settings (you'll need to update these with your actual bot token)
INSERT INTO admin_telegram_settings (
    bot_token,
    admin_chat_id,
    support_chat_id,
    is_active
) VALUES (
    'your_bot_token_here',
    'your_admin_chat_id_here',
    'your_support_chat_id_here',
    true
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_admin_telegram_settings_updated_at 
    BEFORE UPDATE ON admin_telegram_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_users_updated_at 
    BEFORE UPDATE ON telegram_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 