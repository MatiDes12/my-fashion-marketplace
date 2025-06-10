-- Delete duplicate orders keeping only the earliest one
DELETE FROM orders 
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY tx_ref ORDER BY created_at ASC) as rn
        FROM orders
    ) t
    WHERE t.rn > 1
);

-- Add unique constraint on tx_ref
ALTER TABLE orders ADD CONSTRAINT unique_tx_ref UNIQUE (tx_ref);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_tx_ref ON orders IS 'Ensures each transaction reference (tx_ref) can only have one order'; 