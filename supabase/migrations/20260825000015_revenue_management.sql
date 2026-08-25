-- ═══════════════════════════════════════════════════════════════
-- REVENUE MANAGEMENT SYSTEM — All 3 Phases
-- Phase 1: Date-range pricing, min stay, calendar
-- Phase 2: Auto-pricing, rate fencing, seasonal templates
-- Phase 3: Overbooking, revenue optimization
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. RATE OVERRIDES (Date-range pricing) ───
CREATE TABLE IF NOT EXISTS rate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rate NUMERIC(10,2) NOT NULL CHECK (rate > 0),
  reason TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'auto', 'seasonal', 'event')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_rate_overrides_dates ON rate_overrides(room_type_id, start_date, end_date);
CREATE INDEX idx_rate_overrides_active ON rate_overrides(is_active) WHERE is_active = true;

ALTER TABLE rate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager manage rate overrides"
  ON rate_overrides FOR ALL
  USING (is_admin() OR is_manager());

CREATE POLICY "Staff read rate overrides"
  ON rate_overrides FOR SELECT
  USING (is_receptionist() OR is_chef() OR is_waiter() OR is_housekeeper());

-- ─── 2. MINIMUM STAY RULES ───
CREATE TABLE IF NOT EXISTS min_stay_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_date DATE,
  end_date DATE,
  min_nights INTEGER NOT NULL CHECK (min_nights >= 1 AND min_nights <= 30),
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_min_stay_date ON min_stay_rules(start_date, end_date);
CREATE INDEX idx_min_stay_dow ON min_stay_rules(day_of_week);

ALTER TABLE min_stay_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager manage min stay"
  ON min_stay_rules FOR ALL
  USING (is_admin() OR is_manager());

CREATE POLICY "Staff read min stay"
  ON min_stay_rules FOR SELECT
  USING (is_receptionist());

-- ─── 3. PRICING RULES (Auto-pricing engine) ───
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('occupancy', 'booking_pace', 'seasonal', 'event', 'day_of_week')),
  
  -- Conditions
  min_occupancy_pct NUMERIC,
  max_occupancy_pct NUMERIC,
  days_before_check_in_min INTEGER,
  days_before_check_in_max INTEGER,
  applies_day_of_week INTEGER CHECK (applies_day_of_week >= 0 AND applies_day_of_week <= 6),
  start_date DATE,
  end_date DATE,
  
  -- Action
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('percentage', 'fixed_amount')),
  adjustment_value NUMERIC NOT NULL,
  
  -- Constraints
  min_rate NUMERIC(10,2),
  max_rate NUMERIC(10,2),
  
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active) WHERE is_active = true;

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager manage pricing rules"
  ON pricing_rules FOR ALL
  USING (is_admin() OR is_manager());

-- ─── 4. RATE PLANS (Fencing) ───
CREATE TABLE IF NOT EXISTS rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  
  -- Pricing
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(10,2),
  
  -- Conditions
  min_nights INTEGER DEFAULT 1,
  max_nights INTEGER,
  advance_booking_days INTEGER,
  requires_corporate_code BOOLEAN DEFAULT false,
  is_refundable BOOLEAN DEFAULT true,
  cancellation_hours INTEGER DEFAULT 24,
  
  -- Applies to
  room_type_ids UUID[],
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager manage rate plans"
  ON rate_plans FOR ALL
  USING (is_admin() OR is_manager());

CREATE POLICY "Staff read rate plans"
  ON rate_plans FOR SELECT
  USING (is_receptionist());

-- ─── 5. SEASONAL TEMPLATES ───
CREATE TABLE IF NOT EXISTS seasonal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- The rates this template sets
  single_rate NUMERIC(10,2),
  twin_rate NUMERIC(10,2),
  studio_rate NUMERIC(10,2),
  
  -- When to apply
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  year_recurring BOOLEAN DEFAULT false,
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CHECK (end_date >= start_date)
);

ALTER TABLE seasonal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager manage seasonal templates"
  ON seasonal_templates FOR ALL
  USING (is_admin() OR is_manager());

