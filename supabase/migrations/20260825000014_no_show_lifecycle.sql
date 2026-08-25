-- ═══════════════════════════════════════════════════════════════
-- NO-SHOW LIFECYCLE
-- Auto-detect + manual mark → room release → deposit → breakfast cancel
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. SITE SETTINGS ───
INSERT INTO site_settings (key, value) VALUES
  ('no_show_cutoff_hour', '18'),
  ('no_show_deposit_forfeit', 'true'),
  ('no_show_notify_guest', 'true')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. MARK NO-SHOW (manual or auto) ───
CREATE OR REPLACE FUNCTION mark_reservation_no_show(
  p_reservation_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res RECORD;
  v_folio_id UUID;
  v_breakfast_cancelled INTEGER := 0;
  v_result JSON;
BEGIN
  -- Get reservation
  SELECT * INTO v_res FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  
  IF v_res.status != 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed reservations can be marked no-show. Current status: %', v_res.status;
  END IF;
  
  -- Update reservation status
  UPDATE reservations SET
    status = 'no_show',
    cancellation_reason = 'No-show — guest did not check in by cutoff',
    updated_at = now()
  WHERE id = p_reservation_id;
  
  -- Release room if assigned
  IF v_res.room_id IS NOT NULL THEN
    UPDATE rooms SET status = 'available' WHERE id = v_res.room_id;
    INSERT INTO room_status_history (room_id, old_status, new_status, changed_by, notes)
    VALUES (v_res.room_id, 'reserved', 'available', auth.uid(), 'No-show — room released');
  END IF;
  
  -- Cancel any scheduled B&B breakfasts
  UPDATE breakfast_orders SET status = 'cancelled'
  WHERE reservation_id = p_reservation_id AND status = 'scheduled';
  
  GET DIAGNOSTICS v_breakfast_cancelled = ROW_COUNT;
  
  -- Also cancel breakfast items
  UPDATE breakfast_order_items SET status = 'cancelled'
  WHERE breakfast_order_id IN (
    SELECT id FROM breakfast_orders WHERE reservation_id = p_reservation_id
  ) AND status = 'scheduled';
  
  -- Cancel breakfast selections
  DELETE FROM breakfast_selections WHERE reservation_id = p_reservation_id;
  
  -- Handle deposit (forfeit or flag for refund)
  IF v_res.deposit_amount > 0 AND v_res.deposit_paid = true THEN
    -- Check policy
    IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'no_show_deposit_forfeit' AND value = 'true') THEN
      -- Forfeit: mark deposit as forfeited in booking_payments
      UPDATE booking_payments SET
        status = 'forfeited',
        reference = COALESCE(reference, '') || ' [FORFEITED: no-show]'
      WHERE reservation_id = p_reservation_id AND status IN ('pending', 'verified');
      
      -- Add audit log for deposit forfeit
      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
      VALUES (
        auth.uid(), 'no_show_deposit_forfeited', 'reservations', p_reservation_id,
        jsonb_build_object('deposit_amount', v_res.deposit_amount, 'reason', 'no-show')
      );
    END IF;
  END IF;
  
  -- Audit log
  INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (
    auth.uid(), 'no_show_marked', 'reservations', p_reservation_id,
    jsonb_build_object(
      'guest_id', v_res.guest_id,
      'room_id', v_res.room_id,
      'check_in', v_res.check_in,
      'check_out', v_res.check_out,
      'deposit_amount', v_res.deposit_amount,
      'breakfast_cancelled', v_breakfast_cancelled
    )
  );
  
  -- Notify guest (if enabled)
  IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'no_show_notify_guest' AND value = 'true') THEN
    IF v_res.guest_id IS NOT NULL THEN
      INSERT INTO guest_alerts (guest_id, reservation_id, type, title, message)
      VALUES (
        v_res.guest_id,
        p_reservation_id,
        'general',
        '⚠️ Reservation marked as no-show',
        'Your reservation for ' || TO_CHAR(v_res.check_in, 'Mon DD') || ' was marked as no-show. '
        || CASE WHEN v_res.deposit_amount > 0 AND v_res.deposit_paid THEN 'Your deposit of KES ' || v_res.deposit_amount || ' has been forfeited per our no-show policy.' ELSE '' END
        || ' Contact us within 24 hours if you believe this is an error.'
      );
    END IF;
  END IF;
  
  SELECT jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'status', 'no_show',
    'room_released', v_res.room_id IS NOT NULL,
    'breakfast_cancelled', v_breakfast_cancelled,
    'deposit_forfeited', v_res.deposit_amount > 0 AND v_res.deposit_paid
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ─── 3. AUTO-DETECT NO-SHOWS ───
-- Called periodically (e.g., daily at cutoff hour) to find reservations
-- where check-in date has passed but status is still 'confirmed'
CREATE OR REPLACE FUNCTION auto_detect_no_shows()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_hour INTEGER;
  v_count INTEGER := 0;
  v_res RECORD;
  v_results JSONB := '[]'::JSONB;
