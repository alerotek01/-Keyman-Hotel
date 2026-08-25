-- ═══════════════════════════════════════════════════════════════
-- BREAKFAST KITCHEN STATUS + GUEST ALERTS
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. KITCHEN STATUS ON BREAKFAST ORDER ITEMS ───
ALTER TABLE breakfast_order_items ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'pending' 
  CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'served', 'skipped'));

ALTER TABLE breakfast_order_items ADD COLUMN IF NOT EXISTS kitchen_started_at TIMESTAMPTZ;
ALTER TABLE breakfast_order_items ADD COLUMN IF NOT EXISTS kitchen_ready_at TIMESTAMPTZ;
ALTER TABLE breakfast_order_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── 2. GUEST ALERTS TABLE ───
CREATE TABLE IF NOT EXISTS guest_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('breakfast_preparing', 'breakfast_ready', 'breakfast_served', 'breakfast_skipped', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guest_alerts_guest ON guest_alerts(guest_id);
CREATE INDEX idx_guest_alerts_unread ON guest_alerts(guest_id, read) WHERE read = false;

ALTER TABLE guest_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests read own alerts"
  ON guest_alerts FOR SELECT
  USING (guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));

CREATE POLICY "Guests update own alerts"
  ON guest_alerts FOR UPDATE
  USING (guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));

CREATE POLICY "Staff insert alerts"
  ON guest_alerts FOR INSERT
  WITH CHECK (is_chef() OR is_waiter() OR is_receptionist() OR is_manager() OR is_admin());

-- ─── 3. FUNCTION: Update kitchen status + alert guest ───
CREATE OR REPLACE FUNCTION update_breakfast_kitchen_status(
  p_item_id UUID,
  p_new_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_order RECORD;
  v_guest_id UUID;
  v_alert_title TEXT;
  v_alert_message TEXT;
BEGIN
  -- Get the item + parent order
  SELECT boi.*, bo.guest_name, bo.room_number, bo.guest_id, bo.reservation_id
  INTO v_item
  FROM breakfast_order_items boi
  JOIN breakfast_orders bo ON bo.id = boi.breakfast_order_id
  WHERE boi.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Breakfast item not found';
  END IF;

  v_guest_id := v_item.guest_id;

  -- Update kitchen status
  UPDATE breakfast_order_items SET
    kitchen_status = p_new_status,
    kitchen_started_at = CASE WHEN p_new_status = 'preparing' THEN now() ELSE kitchen_started_at END,
    kitchen_ready_at = CASE WHEN p_new_status = 'ready' THEN now() ELSE kitchen_ready_at END,
    status = CASE 
      WHEN p_new_status = 'served' THEN 'served'
      WHEN p_new_status = 'skipped' THEN 'skipped'
      ELSE status
    END,
    verified_by = CASE WHEN p_new_status IN ('served', 'skipped') THEN auth.uid() ELSE verified_by END,
    verified_at = CASE WHEN p_new_status IN ('served', 'skipped') THEN now() ELSE verified_at END
  WHERE id = p_item_id;

  -- Create guest alert
  IF v_guest_id IS NOT NULL THEN
    CASE p_new_status
      WHEN 'preparing' THEN
        v_alert_title := '🍳 Your breakfast is being prepared';
        v_alert_message := v_item.quantity || 'x ' || v_item.item_name || ' for Room ' || v_item.room_number || ' is now being prepared by the kitchen.';
      WHEN 'ready' THEN
        v_alert_title := '✅ Your breakfast is ready!';
        v_alert_message := v_item.quantity || 'x ' || v_item.item_name || ' for Room ' || v_item.room_number || ' is ready for pickup at the cafeteria.';
      WHEN 'served' THEN
        v_alert_title := '🍽️ Breakfast served';
        v_alert_message := v_item.quantity || 'x ' || v_item.item_name || ' has been served.';
      WHEN 'skipped' THEN
        v_alert_title := '⏭️ Breakfast skipped';
        v_alert_message := v_item.quantity || 'x ' || v_item.item_name << ' was marked as no-show.';
      ELSE
        v_alert_title := 'Update: ' || p_new_status;
        v_alert_message := 'Your breakfast order status has been updated.';
    END CASE;

    INSERT INTO guest_alerts (guest_id, reservation_id, type, title, message, metadata)
    VALUES (
      v_guest_id,
      v_item.reservation_id,
      'breakfast_' || p_new_status,
      v_alert_title,
      v_alert_message,
      jsonb_build_object(
        'item_name', v_item.item_name,
        'quantity', v_item.quantity,
        'room_number', v_item.room_number,
        'verification_code', v_item.verification_code,
        'kitchen_status', p_new_status
      )
    );
  END IF;

  RETURN p_new_status;
END;
$$;

-- ─── 4. FUNCTION: Get guest's breakfast orders with status ───
CREATE OR REPLACE FUNCTION get_guest_breakfast_orders(
  p_guest_id UUID
)
RETURNS TABLE (
  id UUID,
  verification_code TEXT,
  item_name TEXT,
  item_price NUMERIC,
  quantity INTEGER,
  room_number TEXT,
  meal_date DATE,
  kitchen_status TEXT,
  kitchen_started_at TIMESTAMPTZ,
  kitchen_ready_at TIMESTAMPTZ,
  reservation_id UUID,
  can_change BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    boi.id, boi.verification_code, boi.item_name, boi.item_price,
    boi.quantity, bo.room_number, bo.meal_date,
    boi.kitchen_status, boi.kitchen_started_at, boi.kitchen_ready_at,
    bo.reservation_id,
    is_within_breakfast_change_window(bo.meal_date) as can_change
  FROM breakfast_order_items boi
  JOIN breakfast_orders bo ON bo.id = boi.breakfast_order_id
  WHERE bo.guest_id = p_guest_id
    AND bo.meal_date >= CURRENT_DATE - INTERVAL '1 day'
  ORDER BY bo.meal_date, bo.room_number, boi.item_name;
END;
$$;

-- ─── 5. FUNCTION: Get unread alert count ───
CREATE OR REPLACE FUNCTION get_unread_alert_count(
  p_guest_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM guest_alerts
  WHERE guest_id = p_guest_id AND read = false;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- ─── 6. FUNCTION: Mark alerts as read ───
CREATE OR REPLACE FUNCTION mark_alerts_read(
  p_guest_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE guest_alerts SET read = true
  WHERE guest_id = p_guest_id AND read = false;
END;
$$;
