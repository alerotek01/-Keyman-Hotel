-- ═══════════════════════════════════════════════════════════════
-- B&B PER-DAY ITEM SELECTION
-- Guest picks different breakfast items per morning
-- Each item gets its own KB-XXXX verification code
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. BREAKFAST ORDER ITEMS ───
-- Individual items within a breakfast order (one code per item)
CREATE TABLE IF NOT EXISTS breakfast_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breakfast_order_id UUID NOT NULL REFERENCES breakfast_orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  item_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Each item gets its own verification code
  verification_code TEXT NOT NULL UNIQUE,
  
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'served', 'skipped', 'cancelled')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_breakfast_items_order ON breakfast_order_items(breakfast_order_id);
CREATE INDEX idx_breakfast_items_code ON breakfast_order_items(verification_code);
CREATE INDEX idx_breakfast_items_status ON breakfast_order_items(status);
CREATE INDEX idx_breakfast_items_menu ON breakfast_order_items(menu_item_id);

-- ─── 2. RLS ───
ALTER TABLE breakfast_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kitchen staff read breakfast items"
  ON breakfast_order_items FOR SELECT
  USING (is_chef() OR is_waiter() OR is_receptionist() OR is_manager() OR is_admin());

CREATE POLICY "Kitchen staff update breakfast items"
  ON breakfast_order_items FOR UPDATE
  USING (is_chef() OR is_waiter() OR is_receptionist() OR is_manager() OR is_admin());

CREATE POLICY "System inserts breakfast items"
  ON breakfast_order_items FOR INSERT
  WITH CHECK (true);

-- ─── 3. BREAKFAST SELECTIONS TABLE ───
-- Stores what the guest selected per day at booking time
CREATE TABLE IF NOT EXISTS breakfast_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  item_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  meal_date DATE NOT NULL,
  pax INTEGER NOT NULL DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_breakfast_sel_reservation ON breakfast_selections(reservation_id);
CREATE INDEX idx_breakfast_sel_date ON breakfast_selections(meal_date);

ALTER TABLE breakfast_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests read own breakfast selections"
  ON breakfast_selections FOR SELECT
  USING (reservation_id IN (
    SELECT id FROM reservations WHERE guest_user_id = auth.uid()
  ));

CREATE POLICY "Staff read breakfast selections"
  ON breakfast_selections FOR SELECT
  USING (is_receptionist() OR is_manager() OR is_admin() OR is_chef());

CREATE POLICY "Staff manage breakfast selections"
  ON breakfast_selections FOR ALL
  USING (is_receptionist() OR is_manager() OR is_admin());

-- ─── 4. UPDATE schedule_bb_breakfasts FOR PER-DAY ITEMS ───
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
  v_count INTEGER := 0;
  v_code TEXT;
  v_current_date DATE;
  v_sel RECORD;
  v_order_id UUID;
BEGIN
  -- Only schedule if reservation is B&B
  IF NOT EXISTS (
    SELECT 1 FROM reservations 
    WHERE id = p_reservation_id AND meal_plan = 'b&b'
  ) THEN
    RETURN 0;
  END IF;

  v_current_date := p_check_in;
  
  -- For each morning of the stay
  WHILE v_current_date < p_check_out LOOP
    -- Create a breakfast order for this morning
    v_code := generate_breakfast_code();
    
    INSERT INTO breakfast_orders (
      reservation_id, guest_id, room_number, guest_name,
      meal_date, pax, verification_code, status
    ) VALUES (
      p_reservation_id, p_guest_id, p_room_number, p_guest_name,
      v_current_date, p_num_adults, v_code, 'scheduled'
    )
    ON CONFLICT (room_number, meal_date, reservation_id) DO NOTHING
    RETURNING id INTO v_order_id;
    
    -- Skip if order already existed
    IF v_order_id IS NULL THEN
      SELECT id INTO v_order_id FROM breakfast_orders
      WHERE room_number = p_room_number AND meal_date = v_current_date AND reservation_id = p_reservation_id;
    END IF;
    
    -- Create individual item codes for each selected item on this date
    FOR v_sel IN 
      SELECT bs.menu_item_id, bs.item_name, bs.item_price, bs.quantity
      FROM breakfast_selections bs
      WHERE bs.reservation_id = p_reservation_id 
        AND bs.meal_date = v_current_date
    LOOP
      v_code := generate_breakfast_code();
      
      INSERT INTO breakfast_order_items (
        breakfast_order_id, menu_item_id, item_name, item_price,
        quantity, verification_code, status
      ) VALUES (
        v_order_id, v_sel.menu_item_id, v_sel.item_name, v_sel.item_price,
        v_sel.quantity, v_code, 'scheduled'
      );
      
      v_count := v_count + 1;
    END LOOP;
    
    v_current_date := v_current_date + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─── 5. VERIFY INDIVIDUAL ITEM CODE ───
