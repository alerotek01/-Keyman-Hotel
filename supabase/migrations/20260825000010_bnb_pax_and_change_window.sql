-- ═══════════════════════════════════════════════════════════════
-- B&B PAX ORDERING + CHANGE WINDOW + VARIANCE HANDLING
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. SITE SETTINGS ───
INSERT INTO site_settings (key, value) VALUES
  ('breakfast_change_cutoff_hours', '5'),
  ('breakfast_serving_start', '06:30'),
  ('breakfast_serving_end', '10:00')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. RESERVATIONS: Track paid breakfast total ───
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS breakfast_override_total NUMERIC DEFAULT 0;

-- ─── 3. BREAKFAST SELECTIONS: Add pax column ───
-- (pax already exists from previous migration, just ensure it's there)
ALTER TABLE breakfast_selections ADD COLUMN IF NOT EXISTS original_price NUMERIC;
ALTER TABLE breakfast_selections ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ;
ALTER TABLE breakfast_selections ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- ─── 4. BREAKFAST CHANGE LOG ───
-- Tracks every change for audit
CREATE TABLE IF NOT EXISTS breakfast_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('add', 'remove', 'modify_quantity', 'swap_item')),
  
  -- What changed
  old_item_name TEXT,
  old_quantity INTEGER,
  old_price NUMERIC,
  new_item_name TEXT,
  new_quantity INTEGER,
  new_price NUMERIC,
  
  -- Variance
  variance_amount NUMERIC NOT NULL DEFAULT 0,
  folio_transaction_id UUID,
  
  meal_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_breakfast_changes_reservation ON breakfast_changes(reservation_id);
CREATE INDEX idx_breakfast_changes_date ON breakfast_changes(meal_date);

ALTER TABLE breakfast_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage breakfast changes"
  ON breakfast_changes FOR ALL
  USING (is_receptionist() OR is_manager() OR is_admin());

CREATE POLICY "Guests read own breakfast changes"
  ON breakfast_changes FOR SELECT
  USING (reservation_id IN (
    SELECT id FROM reservations WHERE guest_user_id = auth.uid()
  ));

