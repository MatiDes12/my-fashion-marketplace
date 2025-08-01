-- Add bot_username column to admin_telegram_settings table
ALTER TABLE admin_telegram_settings 
ADD COLUMN bot_username VARCHAR(100);

-- Update existing records with default bot username
UPDATE admin_telegram_settings 
SET bot_username = 'Avrioxshop_bot' 
WHERE bot_username IS NULL;

-- Make bot_username NOT NULL after setting default values
ALTER TABLE admin_telegram_settings 
ALTER COLUMN bot_username SET NOT NULL; 