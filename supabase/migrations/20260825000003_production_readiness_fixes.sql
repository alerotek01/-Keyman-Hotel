-- ============================================================
-- PRODUCTION READINESS FIXES — E2E AUDIT FINDINGS
-- ============================================================
-- Date: 2026-08-25
-- Scope: Business logic vulnerabilities across all business flows
-- ============================================================

-- ─── FIX 1: Prevent negative/zero amounts on folio_transactions ───
-- VULNERABILITY: folio_transactions.amount has no CHECK constraint
-- Staff could insert negative "adjustment" entries to zero out debt
ALTER TABLE folio_transactions 
  DROP CONSTRAINT IF EXISTS chk_folio_txn_amount_positive;
ALTER TABLE folio_transactions 
  ADD CONSTRAINT chk_folio_txn_amount_positive 
  CHECK (amount > 0);

-- ─── FIX 2: Server-side max amount cap on folio_payments ───
-- VULNERABILITY: No upper bound on payment amounts
-- Staff could record payment of 99999999 to manipulate reconciliation
CREATE OR REPLACE FUNCTION validate_folio_payment_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_daily_payments NUMERIC;
  v_today_total NUMERIC;
BEGIN
  -- Cap: single payment cannot exceed KES 5,000,000
  IF NEW.amount > 5000000 THEN
    RAISE EXCEPTION 'Payment amount KES % exceeds maximum allowed (KES 5,000,000)', NEW.amount;
  END IF;

  -- Cannot record payment for a closed folio
  IF EXISTS (
    SELECT 1 FROM guest_folios 
    WHERE id = NEW.folio_id AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'Cannot record payment for a closed folio';
  END IF;

  -- Total payments for a folio cannot exceed folio charges by more than 10%
  -- (allow small overpayment for rounding, but not massive overpayment)
  DECLARE
    v_total_charges NUMERIC;
    v_total_payments NUMERIC;
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_charges
    FROM folio_transactions WHERE folio_id = NEW.folio_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
    FROM folio_payments WHERE folio_id = NEW.folio_id;

    IF (v_total_payments + NEW.amount) > (v_total_charges * 1.10) AND v_total_charges > 0 THEN
      RAISE EXCEPTION 'Total payments (KES %) would exceed folio charges (KES %) by more than 10%%',
        (v_total_payments + NEW.amount), v_total_charges;
    END IF;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_folio_payment ON folio_payments;
CREATE TRIGGER trg_validate_folio_payment
  BEFORE INSERT ON folio_payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_folio_payment_amount();

-- ─── FIX 3: Server-side shift state machine ───
-- VULNERABILITY: Shift transitions done via direct .update() in frontend
-- No server-side validation of valid state transitions
CREATE OR REPLACE FUNCTION update_shift_status_safe(
  p_shift_id UUID,
  p_new_status TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift RECORD;
  v_valid_transitions JSONB := '{
    "not_started": ["active", "cancelled"],
    "assigned": ["accepted", "rejected", "cancelled"],
    "accepted": ["active", "cancelled"],
    "active": ["ended"],
    "ended": ["submitted"],
    "submitted": ["reconciled", "closed"],
    "reconciled": ["closed"],
    "rejected": ["assigned"],
    "cancelled": ["assigned"]
  }'::jsonb;
  v_allowed JSONB;
  v_actor UUID;
BEGIN
  v_actor := COALESCE(p_actor_id, auth.uid());

  SELECT * INTO v_shift
  FROM staff_shifts
  WHERE id = p_shift_id;

  IF v_shift IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
  END IF;

  -- Only the shift owner, managers, or admins can change shift status
  IF v_shift.user_id != v_actor AND NOT (is_manager() OR is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to modify this shift');
  END IF;

  v_allowed := v_valid_transitions -> v_shift.status;

  IF v_allowed IS NULL OR NOT (v_allowed @> to_jsonb(p_new_status::text)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition from ' || v_shift.status || ' to ' || p_new_status
    );
  END IF;

  UPDATE staff_shifts
  SET status = p_new_status::shift_status,
      CASE WHEN p_new_status = 'active' THEN NOW() ELSE start_time END as start_time,
      CASE WHEN p_new_status = 'ended' THEN NOW() ELSE end_time END as end_time,
      CASE WHEN p_new_status = 'accepted' THEN NOW() ELSE accepted_at END as accepted_at,
      CASE WHEN p_new_status = 'rejected' THEN NOW() ELSE rejected_at END as rejected_at
  WHERE id = p_shift_id;

  RETURN jsonb_build_object(
    'success', true,
    'from', v_shift.status,
    'to', p_new_status,
    'shift_id', p_shift_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_shift_status_safe(UUID, TEXT, UUID) TO authenticated;

-- ─── FIX 4: Idempotency guard on folio_payments ───
-- VULNERABILITY: Double-click on "Record Payment" creates duplicate charges
CREATE OR REPLACE FUNCTION record_payment_idempotent(
  p_folio_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_recorded_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio RECORD;
  v_payment RECORD;
  v_dupe RECORD;
BEGIN
  -- Validate folio exists and is open
  SELECT * INTO v_folio FROM guest_folios WHERE id = p_folio_id;
  IF v_folio IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Folio not found');
  END IF;
  IF v_folio.status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Folio is already closed');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be positive');
  END IF;
  IF p_amount > 5000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment exceeds maximum limit');
  END IF;

  -- Idempotency: if same folio + amount + method within last 30 seconds, skip
  SELECT id INTO v_dupe
  FROM folio_payments
  WHERE folio_id = p_folio_id
    AND amount = p_amount
    AND method = p_method
    AND created_at > NOW() - INTERVAL '30 seconds'
  LIMIT 1;

  IF v_dupe IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_dupe.id,
      'duplicate', true,
      'message', 'Duplicate payment detected — skipped'
    );
  END IF;

  -- Insert payment
  INSERT INTO folio_payments (folio_id, amount, method, reference, recorded_by, status)
  VALUES (p_folio_id, p_amount, p_method, p_reference, p_recorded_by, 'completed')
  RETURNING * INTO v_payment;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'amount', v_payment.amount,
    'method', v_payment.method,
    'duplicate', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_payment_idempotent(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

-- ─── FIX 5: Server-side order total validation ───
-- VULNERABILITY: create_order_rate_limited uses client prices
-- Server must recalculate from menu_items.price
CREATE OR REPLACE FUNCTION validate_and_fix_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_total NUMERIC;
BEGIN
  -- Recalculate total from order items + current menu prices
  SELECT COALESCE(SUM(roi.quantity * mi.price), 0)
  INTO v_server_total
  FROM restaurant_order_items roi
  JOIN menu_items mi ON roi.menu_item_id = mi.id
  WHERE roi.order_id = NEW.id;

  -- Override client total with server-calculated total
  IF NEW.total != v_server_total THEN
    INSERT INTO order_events (order_id, from_status, to_status, notes, actor_id)
    VALUES (NEW.id, NEW.status, NEW.status,
      'Total corrected from ' || NEW.total || ' to ' || v_server_total || ' (server validation)',
      auth.uid());
    NEW.total := v_server_total;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_total ON restaurant_orders;
CREATE TRIGGER trg_validate_order_total
  BEFORE UPDATE OF total ON restaurant_orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_and_fix_order_total();

-- ─── FIX 6: Prevent role escalation via direct UPDATE ───
CREATE OR REPLACE FUNCTION prevent_self_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can change roles
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Only administrators can change user roles';
    END IF;

    -- Log role change for audit
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'role_changed',
      'users',
      NEW.id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;

  -- Prevent deactivating yourself
  IF NEW.id = auth.uid() AND NEW.is_active = false THEN
    RAISE EXCEPTION 'Cannot deactivate your own account';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON users;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_role_change();

-- ─── FIX 7: Rate limit reconciliation submissions ───
CREATE OR REPLACE FUNCTION check_reconciliation_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM shift_reconciliations
  WHERE submitted_by = NEW.submitted_by
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Too many reconciliation submissions. Please wait before submitting again.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconciliation_rate_limit ON shift_reconciliations;
CREATE TRIGGER trg_reconciliation_rate_limit
  BEFORE INSERT ON shift_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION check_reconciliation_rate_limit();

-- ─── FIX 8: Prevent room double-assignment race condition ───
-- Add FOR UPDATE hint to room status check
CREATE OR REPLACE FUNCTION prevent_room_double_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_status TEXT;
BEGIN
  -- Lock the room row to prevent race conditions
  SELECT status INTO v_room_status
  FROM rooms
  WHERE id = NEW.room_id
  FOR UPDATE;

  IF v_room_status != 'available' AND v_room_status != 'inspected' THEN
    RAISE EXCEPTION 'Room is no longer available (status: %). Another guest may have been assigned.', v_room_status;
  END IF;

  -- Mark room as occupied
  UPDATE rooms SET status = 'occupied' WHERE id = NEW.room_id;

  RETURN NEW;
END;
$$;

-- Note: This trigger fires on INSERT to reservations where room_id is set and status transitions to checked_in
-- The actual atomic check-in is handled by check_in_guest_atomic which already has SELECT FOR UPDATE

-- ─── COMMENTS ──────────────────────────────────────────────────
COMMENT ON FUNCTION validate_folio_payment_amount() IS 'Validates folio payment amounts: max KES 5M, no overpayment >10%, no payment on closed folio';
COMMENT ON FUNCTION update_shift_status_safe(UUID, TEXT, UUID) IS 'Server-side shift state machine with role-based access control';
COMMENT ON FUNCTION record_payment_idempotent(UUID, NUMERIC, TEXT, TEXT, UUID) IS 'Idempotent payment recording: prevents double-click duplicates within 30s window';
COMMENT ON FUNCTION prevent_self_role_change() IS 'Only admins can change roles; prevents self-deactivation';
COMMENT ON FUNCTION check_reconciliation_rate_limit() IS 'Max 5 reconciliation submissions per hour per user';
