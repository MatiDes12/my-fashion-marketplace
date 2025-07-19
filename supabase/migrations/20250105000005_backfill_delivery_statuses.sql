-- Backfill delivery_statuses table with existing delivery_tracking data
INSERT INTO delivery_statuses (
  order_id,
  delivery_account_id,
  status,
  notes,
  delivery_person_name,
  delivery_person_phone,
  created_at
)
SELECT 
  dt.order_id,
  dt.delivery_account_id,
  CASE 
    WHEN dt.status = 'assigned' THEN 'confirmed'
    WHEN dt.status = 'picked_up' THEN 'in_transit'
    WHEN dt.status = 'in_transit' THEN 'in_transit'
    WHEN dt.status = 'out_for_delivery' THEN 'in_transit'
    WHEN dt.status = 'delivered' THEN 'delivered'
    WHEN dt.status = 'failed' THEN 'cancelled'
    ELSE 'confirmed'
  END as status,
  CASE 
    WHEN dt.status = 'assigned' THEN 'Delivery assigned to ' || da.delivery_person_name
    WHEN dt.status = 'picked_up' THEN 'Order picked up by ' || da.delivery_person_name
    WHEN dt.status = 'in_transit' THEN 'Order in transit with ' || da.delivery_person_name
    WHEN dt.status = 'out_for_delivery' THEN 'Order in transit with ' || da.delivery_person_name
    WHEN dt.status = 'delivered' THEN 'Order delivered by ' || da.delivery_person_name
    WHEN dt.status = 'failed' THEN 'Delivery failed'
    ELSE 'Delivery status updated'
  END as notes,
  da.delivery_person_name,
  da.phone_number,
  COALESCE(dt.assigned_at, dt.created_at) as created_at
FROM delivery_tracking dt
JOIN delivery_accounts da ON dt.delivery_account_id = da.id
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_statuses ds 
  WHERE ds.order_id = dt.order_id 
  AND ds.delivery_account_id = dt.delivery_account_id
  AND ds.status = CASE 
    WHEN dt.status = 'assigned' THEN 'confirmed'
    WHEN dt.status = 'picked_up' THEN 'in_transit'
    WHEN dt.status = 'in_transit' THEN 'in_transit'
    WHEN dt.status = 'delivered' THEN 'delivered'
    WHEN dt.status = 'failed' THEN 'cancelled'
    ELSE 'confirmed'
  END
);

-- Also update order statuses based on delivery status
UPDATE orders 
SET order_status = CASE 
  WHEN dt.status = 'assigned' THEN 'confirmed'
  WHEN dt.status = 'picked_up' THEN 'shipped'
  WHEN dt.status = 'in_transit' THEN 'shipped'
  WHEN dt.status = 'out_for_delivery' THEN 'shipped'
  WHEN dt.status = 'delivered' THEN 'delivered'
  WHEN dt.status = 'failed' THEN 'cancelled'
  ELSE order_status
END
FROM delivery_tracking dt
WHERE orders.id = dt.order_id
AND orders.order_status IN ('pending', 'confirmed')
AND dt.status IN ('assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'); 