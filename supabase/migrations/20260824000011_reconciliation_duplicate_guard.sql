-- Update submit_reconciliation_safe to check for existing reconciliation first
-- and return a friendly error message instead of raw DB constraint violation

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
  v_existing RECORD;
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

  -- Verify shift has ended
  IF v_shift.status NOT IN ('ended', 'submitted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift must be ended before submitting reconciliation');
  END IF;

  -- Check for existing active reconciliation (graceful duplicate guard)
  SELECT id, status INTO v_existing
  FROM shift_reconciliations
  WHERE shift_id = p_shift_id
    AND status IN ('submitted', 'flagged');

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A reconciliation has already been submitted for this shift. You cannot submit another one until it is reviewed.',
      'existing_id', v_existing.id,
      'existing_status', v_existing.status
    );
  END IF;

  -- ─── RECALCULATE ALL TOTALS FROM ACTUAL TRANSACTIONS ───

  SELECT COALESCE(SUM(total), 0) INTO v_sales_total
  FROM restaurant_orders
  WHERE status IN ('delivered', 'payment_submitted', 'payment_verified', 'reconciled')
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  SELECT COALESCE(SUM(amount), 0) INTO v_cash_total
  FROM folio_payments
  WHERE method = 'cash'
    AND status = 'completed'
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  SELECT COALESCE(SUM(amount), 0) INTO v_mpesa_total
  FROM folio_payments
  WHERE method = 'mpesa'
    AND status = 'completed'
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  SELECT COALESCE(SUM(amount), 0) INTO v_room_charges_total
  FROM payments
  WHERE recorded_by = v_shift.user_id
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());

  v_expected_cash := v_cash_total + v_room_charges_total;

  -- Validate actual_cash
  IF p_actual_cash < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actual cash cannot be negative');
  END IF;

  IF p_actual_cash > 10000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actual cash exceeds maximum limit');
  END IF;

  v_variance := p_actual_cash - v_expected_cash;
  v_has_variance := v_variance != 0;

  -- ─── INSERT RECONCILIATION WITH SERVER-COMPUTED VALUES ───
  INSERT INTO shift_reconciliations (
    shift_id, submitted_by, sales_total, cash_total, mpesa_total,
    room_charges_total, expected_cash, actual_cash, variance, notes,
    status, variance_status, variance_explanation, variance_proof_type
  ) VALUES (
    p_shift_id, v_actor_id, v_sales_total, v_cash_total, v_mpesa_total,
    v_room_charges_total, v_expected_cash, p_actual_cash, v_variance, p_notes,
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
