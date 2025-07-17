-- Create delivery accounts table
CREATE TABLE delivery_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_person_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create delivery tracking table
CREATE TABLE delivery_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    delivery_account_id UUID NOT NULL REFERENCES delivery_accounts(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivery_notes TEXT,
    proof_images TEXT[], -- Array of image URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_delivery_accounts_seller_id ON delivery_accounts(seller_id);
CREATE INDEX idx_delivery_accounts_is_active ON delivery_accounts(is_active);
CREATE INDEX idx_delivery_tracking_order_id ON delivery_tracking(order_id);
CREATE INDEX idx_delivery_tracking_delivery_account_id ON delivery_tracking(delivery_account_id);
CREATE INDEX idx_delivery_tracking_status ON delivery_tracking(status);

-- Add RLS policies
ALTER TABLE delivery_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Policies for delivery_accounts
CREATE POLICY "Sellers can view their own delivery accounts" ON delivery_accounts
    FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own delivery accounts" ON delivery_accounts
    FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own delivery accounts" ON delivery_accounts
    FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own delivery accounts" ON delivery_accounts
    FOR DELETE USING (seller_id = auth.uid());

-- Policies for delivery_tracking
CREATE POLICY "Sellers can view delivery tracking for their orders" ON delivery_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o 
            JOIN products p ON o.product_id = p.id
            WHERE o.id = delivery_tracking.order_id 
            AND p.owner_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can insert delivery tracking" ON delivery_tracking
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o 
            JOIN products p ON o.product_id = p.id
            WHERE o.id = delivery_tracking.order_id 
            AND p.owner_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can update delivery tracking" ON delivery_tracking
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders o 
            JOIN products p ON o.product_id = p.id
            WHERE o.id = delivery_tracking.order_id 
            AND p.owner_id = auth.uid()
        )
    );

-- Delivery persons can view their assigned deliveries
CREATE POLICY "Delivery persons can view their assigned deliveries" ON delivery_tracking
    FOR SELECT USING (delivery_account_id IN (
        SELECT id FROM delivery_accounts WHERE phone_number = (
            SELECT phone FROM users WHERE id = auth.uid()
        )
    ));

-- Delivery persons can update their assigned deliveries
CREATE POLICY "Delivery persons can update their assigned deliveries" ON delivery_tracking
    FOR UPDATE USING (delivery_account_id IN (
        SELECT id FROM delivery_accounts WHERE phone_number = (
            SELECT phone FROM users WHERE id = auth.uid()
        )
    ));

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_delivery_accounts_updated_at
    BEFORE UPDATE ON delivery_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_tracking_updated_at
    BEFORE UPDATE ON delivery_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 