-- ─── 5. FUNCTION: Check if within change window ───
CREATE OR REPLACE FUNCTION is_within_breakfast_change_window(
  p_meal_date DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_hours INTEGER;
  v_serving_start TEXT;
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  -- Get cutoff setting (default 5 hours)
  SELECT value::INTEGER INTO v_cutoff_hours 
  FROM site_settings WHERE key = 'breakfast_change_cutoff_hours';
  
  v_cutoff_hours := COALESCE(v_cutoff_hours, 5);
  
  -- Get serving start time (default 06:30)
  SELECT value INTO v_serving_start 
  FROM site_settings WHERE key = 'breakfast_serving_start';
  
  v_serving_start := COALESCE(v_serving_start, '06:30');
  
  -- Cutoff = meal_date + serving_start - cutoff_hours
  v_cutoff_time := (p_meal_date || ' ' || v_serving_start)::TIMESTAMPTZ - (v_cutoff_hours || ' hours')::INTERVAL;
  
  RETURN NOW() < v_cutoff_time;
END;
$$;

-- ─── 6. FUNCTION: Change breakfast selection with variance ───
CREATE OR REPLACE FUNCTION change_breakfast_selection(
  p_reservation_id UUID,
  p_meal_date DATE,
  p_old_selection_id UUID,
  p_new_menu_item_id UUID,
  p_new_quantity INTEGER,
  p_change_type TEXT DEFAULT 'swap_item'
)
RETURNS TABLE (
  success BOOLEAN,
  variance NUMERIC,
  new_total NUMERIC,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_sel RECORD;
  v_new_item RECORD;
  v_variance NUMERIC := 0;
  v_old_total NUMERIC := 0;
  v_new_total NUMERIC := 0;
  v_folio_id UUID;
  v_txn_id UUID;
  v_pax INTEGER;
  v_cutoff_hours INTEGER;
  v_serving_start TEXT;
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  -- Check change window
  SELECT value::INTEGER INTO v_cutoff_hours 
  FROM site_settings WHERE key = 'breakfast_change_cutoff_hours';
  v_cutoff_hours := COALESCE(v_cutoff_hours, 5);
  
  SELECT value INTO v_serving_start 
  FROM site_settings WHERE key = 'breakfast_serving_start';
  v_serving_start := COALESCE(v_serving_start, '06:30');
  
  v_cutoff_time := (p_meal_date || ' ' || v_serving_start)::TIMESTAMPTZ - (v_cutoff_hours || ' hours')::INTERVAL;
  
  IF NOW() >= v_cutoff_time THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN, 
      0::NUMERIC, 
      0::NUMERIC,
      ('Cannot change — cutoff was ' || TO_CHAR(v_cutoff_time, 'Mon DD HH24:MI') || '. Changes must be made ' || v_cutoff_hours || ' hours before breakfast.')::TEXT;
    RETURN;
  END IF;

  -- Get old selection
  SELECT * INTO v_old_sel FROM breakfast_selections WHERE id = p_old_selection_id;
  
  IF NOT FOUND OR v_old_sel.reservation_id != p_reservation_id THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 0::NUMERIC, 0::NUMERIC, 'Selection not found'::TEXT;
    RETURN;
  END IF;

  IF v_old_sel.meal_date != p_meal_date THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 0::NUMERIC, 0::NUMERIC, 'Meal date mismatch'::TEXT;
    RETURN;
  END IF;

  -- Get new item
  SELECT * INTO v_new_item FROM menu_items WHERE id = p_new_menu_item_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 0::NUMERIC, 0::NUMERIC, 'New menu item not found'::TEXT;
    RETURN;
  END IF;

  -- Get pax from selection
  v_pax := v_old_sel.pax;
  
  -- Calculate old total (item price × quantity × pax)
  v_old_total := v_old_sel.item_price * v_old_sel.quantity * v_pax;
  
  -- Calculate new total
  v_new_total := v_new_item.price * p_new_quantity * v_pax;
  
  -- Variance (positive = guest pays more, negative = refund/credit)
  v_variance := v_new_total - v_old_total;

  -- Update the selection
  UPDATE breakfast_selections SET
    menu_item_id = v_new_item.id,
    item_name = v_new_item.name,
    item_price = v_new_item.price,
    quantity = p_new_quantity,
    original_price = v_old_sel.item_price,
    changed_at = now(),
    change_reason = p_change_type
  WHERE id = p_old_selection_id;

  -- If variance, add to folio
  IF v_variance != 0 THEN
    -- Get the folio for this reservation
    SELECT f.id INTO v_folio_id
    FROM folios f WHERE f.reservation_id = p_reservation_id LIMIT 1;
    
    IF v_folio_id IS NOT NULL THEN
      IF v_variance > 0 THEN
        -- Guest pays more: add charge to folio
        INSERT INTO folio_transactions (
          folio_id, type, description, amount, reference, recorded_by
        ) VALUES (
          v_folio_id,
          'charge',
          'Breakfast change: ' || v_old_sel.quantity || 'x ' || v_old_sel.item_name || ' → ' || p_new_quantity || 'x ' || v_new_item.name || ' (' || TO_CHAR(p_meal_date, 'Mon DD') || ')',
          v_variance,
          'breakfast_change',
          auth.uid()
        ) RETURNING id INTO v_txn_id;
      ELSE
        -- Guest gets credit: add negative charge
        INSERT INTO folio_transactions (
          folio_id, type, description, amount, reference, recorded_by
        ) VALUES (
          v_folio_id,
          'adjustment',
          'Breakfast credit: ' || v_old_sel.quantity || 'x ' || v_old_sel.item_name || ' → ' || p_new_quantity || 'x ' || v_new_item.name || ' (' || TO_CHAR(p_meal_date, 'Mon DD') || ')',
          ABS(v_variance),
          'breakfast_change',
          auth.uid()
        ) RETURNING id INTO v_txn_id;
      END IF;
    END IF;
  END IF;

  -- Log the change
  INSERT INTO breakfast_changes (
    reservation_id, changed_by, change_type,
    old_item_name, old_quantity, old_price,
    new_item_name, new_quantity, new_price,
    variance_amount, folio_transaction_id, meal_date
  ) VALUES (
    p_reservation_id, auth.uid(), p_change_type,
    v_old_sel.item_name, v_old_sel.quantity, v_old_sel.item_price,
    v_new_item.name, p_new_quantity, v_new_item.price,
    v_variance, v_txn_id, p_meal_date
  );

  -- Update reservation breakfast total
  UPDATE reservations SET
    breakfast_override_total = (
      SELECT COALESCE(SUM(item_price * quantity * pax), 0)
      FROM breakfast_selections WHERE reservation_id = p_reservation_id
    )
  WHERE id = p_reservation_id;

  RETURN QUERY SELECT 
    TRUE::BOOLEAN, 
    v_variance, 
    v_new_total,
    CASE 
      WHEN v_variance > 0 THEN 'Added KES ' || v_variance || ' to your folio. Pay at checkout.'
      WHEN v_variance < 0 THEN 'KES ' || ABS(v_variance) || ' credited to your folio.'
      ELSE 'No price change.'
    END::TEXT;
END;
$$;

-- ─── 7. FUNCTION: Get remaining breakfast selections for a reservation ───
CREATE OR REPLACE FUNCTION get_breakfast_selections(
  p_reservation_id UUID
)
RETURNS TABLE (
  id UUID,
  menu_item_id UUID,
  item_name TEXT,
  item_price NUMERIC,
  quantity INTEGER,
  meal_date DATE,
  pax INTEGER,
  can_change BOOLEAN,
  days_until_breakfast NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.id, bs.menu_item_id, bs.item_name, bs.item_price,
    bs.quantity, bs.meal_date, bs.pax,
    is_within_breakfast_change_window(bs.meal_date) as can_change,
    EXTRACT(DAY FROM (bs.meal_date::TIMESTAMPTZ - NOW())) as days_until_breakfast
  FROM breakfast_selections bs
  WHERE bs.reservation_id = p_reservation_id
    AND bs.meal_date >= CURRENT_DATE
  ORDER BY bs.meal_date, bs.item_name;
END;
$$;
