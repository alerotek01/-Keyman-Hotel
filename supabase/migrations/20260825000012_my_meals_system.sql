-- ═══════════════════════════════════════════════════════════════
-- MY MEALS: Feedback, Favorites, Re-Order
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. MEAL FEEDBACK ───
CREATE TABLE IF NOT EXISTS meal_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  reservation_id UUID REFERENCES reservations(id),
  order_id UUID REFERENCES restaurant_orders(id),
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- Meal context
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'drink')),
  order_source TEXT, -- 'b&b', 'restaurant', 'room_service'
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meal_feedback_guest ON meal_feedback(guest_id);
CREATE INDEX idx_meal_feedback_item ON meal_feedback(menu_item_id);
CREATE INDEX idx_meal_feedback_rating ON meal_feedback(rating);

ALTER TABLE meal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests manage own feedback"
  ON meal_feedback FOR ALL
  USING (guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));

CREATE POLICY "Admin/manager reads all feedback"
  ON meal_feedback FOR SELECT
  USING (is_admin() OR is_manager());

CREATE POLICY "Staff reads feedback"
  ON meal_feedback FOR SELECT
  USING (is_chef() OR is_waiter());

-- ─── 2. MEAL FAVORITES (Quick Re-Order) ───
CREATE TABLE IF NOT EXISTS meal_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  times_ordered INTEGER DEFAULT 1,
  last_ordered_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(guest_id, menu_item_id)
);

CREATE INDEX idx_meal_favorites_guest ON meal_favorites(guest_id);

ALTER TABLE meal_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests manage own favorites"
  ON meal_favorites FOR ALL
  USING (guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));

-- ─── 3. FUNCTION: Submit meal feedback ───
CREATE OR REPLACE FUNCTION submit_meal_feedback(
  p_guest_id UUID,
  p_menu_item_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL,
  p_reservation_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_meal_type TEXT DEFAULT NULL,
  p_order_source TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feedback_id UUID;
BEGIN
  INSERT INTO meal_feedback (
    guest_id, menu_item_id, rating, comment,
    reservation_id, order_id, meal_type, order_source
  ) VALUES (
    p_guest_id, p_menu_item_id, p_rating, p_comment,
    p_reservation_id, p_order_id, p_meal_type, p_order_source
  ) RETURNING id INTO v_feedback_id;

  -- Update or create favorite
  INSERT INTO meal_favorites (guest_id, menu_item_id, times_ordered, last_ordered_at)
  VALUES (p_guest_id, p_menu_item_id, 1, now())
  ON CONFLICT (guest_id, menu_item_id) DO UPDATE SET
    times_ordered = meal_favorites.times_ordered + 1,
    last_ordered_at = now();

  RETURN v_feedback_id;
END;
$$;

-- ─── 4. FUNCTION: Get guest's complete meal history ───
CREATE OR REPLACE FUNCTION get_guest_meal_history(
  p_guest_id UUID
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  item_name TEXT,
  item_price NUMERIC,
  quantity INTEGER,
  total NUMERIC,
  order_status TEXT,
  order_source TEXT,
  order_date TIMESTAMPTZ,
  has_feedback BOOLEAN,
  feedback_rating INTEGER,
  is_favorite BOOLEAN,
  menu_item_id UUID,
  category_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ro.id as order_id,
    ro.order_number,
    mi.name as item_name,
    roi.unit_price as item_price,
    roi.quantity,
    roi.subtotal as total,
    ro.status as order_status,
    ro.source as order_source,
    ro.created_at as order_date,
    EXISTS(SELECT 1 FROM meal_feedback mf WHERE mf.order_id = ro.id AND mf.guest_id = p_guest_id) as has_feedback,
    (SELECT mf.rating FROM meal_feedback mf WHERE mf.order_id = ro.id AND mf.guest_id = p_guest_id LIMIT 1) as feedback_rating,
    EXISTS(SELECT 1 FROM meal_favorites mfa WHERE mfa.guest_id = p_guest_id AND mfa.menu_item_id = roi.menu_item_id) as is_favorite,
    roi.menu_item_id,
    mc.name as category_name
  FROM restaurant_orders ro
  JOIN restaurant_order_items roi ON roi.order_id = ro.id
  JOIN menu_items mi ON mi.id = roi.menu_item_id
  LEFT JOIN menu_categories mc ON mc.id = mi.category_id
  WHERE ro.guest_id = p_guest_id
  ORDER BY ro.created_at DESC;
END;
$$;

-- ─── 5. FUNCTION: Get guest's favorites (for quick re-order) ───
CREATE OR REPLACE FUNCTION get_guest_favorites(
  p_guest_id UUID
)
RETURNS TABLE (
  menu_item_id UUID,
  item_name TEXT,
  item_price NUMERIC,
  item_image TEXT,
  times_ordered INTEGER,
  last_ordered_at TIMESTAMPTZ,
  avg_rating NUMERIC,
  category_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mfa.menu_item_id,
    mi.name as item_name,
    mi.price as item_price,
    mi.image_url as item_image,
    mfa.times_ordered,
    mfa.last_ordered_at,
    (SELECT ROUND(AVG(mf.rating), 1) FROM meal_feedback mf WHERE mf.menu_item_id = mfa.menu_item_id AND mf.guest_id = p_guest_id) as avg_rating,
    mc.name as category_name
  FROM meal_favorites mfa
  JOIN menu_items mi ON mi.id = mfa.menu_item_id
  LEFT JOIN menu_categories mc ON mc.id = mi.category_id
  WHERE mfa.guest_id = p_guest_id
  ORDER BY mfa.times_ordered DESC, mfa.last_ordered_at DESC;
END;
$$;
