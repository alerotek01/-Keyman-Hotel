-- ============================================================
-- COMPREHENSIVE SECURITY AUDIT — ALL PIPELINES
-- ============================================================
-- Audit Date: 2026-08-24
-- Scope: Guest, Waiter, Chef, Receptionist, Housekeeper, Manager, Admin
-- Method: Business Logic Vulnerability Playbook (Section 11)
-- ============================================================

-- ─── AUDIT FINDINGS ────────────────────────────────────────
--
-- CRITICAL (Revenue/Data Manipulation):
-- 1. site_content: ALL operations open to ANY user → site content tampered
-- 2. otp_codes: ALL operations open → OTP codes readable/modifiable
-- 3. guests: Public SELECT → guest PII exposed
-- 4. notifications: INSERT open → fake notifications for any user
-- 5. staff_shifts: INSERT claims "staff and managers" but policy has no role check
-- 6. messages: INSERT has no sender_id validation → message impersonation
-- 7. order_events: INSERT has no actor validation → fake order events
-- 8. booking_payments: Duplicate INSERT policies, both open
-- 9. folio_payments: INSERT open after previous fix
-- 10. conference_bookings: INSERT fully open
--
-- HIGH (Workflow Bypass):
-- 11. No rate limiting on OTP generation (SMS bombing possible)
-- 12. No idempotency on payment creation (double-charge possible)
-- 13. Restaurant order total calculated client-side (price manipulation)
-- 14. No server-side validation on reconciliation variance values
--
-- MEDIUM (Information Disclosure):
-- 15. Guest lookup by name/email possible without auth
-- 16. Staff table has weak RLS (all operations open)
--
-- ============================================================

-- ─── FIX 1: site_content — admin-only management ───────────
DROP POLICY IF EXISTS "site_content_all" ON site_content;
CREATE POLICY "Admins manage site_content"
  ON site_content FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── FIX 2: otp_codes — service role only ──────────────────
DROP POLICY IF EXISTS "otp_all" ON otp_codes;
CREATE POLICY "Service role only otp"
  ON otp_codes FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- ─── FIX 3: guests — remove public lookup ──────────────────
DROP POLICY IF EXISTS "Public can lookup guests" ON guests;
CREATE POLICY "Staff view guests"
  ON guests FOR SELECT
  USING (is_receptionist() OR is_manager() OR is_admin());

-- ─── FIX 4: notifications — service role INSERT only ───────
DROP POLICY IF EXISTS "Anyone create notifications" ON notifications;
CREATE POLICY "Service role create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role'::text);

-- ─── FIX 5: conference_bookings — authenticated only ───────
DROP POLICY IF EXISTS "cb_insert" ON conference_bookings;
CREATE POLICY "Authenticated create conference"
  ON conference_bookings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'::text);

-- ─── FIX 6: staff_shifts — managers only create ────────────
DROP POLICY IF EXISTS "Staff and managers can create shifts" ON staff_shifts;
CREATE POLICY "Managers create shifts"
  ON staff_shifts FOR INSERT
  WITH CHECK (is_manager() OR is_admin());

-- ─── FIX 7: messages — sender_id validation ────────────────
DROP POLICY IF EXISTS "Channel members can post messages" ON messages;
CREATE POLICY "Members post messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_id = messages.channel_id
      AND user_id = auth.uid()
    )
  );

-- ─── FIX 8: booking_payments — remove duplicate open policy ─
DROP POLICY IF EXISTS "bps_insert" ON booking_payments;

-- ─── FIX 9: order_events — actor validation ────────────────
DROP POLICY IF EXISTS "Waiter/chef create events" ON order_events;
CREATE POLICY "Staff create events"
  ON order_events FOR INSERT
  WITH CHECK (actor_id = auth.uid() AND is_staff());

-- ─── FIX 10: folio_payments — authenticated only ───────────
DROP POLICY IF EXISTS "Reception and waiters create payments" ON folio_payments;
CREATE POLICY "Authenticated create folio_payments"
  ON folio_payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'::text);

-- ─── FIX 11: Rate limit OTP generation ─────────────────────
CREATE OR REPLACE FUNCTION check_otp_rate_limit(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM otp_codes
  WHERE phone = p_phone
    AND created_at > NOW() - INTERVAL '5 minutes';
  
  -- Max 3 OTP requests per 5 minutes per phone
  RETURN v_count < 3;
END;
$$;

-- ─── FIX 12: Server-side order total validation ────────────
CREATE OR REPLACE FUNCTION validate_order_total(
  p_order_id uuid,
  p_client_total numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_server_total numeric;
  v_diff numeric;
BEGIN
  -- Calculate total server-side from order items + menu prices
  SELECT COALESCE(SUM(roi.quantity * mi.price), 0)
  INTO v_server_total
  FROM restaurant_order_items roi
  JOIN menu_items mi ON roi.menu_item_id = mi.id
  WHERE roi.order_id = p_order_id;
  
  -- Allow 1% tolerance for rounding
  v_diff := ABS(v_server_total - p_client_total);
  
  IF v_diff > (v_server_total * 0.01 + 1) THEN
    RETURN json_build_object(
      'valid', false,
      'server_total', v_server_total,
      'client_total', p_client_total,
      'difference', v_diff,
      'error', 'Order total mismatch — possible price manipulation'
    );
  END IF;
  
  RETURN json_build_object('valid', true, 'total', v_server_total);
END;
$$;

-- ─── FIX 13: Server-side reconciliation validation ─────────
CREATE OR REPLACE FUNCTION validate_reconciliation(
  p_shift_id uuid,
  p_actual_cash numeric,
  p_sales_total numeric,
  p_cash_total numeric,
  p_mpesa_total numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected_cash numeric;
  v_variance numeric;
BEGIN
  -- Calculate expected cash from payments table
  SELECT COALESCE(SUM(amount), 0)
  INTO v_expected_cash
  FROM payments
  WHERE recorded_by = (SELECT user_id FROM staff_shifts WHERE id = p_shift_id)
    AND method = 'cash'
    AND created_at::date = (SELECT shift_date FROM staff_shifts WHERE id = p_shift_id);
  
  -- Validate totals add up
  IF ABS((p_cash_total + p_mpesa_total) - p_sales_total) > 1 THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Cash + M-Pesa does not equal total sales'
    );
  END IF;
  
  -- Validate actual cash is non-negative
  IF p_actual_cash < 0 THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Actual cash cannot be negative'
    );
  END IF;
  
  v_variance := p_actual_cash - v_expected_cash;
  
  RETURN json_build_object(
    'valid', true,
    'expected_cash', v_expected_cash,
    'variance', v_variance
  );
END;
$$;

-- ─── Grant execute permissions ──────────────────────────────
GRANT EXECUTE ON FUNCTION check_otp_rate_limit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_order_total(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_reconciliation(uuid, numeric, numeric, numeric, numeric) TO authenticated;
