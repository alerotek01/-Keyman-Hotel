-- ═══════════════════════════════════════════════════════════════
-- B&B MEAL PLAN WITH TRACKING CODES
-- Prevents free-riders: room_only guests can't get free breakfast
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. MEAL PLAN COLUMN ON RESERVATIONS ───
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS meal_plan TEXT DEFAULT 'room_only' CHECK (meal_plan IN ('room_only', 'b&b'));
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS breakfast_total NUMERIC DEFAULT 0;

-- ─── 2. BREAKFAST ORDERS TABLE ───
-- Each B&B guest gets one row per morning with a unique verification code
CREATE TABLE IF NOT EXISTS breakfast_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id),
  room_number TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  meal_date DATE NOT NULL,
  pax INTEGER NOT NULL DEFAULT 1,
  
  -- The unique code the guest shows at the kitchen
  verification_code TEXT NOT NULL UNIQUE,
  
  -- Status tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'served', 'skipped', 'cancelled')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_breakfast_reservation ON breakfast_orders(reservation_id);
CREATE INDEX idx_breakfast_date ON breakfast_orders(meal_date);
CREATE INDEX idx_breakfast_code ON breakfast_orders(verification_code);
CREATE INDEX idx_breakfast_status ON breakfast_orders(status);
CREATE INDEX idx_breakfast_room_date ON breakfast_orders(room_number, meal_date);

-- Unique constraint: one order per room per date per reservation
CREATE UNIQUE INDEX idx_breakfast_room_date_reservation 
  ON breakfast_orders(room_number, meal_date, reservation_id);

-- ─── 3. RLS POLICIES ───
ALTER TABLE breakfast_orders ENABLE ROW LEVEL SECURITY;

-- Chef/waiter can read today's orders and verify
CREATE POLICY "Kitchen staff read breakfast"
  ON breakfast_orders FOR SELECT
  USING (is_chef() OR is_waiter() OR is_receptionist() OR is_manager() OR is_admin());

-- Chef/waiter can update status (serve/skip)
CREATE POLICY "Kitchen staff update breakfast"
  ON breakfast_orders FOR UPDATE
  USING (is_chef() OR is_waiter() OR is_receptionist() OR is_manager() OR is_admin());

-- Only system (via function) inserts
CREATE POLICY "System inserts breakfast"
  ON breakfast_orders FOR INSERT
  WITH CHECK (true);

-- ─── 4. GENERATE UNIQUE VERIFICATION CODE ───
-- Format: KB-XXXX (Keyman Breakfast + 4 alphanumeric chars)
CREATE OR REPLACE FUNCTION generate_breakfast_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN := true;
BEGIN
  WHILE v_exists LOOP
    v_code := 'KB-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    SELECT EXISTS(SELECT 1 FROM breakfast_orders WHERE verification_code = v_code) INTO v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ─── 5. SCHEDULE B&B BREAKFASTS (called by check_in_guest_atomic) ───
