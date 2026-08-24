-- ============================================================
-- SERVER-SIDE RECONCILIATION VALIDATION
-- ============================================================
-- Business Logic Vulnerability Fix:
-- Previously, staff submitted sales_total, cash_total, mpesa_total
-- from the client. A malicious user could intercept and modify these
-- values via browser DevTools before submission.
--
-- Now: server recalculates all totals from actual transactions
-- in the database. Staff only submits actual_cash (what they're
-- physically holding) and notes. Everything else is computed.
-- ============================================================

-- Prevent duplicate active reconciliations per shift
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_one_per_shift
  ON shift_reconciliations (shift_id)
  WHERE status IN ('submitted', 'flagged');

-- The safe submission function
CREATE OR REPLACE FUNCTION submit_reconciliation_safe(
  p_shift_id UUID,
  p_actual_cash NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_variance_explanation TEXT DEFAULT NULL,
  p_variance_proof_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift RECORD;
  v_sales_total NUMERIC := 0;
  v_cash_total NUMERIC := 0;
  v_mpesa_total NUMERIC := 0;
  v_room_charges_total NUMERIC := 0;
  v_expected_cash NUMERIC := 0;
  v_variance NUMERIC;
  v_has_variance BOOLEAN;
  v_rec RECORD;
  v_actor_id UUID;
BEGIN
  -- Get the shift record
  SELECT * INTO v_shift
  FROM staff_shifts
  WHERE id = p_shift_id;

  IF v_shift IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
  END IF;

  -- Verify the caller owns this shift OR is a manager
  v_actor_id := auth.uid();
  IF v_shift.user_id != v_actor_id THEN
    IF NOT (is_manager() OR is_admin()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'You can only submit reconciliation for your own shift');
    END IF;
  END IF;

  -- Verify shift has ended (can't reconcile an active shift)
  IF v_shift.status NOT IN ('ended', 'submitted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift must be ended before submitting reconciliation');
  END IF;

  -- ─── RECALCULATE ALL TOTALS FROM ACTUAL TRANSACTIONS ───

  -- Sales total from restaurant orders (all statuses that represent real sales)
  SELECT COALESCE(SUM(total), 0) INTO v_sales_total
  FROM restaurant_orders
  WHERE status IN ('delivered', 'payment_submitted', 'payment_verified', 'reconciled')
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  -- Cash payments from folio_payments
  SELECT COALESCE(SUM(amount), 0) INTO v_cash_total
  FROM folio_payments
  WHERE method = 'cash'
    AND status = 'completed'
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  -- M-Pesa payments from folio_payments
  SELECT COALESCE(SUM(amount), 0) INTO v_mpesa_total
  FROM folio_payments
  WHERE method = 'mpesa'
    AND status = 'completed'
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  -- Room charges from payments table (waiter-recorded)
  SELECT COALESCE(SUM(amount), 0) INTO v_room_charges_total
  FROM payments
  WHERE recorded_by = v_shift.user_id
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  -- Expected cash = cash payments + room charges paid in cash
  v_expected_cash := v_cash_total + v_room_charges_total;

  -- Validate actual_cash is reasonable (not negative, not absurdly high)
  IF p_actual_cash < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actual cash cannot be negative');
  END IF;

  IF p_actual_cash > 10000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actual cash exceeds maximum limit');
  END IF;

  -- Calculate variance
  v_variance := p_actual_cash - v_expected_cash;
  v_has_variance := v_variance != 0;

  -- ─── INSERT RECONCILIATION WITH SERVER-COMPUTED VALUES ───
  INSERT INTO shift_reconciliations (
    shift_id,
    submitted_by,
    sales_total,
    cash_total,
    mpesa_total,
    room_charges_total,
    expected_cash,
    actual_cash,
    variance,
    notes,
    status,
    variance_status,
    variance_explanation,
    variance_proof_type
  ) VALUES (
    p_shift_id,
    v_actor_id,
    v_sales_total,
    v_cash_total,
    v_mpesa_total,
    v_room_charges_total,
    v_expected_cash,
    p_actual_cash,
    v_variance,
    p_notes,
    'submitted',
    CASE WHEN v_has_variance THEN 'open' ELSE 'none' END,
    CASE WHEN v_has_variance THEN p_variance_explanation END,
    CASE WHEN v_has_variance THEN p_variance_proof_type END
  )
  RETURNING * INTO v_rec;

  -- Update shift status
  UPDATE staff_shifts SET status = 'submitted' WHERE id = p_shift_id;

  RETURN jsonb_build_object(
    'success', true,
    'reconciliation_id', v_rec.id,
    'sales_total', v_sales_total,
    'cash_total', v_cash_total,
    'mpesa_total', v_mpesa_total,
    'expected_cash', v_expected_cash,
    'actual_cash', p_actual_cash,
    'variance', v_variance
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION submit_reconciliation_safe(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION submit_reconciliation_safe IS 'Server-validated reconciliation submission. Recalculates totals from actual transactions to prevent client-side tampering.';
