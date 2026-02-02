

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_to_cart"("p_user_id" "uuid", "p_product_id" "uuid", "p_quantity" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check if product exists and is active
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Product not found or inactive');
  END IF;

  -- Insert or update cart item
  INSERT INTO cart_items (user_id, product_id, quantity)
  VALUES (p_user_id, p_product_id, p_quantity)
  ON CONFLICT (user_id, product_id) 
  DO UPDATE SET 
    quantity = cart_items.quantity + p_quantity,
    updated_at = now()
  RETURNING jsonb_build_object('id', id, 'quantity', quantity) INTO v_result;
  
  RETURN jsonb_build_object('success', true, 'data', v_result);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."add_to_cart"("p_user_id" "uuid", "p_product_id" "uuid", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_to_queue"("conv_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_position INTEGER;
BEGIN
    SELECT COALESCE(MAX(position), 0) + 1 INTO next_position
    FROM chat_queue;
    
    INSERT INTO chat_queue (conversation_id, position, priority, channel_type)
    SELECT 
        conv_id,
        next_position,
        c.priority,
        c.channel_type
    FROM conversations c
    WHERE c.id = conv_id;
    
    UPDATE conversations
    SET queue_position = next_position
    WHERE id = conv_id;
END;
$$;


ALTER FUNCTION "public"."add_to_queue"("conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_assign_conversation"("conv_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    assignee_id UUID;
    conv_channel_type TEXT;
BEGIN
    -- Get conversation channel type
    SELECT channel_type INTO conv_channel_type
    FROM conversations
    WHERE id = conv_id;
    
    -- Find available agent based on channel type
    IF conv_channel_type = 'customer_admin' THEN
        SELECT ca.user_id INTO assignee_id
        FROM chat_availability ca
        JOIN public.users u ON ca.user_id = u.id
        WHERE ca.is_online = true
        AND ca.availability_status = 'available'
        AND ca.current_conversations < ca.max_conversations
        AND (u.role = 'admin' OR u.is_admin = true)
        ORDER BY ca.current_conversations ASC, ca.last_activity ASC
        LIMIT 1;
    ELSIF conv_channel_type = 'customer_seller' THEN
        SELECT ca.user_id INTO assignee_id
        FROM chat_availability ca
        JOIN public.users u ON ca.user_id = u.id
        WHERE ca.is_online = true
        AND ca.availability_status = 'available'
        AND ca.current_conversations < ca.max_conversations
        AND u.role = 'seller'
        ORDER BY ca.current_conversations ASC, ca.last_activity ASC
        LIMIT 1;
    END IF;
    
    -- Assign if found
    IF assignee_id IS NOT NULL THEN
        INSERT INTO chat_assignments (conversation_id, assignee_id, assignee_type, auto_assigned)
        VALUES (
            conv_id,
            assignee_id,
            CASE WHEN conv_channel_type = 'customer_admin' THEN 'admin' ELSE 'seller' END,
            true
        );
        
        UPDATE conversations
        SET 
            assigned_admin_id = CASE WHEN conv_channel_type = 'customer_admin' THEN assignee_id ELSE NULL END,
            assigned_seller_id = CASE WHEN conv_channel_type = 'customer_seller' THEN assignee_id ELSE NULL END,
            auto_assigned = true
        WHERE id = conv_id;
        
        -- Update agent's conversation count
        UPDATE chat_availability
        SET current_conversations = current_conversations + 1
        WHERE user_id = assignee_id;
    END IF;
    
    RETURN assignee_id;
END;
$$;


ALTER FUNCTION "public"."auto_assign_conversation"("conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_generate_product_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    base_slug text;
BEGIN
    -- Only generate slug if it's empty or NULL, or if title changed
    IF NEW.slug IS NULL OR NEW.slug = '' OR (TG_OP = 'UPDATE' AND OLD.title != NEW.title AND NEW.slug = OLD.slug) THEN
        base_slug := generate_product_slug(NEW.title);
        NEW.slug := ensure_unique_product_slug(base_slug, NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_generate_product_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_user_storage_usage"("user_id" "uuid") RETURNS TABLE("total_size_mb" double precision, "total_images" bigint, "image_details" "json"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH image_info AS (
    SELECT 
      pi.image_url,
      p.title as product_title,
      -- Estimate size based on URL length as placeholder
      -- You might want to implement actual size calculation here
      COALESCE(LENGTH(pi.image_url) / 1024.0, 0) as size_mb
    FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    WHERE p.owner_id = user_id
  )
  SELECT 
    COALESCE(SUM(size_mb), 0)::DOUBLE PRECISION as total_size_mb,
    COUNT(*)::BIGINT as total_images,
    ARRAY_AGG(
      json_build_object(
        'url', image_url,
        'product', product_title,
        'estimated_size', ROUND(size_mb::numeric, 2) || ' MB'
      )
    ) as image_details
  FROM image_info;
END;
$$;


ALTER FUNCTION "public"."calculate_user_storage_usage"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_wait_time"("conv_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    queue_pos INTEGER;
    avg_response_time INTEGER;
    wait_time INTEGER;
BEGIN
    SELECT position INTO queue_pos
    FROM chat_queue
    WHERE conversation_id = conv_id;
    
    IF queue_pos IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate average response time (in minutes)
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (cm.created_at - c.created_at)) / 60), 5) INTO avg_response_time
    FROM conversations c
    JOIN chat_messages cm ON c.id = cm.conversation_id
    WHERE c.channel_type = (SELECT channel_type FROM conversations WHERE id = conv_id)
    AND c.created_at > NOW() - INTERVAL '24 hours';
    
    wait_time := queue_pos * avg_response_time;
    
    UPDATE conversations
    SET estimated_wait_time = wait_time
    WHERE id = conv_id;
    
    RETURN wait_time;
END;
$$;


ALTER FUNCTION "public"."calculate_wait_time"("conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_transaction_amounts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    expected_total NUMERIC(10, 2);
BEGIN
    -- Calculate expected total EXCLUDING service_fee (since it's deducted from seller, not added to customer)
    expected_total := COALESCE(NEW.subtotal, 0)
                   + COALESCE(NEW.platform_fee, 0)
                   + COALESCE(NEW.vat_amount, 0)
                   + COALESCE(NEW.delivery_fee, 0)
                   + COALESCE(NEW.gift_wrapping_fee, 0);

    -- Check if total_amount matches the sum of all components (excluding service_fee)
    IF ABS(COALESCE(NEW.total_amount, 0) - expected_total) > 0.01 THEN
        RAISE EXCEPTION USING MESSAGE = format(
            'Total amount (%s) does not match sum of components (%s)',
            to_char(COALESCE(NEW.total_amount, 0), 'FM999999990.00'),
            to_char(expected_total, 'FM999999990.00')
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_transaction_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_gift_purchases"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.gift_purchases 
    SET status = 'expired' 
    WHERE status = 'pending' AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_gift_purchases"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_shared_carts"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.shared_carts 
    WHERE expires_at < NOW() AND is_used = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_shared_carts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_temporary_orders"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.temporary_orders
  WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_temporary_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_sessions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM chat_sessions 
    WHERE last_activity < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_platform_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Calculate amounts
  INSERT INTO transactions (
    order_id,
    payment_method,
    payment_status,
    subtotal,
    vat_amount,
    platform_fee,
    service_fee,
    delivery_fee,
    total_amount,
    seller_payout_amount,
    platform_revenue,
    seller_id
  )
  SELECT
    NEW.id,
    'telebirr',
    'completed',
    NEW.total_price,
    NEW.ethiopia_tax,
    NEW.platform_fee,
    NEW.service_fee,
    NEW.delivery_fee,
    (NEW.total_price + NEW.ethiopia_tax + NEW.platform_fee + NEW.service_fee + NEW.delivery_fee),
    (NEW.total_price - NEW.platform_fee - NEW.service_fee), -- Amount to pay seller
    (NEW.platform_fee + NEW.service_fee + NEW.ethiopia_tax), -- Amount for platform
    products.owner_id -- Get seller ID from products table
  FROM products
  WHERE products.id = NEW.product_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_platform_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_support_chat_room"("customer_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    room_id UUID;
BEGIN
    -- Create a new support chat room
    INSERT INTO chat_rooms (name, type, created_by, metadata)
    VALUES (
        'Support Chat - ' || customer_id::text,
        'support',
        customer_id,
        jsonb_build_object('customer_id', customer_id)
    )
    RETURNING id INTO room_id;
    
    -- Add customer as participant
    INSERT INTO chat_participants (room_id, user_id, role)
    VALUES (room_id, customer_id, 'customer');
    
    -- Add admin/support as participant (you can modify this logic)
    INSERT INTO chat_participants (room_id, user_id, role)
    SELECT room_id, user_id, 'support'
    FROM chat_permissions 
    WHERE permission_type = 'can_create_rooms' 
    AND is_active = true
    LIMIT 1;
    
    RETURN room_id;
END;
$$;


ALTER FUNCTION "public"."create_support_chat_room"("customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_full_name" "text", "user_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO users (id, email, full_name, role)
  VALUES (user_id, user_email, user_full_name, user_role);
END;
$$;


ALTER FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_full_name" "text", "user_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."distribute_payment"("p_order_id" "uuid", "p_seller_amount" numeric, "p_platform_fee" numeric, "p_service_fee" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Add to seller's balance
  update sellers
  set available_balance = available_balance + p_seller_amount
  where id = (select seller_id from orders where id = p_order_id);
  
  -- Add fees to admin's account
  update admin_accounts
  set 
    platform_fees = platform_fees + p_platform_fee,
    service_fees = service_fees + p_service_fee
  where id = '1'; -- Main admin account
end;
$$;


ALTER FUNCTION "public"."distribute_payment"("p_order_id" "uuid", "p_seller_amount" numeric, "p_platform_fee" numeric, "p_service_fee" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_unique_product_slug"("base_slug" "text", "product_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    final_slug text;
    counter integer := 1;
    temp_slug text;
BEGIN
    final_slug := base_slug;
    
    -- Check if slug already exists (excluding current product if updating)
    WHILE EXISTS (
        SELECT 1 FROM products 
        WHERE slug = final_slug 
        AND (product_id IS NULL OR id != product_id)
    ) LOOP
        temp_slug := base_slug || '-' || counter;
        final_slug := temp_slug;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."ensure_unique_product_slug"("base_slug" "text", "product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_delivery_access_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 12-character alphanumeric token
    token := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM delivery_access_tokens WHERE access_token = token) INTO exists;
    
    -- If token doesn't exist, return it
    IF NOT exists THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_delivery_access_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_gift_purchase_link"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_gift_purchase_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_product_slug"("title_text" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    trim(title_text),
                    '[^a-zA-Z0-9\s\-]', '', 'g'
                ),
                '\s+', '-', 'g'
            ),
            '\-+', '-', 'g'
        )
    );
END;
$$;


ALTER FUNCTION "public"."generate_product_slug"("title_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_share_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    code TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        -- Generate a 12-character alphanumeric code
        code := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM public.shared_carts WHERE share_code = code) THEN
            RETURN code;
        END IF;
        
        counter := counter + 1;
        IF counter > 100 THEN
            RAISE EXCEPTION 'Unable to generate unique share code after 100 attempts';
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_share_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_advanced_analytics"("input_data" "json") RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  p_user_id uuid;
  p_time_range text;
  start_date DATE;
  top_products_data json;
  category_data json;
  hourly_data json;
BEGIN
  -- Extract parameters from input JSON
  p_user_id := (input_data->>'user_id')::uuid;
  p_time_range := input_data->>'time_range';

  -- Calculate date range
  start_date := CASE
    WHEN p_time_range = '7days' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN p_time_range = '30days' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN p_time_range = '90days' THEN CURRENT_DATE - INTERVAL '90 days'
    WHEN p_time_range = 'year' THEN DATE_TRUNC('year', CURRENT_DATE)::DATE
    ELSE CURRENT_DATE - INTERVAL '30 days'
  END;

  -- Get top products
  SELECT json_agg(p)
  INTO top_products_data
  FROM (
    SELECT 
      p.id,
      p.title,
      COUNT(o.id) as total_sales,
      COALESCE(SUM(o.total_price), 0) as revenue,
      0 as views
    FROM products p
    LEFT JOIN orders o ON o.product_id = p.id
    WHERE p.owner_id = p_user_id
    GROUP BY p.id, p.title
    ORDER BY COUNT(o.id) DESC
    LIMIT 5
  ) p;

  -- Get category performance
  SELECT json_agg(cp)
  INTO category_data
  FROM (
    SELECT 
      COALESCE(p.category, 'Uncategorized') as category,
      COUNT(o.id) as sales,
      COALESCE(SUM(o.total_price), 0) as revenue
    FROM products p
    LEFT JOIN orders o ON o.product_id = p.id
    WHERE p.owner_id = p_user_id
    GROUP BY p.category
  ) cp;

  -- Return complete advanced analytics
  RETURN json_build_object(
    'customerRetention', 75,
    'averageOrderFrequency', 14,
    'topProducts', COALESCE(top_products_data, '[]'::json),
    'categoryPerformance', COALESCE(category_data, '[]'::json),
    'salesByHour', json_build_object(
      'labels', ARRAY['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
                      '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'],
      'data', ARRAY[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ),
    'customerSegments', json_build_object(
      'new', 0,
      'returning', 0,
      'inactive', 0
    ),
    'inventoryMetrics', json_build_object(
      'lowStock', (
        SELECT COUNT(*)
        FROM products p
        WHERE p.owner_id = p_user_id
        AND p.quantity <= 10
        AND p.quantity > 0
      ),
      'outOfStock', (
        SELECT COUNT(*)
        FROM products p
        WHERE p.owner_id = p_user_id
        AND p.quantity = 0
      ),
      'totalProducts', (
        SELECT COUNT(*)
        FROM products p
        WHERE p.owner_id = p_user_id
      ),
      'averageTurnover', 14
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_advanced_analytics"("input_data" "json") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_advanced_analytics"("p_user_id" "uuid", "time_range" "text") RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  start_date DATE;
BEGIN
  -- Calculate date range
  start_date := CASE
    WHEN time_range = '7days' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN time_range = '30days' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN time_range = '90days' THEN CURRENT_DATE - INTERVAL '90 days'
    WHEN time_range = 'year' THEN DATE_TRUNC('year', CURRENT_DATE)::DATE
    ELSE CURRENT_DATE - INTERVAL '30 days'
  END;

  RETURN json_build_object(
    'customerRetention', 75, -- Placeholder value
    'averageOrderFrequency', 14, -- Placeholder value
    'topProducts', (
      SELECT json_agg(row_to_json(p))
      FROM (
        SELECT 
          p.id,
          p.title,
          COUNT(o.id) as total_sales,
          COALESCE(SUM(o.total_price), 0) as revenue,
          0 as views -- Placeholder for views
        FROM products p
        LEFT JOIN orders o ON o.product_id = p.id
        WHERE p.owner_id = p_user_id
        AND (o.created_at >= start_date OR o.created_at IS NULL)
        GROUP BY p.id, p.title
        ORDER BY COUNT(o.id) DESC
        LIMIT 5
      ) p
    ),
    'categoryPerformance', (
      SELECT json_agg(row_to_json(cp))
      FROM (
        SELECT 
          COALESCE(p.category, 'Uncategorized') as category,
          COUNT(o.id) as sales,
          COALESCE(SUM(o.total_price), 0) as revenue
        FROM products p
        LEFT JOIN orders o ON o.product_id = p.id
        WHERE p.owner_id = p_user_id
        AND (o.created_at >= start_date OR o.created_at IS NULL)
        GROUP BY p.category
      ) cp
    ),
    'salesByHour', json_build_object(
      'labels', ARRAY['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
                      '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'],
      'data', ARRAY_AGG(COALESCE(h.hourly_sales, 0))
    ),
    'customerSegments', json_build_object(
      'new', (
        SELECT COUNT(DISTINCT o.user_id)
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.owner_id = p_user_id
        AND o.created_at >= start_date
      ),
      'returning', 0, -- Placeholder
      'inactive', 0  -- Placeholder
    ),
    'inventoryMetrics', json_build_object(
      'lowStock', (
        SELECT COUNT(*)
        FROM products p
        WHERE p.owner_id = p_user_id
        AND p.quantity <= 10
        AND p.quantity > 0
      ),
      'outOfStock', (
        SELECT COUNT(*)
        FROM products p
        WHERE p.owner_id = p_user_id
        AND p.quantity = 0
      ),
      'totalProducts', (
        SELECT COUNT(*)
        FROM products p
        WHERE p.owner_id = p_user_id
      ),
      'averageTurnover', 14 -- Placeholder value
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_advanced_analytics"("p_user_id" "uuid", "time_range" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_basic_analytics"("input_data" "json") RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  p_user_id uuid;
  p_time_range text;
  start_date DATE;
  orders_count bigint;
  total_rev numeric;
  avg_order numeric;
  order_stats json;
  revenue_data json;
BEGIN
  -- Extract parameters from input JSON
  p_user_id := (input_data->>'user_id')::uuid;
  p_time_range := input_data->>'time_range';

  -- Calculate date range
  start_date := CASE
    WHEN p_time_range = '7days' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN p_time_range = '30days' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN p_time_range = '90days' THEN CURRENT_DATE - INTERVAL '90 days'
    WHEN p_time_range = 'year' THEN DATE_TRUNC('year', CURRENT_DATE)::DATE
    ELSE CURRENT_DATE - INTERVAL '30 days'
  END;

  -- Get order statistics
  SELECT 
    COUNT(*),
    COALESCE(SUM(o.total_price), 0),
    COALESCE(AVG(o.total_price), 0)
  INTO
    orders_count,
    total_rev,
    avg_order
  FROM orders o
  JOIN products p ON o.product_id = p.id
  WHERE p.owner_id = p_user_id
  AND o.created_at >= start_date;

  -- Get order status counts
  SELECT json_build_object(
    'pending', COUNT(*) FILTER (WHERE o.order_status = 'pending'),
    'completed', COUNT(*) FILTER (WHERE o.order_status = 'completed'),
    'cancelled', COUNT(*) FILTER (WHERE o.order_status = 'cancelled')
  ) INTO order_stats
  FROM orders o
  JOIN products p ON o.product_id = p.id
  WHERE p.owner_id = p_user_id
  AND o.created_at >= start_date;

  -- Get revenue by month
  WITH monthly_revenue AS (
    SELECT 
      date_trunc('month', d)::date as month,
      COALESCE(SUM(o.total_price), 0) as revenue
    FROM generate_series(start_date, CURRENT_DATE, '1 month'::interval) d
    LEFT JOIN orders o ON date_trunc('month', o.created_at) = date_trunc('month', d)
    LEFT JOIN products p ON o.product_id = p.id AND p.owner_id = p_user_id
    GROUP BY date_trunc('month', d)
    ORDER BY month
  )
  SELECT json_build_object(
    'labels', ARRAY_AGG(TO_CHAR(month, 'Month')),
    'data', ARRAY_AGG(revenue)
  ) INTO revenue_data
  FROM monthly_revenue;

  -- Return complete analytics object
  RETURN json_build_object(
    'totalOrders', orders_count,
    'totalRevenue', total_rev,
    'averageOrderValue', avg_order,
    'subscriptionPlan', (
      SELECT subscription_plan
      FROM users
      WHERE id = p_user_id
    ),
    'ordersByStatus', order_stats,
    'revenueByMonth', revenue_data
  );
END;
$$;


ALTER FUNCTION "public"."get_basic_analytics"("input_data" "json") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_basic_analytics"("p_user_id" "uuid", "time_range" "text") RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  start_date DATE;
BEGIN
  -- Calculate date range
  start_date := CASE
    WHEN time_range = '7days' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN time_range = '30days' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN time_range = '90days' THEN CURRENT_DATE - INTERVAL '90 days'
    WHEN time_range = 'year' THEN DATE_TRUNC('year', CURRENT_DATE)::DATE
    ELSE CURRENT_DATE - INTERVAL '30 days'
  END;

  RETURN json_build_object(
    'totalOrders', (
      SELECT COUNT(*)
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.owner_id = p_user_id
      AND o.created_at >= start_date
    ),
    'totalRevenue', (
      SELECT COALESCE(SUM(o.total_price), 0)
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.owner_id = p_user_id
      AND o.created_at >= start_date
    ),
    'averageOrderValue', (
      SELECT COALESCE(AVG(o.total_price), 0)
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.owner_id = p_user_id
      AND o.created_at >= start_date
    ),
    'ordersByStatus', json_build_object(
      'pending', COUNT(*) FILTER (WHERE o.order_status = 'pending'),
      'completed', COUNT(*) FILTER (WHERE o.order_status = 'completed'),
      'cancelled', COUNT(*) FILTER (WHERE o.order_status = 'cancelled')
    ),
    'revenueByMonth', (
      SELECT json_build_object(
        'labels', ARRAY_AGG(TO_CHAR(date_trunc('month', d.month_date), 'Month')),
        'data', ARRAY_AGG(COALESCE(r.monthly_revenue, 0))
      )
      FROM (
        SELECT generate_series(
          date_trunc('month', start_date)::date,
          date_trunc('month', CURRENT_DATE)::date,
          '1 month'::interval
        ) AS month_date
      ) d
      LEFT JOIN (
        SELECT 
          date_trunc('month', o.created_at) as month,
          SUM(o.total_price) as monthly_revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.owner_id = p_user_id
        GROUP BY date_trunc('month', o.created_at)
      ) r ON date_trunc('month', d.month_date) = r.month
      GROUP BY d.month_date
      ORDER BY d.month_date
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_basic_analytics"("p_user_id" "uuid", "time_range" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cart_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_count
  FROM cart_items
  WHERE user_id = p_user_id;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."get_cart_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_featured_sellers"() RETURNS TABLE("seller_id" "uuid", "seller_name" "text", "store_settings" "jsonb", "top_product" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return query
  with ranked_products as (
    select 
      p.id as product_id,
      p.owner_id,
      p.title,
      p.price,
      p.created_at,
      count(distinct l.id) as like_count,
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'image_url', pi.image_url
          )
        )
        from product_images pi
        where pi.product_id = p.id
      ) as images,
      row_number() over (partition by p.owner_id order by count(distinct l.id) desc) as rn
    from products p
    left join likes l on l.product_id = p.id
    where p.is_active = true
    group by p.id
  )
  select 
    u.id as seller_id,
    u.full_name as seller_name,
    u.store_settings,
    case 
      when rp.product_id is not null then
        jsonb_build_object(
          'id', rp.product_id,
          'title', rp.title,
          'price', rp.price,
          'images', coalesce(rp.images, '[]'::jsonb),
          'like_count', rp.like_count
        )
      else null
    end as top_product
  from users u
  left join ranked_products rp on rp.owner_id = u.id and rp.rn = 1
  where u.role = 'owner'
  order by (u.store_settings->>'updated_at')::timestamptz desc nulls last
  limit 10;
end;
$$;


ALTER FUNCTION "public"."get_featured_sellers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_owner_orders"("owner_id_input" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "product_id" "uuid", "quantity" integer, "total_price" numeric, "order_status" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "user_full_name" "text", "user_email" "text", "product_title" "text", "product_price" numeric, "product_owner_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  order_count INTEGER;
BEGIN
  -- Debug logging
  RAISE NOTICE 'Fetching orders for owner_id: %', owner_id_input;
  
  -- Get count of matching products
  SELECT COUNT(*) INTO order_count
  FROM public.orders o
  JOIN public.products p ON o.product_id = p.id
  WHERE p.owner_id = owner_id_input;
  
  RAISE NOTICE 'Found % matching orders', order_count;

  RETURN QUERY
  WITH owner_products AS (
    SELECT id, owner_id, title, price
    FROM public.products
    WHERE owner_id = owner_id_input
  )
  SELECT 
    o.id,
    o.user_id,
    o.product_id,
    o.quantity,
    o.total_price,
    o.order_status,
    o.created_at,
    o.updated_at,
    u.full_name,
    u.email,
    p.title,
    p.price,
    p.owner_id
  FROM 
    public.orders o
    JOIN owner_products p ON o.product_id = p.id
    JOIN public.users u ON o.user_id = u.id
  ORDER BY 
    o.created_at DESC;

  -- Final debug count
  GET DIAGNOSTICS order_count = ROW_COUNT;
  RAISE NOTICE 'Returning % rows', order_count;
END;
$$;


ALTER FUNCTION "public"."get_owner_orders"("owner_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_stats"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_platform_fees', COALESCE(SUM(platform_fee), 0),
    'total_service_fees', COALESCE(SUM(service_fee), 0),
    'total_vat', COALESCE(SUM(vat_amount), 0),
    'total_revenue', COALESCE(SUM(platform_revenue), 0)
  )
  INTO result
  FROM transactions
  WHERE payment_status = 'completed';
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_platform_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_popular_products"() RETURNS TABLE("id" "uuid", "title" "text", "description" "text", "price" numeric, "category" "text", "owner_id" "uuid", "created_at" timestamp with time zone, "images" "jsonb", "like_count" bigint, "owner" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return query
  select 
    p.id,
    p.title,
    p.description,
    p.price,
    p.category,
    p.owner_id,
    p.created_at,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'image_url', pi.image_url,
          'is_model_picture', pi.is_model_picture
        )
      )
      from product_images pi
      where pi.product_id = p.id
    ) as images,
    count(distinct l.id) as like_count,
    jsonb_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'email', u.email,
      'store_settings', u.store_settings
    ) as owner
  from products p
  left join likes l on l.product_id = p.id
  left join users u on u.id = p.owner_id
  where p.is_active = true
  group by p.id, u.id
  order by count(distinct l.id) desc, p.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_popular_products"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_with_owner"("p_product_id" "uuid") RETURNS TABLE("id" "uuid", "title" "text", "description" "text", "price" numeric, "quantity" integer, "category" "text", "is_active" boolean, "created_at" timestamp with time zone, "owner_id" "uuid", "owner_full_name" "text", "owner_email" "text", "images" "jsonb", "like_count" bigint, "store_settings" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,                    -- Qualified with table alias
    p.title,
    p.description,
    p.price,
    p.quantity,
    p.category,
    p.is_active,
    p.created_at,
    p.owner_id,
    u.full_name as owner_full_name,
    u.email as owner_email,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'image_url', pi.image_url,
            'is_model_picture', pi.is_model_picture
          )
        )
        FROM product_images pi
        WHERE pi.product_id = p.id
      ),
      '[]'::jsonb
    ) as images,
    COALESCE(
      (SELECT COUNT(*) FROM likes l WHERE l.product_id = p.id),
      0
    )::BIGINT as like_count,
    u.store_settings
  FROM products p
  LEFT JOIN users u ON p.owner_id = u.id
  WHERE p.id = p_product_id;
END;
$$;


ALTER FUNCTION "public"."get_product_with_owner"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_products_with_owners"() RETURNS TABLE("id" "uuid", "title" "text", "description" "text", "price" numeric, "category" "text", "is_active" boolean, "created_at" timestamp with time zone, "owner_id" "uuid", "owner_full_name" "text", "owner_email" "text", "images" "jsonb", "like_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.description,
    p.price,
    p.category,
    p.is_active,
    p.created_at,
    p.owner_id,
    u.full_name as owner_full_name,
    u.email as owner_email,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'image_url', pi.image_url,
            'is_model_picture', pi.is_model_picture
          )
        )
        FROM product_images pi
        WHERE pi.product_id = p.id
      ),
      '[]'::jsonb
    ) as images,
    COUNT(l.id) as like_count
  FROM products p
  LEFT JOIN users u ON p.owner_id = u.id
  LEFT JOIN likes l ON p.id = l.product_id
  WHERE p.is_active = true
  GROUP BY p.id, u.full_name, u.email;
