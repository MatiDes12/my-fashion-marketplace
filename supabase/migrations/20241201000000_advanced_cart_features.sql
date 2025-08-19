-- Advanced Cart Features Migration
-- This migration adds support for save for later, gift wrapping, split payments, and gift purchases

-- 1. Add new columns to cart_items table
ALTER TABLE public.cart_items 
ADD COLUMN saved_for_later BOOLEAN DEFAULT FALSE,
ADD COLUMN gift_wrapping BOOLEAN DEFAULT FALSE,
ADD COLUMN gift_message TEXT,
ADD COLUMN gift_wrapping_fee NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN split_payment_id UUID,
ADD COLUMN gift_purchase_id UUID,
ADD COLUMN gift_purchaser_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN gift_purchaser_email TEXT,
ADD COLUMN gift_purchaser_name TEXT,
ADD COLUMN gift_purchase_link TEXT,
ADD COLUMN gift_purchase_expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Create save for later table
CREATE TABLE public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  selected_size TEXT,
  selected_color TEXT,
  selected_variant_sku TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination of user, product, and variant
  CONSTRAINT saved_items_user_product_unique UNIQUE (user_id, product_id, selected_size, selected_color, selected_variant_sku)
);

-- 3. Create split payment groups table
CREATE TABLE public.split_payment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ETB',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- 4. Create split payment participants table
CREATE TABLE public.split_payment_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_payment_id UUID NOT NULL REFERENCES public.split_payment_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique participant per split payment
  CONSTRAINT split_payment_participants_unique UNIQUE (split_payment_id, email)
);

-- 5. Create gift purchase table
CREATE TABLE public.gift_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  purchaser_email TEXT NOT NULL,
  purchaser_name TEXT NOT NULL,
  recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  selected_size TEXT,
  selected_color TEXT,
  selected_variant_sku TEXT,
  gift_wrapping BOOLEAN DEFAULT FALSE,
  gift_message TEXT,
  gift_wrapping_fee NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ETB',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'purchased', 'delivered', 'cancelled', 'expired')),
  payment_method TEXT,
  payment_reference TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  link_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create gift wrapping options table
CREATE TABLE public.gift_wrapping_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ETB',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Insert default gift wrapping options
INSERT INTO public.gift_wrapping_options (name, description, price) VALUES
('Standard Gift Wrap', 'Elegant paper wrapping with ribbon', 50.00),
('Premium Gift Wrap', 'Luxury wrapping with decorative elements', 100.00),
('Birthday Gift Wrap', 'Colorful birthday-themed wrapping', 75.00),
('Wedding Gift Wrap', 'Elegant wedding-themed wrapping', 120.00),
('Holiday Gift Wrap', 'Festive holiday-themed wrapping', 80.00);

-- 8. Create indexes for better performance
CREATE INDEX idx_cart_items_saved_for_later ON public.cart_items(saved_for_later) WHERE saved_for_later = TRUE;
CREATE INDEX idx_cart_items_gift_purchase_id ON public.cart_items(gift_purchase_id);
CREATE INDEX idx_cart_items_split_payment_id ON public.cart_items(split_payment_id);
CREATE INDEX idx_saved_items_user_id ON public.saved_items(user_id);
CREATE INDEX idx_split_payment_groups_created_by ON public.split_payment_groups(created_by);
CREATE INDEX idx_split_payment_participants_split_payment_id ON public.split_payment_participants(split_payment_id);
CREATE INDEX idx_gift_purchases_link_code ON public.gift_purchases(link_code);
CREATE INDEX idx_gift_purchases_purchaser_id ON public.gift_purchases(purchaser_id);
CREATE INDEX idx_gift_purchases_recipient_id ON public.gift_purchases(recipient_id);
CREATE INDEX idx_gift_purchases_status ON public.gift_purchases(status);

-- 9. Add triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saved_items_updated_at 
    BEFORE UPDATE ON public.saved_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_payment_groups_updated_at 
    BEFORE UPDATE ON public.split_payment_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_payment_participants_updated_at 
    BEFORE UPDATE ON public.split_payment_participants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gift_purchases_updated_at 
    BEFORE UPDATE ON public.gift_purchases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gift_wrapping_options_updated_at 
    BEFORE UPDATE ON public.gift_wrapping_options 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Add RLS policies
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_payment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_payment_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_wrapping_options ENABLE ROW LEVEL SECURITY;

-- Saved items policies
CREATE POLICY "Users can view their own saved items" ON public.saved_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved items" ON public.saved_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved items" ON public.saved_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved items" ON public.saved_items
    FOR DELETE USING (auth.uid() = user_id);

-- Split payment groups policies
CREATE POLICY "Users can view split payments they created or participate in" ON public.split_payment_groups
    FOR SELECT USING (
        auth.uid() = created_by OR 
        EXISTS (
            SELECT 1 FROM public.split_payment_participants 
            WHERE split_payment_id = id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create split payments" ON public.split_payment_groups
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update split payments they created" ON public.split_payment_groups
    FOR UPDATE USING (auth.uid() = created_by);

-- Split payment participants policies
CREATE POLICY "Users can view participants of their split payments" ON public.split_payment_participants
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.split_payment_groups 
            WHERE id = split_payment_id AND created_by = auth.uid()
        )
    );

CREATE POLICY "Users can join split payments" ON public.split_payment_participants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own participation" ON public.split_payment_participants
    FOR UPDATE USING (user_id = auth.uid());

-- Gift purchases policies
CREATE POLICY "Users can view gift purchases they created or are recipients of" ON public.gift_purchases
    FOR SELECT USING (
        purchaser_id = auth.uid() OR 
        recipient_id = auth.uid() OR
        purchaser_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "Users can create gift purchases" ON public.gift_purchases
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update gift purchases they created" ON public.gift_purchases
    FOR UPDATE USING (purchaser_id = auth.uid());

-- Gift wrapping options policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view gift wrapping options" ON public.gift_wrapping_options
    FOR SELECT USING (auth.role() = 'authenticated');

-- 11. Create functions for gift purchase link generation
CREATE OR REPLACE FUNCTION generate_gift_purchase_link()
RETURNS TEXT AS $$
DECLARE
    link_code TEXT;
BEGIN
    -- Generate a unique 12-character alphanumeric code
    link_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.gift_purchases WHERE link_code = link_code) LOOP
        link_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
    END LOOP;
    
    RETURN link_code;
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to clean up expired gift purchases
CREATE OR REPLACE FUNCTION cleanup_expired_gift_purchases()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.gift_purchases 
    SET status = 'expired' 
    WHERE status = 'pending' AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 13. Create a cron job to clean up expired gift purchases (runs daily)
SELECT cron.schedule(
    'cleanup-expired-gift-purchases',
    '0 2 * * *', -- Daily at 2 AM
    'SELECT cleanup_expired_gift_purchases();'
);
