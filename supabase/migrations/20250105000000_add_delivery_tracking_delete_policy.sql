-- Add DELETE policy for delivery_tracking
-- This allows sellers to delete delivery tracking records (for removing assignments)

CREATE POLICY "Sellers can delete delivery tracking" ON delivery_tracking
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM orders o 
            JOIN products p ON o.product_id = p.id
            WHERE o.id = delivery_tracking.order_id 
            AND p.owner_id = auth.uid()
        )
    ); 