END;
$$;


ALTER FUNCTION "public"."get_products_with_owners"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_seller_storage_info"("seller_id" "uuid") RETURNS TABLE("total_images" bigint, "total_size_bytes" numeric, "total_size_mb" numeric, "total_size_gb" numeric, "storage_details" "json")
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY
    WITH storage_info AS (
        SELECT 
            p.title as product_title,
            pi.image_url,
            SPLIT_PART(pi.image_url, '/', -1) as filename,
            COALESCE(NULLIF(regexp_replace(
                pi.image_url, 
                '^.*?([0-9]+[KMG]?B).*$', 
                '\\1', 
                'i'
            ), pi.image_url), '0B') as file_size
        FROM products p
        JOIN product_images pi ON p.id = pi.product_id
        WHERE p.owner_id = seller_id
    ),
    size_in_bytes AS (
        SELECT 
            *,
            CASE 
                WHEN file_size ~ '^[0-9]+(K|M|G)?B$' THEN 
                    CASE 
                        WHEN file_size ~ '(?i)KB$' THEN (REPLACE(file_size, 'KB', '')::NUMERIC * 1024)
                        WHEN file_size ~ '(?i)MB$' THEN (REPLACE(file_size, 'MB', '')::NUMERIC * 1024 * 1024)
                        WHEN file_size ~ '(?i)GB$' THEN (REPLACE(file_size, 'GB', '')::NUMERIC * 1024 * 1024 * 1024)
                        WHEN file_size ~ '(?i)B$' THEN REPLACE(file_size, 'B', '')::NUMERIC
                        ELSE 0
                    END
                ELSE 0
            END as bytes
        FROM storage_info
    )
    SELECT 
        COUNT(*)::BIGINT as total_images,
        SUM(bytes)::NUMERIC as total_size_bytes,
        ROUND((SUM(bytes) / (1024*1024))::NUMERIC, 2) as total_size_mb,
        ROUND((SUM(bytes) / (1024*1024*1024))::NUMERIC, 2) as total_size_gb,
        COALESCE(json_agg(json_build_object(
            'product', product_title,
            'url', image_url,
            'filename', filename,
            'size', file_size,
            'size_mb', ROUND((bytes / (1024*1024))::NUMERIC, 2)
        )), '[]'::json) as storage_details
    FROM size_in_bytes;
