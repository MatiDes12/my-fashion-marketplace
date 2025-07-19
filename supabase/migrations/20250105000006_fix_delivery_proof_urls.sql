-- Fix existing delivery proof URLs that have duplicate path segments
UPDATE delivery_tracking 
SET proof_images = array(
  SELECT 
    CASE 
      WHEN url LIKE '%/delivery-proofs/delivery-proofs/%' 
      THEN REPLACE(url, '/delivery-proofs/delivery-proofs/', '/delivery-proofs/')
      ELSE url 
    END
  FROM unnest(proof_images) AS url
)
WHERE proof_images IS NOT NULL 
AND array_length(proof_images, 1) > 0;

-- Also fix any URLs in delivery_statuses table
UPDATE delivery_statuses 
SET proof_image = REPLACE(proof_image, '/delivery-proofs/delivery-proofs/', '/delivery-proofs/')
WHERE proof_image LIKE '%/delivery-proofs/delivery-proofs/%'; 