-- ─── 6. OVERBOOKING SETTINGS ───
INSERT INTO site_settings (key, value) VALUES
  ('overbooking_enabled', 'false'),
  ('overbooking_max_pct', '10'),
  ('overbooking_safety_margin', '5'),
  ('overbooking_requires_approval', 'true'),
  ('pricing_auto_enabled', 'false'),
  ('pricing_check_interval_minutes', '60')
ON CONFLICT (key) DO NOTHING;

-- ─── 7. REVENUE FUNCTIONS ───

-- Get effective rate for a room type on a specific date
CREATE OR REPLACE FUNCTION get_effective_rate(
  p_room_type_id UUID,
  p_date DATE,
  p_rate_plan_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_rate NUMERIC;
  v_override_rate NUMERIC;
  v_final_rate NUMERIC;
  v_plan_discount NUMERIC;
BEGIN
  -- Get base rate
  SELECT base_rate INTO v_base_rate FROM room_types WHERE id = p_room_type_id;
  
  -- Check for override on this date
  SELECT rate INTO v_override_rate
  FROM rate_overrides
  WHERE room_type_id = p_room_type_id
    AND is_active = true
    AND start_date <= p_date
    AND end_date >= p_date
  ORDER BY created_at DESC
  LIMIT 1;
  
  v_final_rate := COALESCE(v_override_rate, v_base_rate);
  
  -- Apply rate plan discount if specified
  IF p_rate_plan_id IS NOT NULL THEN
    SELECT 
      CASE discount_type
        WHEN 'percentage' THEN v_final_rate * (1 - discount_value / 100)
        WHEN 'fixed_amount' THEN GREATEST(100, v_final_rate - discount_value)
        ELSE v_final_rate
      END
    INTO v_plan_discount
    FROM rate_plans WHERE id = p_rate_plan_id AND is_active = true;
    
    v_final_rate := COALESCE(v_plan_discount, v_final_rate);
  END IF;
  
  RETURN v_final_rate;
END;
$$;

-- Calculate total stay cost with date-range pricing
CREATE OR REPLACE FUNCTION calculate_stay_total(
  p_room_type_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_rate_plan_id UUID DEFAULT NULL
)
RETURNS TABLE (
  nightly_rates JSONB,
  total NUMERIC,
  nights INTEGER,
  avg_rate NUMERIC,
  savings NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_rate NUMERIC;
  v_day DATE;
  v_rate NUMERIC;
  v_rates JSONB := '[]'::JSONB;
  v_total NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  SELECT base_rate INTO v_base_rate FROM room_types WHERE id = p_room_type_id;
  
  v_day := p_check_in;
  WHILE v_day < p_check_out LOOP
    v_rate := get_effective_rate(p_room_type_id, v_day, p_rate_plan_id);
    v_rates := v_rates || jsonb_build_object('date', v_day, 'rate', v_rate);
    v_total := v_total + v_rate;
    v_count := v_count + 1;
    v_day := v_day + 1;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_rates,
    v_total,
    v_count,
    CASE WHEN v_count > 0 THEN v_total / v_count ELSE 0 END,
    GREATEST(0, (v_base_rate * v_count) - v_total);
END;
$$;

-- Check minimum stay requirement
CREATE OR REPLACE FUNCTION check_min_stay(
  p_room_type_id UUID,
  p_check_in DATE,
  p_check_out DATE
)
RETURNS TABLE (
  meets_minimum BOOLEAN,
  required_nights INTEGER,
  requested_nights INTEGER,
  message TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_nights INTEGER := 1;
  v_requested INTEGER;
  v_rule RECORD;
BEGIN
  v_requested := GREATEST(1, (p_check_out - p_check_in)::INTEGER);
  
  -- Check specific date rules first
  FOR v_rule IN
    SELECT msr.min_nights
    FROM min_stay_rules msr
    WHERE msr.is_active = true
      AND (msr.room_type_id IS NULL OR msr.room_type_id = p_room_type_id)
      AND (msr.start_date IS NULL OR msr.start_date <= p_check_in)
      AND (msr.end_date IS NULL OR msr.end_date >= p_check_in)
      AND (msr.day_of_week IS NULL OR msr.day_of_week = EXTRACT(DOW FROM p_check_in)::INTEGER)
    ORDER BY msr.min_nights DESC
    LIMIT 1
  LOOP
    v_min_nights := GREATEST(v_min_nights, v_rule.min_nights);
  END LOOP;
  
  RETURN QUERY SELECT
    v_requested >= v_min_nights,
    v_min_nights,
    v_requested,
    CASE 
      WHEN v_requested < v_min_nights THEN 
        'Minimum stay is ' || v_min_nights || ' nights. You requested ' || v_requested || ' night(s).'
      ELSE 'OK'
    END;
END;
$$;

-- Apply auto-pricing based on occupancy
CREATE OR REPLACE FUNCTION apply_auto_pricing()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_room_type RECORD;
  v_date DATE;
  v_occupied INTEGER;
  v_total INTEGER;
  v_occupancy_pct NUMERIC;
  v_new_rate NUMERIC;
  v_adjusted INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
BEGIN
  -- Only run if auto-pricing is enabled
  IF NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'pricing_auto_enabled' AND value = 'true') THEN
    RETURN jsonb_build_object('enabled', false, 'message', 'Auto-pricing is disabled');
  END IF;
  
  -- For each room type
  FOR v_room_type IN SELECT id, name, base_rate FROM room_types WHERE is_active = true
  LOOP
    -- Check next 30 days
    FOR v_date IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day')::DATE
    LOOP
      -- Calculate occupancy for this date
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('confirmed', 'checked_in')),
        (SELECT COUNT(*) FROM rooms WHERE room_type_id = v_room_type.id AND is_active = true)
      INTO v_occupied, v_total
      FROM reservations
      WHERE room_type_id = v_room_type.id
        AND status IN ('confirmed', 'checked_in')
        AND check_in <= v_date AND check_out > v_date;
      
      IF v_total = 0 THEN CONTINUE; END IF;
      
      v_occupancy_pct := (v_occupied::NUMERIC / v_total) * 100;
      
      -- Find matching pricing rules
      FOR v_rule IN
        SELECT * FROM pricing_rules
        WHERE is_active = true
          AND rule_type = 'occupancy'
          AND min_occupancy_pct <= v_occupancy_pct
          AND max_occupancy_pct >= v_occupancy_pct
          AND (start_date IS NULL OR start_date <= v_date)
          AND (end_date IS NULL OR end_date >= v_date)
        ORDER BY priority DESC
        LIMIT 1
      LOOP
        -- Calculate new rate
        IF v_rule.adjustment_type = 'percentage' THEN
          v_new_rate := v_room_type.base_rate * (1 + v_rule.adjustment_value / 100);
        ELSE
          v_new_rate := v_room_type.base_rate + v_rule.adjustment_value;
        END IF;
        
        -- Apply min/max bounds
        IF v_rule.min_rate IS NOT NULL THEN
          v_new_rate := GREATEST(v_new_rate, v_rule.min_rate);
        END IF;
        IF v_rule.max_rate IS NOT NULL THEN
          v_new_rate := LEAST(v_new_rate, v_rule.max_rate);
        END IF;
        
        -- Upsert rate override
        INSERT INTO rate_overrides (room_type_id, start_date, end_date, rate, reason, source)
        VALUES (v_room_type.id, v_date, v_date, v_new_rate, 
          'Auto: ' || v_rule.name || ' (occupancy: ' || ROUND(v_occupancy_pct) || '%)', 'auto')
        ON CONFLICT DO NOTHING;
        
        v_adjusted := v_adjusted + 1;
        v_results := v_results || jsonb_build_object(
          'room_type', v_room_type.name,
          'date', v_date,
          'occupancy', ROUND(v_occupancy_pct),
          'new_rate', v_new_rate,
          'rule', v_rule.name
        );
      END LOOP;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'enabled', true,
    'adjusted', v_adjusted,
    'details', v_results
  );
