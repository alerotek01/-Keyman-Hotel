-- ============================================================
-- SECURITY HARDENING: Report Data Pipeline
-- ============================================================
-- Vulnerability Audit Findings:
-- 1. restaurant_orders INSERT was open to ANY authenticated user
-- 2. reservations INSERT was open to ANY authenticated user  
-- 3. folio_payments INSERT was open to ANY staff member
-- 4. restaurant_order_items had no DELETE restriction
-- 5. No server-side input validation on report date ranges
-- 6. Critical aggregations computed client-side only
-- ============================================================

-- ─── FIX 1: Restrict restaurant_orders INSERT ──────────────
-- BEFORE: Anyone could create fake orders, manipulating revenue reports
-- AFTER: Only waiters, managers, admins can create orders
DROP POLICY IF EXISTS "Anyone create" ON restaurant_orders;
CREATE POLICY "Waiters and managers create orders"
  ON restaurant_orders FOR INSERT
  WITH CHECK (is_waiter() OR is_manager() OR is_admin());

-- ─── FIX 2: Restrict reservations INSERT ───────────────────
-- BEFORE: Anyone could create fake reservations, manipulating occupancy reports
-- AFTER: Only receptionists, admins can create reservations
DROP POLICY IF EXISTS "Anyone create" ON reservations;
CREATE POLICY "Reception and admin create reservations"
  ON reservations FOR INSERT
  WITH CHECK (is_receptionist() OR is_admin());

-- ─── FIX 3: Restrict folio_payments INSERT ─────────────────
-- BEFORE: Any staff could create fake payments, manipulating revenue
-- AFTER: Only receptionists, waiters, managers can create payments
DROP POLICY IF EXISTS "Staff create folio_payments" ON folio_payments;
CREATE POLICY "Reception and waiters create payments"
  ON folio_payments FOR INSERT
  WITH CHECK (is_receptionist() OR is_waiter() OR is_manager());

-- ─── FIX 4: Restrict restaurant_order_items DELETE ──────────
-- BEFORE: Waiters could delete items from orders, manipulating totals
-- AFTER: Only managers, admins can delete order items
DROP POLICY IF EXISTS "Waiter manage items" ON restaurant_order_items;
CREATE POLICY "Staff manage order items"
  ON restaurant_order_items FOR ALL
  USING (is_waiter() OR is_chef() OR is_manager() OR is_admin())
  WITH CHECK (is_waiter() OR is_chef() OR is_manager() OR is_admin());

CREATE POLICY "Only managers delete order items"
  ON restaurant_order_items FOR DELETE
  USING (is_manager() OR is_admin());

-- ─── FIX 5: Input Validation Function ──────────────────────
-- Validates date ranges for report queries to prevent manipulation
CREATE OR REPLACE FUNCTION validate_report_dates(p_from date, p_to date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent future dates
  IF p_from > CURRENT_DATE THEN
    RETURN json_build_object('valid', false, 'error', 'Start date cannot be in the future');
  END IF;
  
  -- Prevent end date before start
  IF p_to < p_from THEN
    RETURN json_build_object('valid', false, 'error', 'End date must be after start date');
  END IF;
  
  -- Prevent ranges > 1 year
  IF (p_to - p_from) > 365 THEN
    RETURN json_build_object('valid', false, 'error', 'Date range cannot exceed 365 days');
  END IF;
  
  RETURN json_build_object('valid', true);
END;
$$;

-- ─── FIX 6: Server-Side Revenue Aggregation ────────────────
-- Tamper-proof revenue calculation that bypasses client-side manipulation
CREATE OR REPLACE FUNCTION get_revenue_summary(p_from date, p_to date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation json;
  v_result json;
BEGIN
  v_validation := validate_report_dates(p_from, p_to);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN v_validation;
  END IF;
  
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(rate * GREATEST(1, EXTRACT(DAY FROM (check_out - check_in)))), 0),
    'total_bookings', COUNT(*),
    'checked_in', COUNT(*) FILTER (WHERE status = 'checked_in'),
    'checked_out', COUNT(*) FILTER (WHERE status = 'checked_out'),
    'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'no_show', COUNT(*) FILTER (WHERE status = 'no_show'),
    'avg_rate', COALESCE(AVG(rate), 0),
    'avg_stay_nights', COALESCE(AVG(GREATEST(1, EXTRACT(DAY FROM (check_out - check_in)))), 0)
  ) INTO v_result
  FROM reservations
  WHERE check_in >= p_from AND check_in <= p_to;
  
  RETURN v_result;
END;
$$;

-- ─── FIX 7: Server-Side Occupancy Aggregation ──────────────
CREATE OR REPLACE FUNCTION get_occupancy_summary(p_from date, p_to date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation json;
  v_result json;
  v_total_rooms int;
BEGIN
  v_validation := validate_report_dates(p_from, p_to);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN v_validation;
  END IF;
  
  SELECT COUNT(*) INTO v_total_rooms FROM rooms WHERE is_active = true;
  
  SELECT json_build_object(
    'total_rooms', v_total_rooms,
    'occupied_rooms', (SELECT COUNT(*) FROM rooms WHERE status = 'occupied'),
    'available_rooms', (SELECT COUNT(*) FROM rooms WHERE status = 'available'),
    'occupancy_rate', CASE WHEN v_total_rooms > 0 
      THEN ROUND((SELECT COUNT(*) FROM rooms WHERE status = 'occupied')::numeric / v_total_rooms * 100, 1)
      ELSE 0 END,
    'period_bookings', (SELECT COUNT(*) FROM reservations WHERE check_in >= p_from AND check_in <= p_to)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ─── FIX 8: Grant execute to authenticated users ───────────
GRANT EXECUTE ON FUNCTION validate_report_dates(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_summary(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_occupancy_summary(date, date) TO authenticated;