BEGIN
  -- Get cutoff hour (default 18:00 = 6 PM)
  SELECT value::INTEGER INTO v_cutoff_hour
  FROM site_settings WHERE key = 'no_show_cutoff_hour';
  
  v_cutoff_hour := COALESCE(v_cutoff_hour, 18);
  
  -- Find confirmed reservations where check-in date + cutoff hour has passed
  FOR v_res IN
    SELECT id, guest_id, room_id, check_in, check_out, rate, deposit_amount
    FROM reservations
    WHERE status = 'confirmed'
      AND (check_in || ' ' || LPAD(v_cutoff_hour::TEXT, 2, '0') || ':00')::TIMESTAMPTZ < NOW()
  LOOP
    -- Mark as no-show
    BEGIN
      PERFORM mark_reservation_no_show(v_res.id);
      v_count := v_count + 1;
      v_results := v_results || jsonb_build_object(
        'reservation_id', v_res.id,
        'check_in', v_res.check_in,
        'room_released', v_res.room_id IS NOT NULL
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other reservations
      INSERT INTO audit_logs (action, table_name, record_id, new_values)
      VALUES ('auto_no_show_error', 'reservations', v_res.id, jsonb_build_object('error', SQLERRM));
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', v_count,
    'reservations', v_results,
    'cutoff_hour', v_cutoff_hour
  );
END;
$$;

-- ─── 4. GET RESERVATIONS NEEDING NO-SHOW CHECK ───
CREATE OR REPLACE FUNCTION get_no_show_candidates()
RETURNS TABLE (
  id UUID,
  guest_name TEXT,
  guest_phone TEXT,
  room_number TEXT,
  check_in DATE,
  check_out DATE,
  rate NUMERIC,
  deposit_amount NUMERIC,
  deposit_paid BOOLEAN,
  hours_since_checkin NUMERIC,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_hour INTEGER;
BEGIN
  SELECT value::INTEGER INTO v_cutoff_hour
  FROM site_settings WHERE key = 'no_show_cutoff_hour';
  v_cutoff_hour := COALESCE(v_cutoff_hour, 18);
  
  RETURN QUERY
  SELECT 
    r.id,
    g.name as guest_name,
    g.phone as guest_phone,
    rm.room_number,
    r.check_in,
    r.check_out,
    r.rate,
    r.deposit_amount,
    r.deposit_paid,
    EXTRACT(HOUR FROM (NOW() - (r.check_in || ' ' || LPAD(v_cutoff_hour::TEXT, 2, '0') || ':00')::TIMESTAMPTZ)) as hours_since_checkin,
    r.source
  FROM reservations r
  LEFT JOIN guests g ON g.id = r.guest_id
  LEFT JOIN rooms rm ON rm.id = r.room_id
  WHERE r.status = 'confirmed'
    AND r.check_in < CURRENT_DATE
  ORDER BY r.check_in;
END;
$$;

-- ─── 5. UPDATE CANCELLATION DEADLINE ON BOOKING ───
-- Auto-set cancellation_deadline when reservation is created
CREATE OR REPLACE FUNCTION set_cancellation_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours INTEGER;
BEGIN
  SELECT value::INTEGER INTO v_hours
  FROM site_settings WHERE key = 'cancellation_policy_hours';
  
  v_hours := COALESCE(v_hours, 24);
  
  NEW.cancellation_deadline := (NEW.check_in || ' 14:00')::TIMESTAMPTZ - (v_hours || ' hours')::INTERVAL;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_set_cancellation_deadline ON reservations;
CREATE TRIGGER trg_set_cancellation_deadline
  BEFORE INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION set_cancellation_deadline();