END;
$$;

-- Calculate safe overbooking limit
CREATE OR REPLACE FUNCTION calculate_overbooking_limit()
RETURNS TABLE (
  room_type_name TEXT,
  total_rooms INTEGER,
  cancellation_rate NUMERIC,
  safe_overbook INTEGER,
  max_allowed INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_pct NUMERIC;
BEGIN
  SELECT value::NUMERIC INTO v_max_pct
  FROM site_settings WHERE key = 'overbooking_max_pct';
  v_max_pct := COALESCE(v_max_pct, 10);
  
  RETURN QUERY
  WITH cancellation_stats AS (
    SELECT 
      rt.name as rtype,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE r.status = 'cancelled') as cancelled
    FROM reservations r
    JOIN room_types rt ON rt.id = r.room_type_id
    WHERE r.created_at > NOW() - INTERVAL '90 days'
    GROUP BY rt.id, rt.name
  ),
  room_counts AS (
    SELECT rt.name as rtype, COUNT(*) as cnt
    FROM rooms rm
    JOIN room_types rt ON rt.id = rm.room_type_id
    WHERE rm.is_active = true
    GROUP BY rt.id, rt.name
  )
  SELECT 
    cs.rtype,
    COALESCE(rc.cnt, 0)::INTEGER,
    CASE WHEN cs.total > 0 THEN (cs.cancelled::NUMERIC / cs.total * 100) ELSE 0 END,
    GREATEST(0, ROUND((COALESCE(rc.cnt, 0) * v_max_pct / 100) - (cs.cancelled::NUMERIC / GREATEST(cs.total, 1) * COALESCE(rc.cnt, 0))))::INTEGER,
    (COALESCE(rc.cnt, 0) * v_max_pct / 100)::INTEGER
  FROM cancellation_stats cs
  LEFT JOIN room_counts rc ON rc.rtype = cs.rtype;