DROP FUNCTION IF EXISTS verify_breakfast_code(TEXT);
CREATE OR REPLACE FUNCTION verify_breakfast_code(
  p_code TEXT
)
RETURNS TABLE (
  valid BOOLEAN,
  guest_name TEXT,
  room_number TEXT,
  item_name TEXT,
  item_price NUMERIC,
  quantity INTEGER,
  meal_date DATE,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_order RECORD;
BEGIN
  -- First try individual item code
  SELECT boi.*, bo.guest_name, bo.room_number, bo.meal_date
  INTO v_item
  FROM breakfast_order_items boi
  JOIN breakfast_orders bo ON bo.id = boi.breakfast_order_id
  WHERE boi.verification_code = UPPER(TRIM(p_code));
  
  IF FOUND THEN
    IF v_item.status = 'served' THEN
      RETURN QUERY SELECT 
        FALSE::BOOLEAN, v_item.guest_name, v_item.room_number,
        v_item.item_name, v_item.item_price, v_item.quantity,
        v_item.meal_date, v_item.status,
        ('⚠️ Already served at ' || TO_CHAR(v_item.verified_at, 'HH24:MI'))::TEXT;
      RETURN;
    END IF;

    IF v_item.status IN ('cancelled', 'skipped') THEN
      RETURN QUERY SELECT 
        FALSE::BOOLEAN, v_item.guest_name, v_item.room_number,
        v_item.item_name, v_item.item_price, v_item.quantity,
        v_item.meal_date, v_item.status,
        ('⚠️ Item was ' || v_item.status || '. Cannot serve.')::TEXT;
      RETURN;
    END IF;

    IF v_item.meal_date != CURRENT_DATE THEN
      RETURN QUERY SELECT 
        FALSE::BOOLEAN, v_item.guest_name, v_item.room_number,
        v_item.item_name, v_item.item_price, v_item.quantity,
        v_item.meal_date, v_item.status,
        ('⚠️ This code is for ' || TO_CHAR(v_item.meal_date, 'Mon DD') || ', not today.')::TEXT;
      RETURN;
    END IF;

    RETURN QUERY SELECT 
      TRUE::BOOLEAN, v_item.guest_name, v_item.room_number,
      v_item.item_name, v_item.item_price, v_item.quantity,
      v_item.meal_date, v_item.status,
      ('✅ SERVE: ' || v_item.quantity || 'x ' || v_item.item_name || ' for ' || v_item.guest_name || ' (Room ' || v_item.room_number || ')')::TEXT;
    RETURN;
  END IF;

  -- Fallback: try order-level code
  SELECT * INTO v_order FROM breakfast_orders WHERE verification_code = UPPER(TRIM(p_code));
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::NUMERIC, NULL::INTEGER,
      NULL::DATE, NULL::TEXT,
      '❌ Invalid code. This guest does not have a B&B breakfast booked.'::TEXT;
    RETURN;
  END IF;

  IF v_order.status = 'served' THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN, v_order.guest_name, v_order.room_number,
      NULL::TEXT, NULL::NUMERIC, NULL::INTEGER,
      v_order.meal_date, v_order.status,
      ('⚠️ Already served at ' || TO_CHAR(v_order.verified_at, 'HH24:MI'))::TEXT;
    RETURN;
  END IF;

  IF v_order.meal_date != CURRENT_DATE THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN, v_order.guest_name, v_order.room_number,
      NULL::TEXT, NULL::NUMERIC, NULL::INTEGER,
      v_order.meal_date, v_order.status,
      ('⚠️ This code is for ' || TO_CHAR(v_order.meal_date, 'Mon DD') || ', not today.')::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    TRUE::BOOLEAN, v_order.guest_name, v_order.room_number,
    NULL::TEXT, NULL::NUMERIC, NULL::INTEGER,
    v_order.meal_date, v_order.status,
    ('✅ VALID — ' || v_order.pax || ' breakfast(s) for ' || v_order.guest_name || ' (Room ' || v_order.room_number || '). Scan individual item codes.')::TEXT;
END;
$$;

-- ─── 6. MARK INDIVIDUAL ITEM SERVED ───
DROP FUNCTION IF EXISTS mark_breakfast_served(TEXT);
CREATE OR REPLACE FUNCTION mark_breakfast_served(
  p_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Try item-level code first
  SELECT * INTO v_item FROM breakfast_order_items WHERE verification_code = UPPER(TRIM(p_code));
  
  IF FOUND THEN
    IF v_item.status != 'scheduled' THEN
      RAISE EXCEPTION 'Item is already %, cannot mark as served', v_item.status;
    END IF;

    UPDATE breakfast_order_items SET
      status = 'served',
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = v_item.id;

    -- Check if all items in the parent order are served
    IF NOT EXISTS (
      SELECT 1 FROM breakfast_order_items 
      WHERE breakfast_order_id = v_item.breakfast_order_id AND status = 'scheduled'
    ) THEN
      UPDATE breakfast_orders SET
        status = 'served',
        verified_by = auth.uid(),
        verified_at = now()
      WHERE id = v_item.breakfast_order_id;
    END IF;

    RETURN 'Served: ' || v_item.quantity || 'x ' || v_item.item_name;
  END IF;

  -- Fallback: order-level code
  DECLARE
    v_order RECORD;
  BEGIN
    SELECT * INTO v_order FROM breakfast_orders WHERE verification_code = UPPER(TRIM(p_code));
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid verification code';
    END IF;

    UPDATE breakfast_order_items SET
      status = 'served',
      verified_by = auth.uid(),
      verified_at = now()
    WHERE breakfast_order_id = v_order.id AND status = 'scheduled';

    UPDATE breakfast_orders SET
      status = 'served',
      verified_by = auth.uid(),
      verified_at = now()
    WHERE id = v_order.id;

    RETURN 'Served all items for ' || v_order.guest_name;
  END;
END;
$$;

-- ─── 7. GET TODAY'S BREAKFAST ITEMS (for kitchen display) ───
CREATE OR REPLACE FUNCTION get_today_breakfast_items()
RETURNS TABLE (
  id UUID,
  verification_code TEXT,
  guest_name TEXT,
  room_number TEXT,
  item_name TEXT,
  item_price NUMERIC,
  quantity INTEGER,
  status TEXT,
  verified_at TIMESTAMPTZ,
  meal_date DATE,
  breakfast_order_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    boi.id, boi.verification_code, bo.guest_name, bo.room_number,
    boi.item_name, boi.item_price, boi.quantity, boi.status,
    boi.verified_at, bo.meal_date, boi.breakfast_order_id
  FROM breakfast_order_items boi
  JOIN breakfast_orders bo ON bo.id = boi.breakfast_order_id
  WHERE bo.meal_date = CURRENT_DATE
  ORDER BY bo.room_number, boi.item_name;
END;
$$;