CREATE OR REPLACE FUNCTION schedule_bb_breakfasts(
  p_reservation_id UUID,
  p_room_number TEXT,
  p_guest_name TEXT,
  p_check_in DATE,
  p_check_out DATE,
  p_num_adults INTEGER DEFAULT 1,
  p_guest_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meal_date DATE;
  v_count INTEGER := 0;
  v_code TEXT;
  v_current_date DATE;
BEGIN
  -- Only schedule if reservation is B&B
  IF NOT EXISTS (
    SELECT 1 FROM reservations 
    WHERE id = p_reservation_id AND meal_plan = 'b&b'
  ) THEN
    RETURN 0;
  END IF;

  v_current_date := p_check_in;
  
  -- Schedule one breakfast per morning of the stay
  -- (check_in morning through morning before checkout)
  WHILE v_current_date < p_check_out LOOP
    v_code := generate_breakfast_code();
    
    INSERT INTO breakfast_orders (
      reservation_id, guest_id, room_number, guest_name,
      meal_date, pax, verification_code, status
    ) VALUES (
      p_reservation_id, p_guest_id, p_room_number, p_guest_name,
      v_current_date, p_num_adults, v_code, 'scheduled'
    )
    ON CONFLICT (room_number, meal_date, reservation_id) DO NOTHING;
    
    v_count := v_count + 1;
    v_current_date := v_current_date + 1;
  END LOOP;

  -- Note: Audit logged by check_in_guest_atomic caller

  RETURN v_count;
END;
$$;

-- ─── 6. VERIFY BREAKFAST CODE (Kitchen verification) ───
CREATE OR REPLACE FUNCTION verify_breakfast_code(
  p_code TEXT
)
RETURNS TABLE (
  valid BOOLEAN,
  guest_name TEXT,
  room_number TEXT,
  pax INTEGER,
  meal_date DATE,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Find the order
  SELECT * INTO v_order 
  FROM breakfast_orders 
  WHERE verification_code = UPPER(TRIM(p_code));
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN, 
      NULL::TEXT, 
      NULL::TEXT, 
      NULL::INTEGER, 
      NULL::DATE, 
      NULL::TEXT,
      '❌ Invalid code. This guest does not have a B&B breakfast booked.'::TEXT;
    RETURN;
  END IF;

  -- Check if already served
  IF v_order.status = 'served' THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      v_order.guest_name,
      v_order.room_number,
      v_order.pax,
      v_order.meal_date,
      v_order.status,
      ('⚠️ Already served at ' || TO_CHAR(v_order.verified_at, 'HH24:MI'))::TEXT;
    RETURN;
  END IF;

  -- Check if cancelled/skipped
  IF v_order.status IN ('cancelled', 'skipped') THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      v_order.guest_name,
      v_order.room_number,
      v_order.pax,
      v_order.meal_date,
      v_order.status,
      ('⚠️ Order was ' || v_order.status || '. Cannot serve.')::TEXT;
    RETURN;
  END IF;

  -- Check if date is wrong (not today)
  IF v_order.meal_date != CURRENT_DATE THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      v_order.guest_name,
      v_order.room_number,
      v_order.pax,
      v_order.meal_date,
      v_order.status,
      ('⚠️ This code is for ' || TO_CHAR(v_order.meal_date, 'Mon DD') || ', not today.')::TEXT;
    RETURN;
  END IF;

  -- Valid! Return guest details for name confirmation
  RETURN QUERY SELECT 
    TRUE::BOOLEAN,
    v_order.guest_name,
    v_order.room_number,
    v_order.pax,
    v_order.meal_date,
    v_order.status,
    ('✅ VALID — Serve ' || v_order.pax || ' breakfast(s) for ' || v_order.guest_name || ' (Room ' || v_order.room_number || ')')::TEXT;
END;
$$;

-- ─── 7. MARK BREAKFAST SERVED ───
CREATE OR REPLACE FUNCTION mark_breakfast_served(
  p_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM breakfast_orders WHERE verification_code = UPPER(TRIM(p_code));
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid verification code';
  END IF;

  IF v_order.status != 'scheduled' THEN
    RAISE EXCEPTION 'Order is already %, cannot mark as served', v_order.status;
  END IF;

  UPDATE breakfast_orders SET
    status = 'served',
    verified_by = auth.uid(),
    verified_at = now()
  WHERE id = v_order.id;

  RETURN 'Served';
END;
$$;

-- ─── 8. MARK BREAKFAST SKIPPED (no-show) ───
CREATE OR REPLACE FUNCTION mark_breakfast_skipped(
  p_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM breakfast_orders WHERE verification_code = UPPER(TRIM(p_code));
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid verification code';
  END IF;

  UPDATE breakfast_orders SET
    status = 'skipped',
    verified_by = auth.uid(),
    verified_at = now()
  WHERE id = v_order.id AND status = 'scheduled';

  RETURN 'Skipped';
END;
$$;

-- ─── 9. GET TODAY'S BREAKFAST ORDERS ───
CREATE OR REPLACE FUNCTION get_today_breakfasts()
RETURNS TABLE (
  id UUID,
  verification_code TEXT,
  guest_name TEXT,
  room_number TEXT,
  pax INTEGER,
  status TEXT,
  verified_at TIMESTAMPTZ,
  meal_date DATE,
  reservation_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bo.id, bo.verification_code, bo.guest_name, bo.room_number,
    bo.pax, bo.status, bo.verified_at, bo.meal_date, bo.reservation_id
  FROM breakfast_orders bo
  WHERE bo.meal_date = CURRENT_DATE
  ORDER BY bo.room_number;
END;
$$;

-- ─── 10. CANCEL REMAINING BREAKFASTS ON EARLY CHECKOUT ───
CREATE OR REPLACE FUNCTION cancel_remaining_breakfasts(
  p_reservation_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE breakfast_orders SET status = 'cancelled'
  WHERE reservation_id = p_reservation_id
    AND status = 'scheduled'
    AND meal_date > CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