END;
$$;

-- Get revenue summary for dashboard
CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_start DATE;
  v_room_revenue NUMERIC;
  v_restaurant_revenue NUMERIC;
  v_avg_occupancy NUMERIC;
  v_total_bookings INTEGER;
  v_cancelled_bookings INTEGER;
  v_avg_rate NUMERIC;
  v_revpar NUMERIC;
  v_total_rooms INTEGER;
BEGIN
  v_start := CURRENT_DATE - p_days;
  
  -- Room revenue
  SELECT COALESCE(SUM(amount), 0) INTO v_room_revenue
  FROM folio_transactions ft
  JOIN folios f ON f.id = ft.folio_id
  JOIN reservations r ON r.id = f.reservation_id
  WHERE ft.type = 'room_charge'
    AND ft.created_at >= v_start;
  
  -- Restaurant revenue
  SELECT COALESCE(SUM(total), 0) INTO v_restaurant_revenue
  FROM restaurant_orders
  WHERE created_at >= v_start
    AND status NOT IN ('cancelled');
  
  -- Occupancy
  SELECT COUNT(*) INTO v_total_rooms FROM rooms WHERE is_active = true;
  
  WITH daily_occ AS (
    SELECT 
      d::DATE as day,
      (SELECT COUNT(*) FROM reservations r 
       WHERE r.status IN ('confirmed','checked_in') 
       AND r.check_in <= d AND r.check_out > d) as occupied
    FROM generate_series(v_start, CURRENT_DATE, '1 day') d
  )
  SELECT AVG(occupied::NUMERIC / GREATEST(v_total_rooms, 1) * 100) INTO v_avg_occupancy
  FROM daily_occ;
  
  -- Bookings
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO v_total_bookings, v_cancelled_bookings
  FROM reservations WHERE created_at >= v_start;
  
  -- ADR & RevPAR
  v_avg_rate := CASE WHEN v_total_bookings > 0 THEN v_room_revenue / v_total_bookings / GREATEST(p_days, 1) ELSE 0 END;
  v_revpar := CASE WHEN v_total_rooms > 0 THEN v_room_revenue / v_total_rooms / GREATEST(p_days, 1) ELSE 0 END;
  
  SELECT jsonb_build_object(
    'period_days', p_days,
    'room_revenue', v_room_revenue,
    'restaurant_revenue', v_restaurant_revenue,
    'total_revenue', v_room_revenue + v_restaurant_revenue,
    'avg_occupancy_pct', ROUND(COALESCE(v_avg_occupancy, 0), 1),
    'total_bookings', v_total_bookings,
    'cancelled_bookings', v_cancelled_bookings,
    'cancellation_rate_pct', CASE WHEN v_total_bookings > 0 THEN ROUND(v_cancelled_bookings::NUMERIC / v_total_bookings * 100, 1) ELSE 0 END,
    'avg_daily_rate', ROUND(v_avg_rate, 0),
    'revpar', ROUND(v_revpar, 0),
    'total_rooms', v_total_rooms
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