END;
$_$;


ALTER FUNCTION "public"."get_seller_storage_info"("seller_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_message_count"("user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM chat_messages cm
        JOIN chat_participants cp ON cm.room_id = cp.room_id
        WHERE cp.user_id = get_unread_message_count.user_id
        AND cp.is_active = true
        AND cm.sender_id != get_unread_message_count.user_id
        AND cm.created_at > cp.last_read_at
    );
END;
$$;


ALTER FUNCTION "public"."get_unread_message_count"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    email,
    role,
    created_at
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_url"("url" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN url ~ '^https?://[^\s/$.?#].[^\s]*$';
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$_$;


ALTER FUNCTION "public"."is_valid_url"("url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_messages_read"("conv_id" "uuid", "user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE chat_messages
    SET 
        is_read = TRUE,
        read_at = NOW(),
        delivery_status = 'read'
    WHERE conversation_id = conv_id
    AND sender_id != user_id
    AND is_read = FALSE;

    UPDATE conversations
    SET unread_count = 0
    WHERE id = conv_id;
END;
$$;


ALTER FUNCTION "public"."mark_conversation_messages_read"("conv_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_messages_as_read"("room_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE chat_messages 
    SET is_read = true 
    WHERE chat_messages.room_id = mark_messages_as_read.room_id 
    AND sender_id != auth.uid();
    
    UPDATE chat_participants 
    SET last_read_at = NOW() 
    WHERE chat_participants.room_id = mark_messages_as_read.room_id 
    AND user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."mark_messages_as_read"("room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_admin_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND is_admin = true
  ) THEN
    PERFORM set_config('app.current_user_is_admin', 'true', false);
  ELSE
    PERFORM set_config('app.current_user_is_admin', 'false', false);
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."set_admin_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_inactive_users_offline"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE user_chat_status 
  SET is_online = false, 
      status_message = 'Offline',
      last_seen = NOW(),
      updated_at = NOW()
  WHERE is_online = true 
    AND last_seen < NOW() - INTERVAL '30 minutes';
END;
$$;


ALTER FUNCTION "public"."set_inactive_users_offline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_auto_assign"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.assigned_admin_id IS NULL AND NEW.assigned_seller_id IS NULL THEN
        PERFORM auto_assign_conversation(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_auto_assign"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_admin_payment_settings_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_admin_payment_settings_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_room_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE chat_rooms 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_room_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_preview"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE conversations
    SET
        last_message_preview = CASE
            WHEN NEW.message_type = 'text' THEN LEFT(NEW.message, 100)
            WHEN NEW.message_type = 'image' THEN '📷 Image'
            WHEN NEW.message_type = 'file' THEN '📎 File'
            WHEN NEW.message_type = 'announcement' THEN '📢 Announcement'
            WHEN NEW.message_type = 'broadcast' THEN '📡 Broadcast'
            ELSE 'New message'
        END,
        last_message_at = NEW.created_at,
        updated_at = NEW.created_at,
        unread_count = (
            SELECT COUNT(*)
            FROM chat_messages cm
            WHERE cm.conversation_id = NEW.conversation_id
            AND cm.is_read = FALSE
            AND cm.sender_id != NEW.sender_id
        )
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_preview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_delivery_statuses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_delivery_statuses_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_settings_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payment_settings_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pickup_code_verified_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.pickup_code_verified = true AND OLD.pickup_code_verified = false THEN
        NEW.pickup_code_verified_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pickup_code_verified_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_quantity"("p_product_id" "uuid", "p_quantity" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_quantity integer;
BEGIN
    -- Get current quantity
    SELECT quantity INTO v_current_quantity
    FROM public.products
    WHERE id = p_product_id;

    -- Validate input
    IF v_current_quantity IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    IF p_quantity < 0 THEN
        RAISE EXCEPTION 'Quantity cannot be negative';
    END IF;

    -- Update the product
    UPDATE public.products
    SET 
        quantity = p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update product quantity: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."update_product_quantity"("p_product_id" "uuid", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_seller_tutorials_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_seller_tutorials_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subscription_status"("p_tx_ref" "text", "p_transaction_reference" "text", "p_user_id" "uuid", "p_plan_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update subscription order
  UPDATE subscription_orders
  SET status = 'completed',
      transaction_reference = p_transaction_reference,
      updated_at = NOW()
  WHERE tx_ref = p_tx_ref;

  -- Update user subscription plan
  UPDATE users
  SET subscription_plan = p_plan_id
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_subscription_status"("p_tx_ref" "text", "p_transaction_reference" "text", "p_user_id" "uuid", "p_plan_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_online != OLD.is_online OR NEW.availability_status != OLD.availability_status THEN
        -- Update last activity
        NEW.last_activity = NOW();
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_last_seen"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update last_seen when user sends a message
  UPDATE user_chat_status 
  SET last_seen = NOW(),
      updated_at = NOW()
  WHERE user_id = NEW.sender_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_last_seen"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_verification_status"("p_is_verified" boolean, "p_new_status" "text", "p_user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update the user
  UPDATE public.users
  SET 
    is_verified = p_is_verified,
    verification_status = p_new_status
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'User verification status updated'
  );
END;
$$;


ALTER FUNCTION "public"."update_user_verification_status"("p_is_verified" boolean, "p_new_status" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Validate quantity
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Order quantity must be greater than 0';
  END IF;

  -- Validate prices and fees
  IF NEW.total_price < 0 THEN
    RAISE EXCEPTION 'Total price cannot be negative';
  END IF;

  -- Set null fees to 0
  NEW.platform_fee := COALESCE(NEW.platform_fee, 0);
  NEW.service_fee := COALESCE(NEW.service_fee, 0);
  NEW.ethiopia_tax := COALESCE(NEW.ethiopia_tax, 0);
  NEW.delivery_fee := COALESCE(NEW.delivery_fee, 0);

  -- Validate fees are not negative
  IF NEW.platform_fee < 0 OR 
     NEW.service_fee < 0 OR 
     NEW.ethiopia_tax < 0 OR 
     NEW.delivery_fee < 0 THEN
    RAISE EXCEPTION 'Fees cannot be negative';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_payment_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  -- Validate URLs if present
  IF NEW.telebirr_settings->>'is_active' = 'true' THEN
    IF NOT is_valid_url(NEW.telebirr_settings->>'notify_url') THEN
      RAISE EXCEPTION 'Invalid Telebirr notify URL';
    END IF;
    IF NOT is_valid_url(NEW.telebirr_settings->>'redirect_url') THEN
      RAISE EXCEPTION 'Invalid Telebirr redirect URL';
    END IF;
  END IF;

  IF NEW.cbe_birr_settings->>'is_active' = 'true' THEN
    IF NOT is_valid_url(NEW.cbe_birr_settings->>'notify_url') THEN
      RAISE EXCEPTION 'Invalid CBE Birr notify URL';
    END IF;
  END IF;

  IF NEW.amole_settings->>'is_active' = 'true' THEN
    IF NOT is_valid_url(NEW.amole_settings->>'notify_url') THEN
      RAISE EXCEPTION 'Invalid Amole notify URL';
    END IF;
  END IF;

  -- Validate bank account number format if present
  IF NEW.bank_settings->>'is_active' = 'true' THEN
    IF NOT (NEW.bank_settings->>'account_number' ~ '^\d{10,16}$') THEN
      RAISE EXCEPTION 'Invalid bank account number format';
    END IF;
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."validate_payment_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- For debugging
  RAISE NOTICE 'Validating transaction: subtotal=%, delivery_fee=%, total_amount=%',
    NEW.subtotal, NEW.delivery_fee, NEW.total_amount;

  -- Check if total_amount equals subtotal + delivery_fee
  IF ROUND(NEW.total_amount::numeric, 2) != ROUND((NEW.subtotal + NEW.delivery_fee)::numeric, 2) THEN
    RAISE EXCEPTION 'Total amount (%.2f) does not match sum of components (%.2f)',
      NEW.total_amount,
      (NEW.subtotal + NEW.delivery_fee);
  END IF;

  -- Check if seller_payout_amount equals total_amount - service_fee
  IF ROUND(NEW.seller_payout_amount::numeric, 2) != ROUND((NEW.total_amount - NEW.service_fee)::numeric, 2) THEN
    RAISE EXCEPTION 'Seller payout amount (%.2f) does not match total_amount - service_fee (%.2f)',
      NEW.seller_payout_amount,
      (NEW.total_amount - NEW.service_fee);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_transaction"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_payment_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telebirr_number" character varying(255) NOT NULL,
    "telebirr_name" character varying(255) NOT NULL,
    "merchant_app_id" character varying(255) NOT NULL,
    "fabric_app_id" character varying(255) NOT NULL,
    "app_secret" "text" NOT NULL,
    "private_key" "text" NOT NULL,
    "short_code" character varying(255) NOT NULL,
    "notify_url" "text" NOT NULL,
    "redirect_url" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subscription_notify_url" "text",
    "chapa_public_key" character varying(255),
    "chapa_secret_key" "text",
    "chapa_callback_url" "text",
    "chapa_webhook_secret" "text",
    "chapa_is_active" boolean DEFAULT true,
    CONSTRAINT "payment_method_active_check" CHECK ((("is_active" = true) OR ("chapa_is_active" = true)))
);


ALTER TABLE "public"."admin_payment_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."admin_payment_settings"."chapa_public_key" IS 'Chapa public key for payment integration';



COMMENT ON COLUMN "public"."admin_payment_settings"."chapa_secret_key" IS 'Chapa secret key for payment authentication';



COMMENT ON COLUMN "public"."admin_payment_settings"."chapa_callback_url" IS 'URL for Chapa payment callbacks';



COMMENT ON COLUMN "public"."admin_payment_settings"."chapa_webhook_secret" IS 'Secret for verifying Chapa webhooks';



COMMENT ON COLUMN "public"."admin_payment_settings"."chapa_is_active" IS 'Whether Chapa payment is active';



CREATE TABLE IF NOT EXISTS "public"."admin_telegram_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bot_token" character varying(255) NOT NULL,
    "webhook_url" character varying(500),
    "admin_chat_id" character varying(100) NOT NULL,
    "support_chat_id" character varying(100),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bot_username" character varying(100) NOT NULL
);


ALTER TABLE "public"."admin_telegram_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "quantity" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "price" numeric(10,2) NOT NULL,
    "delivery_fee" numeric(10,2) DEFAULT 0,
    "delivery_method" "text",
    "delivery_address" "text",
    "selected_size" "text",
    "selected_color" "text",
    "selected_variant_sku" "text",
    "notes" "text",
    "saved_for_later" boolean DEFAULT false,
    "gift_wrapping" boolean DEFAULT false,
    "gift_message" "text",
    "gift_wrapping_fee" numeric(10,2) DEFAULT 0,
    "split_payment_id" "uuid",
    "gift_purchase_id" "uuid",
    "gift_purchaser_id" "uuid",
    "gift_purchaser_email" "text",
    "gift_purchaser_name" "text",
    "gift_purchase_link" "text",
    "gift_purchase_expires_at" timestamp with time zone,
    "purchased_by" "text",
    "purchased_by_name" "text",
    "shared_cart_id" "uuid",
    CONSTRAINT "cart_items_delivery_method_check" CHECK (("delivery_method" = ANY (ARRAY['delivery'::"text", 'pickup'::"text"])))
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_type" character varying(20) NOT NULL,
    "message" "text" NOT NULL,
    "message_type" character varying(20) DEFAULT 'text'::character varying,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_message_type_check" CHECK ((("message_type")::"text" = ANY ((ARRAY['text'::character varying, 'image'::character varying, 'file'::character varying, 'system'::character varying])::"text"[]))),
    CONSTRAINT "chat_messages_sender_type_check" CHECK ((("sender_type")::"text" = ANY ((ARRAY['admin'::character varying, 'seller'::character varying, 'customer'::character varying])::"text"[])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_type" character varying(20) NOT NULL,
    "seller_id" "uuid",
    "admin_id" "uuid",
    "customer_id" "uuid",
    "is_active" boolean DEFAULT true,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_rooms_room_type_check" CHECK ((("room_type")::"text" = ANY ((ARRAY['admin_seller'::character varying, 'customer_seller'::character varying, 'customer_admin'::character varying])::"text"[])))
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "level" "text" DEFAULT 'info'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "to_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "sent_at" timestamp with time zone,
    CONSTRAINT "contact_messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."custom_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_access_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_account_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."delivery_access_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "delivery_person_name" character varying(255) NOT NULL,
    "phone_number" character varying(20) NOT NULL,
    "email" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."delivery_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "delivery_account_id" "uuid",
    "status" "text" NOT NULL,
    "location" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "notes" "text",
    "delivery_person_name" "text",
    "delivery_person_phone" "text",
    "proof_image" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "delivery_statuses_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'shipped'::"text", 'in_transit'::"text", 'out_for_delivery'::"text", 'delivered'::"text"])))
);


ALTER TABLE "public"."delivery_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "delivery_account_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'assigned'::character varying,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "picked_up_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "delivery_notes" "text",
    "proof_images" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "delivery_tracking_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['assigned'::character varying, 'picked_up'::character varying, 'in_transit'::character varying, 'delivered'::character varying, 'failed'::character varying])::"text"[])))
);


ALTER TABLE "public"."delivery_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "subscription_type" "text",
    "single_email" "text",
    "recipients_count" integer NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_campaigns_subscription_type_check" CHECK (("subscription_type" = ANY (ARRAY['notify_me'::"text", 'newsletter'::"text"])))
);


ALTER TABLE "public"."email_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "subscription_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    CONSTRAINT "email_subscribers_subscription_type_check" CHECK (("subscription_type" = ANY (ARRAY['notify_me'::"text", 'newsletter'::"text"])))
);


ALTER TABLE "public"."email_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flash_sale_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flash_sale_id" "uuid",
    "product_id" "uuid",
    "special_price" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."flash_sale_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flash_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "discount_percentage" integer NOT NULL,
    "min_order_amount" numeric(10,2),
    "free_shipping" boolean DEFAULT false,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "store_id" "uuid",
    "store_name" "text",
    CONSTRAINT "flash_sales_discount_check" CHECK ((("discount_percentage" >= 0) AND ("discount_percentage" <= 100)))
);


ALTER TABLE "public"."flash_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchaser_id" "uuid",
    "purchaser_email" "text" NOT NULL,
    "purchaser_name" "text" NOT NULL,
    "recipient_id" "uuid",
    "recipient_email" "text",
    "recipient_name" "text",
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1,
    "selected_size" "text",
    "selected_color" "text",
    "selected_variant_sku" "text",
    "gift_wrapping" boolean DEFAULT false,
    "gift_message" "text",
    "gift_wrapping_fee" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'ETB'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_method" "text",
    "payment_reference" "text",
    "order_id" "uuid",
    "link_code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "purchased_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gift_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'purchased'::"text", 'delivered'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."gift_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_wrapping_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'ETB'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gift_wrapping_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "quantity" integer DEFAULT 1,
    "total_price" numeric(10,2),
    "order_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "platform_fee" numeric(10,2),
    "service_fee" numeric(10,2),
    "ethiopia_tax" numeric(10,2),
    "delivery_fee" numeric(10,2),
    "payment_status" "text" DEFAULT 'pending'::"text",
    "payment_reference" "text",
    "tx_ref" "text",
    "receipt_url" "text",
    "delivery_proof_image" "text",
    "delivery_method" "text",
    "delivery_address" "text",
    "selected_size" "text",
    "selected_color" "text",
    "selected_variant_sku" "text",
    "pickup_code" character varying(8),
    "pickup_code_verified" boolean DEFAULT false,
    "pickup_code_verified_at" timestamp with time zone,
    "purchased_by" "text",
    "purchased_by_name" "text",
    "shared_cart_id" "uuid",
    "gift_wrapping" boolean DEFAULT false,
    "gift_message" "text",
    "gift_wrapping_fee" numeric(10,2) DEFAULT 0,
    CONSTRAINT "orders_delivery_fee_check" CHECK ((COALESCE("delivery_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "orders_delivery_method_check" CHECK (("delivery_method" = ANY (ARRAY['home_delivery'::"text", 'store_pickup'::"text"]))),
    CONSTRAINT "orders_ethiopia_tax_check" CHECK ((COALESCE("ethiopia_tax", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "orders_gift_wrapping_fee_check" CHECK ((COALESCE("gift_wrapping_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "orders_order_status_check" CHECK (("order_status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'shipped'::"text", 'delivered'::"text", 'picked up'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "orders_platform_fee_check" CHECK ((COALESCE("platform_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "orders_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "orders_service_fee_check" CHECK ((COALESCE("service_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "orders_total_price_check" CHECK (("total_price" >= (0)::numeric))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."selected_size" IS 'Selected size for the product if applicable';



COMMENT ON COLUMN "public"."orders"."selected_color" IS 'Selected color for the product if applicable';



COMMENT ON COLUMN "public"."orders"."selected_variant_sku" IS 'Selected variant SKU for the product if applicable';



COMMENT ON COLUMN "public"."orders"."pickup_code" IS 'Unique code generated for store pickup orders that customers must show to verify their identity';



COMMENT ON COLUMN "public"."orders"."pickup_code_verified" IS 'Whether the pickup code has been verified by the seller';



COMMENT ON COLUMN "public"."orders"."pickup_code_verified_at" IS 'Timestamp when the pickup code was verified';



CREATE TABLE IF NOT EXISTS "public"."payment_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "telebirr_settings" "jsonb" DEFAULT '{"is_active": false}'::"jsonb",
    "bank_settings" "jsonb" DEFAULT '{"is_active": false}'::"jsonb",
    "cbe_birr_settings" "jsonb" DEFAULT '{"is_active": false}'::"jsonb",
    "amole_settings" "jsonb" DEFAULT '{"is_active": false}'::"jsonb",
    "chapa_settings" "jsonb" DEFAULT '{"is_active": false}'::"jsonb",
    "mpesa_settings" "jsonb" DEFAULT '{"is_active": false}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_settings" "jsonb" DEFAULT '{"email": "", "is_active": false, "account_id": ""}'::"jsonb",
    CONSTRAINT "valid_amole_settings" CHECK (((NOT (("amole_settings" ->> 'is_active'::"text"))::boolean) OR (("amole_settings" ? 'account_number'::"text") AND ("amole_settings" ? 'phone_number'::"text")))),
    CONSTRAINT "valid_bank_settings" CHECK (((NOT (("bank_settings" ->> 'is_active'::"text"))::boolean) OR (("bank_settings" ? 'account_number'::"text") AND ("bank_settings" ? 'phone_number'::"text") AND ("bank_settings" ? 'bank_name'::"text")))),
    CONSTRAINT "valid_cbe_birr_settings" CHECK (((NOT (("cbe_birr_settings" ->> 'is_active'::"text"))::boolean) OR (("cbe_birr_settings" ? 'account_number'::"text") AND ("cbe_birr_settings" ? 'phone_number'::"text")))),
    CONSTRAINT "valid_chapa_settings" CHECK (((NOT (("chapa_settings" ->> 'is_active'::"text"))::boolean) OR (("chapa_settings" ? 'account_number'::"text") AND ("chapa_settings" ? 'phone_number'::"text")))),
    CONSTRAINT "valid_mpesa_settings" CHECK (((NOT (("mpesa_settings" ->> 'is_active'::"text"))::boolean) OR (("mpesa_settings" ? 'account_number'::"text") AND ("mpesa_settings" ? 'phone_number'::"text")))),
    CONSTRAINT "valid_telebirr_settings" CHECK (((NOT (("telebirr_settings" ->> 'is_active'::"text"))::boolean) OR (("telebirr_settings" ? 'account_number'::"text") AND ("telebirr_settings" ? 'phone_number'::"text"))))
);


ALTER TABLE "public"."payment_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payment_settings"."stripe_settings" IS 'Stripe payment configuration including account ID and email for international payments';



CREATE TABLE IF NOT EXISTS "public"."platform_withdrawals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "bank_name" "text" NOT NULL,
    "account_number" "text" NOT NULL,
    "account_holder" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "transaction_reference" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "notes" "text",
    "withdrawal_method" character varying(50) DEFAULT 'bank'::character varying,
    "telebirr_number" character varying(255),
    "telebirr_name" character varying(255),
    "user_id" "uuid",
    CONSTRAINT "platform_withdrawals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."platform_withdrawals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "image_url" "text" NOT NULL,
    "is_model_picture" boolean DEFAULT false
);


ALTER TABLE "public"."product_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "quantity" integer DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(10,2),
    "detailed_description" "text",
    "quality" "text" DEFAULT 'new'::"text",
    "sizes" "jsonb" DEFAULT '[]'::"jsonb",
    "colors" "jsonb" DEFAULT '[]'::"jsonb",
    "available_variants" "jsonb" DEFAULT '[]'::"jsonb",
    "brand" "text",
    "material" "text",
    "care_instructions" "text",
    "measurements" "jsonb",
    "shipping_info" "jsonb" DEFAULT '{"return_policy": "", "processing_time": "1-2 business days", "shipping_options": []}'::"jsonb",
    "highlights" "text"[] DEFAULT '{}'::"text"[],
    "specifications" "jsonb" DEFAULT '{}'::"jsonb",
    "style_notes" "text",
    "fit_info" "text",
    "occasion" "text"[],
    "season" "text"[],
    "sustainability_info" "text",
    "country_of_origin" "text",
    "warranty_info" "text",
    "faqs" "jsonb" DEFAULT '[]'::"jsonb",
    "delivery_time" "text",
    "delivery_options" "jsonb" DEFAULT '{"pickup": true, "delivery": true, "delivery_time": null, "pickup_location": null}'::"jsonb",
    "slug" "text",
    CONSTRAINT "products_quality_check" CHECK (("quality" = ANY (ARRAY['new'::"text", 'used'::"text", 'refurbished'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seller_verification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "business_name" "text" NOT NULL,
    "business_email" "text" NOT NULL,
    "business_phone" "text" NOT NULL,
    "legal_business_name" "text" NOT NULL,
    "business_registration_no" "text" NOT NULL,
    "tin_number" "text" NOT NULL,
    "is_vat_registered" boolean DEFAULT false,
    "trade_license_url" "text",
    "tin_certificate_url" "text",
    "memorandum_url" "text",
    "region" "text" NOT NULL,
    "kifle_ketema" "text" NOT NULL,
    "woreda" "text" NOT NULL,
    "kebele" "text",
    "house_no" "text" NOT NULL,
    "id_document_type" "text" NOT NULL,
    "id_document_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vat_number" "text",
    "rejection_reason" "text",
    CONSTRAINT "seller_verification_id_document_type_check" CHECK (("id_document_type" = ANY (ARRAY['kebele_id'::"text", 'national_id'::"text", 'passport'::"text", 'driving_license'::"text"]))),
    CONSTRAINT "seller_verification_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'needs_reconsideration'::"text"])))
);


ALTER TABLE "public"."seller_verification" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_business_names" AS
 SELECT "seller_verification"."user_id",
    "seller_verification"."business_name"
   FROM "public"."seller_verification"
  WHERE ("seller_verification"."status" = 'approved'::"text");


ALTER TABLE "public"."public_business_names" OWNER TO "postgres";


COMMENT ON VIEW "public"."public_business_names" IS 'Public view exposing only business names for approved seller verifications';



CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1,
    "selected_size" "text",
    "selected_color" "text",
    "selected_variant_sku" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seller_tutorials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tutorial_type" "text" DEFAULT 'dashboard_walkthrough'::"text" NOT NULL,
    "is_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "skipped_at" timestamp with time zone,
    "current_step" integer DEFAULT 1,
    "total_steps" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."seller_tutorials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "share_code" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recipient_email" "text",
    "recipient_name" "text",
    "message" "text",
    "cart_data" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "is_used" boolean DEFAULT false,
    "used_at" timestamp with time zone,
    "used_by_email" "text",
    "used_by_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shared_carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_payment_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "total_amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'ETB'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "split_payment_groups_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."split_payment_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_payment_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "split_payment_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payment_method" "text",
    "payment_reference" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "split_payment_participants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."split_payment_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "plan_id" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "period" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "tx_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subscription_end_date" timestamp with time zone,
    "payment_method" "text",
    "transaction_reference" "text",
    "cancelled_at" timestamp with time zone,
    CONSTRAINT "subscription_orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['telebirr'::"text", 'chapa'::"text", 'stripe'::"text"]))),
    CONSTRAINT "subscription_orders_period_check" CHECK (("period" = ANY (ARRAY['month'::"text", 'year'::"text"]))),
    CONSTRAINT "subscription_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."subscription_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscription_orders"."payment_method" IS 'Payment method used for subscription: telebirr, chapa, or stripe';



COMMENT ON COLUMN "public"."subscription_orders"."transaction_reference" IS 'Payment gateway transaction reference for receipt/verification';



CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "admin_response" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "chat_id" character varying(100) NOT NULL,
    "notification_type" character varying(50) NOT NULL,
    "message_text" "text" NOT NULL,
    "metadata" "jsonb",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'sent'::character varying,
    "error_message" "text",
    CONSTRAINT "telegram_notifications_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['sent'::character varying, 'failed'::character varying, 'pending'::character varying])::"text"[])))
);


ALTER TABLE "public"."telegram_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "chat_id" character varying(100) NOT NULL,
    "username" character varying(100),
    "first_name" character varying(100),
    "last_name" character varying(100),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."telegram_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temporary_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tx_ref" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "platform_fee" numeric(10,2) DEFAULT 0,
    "service_fee" numeric(10,2) DEFAULT 0,
    "ethiopia_tax" numeric(10,2) DEFAULT 0,
    "delivery_fee" numeric(10,2) DEFAULT 0,
    "delivery_method" "text",
    "delivery_address" "text",
    "selected_size" "text",
    "selected_color" "text",
    "selected_variant_sku" "text",
    "customer_phone" "text",
    "seller_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "gift_wrapping" boolean DEFAULT false,
    "gift_message" "text",
    "gift_wrapping_fee" numeric(10,2) DEFAULT 0,
    CONSTRAINT "temporary_orders_delivery_fee_check" CHECK ((COALESCE("delivery_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "temporary_orders_delivery_method_check" CHECK (("delivery_method" = ANY (ARRAY['home_delivery'::"text", 'store_pickup'::"text"]))),
    CONSTRAINT "temporary_orders_ethiopia_tax_check" CHECK ((COALESCE("ethiopia_tax", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "temporary_orders_gift_wrapping_fee_check" CHECK ((COALESCE("gift_wrapping_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "temporary_orders_platform_fee_check" CHECK ((COALESCE("platform_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "temporary_orders_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "temporary_orders_service_fee_check" CHECK ((COALESCE("service_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "temporary_orders_total_price_check" CHECK (("total_price" >= (0)::numeric))
);


ALTER TABLE "public"."temporary_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."temporary_orders"."metadata" IS 'JSON metadata for storing additional order information like shared cart details';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "payment_method" character varying(50),
    "payment_status" character varying(50),
    "subtotal" numeric(10,2),
    "vat_amount" numeric(10,2),
    "platform_fee" numeric(10,2),
    "service_fee" numeric(10,2),
    "delivery_fee" numeric(10,2),
    "total_amount" numeric(10,2),
    "seller_payout_amount" numeric(10,2),
    "platform_revenue" numeric(10,2),
    "seller_id" "uuid",
    "platform_payout_status" character varying(50) DEFAULT 'pending'::character varying,
    "seller_payout_status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "subscription_id" "uuid",
    "payment_type" character varying(50),
    "flash_sale_applied" boolean DEFAULT false,
    "original_price" numeric(10,2),
    "flash_sale_price" numeric(10,2),
    "flash_sale_discount_percentage" numeric(5,2),
    "flash_sale_title" "text",
    "gift_wrapping_fee" numeric(10,2) DEFAULT 0,
    CONSTRAINT "transactions_gift_wrapping_fee_check" CHECK ((COALESCE("gift_wrapping_fee", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "transactions_payment_type_check" CHECK ((("payment_type")::"text" = ANY ((ARRAY['order'::character varying, 'subscription'::character varying])::"text"[])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions"."flash_sale_applied" IS 'Whether a flash sale was applied to this transaction';



COMMENT ON COLUMN "public"."transactions"."original_price" IS 'Original product price before flash sale discount';



COMMENT ON COLUMN "public"."transactions"."flash_sale_price" IS 'Price after flash sale discount was applied';



COMMENT ON COLUMN "public"."transactions"."flash_sale_discount_percentage" IS 'Percentage discount applied from flash sale';



COMMENT ON COLUMN "public"."transactions"."flash_sale_title" IS 'Title of the flash sale that was applied';



CREATE TABLE IF NOT EXISTS "public"."user_chat_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_online" boolean DEFAULT false,
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "status_message" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_chat_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text",
    "email" "text",
    "role" "text" DEFAULT 'customer'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subscription_plan" "text" DEFAULT 'basic'::"text",
    "store_settings" "jsonb",
    "is_admin" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "verification_status" "text" DEFAULT 'pending'::"text",
    "phone" "text",
    "phone_verified" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'customer'::"text", 'admin'::"text"]))),
    CONSTRAINT "users_subscription_plan_check" CHECK (("subscription_plan" = ANY (ARRAY['basic'::"text", 'pro'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "users_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'needs_reconsideration'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."users_with_payment_settings" WITH ("security_invoker"='on') AS
 SELECT "u"."id",
    "u"."full_name",
    "u"."email",
    "u"."role",
    "u"."created_at",
    "u"."subscription_plan",
    "u"."store_settings",
    "u"."is_admin",
    "u"."is_verified",
    "u"."verification_status",
    "ps"."telebirr_settings",
    "ps"."bank_settings",
    "ps"."cbe_birr_settings",
    "ps"."amole_settings",
    "ps"."chapa_settings",
    "ps"."mpesa_settings"
   FROM ("public"."users" "u"
     LEFT JOIN "public"."payment_settings" "ps" ON (("u"."id" = "ps"."user_id")));


ALTER TABLE "public"."users_with_payment_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wishlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_payment_settings"
    ADD CONSTRAINT "admin_payment_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_telegram_settings"
    ADD CONSTRAINT "admin_telegram_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_logs"
    ADD CONSTRAINT "client_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_access_tokens"
    ADD CONSTRAINT "delivery_access_tokens_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."delivery_access_tokens"
    ADD CONSTRAINT "delivery_access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_accounts"
    ADD CONSTRAINT "delivery_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_statuses"
    ADD CONSTRAINT "delivery_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_tracking"
    ADD CONSTRAINT "delivery_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_subscribers"
    ADD CONSTRAINT "email_subscribers_email_subscription_type_key" UNIQUE ("email", "subscription_type");



ALTER TABLE ONLY "public"."email_subscribers"
    ADD CONSTRAINT "email_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flash_sale_products"
    ADD CONSTRAINT "flash_sale_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flash_sales"
    ADD CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_purchases"
    ADD CONSTRAINT "gift_purchases_link_code_key" UNIQUE ("link_code");



ALTER TABLE ONLY "public"."gift_purchases"
    ADD CONSTRAINT "gift_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_wrapping_options"
    ADD CONSTRAINT "gift_wrapping_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_withdrawals"
    ADD CONSTRAINT "platform_withdrawals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."saved_items"
    ADD CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_items"
    ADD CONSTRAINT "saved_items_user_product_unique" UNIQUE ("user_id", "product_id", "selected_size", "selected_color", "selected_variant_sku");



ALTER TABLE ONLY "public"."seller_tutorials"
    ADD CONSTRAINT "seller_tutorials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_tutorials"
    ADD CONSTRAINT "seller_tutorials_user_id_tutorial_type_key" UNIQUE ("user_id", "tutorial_type");



ALTER TABLE ONLY "public"."seller_verification"
    ADD CONSTRAINT "seller_verification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_carts"
    ADD CONSTRAINT "shared_carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_carts"
    ADD CONSTRAINT "shared_carts_share_code_key" UNIQUE ("share_code");



ALTER TABLE ONLY "public"."split_payment_groups"
    ADD CONSTRAINT "split_payment_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_payment_participants"
    ADD CONSTRAINT "split_payment_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_payment_participants"
    ADD CONSTRAINT "split_payment_participants_unique" UNIQUE ("split_payment_id", "email");



ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_tx_ref_key" UNIQUE ("tx_ref");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_notifications"
    ADD CONSTRAINT "telegram_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_users"
    ADD CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_users"
    ADD CONSTRAINT "telegram_users_user_id_chat_id_key" UNIQUE ("user_id", "chat_id");



ALTER TABLE ONLY "public"."temporary_orders"
    ADD CONSTRAINT "temporary_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "unique_transaction_reference" UNIQUE ("transaction_reference");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "unique_tx_ref" UNIQUE ("tx_ref");



COMMENT ON CONSTRAINT "unique_tx_ref" ON "public"."orders" IS 'Ensures each transaction reference (tx_ref) can only have one order';



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "unique_user_settings" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_chat_status"
    ADD CONSTRAINT "user_chat_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_chat_status"
    ADD CONSTRAINT "user_chat_status_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_user_id_product_id_key" UNIQUE ("user_id", "product_id");



CREATE UNIQUE INDEX "cart_items_user_product_unique" ON "public"."cart_items" USING "btree" ("user_id", "product_id") WHERE (("selected_size" IS NULL) AND ("selected_color" IS NULL) AND ("selected_variant_sku" IS NULL));



CREATE UNIQUE INDEX "cart_items_user_product_variant_unique" ON "public"."cart_items" USING "btree" ("user_id", "product_id", "selected_size", "selected_color", "selected_variant_sku") WHERE (("selected_size" IS NOT NULL) OR ("selected_color" IS NOT NULL) OR ("selected_variant_sku" IS NOT NULL));



CREATE UNIQUE INDEX "chat_rooms_unique_rooms" ON "public"."chat_rooms" USING "btree" ("room_type", COALESCE("seller_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("admin_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("customer_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_cart_items_gift_purchase_id" ON "public"."cart_items" USING "btree" ("gift_purchase_id");



CREATE INDEX "idx_cart_items_purchased_by" ON "public"."cart_items" USING "btree" ("purchased_by");



CREATE INDEX "idx_cart_items_saved_for_later" ON "public"."cart_items" USING "btree" ("saved_for_later") WHERE ("saved_for_later" = true);



CREATE INDEX "idx_cart_items_shared_cart_id" ON "public"."cart_items" USING "btree" ("shared_cart_id");



CREATE INDEX "idx_cart_items_split_payment_id" ON "public"."cart_items" USING "btree" ("split_payment_id");



CREATE INDEX "idx_chat_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at");



CREATE INDEX "idx_chat_messages_room_id" ON "public"."chat_messages" USING "btree" ("room_id");



CREATE INDEX "idx_chat_messages_sender_id" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_chat_rooms_admin_id" ON "public"."chat_rooms" USING "btree" ("admin_id");



CREATE INDEX "idx_chat_rooms_customer_id" ON "public"."chat_rooms" USING "btree" ("customer_id");



CREATE INDEX "idx_chat_rooms_last_message_at" ON "public"."chat_rooms" USING "btree" ("last_message_at");



CREATE INDEX "idx_chat_rooms_room_type" ON "public"."chat_rooms" USING "btree" ("room_type");



CREATE INDEX "idx_chat_rooms_seller_id" ON "public"."chat_rooms" USING "btree" ("seller_id");



CREATE INDEX "idx_custom_categories_active" ON "public"."custom_categories" USING "btree" ("is_active");



CREATE INDEX "idx_custom_categories_created_by" ON "public"."custom_categories" USING "btree" ("created_by");



CREATE INDEX "idx_custom_categories_name" ON "public"."custom_categories" USING "btree" ("name");



CREATE INDEX "idx_delivery_access_tokens_account" ON "public"."delivery_access_tokens" USING "btree" ("delivery_account_id");



CREATE INDEX "idx_delivery_access_tokens_token" ON "public"."delivery_access_tokens" USING "btree" ("access_token");



CREATE INDEX "idx_delivery_accounts_is_active" ON "public"."delivery_accounts" USING "btree" ("is_active");



CREATE INDEX "idx_delivery_accounts_seller_id" ON "public"."delivery_accounts" USING "btree" ("seller_id");



CREATE INDEX "idx_delivery_statuses_created_at" ON "public"."delivery_statuses" USING "btree" ("created_at");



CREATE INDEX "idx_delivery_statuses_delivery_account_id" ON "public"."delivery_statuses" USING "btree" ("delivery_account_id");



CREATE INDEX "idx_delivery_statuses_order_id" ON "public"."delivery_statuses" USING "btree" ("order_id");



CREATE INDEX "idx_delivery_statuses_status" ON "public"."delivery_statuses" USING "btree" ("status");



CREATE INDEX "idx_delivery_tracking_delivery_account_id" ON "public"."delivery_tracking" USING "btree" ("delivery_account_id");



CREATE INDEX "idx_delivery_tracking_order_id" ON "public"."delivery_tracking" USING "btree" ("order_id");



CREATE INDEX "idx_delivery_tracking_status" ON "public"."delivery_tracking" USING "btree" ("status");



CREATE INDEX "idx_email_subscribers_email" ON "public"."email_subscribers" USING "btree" ("email");



CREATE INDEX "idx_flash_sale_products_sale" ON "public"."flash_sale_products" USING "btree" ("flash_sale_id");



CREATE INDEX "idx_flash_sales_active_time" ON "public"."flash_sales" USING "btree" ("is_active", "start_time", "end_time");



CREATE INDEX "idx_gift_purchases_link_code" ON "public"."gift_purchases" USING "btree" ("link_code");



CREATE INDEX "idx_gift_purchases_purchaser_id" ON "public"."gift_purchases" USING "btree" ("purchaser_id");



CREATE INDEX "idx_gift_purchases_recipient_id" ON "public"."gift_purchases" USING "btree" ("recipient_id");



CREATE INDEX "idx_gift_purchases_status" ON "public"."gift_purchases" USING "btree" ("status");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_pickup_code" ON "public"."orders" USING "btree" ("pickup_code") WHERE ("pickup_code" IS NOT NULL);



CREATE INDEX "idx_orders_product_id" ON "public"."orders" USING "btree" ("product_id");



CREATE INDEX "idx_orders_purchased_by" ON "public"."orders" USING "btree" ("purchased_by");



CREATE INDEX "idx_orders_shared_cart_id" ON "public"."orders" USING "btree" ("shared_cart_id");



CREATE INDEX "idx_products_owner_id" ON "public"."products" USING "btree" ("owner_id");



CREATE INDEX "idx_products_variants" ON "public"."products" USING "gin" ("available_variants");



CREATE INDEX "idx_saved_items_user_id" ON "public"."saved_items" USING "btree" ("user_id");



CREATE INDEX "idx_seller_tutorials_completed" ON "public"."seller_tutorials" USING "btree" ("is_completed");



CREATE INDEX "idx_seller_tutorials_user_id" ON "public"."seller_tutorials" USING "btree" ("user_id");



CREATE INDEX "idx_shared_carts_expires_at" ON "public"."shared_carts" USING "btree" ("expires_at");



CREATE INDEX "idx_shared_carts_share_code" ON "public"."shared_carts" USING "btree" ("share_code");



CREATE INDEX "idx_shared_carts_user_id" ON "public"."shared_carts" USING "btree" ("user_id");



CREATE INDEX "idx_split_payment_groups_created_by" ON "public"."split_payment_groups" USING "btree" ("created_by");



CREATE INDEX "idx_split_payment_participants_split_payment_id" ON "public"."split_payment_participants" USING "btree" ("split_payment_id");



CREATE INDEX "idx_telegram_notifications_chat_id" ON "public"."telegram_notifications" USING "btree" ("chat_id");



CREATE INDEX "idx_telegram_notifications_sent_at" ON "public"."telegram_notifications" USING "btree" ("sent_at");



CREATE INDEX "idx_telegram_notifications_type" ON "public"."telegram_notifications" USING "btree" ("notification_type");



CREATE INDEX "idx_telegram_notifications_user_id" ON "public"."telegram_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_telegram_users_chat_id" ON "public"."telegram_users" USING "btree" ("chat_id");



CREATE INDEX "idx_telegram_users_is_active" ON "public"."telegram_users" USING "btree" ("is_active");



CREATE INDEX "idx_telegram_users_user_id" ON "public"."telegram_users" USING "btree" ("user_id");



CREATE INDEX "idx_temporary_orders_expires_at" ON "public"."temporary_orders" USING "btree" ("expires_at");



CREATE INDEX "idx_temporary_orders_metadata" ON "public"."temporary_orders" USING "gin" ("metadata");



CREATE INDEX "idx_temporary_orders_tx_ref" ON "public"."temporary_orders" USING "btree" ("tx_ref");



CREATE INDEX "idx_user_chat_status_is_online" ON "public"."user_chat_status" USING "btree" ("is_online");



CREATE INDEX "idx_user_chat_status_user_id" ON "public"."user_chat_status" USING "btree" ("user_id");



CREATE INDEX "idx_wishlist_product_id" ON "public"."wishlist" USING "btree" ("product_id");



CREATE INDEX "idx_wishlist_user_id" ON "public"."wishlist" USING "btree" ("user_id");



CREATE INDEX "likes_product_id_idx" ON "public"."likes" USING "btree" ("product_id");



CREATE INDEX "likes_user_product_idx" ON "public"."likes" USING "btree" ("user_id", "product_id");



CREATE INDEX "orders_product_id_idx" ON "public"."orders" USING "btree" ("product_id");



CREATE INDEX "orders_user_id_idx" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "products_category_idx" ON "public"."products" USING "btree" ("category");



CREATE INDEX "products_is_active_idx" ON "public"."products" USING "btree" ("is_active");



CREATE INDEX "products_owner_id_idx" ON "public"."products" USING "btree" ("owner_id");



CREATE INDEX "products_quality_idx" ON "public"."products" USING "btree" ("quality");



CREATE INDEX "products_quantity_idx" ON "public"."products" USING "btree" ("quantity");



CREATE INDEX "products_slug_idx" ON "public"."products" USING "btree" ("slug");



CREATE UNIQUE INDEX "products_slug_unique_idx" ON "public"."products" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "ratings_product_id_idx" ON "public"."ratings" USING "btree" ("product_id");



CREATE INDEX "ratings_user_product_idx" ON "public"."ratings" USING "btree" ("user_id", "product_id");



CREATE OR REPLACE TRIGGER "check_transaction_amounts_trigger" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."check_transaction_amounts"();



CREATE OR REPLACE TRIGGER "order_completed_transaction" AFTER UPDATE ON "public"."orders" FOR EACH ROW WHEN ((("old"."order_status" <> 'completed'::"text") AND ("new"."order_status" = 'completed'::"text"))) EXECUTE FUNCTION "public"."create_platform_transaction"();



CREATE OR REPLACE TRIGGER "set_admin_status_trigger" AFTER INSERT OR UPDATE OF "is_admin" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_status"();



CREATE OR REPLACE TRIGGER "trigger_auto_generate_product_slug" BEFORE INSERT OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_product_slug"();



CREATE OR REPLACE TRIGGER "update_admin_payment_settings_timestamp" BEFORE UPDATE ON "public"."admin_payment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_admin_payment_settings_timestamp"();



CREATE OR REPLACE TRIGGER "update_admin_telegram_settings_updated_at" BEFORE UPDATE ON "public"."admin_telegram_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cart_items_updated_at" BEFORE UPDATE ON "public"."cart_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_room_last_message_trigger" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_room_last_message"();



CREATE OR REPLACE TRIGGER "update_chat_rooms_updated_at" BEFORE UPDATE ON "public"."chat_rooms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_custom_categories_updated_at" BEFORE UPDATE ON "public"."custom_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_delivery_accounts_updated_at" BEFORE UPDATE ON "public"."delivery_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_delivery_statuses_updated_at" BEFORE UPDATE ON "public"."delivery_statuses" FOR EACH ROW EXECUTE FUNCTION "public"."update_delivery_statuses_updated_at"();



CREATE OR REPLACE TRIGGER "update_delivery_tracking_updated_at" BEFORE UPDATE ON "public"."delivery_tracking" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_gift_purchases_updated_at" BEFORE UPDATE ON "public"."gift_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_gift_wrapping_options_updated_at" BEFORE UPDATE ON "public"."gift_wrapping_options" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_pickup_code_verified_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_pickup_code_verified_at"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_saved_items_updated_at" BEFORE UPDATE ON "public"."saved_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_seller_tutorials_updated_at" BEFORE UPDATE ON "public"."seller_tutorials" FOR EACH ROW EXECUTE FUNCTION "public"."update_seller_tutorials_updated_at"();



CREATE OR REPLACE TRIGGER "update_shared_carts_updated_at" BEFORE UPDATE ON "public"."shared_carts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_split_payment_groups_updated_at" BEFORE UPDATE ON "public"."split_payment_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_split_payment_participants_updated_at" BEFORE UPDATE ON "public"."split_payment_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_orders_updated_at" BEFORE UPDATE ON "public"."subscription_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_telegram_users_updated_at" BEFORE UPDATE ON "public"."telegram_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_chat_status_updated_at" BEFORE UPDATE ON "public"."user_chat_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_last_seen_trigger" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_last_seen"();



CREATE OR REPLACE TRIGGER "validate_order_trigger" BEFORE INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."validate_order"();



CREATE OR REPLACE TRIGGER "validate_transaction_trigger" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_transaction"();



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_gift_purchaser_id_fkey" FOREIGN KEY ("gift_purchaser_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_shared_cart_id_fkey" FOREIGN KEY ("shared_cart_id") REFERENCES "public"."shared_carts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_logs"
    ADD CONSTRAINT "client_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_access_tokens"
    ADD CONSTRAINT "delivery_access_tokens_delivery_account_id_fkey" FOREIGN KEY ("delivery_account_id") REFERENCES "public"."delivery_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_accounts"
    ADD CONSTRAINT "delivery_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_statuses"
    ADD CONSTRAINT "delivery_statuses_delivery_account_id_fkey" FOREIGN KEY ("delivery_account_id") REFERENCES "public"."delivery_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."delivery_statuses"
    ADD CONSTRAINT "delivery_statuses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_tracking"
    ADD CONSTRAINT "delivery_tracking_delivery_account_id_fkey" FOREIGN KEY ("delivery_account_id") REFERENCES "public"."delivery_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_tracking"
    ADD CONSTRAINT "delivery_tracking_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flash_sale_products"
    ADD CONSTRAINT "flash_sale_products_flash_sale_id_fkey" FOREIGN KEY ("flash_sale_id") REFERENCES "public"."flash_sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flash_sale_products"
    ADD CONSTRAINT "flash_sale_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flash_sales"
    ADD CONSTRAINT "flash_sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."flash_sales"
    ADD CONSTRAINT "flash_sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."gift_purchases"
    ADD CONSTRAINT "gift_purchases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gift_purchases"
    ADD CONSTRAINT "gift_purchases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_purchases"
    ADD CONSTRAINT "gift_purchases_purchaser_id_fkey" FOREIGN KEY ("purchaser_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gift_purchases"
    ADD CONSTRAINT "gift_purchases_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shared_cart_id_fkey" FOREIGN KEY ("shared_cart_id") REFERENCES "public"."shared_carts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "payment_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "payment_settings_user_id_users_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_withdrawals"
    ADD CONSTRAINT "platform_withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_items"
    ADD CONSTRAINT "saved_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_items"
    ADD CONSTRAINT "saved_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_tutorials"
    ADD CONSTRAINT "seller_tutorials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_verification"
    ADD CONSTRAINT "seller_verification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shared_carts"
    ADD CONSTRAINT "shared_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_payment_groups"
    ADD CONSTRAINT "split_payment_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_payment_participants"
    ADD CONSTRAINT "split_payment_participants_split_payment_id_fkey" FOREIGN KEY ("split_payment_id") REFERENCES "public"."split_payment_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_payment_participants"
    ADD CONSTRAINT "split_payment_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."telegram_notifications"
    ADD CONSTRAINT "telegram_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."telegram_users"
    ADD CONSTRAINT "telegram_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temporary_orders"
    ADD CONSTRAINT "temporary_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temporary_orders"
    ADD CONSTRAINT "temporary_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temporary_orders"
    ADD CONSTRAINT "temporary_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription_orders"("id");



ALTER TABLE ONLY "public"."user_chat_status"
    ADD CONSTRAINT "user_chat_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist"
    ADD CONSTRAINT "wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can manage all subscription orders" ON "public"."subscription_orders" TO "service_role" USING (true);



CREATE POLICY "Admin can view all subscription orders" ON "public"."subscription_orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."is_admin" = true) OR ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Admin users can manage payment settings" ON "public"."admin_payment_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."is_admin" = true) OR ("users"."role" = 'owner'::"text"))))));



CREATE POLICY "Admins can read email campaigns" ON "public"."email_campaigns" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role" = 'admin'::"text") OR (COALESCE("u"."is_admin", false) = true))))));



CREATE POLICY "Admins can update all verifications" ON "public"."seller_verification" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Admins can update tickets" ON "public"."support_tickets" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Admins can view all notifications" ON "public"."telegram_notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all tickets" ON "public"."support_tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Admins can view all transactions" ON "public"."transactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role" = 'admin'::"text") OR ("users"."role" = 'owner'::"text"))))));



CREATE POLICY "Admins can view all verifications" ON "public"."seller_verification" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Allow admins to do everything" ON "public"."flash_sales" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Allow admins to execute get_platform_stats" ON "public"."transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role" = 'admin'::"text") OR ("users"."is_admin" = true))))));



CREATE POLICY "Allow admins to view subscribers" ON "public"."email_subscribers" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "users"."email"
   FROM "public"."users"
  WHERE ("users"."role" = 'admin'::"text"))));



CREATE POLICY "Allow authenticated users to insert custom categories" ON "public"."custom_categories" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read custom categories" ON "public"."custom_categories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow full access to own flash sales" ON "public"."flash_sales" TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow public to subscribe" ON "public"."email_subscribers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow read access to all flash sales" ON "public"."flash_sales" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow service role full access" ON "public"."delivery_access_tokens" USING (true);



CREATE POLICY "Allow users to delete their own custom categories" ON "public"."custom_categories" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow users to read their own payment settings" ON "public"."payment_settings" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to update their own custom categories" ON "public"."custom_categories" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow users to update their own subscription" ON "public"."email_subscribers" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Allow users to view their own subscription" ON "public"."email_subscribers" FOR SELECT USING (true);



CREATE POLICY "Anyone can create contact messages" ON "public"."contact_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view active flash sale products" ON "public"."flash_sale_products" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."flash_sales"
  WHERE (("flash_sales"."id" = "flash_sale_products"."flash_sale_id") AND ("flash_sales"."is_active" = true) AND (("now"() >= "flash_sales"."start_time") AND ("now"() <= "flash_sales"."end_time"))))));



CREATE POLICY "Anyone can view active flash sales" ON "public"."flash_sales" FOR SELECT USING ((("is_active" = true) AND (("now"() >= "start_time") AND ("now"() <= "end_time"))));



CREATE POLICY "Anyone can view active products" ON "public"."products" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view likes count" ON "public"."likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view product images" ON "public"."product_images" FOR SELECT USING (true);



CREATE POLICY "Anyone can view shared carts by share_code" ON "public"."shared_carts" FOR SELECT USING (("share_code" IS NOT NULL));



CREATE POLICY "Authenticated users can manage their likes" ON "public"."likes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can view gift wrapping options" ON "public"."gift_wrapping_options" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Customers can create orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Customers can view delivery statuses for their orders" ON "public"."delivery_statuses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "delivery_statuses"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Customers can view their own orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (((("auth"."role"() = 'authenticated'::"text") AND ("user_id" = "auth"."uid"())) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Delivery persons can insert delivery statuses" ON "public"."delivery_statuses" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."delivery_access_tokens" "dat"
     JOIN "public"."delivery_accounts" "da" ON (("dat"."delivery_account_id" = "da"."id")))
     JOIN "public"."delivery_tracking" "dt" ON (("dt"."delivery_account_id" = "da"."id")))
  WHERE (("dt"."order_id" = "delivery_statuses"."order_id") AND ("dat"."access_token" = (("current_setting"('request.headers'::"text"))::"json" ->> 'authorization'::"text")) AND ("dat"."expires_at" > "now"()) AND (NOT "dat"."is_used")))));



CREATE POLICY "Delivery persons can update delivery statuses" ON "public"."delivery_statuses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."delivery_access_tokens" "dat"
     JOIN "public"."delivery_accounts" "da" ON (("dat"."delivery_account_id" = "da"."id")))
     JOIN "public"."delivery_tracking" "dt" ON (("dt"."delivery_account_id" = "da"."id")))
  WHERE (("dt"."order_id" = "delivery_statuses"."order_id") AND ("dat"."access_token" = (("current_setting"('request.headers'::"text"))::"json" ->> 'authorization'::"text")) AND ("dat"."expires_at" > "now"()) AND (NOT "dat"."is_used")))));



CREATE POLICY "Delivery persons can update their assigned deliveries" ON "public"."delivery_tracking" FOR UPDATE USING (("delivery_account_id" IN ( SELECT "delivery_accounts"."id"
   FROM "public"."delivery_accounts"
  WHERE (("delivery_accounts"."phone_number")::"text" = ( SELECT "users"."phone"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Delivery persons can view their assigned deliveries" ON "public"."delivery_tracking" FOR SELECT USING (("delivery_account_id" IN ( SELECT "delivery_accounts"."id"
   FROM "public"."delivery_accounts"
  WHERE (("delivery_accounts"."phone_number")::"text" = ( SELECT "users"."phone"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Enable all access for authenticated users" ON "public"."products" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete for users based on user_id" ON "public"."telegram_users" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable insert for authenticated users" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."telegram_users" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read access for all" ON "public"."orders" FOR SELECT USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Enable read access for all roles" ON "public"."orders" USING ((("auth"."role"() = 'service_role'::"text") OR (("auth"."role"() = 'authenticated'::"text") AND (("user_id" = "auth"."uid"()) OR ("product_id" IN ( SELECT "products"."id"
   FROM "public"."products"
  WHERE ("products"."owner_id" = "auth"."uid"())))))));



CREATE POLICY "Enable read access for all users" ON "public"."telegram_users" FOR SELECT USING (true);



CREATE POLICY "Enable read access for users to their own transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "seller_id") OR ("auth"."uid"() IN ( SELECT "orders"."user_id"
   FROM "public"."orders"
  WHERE ("orders"."id" = "transactions"."order_id")))));



CREATE POLICY "Enable service role access" ON "public"."telegram_users" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Enable update for authenticated users" ON "public"."products" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Enable update for seller" ON "public"."transactions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "seller_id")) WITH CHECK (("auth"."uid"() = "seller_id"));



CREATE POLICY "Enable update for users based on user_id" ON "public"."telegram_users" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert valid transactions" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK ((("subtotal" >= (0)::numeric) AND ("total_amount" >= (0)::numeric) AND ("seller_payout_amount" >= (0)::numeric) AND (COALESCE("vat_amount", (0)::numeric) >= (0)::numeric) AND (COALESCE("platform_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("service_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("delivery_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("platform_revenue", (0)::numeric) >= (0)::numeric)));



CREATE POLICY "Likes are viewable by everyone" ON "public"."likes" FOR SELECT USING (true);



CREATE POLICY "Only admins can manage telegram settings" ON "public"."admin_telegram_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Only admins can view contact messages" ON "public"."contact_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Owners can create products" ON "public"."products" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can delete their products" ON "public"."products" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can manage product images" ON "public"."product_images" USING (("auth"."uid"() IN ( SELECT "products"."owner_id"
   FROM "public"."products"
  WHERE ("products"."id" = "product_images"."product_id"))));



CREATE POLICY "Owners can update orders for their products" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "orders"."product_id") AND ("products"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can update their products" ON "public"."products" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can view all their products" ON "public"."products" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can view orders for their products" ON "public"."orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "orders"."product_id") AND ("products"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can view their products" ON "public"."products" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can view their transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "Product owners can manage their images" ON "public"."product_images" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_images"."product_id") AND ("products"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_images"."product_id") AND ("products"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Public can read active settings" ON "public"."admin_payment_settings" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view active payment settings" ON "public"."payment_settings" FOR SELECT USING (true);



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Public users can insert valid orders" ON "public"."orders" FOR INSERT WITH CHECK ((("quantity" > 0) AND ("total_price" >= (0)::numeric) AND (COALESCE("platform_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("service_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("ethiopia_tax", (0)::numeric) >= (0)::numeric) AND (COALESCE("delivery_fee", (0)::numeric) >= (0)::numeric)));



CREATE POLICY "Ratings are viewable by everyone" ON "public"."ratings" FOR SELECT USING (true);



CREATE POLICY "Sellers can delete delivery tracking" ON "public"."delivery_tracking" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."products" "p" ON (("o"."product_id" = "p"."id")))
  WHERE (("o"."id" = "delivery_tracking"."order_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Sellers can delete their own delivery accounts" ON "public"."delivery_accounts" FOR DELETE USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "Sellers can insert delivery tracking" ON "public"."delivery_tracking" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."products" "p" ON (("o"."product_id" = "p"."id")))
  WHERE (("o"."id" = "delivery_tracking"."order_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Sellers can insert their own delivery accounts" ON "public"."delivery_accounts" FOR INSERT WITH CHECK (("seller_id" = "auth"."uid"()));



CREATE POLICY "Sellers can manage their delivery access tokens" ON "public"."delivery_access_tokens" USING (("delivery_account_id" IN ( SELECT "delivery_accounts"."id"
   FROM "public"."delivery_accounts"
  WHERE ("delivery_accounts"."seller_id" = "auth"."uid"()))));



CREATE POLICY "Sellers can manage their flash sale products" ON "public"."flash_sale_products" USING ((EXISTS ( SELECT 1
   FROM "public"."flash_sales"
  WHERE (("flash_sales"."id" = "flash_sale_products"."flash_sale_id") AND ("flash_sales"."created_by" = "auth"."uid"())))));



CREATE POLICY "Sellers can manage their own flash sales" ON "public"."flash_sales" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Sellers can update delivery tracking" ON "public"."delivery_tracking" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."products" "p" ON (("o"."product_id" = "p"."id")))
  WHERE (("o"."id" = "delivery_tracking"."order_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Sellers can update their own delivery accounts" ON "public"."delivery_accounts" FOR UPDATE USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "Sellers can update their own transactions" ON "public"."transactions" FOR UPDATE TO "authenticated" USING (("seller_id" = "auth"."uid"())) WITH CHECK (("seller_id" = "auth"."uid"()));



CREATE POLICY "Sellers can view delivery statuses for their orders" ON "public"."delivery_statuses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."products" "p" ON (("o"."product_id" = "p"."id")))
  WHERE (("o"."id" = "delivery_statuses"."order_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Sellers can view delivery tracking for their orders" ON "public"."delivery_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."products" "p" ON (("o"."product_id" = "p"."id")))
  WHERE (("o"."id" = "delivery_tracking"."order_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Sellers can view their own delivery accounts" ON "public"."delivery_accounts" FOR SELECT USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "Sellers can view their own transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "Server can manage all chat messages" ON "public"."chat_messages" USING (true);



CREATE POLICY "Server can manage all chat rooms" ON "public"."chat_rooms" USING (true);



CREATE POLICY "Server can manage all chat statuses" ON "public"."user_chat_status" USING (true);



CREATE POLICY "Service role can delete email campaigns" ON "public"."email_campaigns" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "Service role can insert email campaigns" ON "public"."email_campaigns" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage all temporary orders" ON "public"."temporary_orders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can update email campaigns" ON "public"."email_campaigns" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "System can update transaction status" ON "public"."transactions" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Update valid transactions" ON "public"."transactions" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "seller_id") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))))) WITH CHECK ((("subtotal" >= (0)::numeric) AND ("total_amount" >= (0)::numeric) AND ("seller_payout_amount" >= (0)::numeric) AND (COALESCE("vat_amount", (0)::numeric) >= (0)::numeric) AND (COALESCE("platform_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("service_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("delivery_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("platform_revenue", (0)::numeric) >= (0)::numeric)));



CREATE POLICY "Users can add items to their own cart" ON "public"."cart_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create chat rooms" ON "public"."chat_rooms" FOR INSERT WITH CHECK ((("seller_id" = "auth"."uid"()) OR ("admin_id" = "auth"."uid"())));



CREATE POLICY "Users can create chat rooms they are part of" ON "public"."chat_rooms" FOR INSERT WITH CHECK ((("seller_id" = "auth"."uid"()) OR ("admin_id" = "auth"."uid"()) OR ("customer_id" = "auth"."uid"())));



CREATE POLICY "Users can create gift purchases" ON "public"."gift_purchases" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create orders" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create shared carts" ON "public"."shared_carts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create split payments" ON "public"."split_payment_groups" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create their own likes" ON "public"."likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own ratings" ON "public"."ratings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own subscription orders" ON "public"."subscription_orders" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own cart items" ON "public"."cart_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own likes" ON "public"."likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own payment settings" ON "public"."payment_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own ratings" ON "public"."ratings" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own saved items" ON "public"."saved_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own telegram links" ON "public"."telegram_users" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can delete their own wishlist items" ON "public"."wishlist" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own withdrawals" ON "public"."platform_withdrawals" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert messages in their chat rooms" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("room_id" IN ( SELECT "chat_rooms"."id"
   FROM "public"."chat_rooms"
  WHERE (("chat_rooms"."seller_id" = "auth"."uid"()) OR ("chat_rooms"."admin_id" = "auth"."uid"()) OR ("chat_rooms"."customer_id" = "auth"."uid"())))) AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "Users can insert orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own status" ON "public"."user_chat_status" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own client logs" ON "public"."client_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own data" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own payment settings" ON "public"."payment_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own saved items" ON "public"."saved_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own telegram links" ON "public"."telegram_users" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can insert their own temporary orders" ON "public"."temporary_orders" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own tutorial progress" ON "public"."seller_tutorials" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own verification" ON "public"."seller_verification" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own wishlist items" ON "public"."wishlist" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own withdrawals" ON "public"."platform_withdrawals" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert transactions" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert valid orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((("quantity" > 0) AND ("total_price" >= (0)::numeric) AND (COALESCE("platform_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("service_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("ethiopia_tax", (0)::numeric) >= (0)::numeric) AND (COALESCE("delivery_fee", (0)::numeric) >= (0)::numeric) AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can join split payments" ON "public"."split_payment_participants" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can manage their own chat status" ON "public"."user_chat_status" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can only set role to customer or owner" ON "public"."users" USING (
CASE
    WHEN ("auth"."uid"() = "id") THEN ("role" = ANY (ARRAY['customer'::"text", 'owner'::"text"]))
    ELSE true
END) WITH CHECK (
CASE
    WHEN ("auth"."uid"() = "id") THEN ("role" = ANY (ARRAY['customer'::"text", 'owner'::"text"]))
    ELSE true
END);



CREATE POLICY "Users can update chat rooms they are part of" ON "public"."chat_rooms" FOR UPDATE USING ((("seller_id" = "auth"."uid"()) OR ("admin_id" = "auth"."uid"()) OR ("customer_id" = "auth"."uid"())));



CREATE POLICY "Users can update gift purchases they created" ON "public"."gift_purchases" FOR UPDATE USING (("purchaser_id" = "auth"."uid"()));



CREATE POLICY "Users can update own status" ON "public"."user_chat_status" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update split payments they created" ON "public"."split_payment_groups" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update their own cart items" ON "public"."cart_items" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own data" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own messages" ON "public"."chat_messages" FOR UPDATE USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own orders" ON "public"."orders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own participation" ON "public"."split_payment_participants" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own payment settings" ON "public"."payment_settings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update their own ratings" ON "public"."ratings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own saved items" ON "public"."saved_items" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own shared carts" ON "public"."shared_carts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own subscription orders" ON "public"."subscription_orders" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own telegram links" ON "public"."telegram_users" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can update their own tutorial progress" ON "public"."seller_tutorials" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own verification" ON "public"."seller_verification" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own withdrawals" ON "public"."platform_withdrawals" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their valid orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("quantity" > 0) AND ("total_price" >= (0)::numeric) AND (COALESCE("platform_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("service_fee", (0)::numeric) >= (0)::numeric) AND (COALESCE("ethiopia_tax", (0)::numeric) >= (0)::numeric) AND (COALESCE("delivery_fee", (0)::numeric) >= (0)::numeric)));



CREATE POLICY "Users can view all chat statuses" ON "public"."user_chat_status" FOR SELECT USING (true);



CREATE POLICY "Users can view all statuses" ON "public"."user_chat_status" FOR SELECT USING (true);



CREATE POLICY "Users can view chat rooms they are part of" ON "public"."chat_rooms" FOR SELECT USING ((("seller_id" = "auth"."uid"()) OR ("admin_id" = "auth"."uid"()) OR ("customer_id" = "auth"."uid"())));



CREATE POLICY "Users can view gift purchases they created or are recipients of" ON "public"."gift_purchases" FOR SELECT USING ((("purchaser_id" = "auth"."uid"()) OR ("recipient_id" = "auth"."uid"()) OR ("purchaser_email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



CREATE POLICY "Users can view messages in their chat rooms" ON "public"."chat_messages" FOR SELECT USING (("room_id" IN ( SELECT "chat_rooms"."id"
   FROM "public"."chat_rooms"
  WHERE (("chat_rooms"."seller_id" = "auth"."uid"()) OR ("chat_rooms"."admin_id" = "auth"."uid"()) OR ("chat_rooms"."customer_id" = "auth"."uid"())))));



CREATE POLICY "Users can view participants of their split payments" ON "public"."split_payment_participants" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."split_payment_groups"
  WHERE (("split_payment_groups"."id" = "split_payment_participants"."split_payment_id") AND ("split_payment_groups"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Users can view split payments they created or participate in" ON "public"."split_payment_groups" FOR SELECT USING ((("auth"."uid"() = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."split_payment_participants"
  WHERE (("split_payment_participants"."split_payment_id" = "split_payment_participants"."id") AND ("split_payment_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own cart items" ON "public"."cart_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own client logs" ON "public"."client_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own data" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own notifications" ON "public"."telegram_notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own orders" ON "public"."orders" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Users can view their own payment settings" ON "public"."payment_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own saved items" ON "public"."saved_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own shared carts" ON "public"."shared_carts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription orders" ON "public"."subscription_orders" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own telegram links" ON "public"."telegram_users" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can view their own temporary orders" ON "public"."temporary_orders" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tickets" ON "public"."support_tickets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING ((("seller_id" = "auth"."uid"()) OR ("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own tutorial progress" ON "public"."seller_tutorials" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own verification" ON "public"."seller_verification" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own wishlist items" ON "public"."wishlist" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own withdrawals" ON "public"."platform_withdrawals" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users cannot set themselves as admin" ON "public"."users" USING (
CASE
    WHEN ("auth"."uid"() = "id") THEN (COALESCE("is_admin", false) = false)
    ELSE true
END) WITH CHECK (
CASE
    WHEN ("auth"."uid"() = "id") THEN (COALESCE("is_admin", false) = false)
    ELSE true
END);



CREATE POLICY "admin_all_transactions" ON "public"."transactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role" = 'admin'::"text") OR ("users"."is_admin" = true))))));



ALTER TABLE "public"."admin_payment_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_payment_settings_policy" ON "public"."admin_payment_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role" = 'admin'::"text") OR ("users"."is_admin" = true))))));



CREATE POLICY "admin_select_policy" ON "public"."users" FOR SELECT TO "authenticated" USING ((("current_setting"('app.current_user_is_admin'::"text", true))::boolean = true));



ALTER TABLE "public"."admin_telegram_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_update_policy" ON "public"."users" FOR UPDATE TO "authenticated" USING ((("current_setting"('app.current_user_is_admin'::"text", true))::boolean = true));



ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_access_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flash_sale_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flash_sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gift_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gift_wrapping_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_withdrawals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read_basic_info_policy" ON "public"."users" FOR SELECT USING (true);



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seller_own_transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("seller_id" = "auth"."uid"()));



ALTER TABLE "public"."seller_tutorials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_verification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_carts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_payment_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_payment_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temporary_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_chat_status" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_self_update_policy" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "user_self_view_policy" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlist" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."likes";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";









































































































































































































GRANT ALL ON FUNCTION "public"."add_to_cart"("p_user_id" "uuid", "p_product_id" "uuid", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_to_cart"("p_user_id" "uuid", "p_product_id" "uuid", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_to_cart"("p_user_id" "uuid", "p_product_id" "uuid", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_to_queue"("conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_to_queue"("conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_to_queue"("conv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_assign_conversation"("conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auto_assign_conversation"("conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_assign_conversation"("conv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_generate_product_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_product_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_product_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_user_storage_usage"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_user_storage_usage"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_user_storage_usage"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_wait_time"("conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_wait_time"("conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_wait_time"("conv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_transaction_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_transaction_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_transaction_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_gift_purchases"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_gift_purchases"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_gift_purchases"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_shared_carts"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_shared_carts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_shared_carts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_temporary_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_temporary_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_temporary_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_platform_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_platform_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_platform_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_support_chat_room"("customer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_support_chat_room"("customer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_support_chat_room"("customer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_full_name" "text", "user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_full_name" "text", "user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_full_name" "text", "user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."distribute_payment"("p_order_id" "uuid", "p_seller_amount" numeric, "p_platform_fee" numeric, "p_service_fee" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."distribute_payment"("p_order_id" "uuid", "p_seller_amount" numeric, "p_platform_fee" numeric, "p_service_fee" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."distribute_payment"("p_order_id" "uuid", "p_seller_amount" numeric, "p_platform_fee" numeric, "p_service_fee" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_unique_product_slug"("base_slug" "text", "product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_unique_product_slug"("base_slug" "text", "product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_unique_product_slug"("base_slug" "text", "product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_delivery_access_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_delivery_access_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_delivery_access_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_gift_purchase_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_gift_purchase_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_gift_purchase_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_product_slug"("title_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_product_slug"("title_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_product_slug"("title_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_share_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_share_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_share_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_advanced_analytics"("input_data" "json") TO "anon";
GRANT ALL ON FUNCTION "public"."get_advanced_analytics"("input_data" "json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_advanced_analytics"("input_data" "json") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_advanced_analytics"("p_user_id" "uuid", "time_range" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_advanced_analytics"("p_user_id" "uuid", "time_range" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_advanced_analytics"("p_user_id" "uuid", "time_range" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_basic_analytics"("input_data" "json") TO "anon";
GRANT ALL ON FUNCTION "public"."get_basic_analytics"("input_data" "json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_basic_analytics"("input_data" "json") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_basic_analytics"("p_user_id" "uuid", "time_range" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_basic_analytics"("p_user_id" "uuid", "time_range" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_basic_analytics"("p_user_id" "uuid", "time_range" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cart_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cart_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cart_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_featured_sellers"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_featured_sellers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_featured_sellers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_owner_orders"("owner_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_owner_orders"("owner_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_owner_orders"("owner_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_platform_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_platform_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_popular_products"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_popular_products"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_popular_products"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_with_owner"("p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_with_owner"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_with_owner"("p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_products_with_owners"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_products_with_owners"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_products_with_owners"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_seller_storage_info"("seller_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_seller_storage_info"("seller_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_seller_storage_info"("seller_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_message_count"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_message_count"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_message_count"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_url"("url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_url"("url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_url"("url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_messages_read"("conv_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_messages_read"("conv_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_messages_read"("conv_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_messages_as_read"("room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_messages_as_read"("room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_messages_as_read"("room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_admin_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_admin_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_admin_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_inactive_users_offline"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_inactive_users_offline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_inactive_users_offline"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_auto_assign"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_auto_assign"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_auto_assign"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_admin_payment_settings_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_admin_payment_settings_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_admin_payment_settings_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_room_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_room_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_room_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_preview"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_preview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_preview"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_delivery_statuses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_delivery_statuses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_delivery_statuses_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_settings_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_settings_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_settings_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pickup_code_verified_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pickup_code_verified_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pickup_code_verified_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_quantity"("p_product_id" "uuid", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_quantity"("p_product_id" "uuid", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_quantity"("p_product_id" "uuid", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_seller_tutorials_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_seller_tutorials_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_seller_tutorials_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subscription_status"("p_tx_ref" "text", "p_transaction_reference" "text", "p_user_id" "uuid", "p_plan_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_subscription_status"("p_tx_ref" "text", "p_transaction_reference" "text", "p_user_id" "uuid", "p_plan_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subscription_status"("p_tx_ref" "text", "p_transaction_reference" "text", "p_user_id" "uuid", "p_plan_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_availability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_last_seen"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_last_seen"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_last_seen"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_verification_status"("p_is_verified" boolean, "p_new_status" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_verification_status"("p_is_verified" boolean, "p_new_status" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_verification_status"("p_is_verified" boolean, "p_new_status" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_payment_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_payment_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_payment_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_transaction"() TO "service_role";
























GRANT ALL ON TABLE "public"."admin_payment_settings" TO "anon";
GRANT ALL ON TABLE "public"."admin_payment_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_payment_settings" TO "service_role";



GRANT ALL ON TABLE "public"."admin_telegram_settings" TO "anon";
GRANT ALL ON TABLE "public"."admin_telegram_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_telegram_settings" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."client_logs" TO "anon";
GRANT ALL ON TABLE "public"."client_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."client_logs" TO "service_role";



GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT ALL ON TABLE "public"."custom_categories" TO "anon";
GRANT ALL ON TABLE "public"."custom_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_categories" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_access_tokens" TO "anon";
GRANT ALL ON TABLE "public"."delivery_access_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_access_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_accounts" TO "anon";
GRANT ALL ON TABLE "public"."delivery_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_statuses" TO "anon";
GRANT ALL ON TABLE "public"."delivery_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_tracking" TO "anon";
GRANT ALL ON TABLE "public"."delivery_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."email_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."email_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."email_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."email_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."email_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."flash_sale_products" TO "anon";
GRANT ALL ON TABLE "public"."flash_sale_products" TO "authenticated";
GRANT ALL ON TABLE "public"."flash_sale_products" TO "service_role";



GRANT ALL ON TABLE "public"."flash_sales" TO "anon";
GRANT ALL ON TABLE "public"."flash_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."flash_sales" TO "service_role";



GRANT ALL ON TABLE "public"."gift_purchases" TO "anon";
GRANT ALL ON TABLE "public"."gift_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."gift_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."gift_wrapping_options" TO "anon";
GRANT ALL ON TABLE "public"."gift_wrapping_options" TO "authenticated";
GRANT ALL ON TABLE "public"."gift_wrapping_options" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payment_settings" TO "anon";
GRANT ALL ON TABLE "public"."payment_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_settings" TO "service_role";



GRANT ALL ON TABLE "public"."platform_withdrawals" TO "anon";
GRANT ALL ON TABLE "public"."platform_withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_withdrawals" TO "service_role";



GRANT ALL ON TABLE "public"."product_images" TO "anon";
GRANT ALL ON TABLE "public"."product_images" TO "authenticated";
GRANT ALL ON TABLE "public"."product_images" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."seller_verification" TO "anon";
GRANT ALL ON TABLE "public"."seller_verification" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_verification" TO "service_role";



GRANT ALL ON TABLE "public"."public_business_names" TO "anon";
GRANT ALL ON TABLE "public"."public_business_names" TO "authenticated";
GRANT ALL ON TABLE "public"."public_business_names" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."saved_items" TO "anon";
GRANT ALL ON TABLE "public"."saved_items" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_items" TO "service_role";



GRANT ALL ON TABLE "public"."seller_tutorials" TO "anon";
GRANT ALL ON TABLE "public"."seller_tutorials" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_tutorials" TO "service_role";



GRANT ALL ON TABLE "public"."shared_carts" TO "anon";
GRANT ALL ON TABLE "public"."shared_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_carts" TO "service_role";



GRANT ALL ON TABLE "public"."split_payment_groups" TO "anon";
GRANT ALL ON TABLE "public"."split_payment_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."split_payment_groups" TO "service_role";



GRANT ALL ON TABLE "public"."split_payment_participants" TO "anon";
GRANT ALL ON TABLE "public"."split_payment_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."split_payment_participants" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_orders" TO "anon";
GRANT ALL ON TABLE "public"."subscription_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_orders" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_notifications" TO "anon";
GRANT ALL ON TABLE "public"."telegram_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_users" TO "anon";
GRANT ALL ON TABLE "public"."telegram_users" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_users" TO "service_role";



GRANT ALL ON TABLE "public"."temporary_orders" TO "anon";
GRANT ALL ON TABLE "public"."temporary_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."temporary_orders" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_chat_status" TO "anon";
GRANT ALL ON TABLE "public"."user_chat_status" TO "authenticated";
GRANT ALL ON TABLE "public"."user_chat_status" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."users" TO "anon";
GRANT SELECT("id") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("full_name") ON TABLE "public"."users" TO "anon";
GRANT SELECT("full_name") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("email") ON TABLE "public"."users" TO "anon";
GRANT SELECT("email") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."users" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("subscription_plan") ON TABLE "public"."users" TO "anon";
GRANT SELECT("subscription_plan") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("store_settings") ON TABLE "public"."users" TO "anon";
GRANT SELECT("store_settings") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("is_verified") ON TABLE "public"."users" TO "anon";
GRANT SELECT("is_verified") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("verification_status") ON TABLE "public"."users" TO "anon";
GRANT SELECT("verification_status") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("phone") ON TABLE "public"."users" TO "anon";
GRANT SELECT("phone") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("phone_verified") ON TABLE "public"."users" TO "anon";
GRANT SELECT("phone_verified") ON TABLE "public"."users" TO "authenticated";



GRANT ALL ON TABLE "public"."users_with_payment_settings" TO "anon";
GRANT ALL ON TABLE "public"."users_with_payment_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."users_with_payment_settings" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist" TO "anon";
GRANT ALL ON TABLE "public"."wishlist" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























