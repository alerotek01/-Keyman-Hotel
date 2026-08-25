-- ═══════════════════════════════════════════════════════════════
-- COMPETITOR RATE MONITORING — OTA Price Intelligence
-- ═══════════════════════════════════════════════════════════════

-- 1. COMPETITOR HOTELS — Hotels we track
CREATE TABLE IF NOT EXISTS competitor_hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT DEFAULT 'Mwatate / Taita Hills',
  
  -- OTA identifiers (for scraping)
  booking_com_url TEXT,          -- Full Booking.com URL or search slug
  booking_com_hotel_id TEXT,     -- Booking.com hotel ID (from URL)
  expedia_url TEXT,
  expedia_hotel_id TEXT,
  google_hotels_url TEXT,
  
  -- Classification
  star_rating INTEGER CHECK (star_rating >= 1 AND star_rating <= 5),
  hotel_type TEXT CHECK (hotel_type IN ('budget', 'mid_range', 'luxury', 'lodge', 'resort')),
  
  -- Key metrics (scraped)
  average_review_score NUMERIC(3,1),
  total_reviews INTEGER DEFAULT 0,
  
  -- Tracking
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. COMPETITOR RATES — Daily rate snapshots
CREATE TABLE IF NOT EXISTS competitor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_hotel_id UUID NOT NULL REFERENCES competitor_hotels(id) ON DELETE CASCADE,
  
  -- Date being priced
  stay_date DATE NOT NULL,
  
  -- Room details
  room_type TEXT,                -- 'Standard', 'Deluxe', 'Suite' as shown on OTA
  room_name TEXT,                -- Full room name from OTA
  
  -- Pricing
  rate NUMERIC(10,2) NOT NULL,  -- Displayed rate
  currency TEXT DEFAULT 'KES',   -- Currency shown
  rate_per_night NUMERIC(10,2), -- If total is shown, compute per-night
  
  -- Context
  source TEXT NOT NULL CHECK (source IN ('booking_com', 'expedia', 'google_hotels', 'manual')),
  source_url TEXT,               -- Direct link to the search/property page
  
  -- Room details from OTA
  cancellation_policy TEXT,      -- 'Free cancellation', 'Non-refundable'
  meal_plan TEXT,                -- 'Room only', 'Breakfast included'
  guest_count INTEGER DEFAULT 2,
  
  -- Metadata
  scraped_at TIMESTAMPTZ DEFAULT now(),
  search_check_in DATE,         -- The check-in date used in the search
  search_check_out DATE,        -- The check-out date used in the search
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_competitor_rates_hotel_date ON competitor_rates(competitor_hotel_id, stay_date);
CREATE INDEX idx_competitor_rates_date ON competitor_rates(stay_date);
CREATE INDEX idx_competitor_rates_source ON competitor_rates(source, scraped_at DESC);

-- 3. SCRAPE LOGS — Track scraping operations
CREATE TABLE IF NOT EXISTS competitor_scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  source TEXT NOT NULL,          -- 'booking_com', 'expedia', 'manual'
  search_query TEXT,             -- What we searched for
  
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  
  hotels_found INTEGER DEFAULT 0,
  rates_scraped INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  
  -- Scraping details
  duration_ms INTEGER,
  response_size_bytes INTEGER,
  error_message TEXT,
  
  -- Search parameters used
  search_destination TEXT,
  search_check_in DATE,
  search_check_out DATE,
  search_adults INTEGER DEFAULT 2,
  search_currency TEXT DEFAULT 'KES',
  
  triggered_by TEXT DEFAULT 'auto',
  triggered_by_user UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RATE ALERTS — When competitor prices change significantly
CREATE TABLE IF NOT EXISTS competitor_rate_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_hotel_id UUID NOT NULL REFERENCES competitor_hotels(id) ON DELETE CASCADE,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'price_drop',        -- Competitor dropped price
    'price_increase',    -- Competitor raised price
    'below_ours',        -- Competitor now cheaper than us
    'above_ours',        -- Competitor now more expensive than us
    'new_competitor',    -- New competitor detected
    'sold_out'           -- Competitor sold out
  )),
  
  room_type TEXT,
  stay_date DATE,
  
  old_rate NUMERIC(10,2),
  new_rate NUMERIC(10,2),
  our_rate NUMERIC(10,2),
  
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rate_alerts_unread ON competitor_rate_alerts(is_read, created_at DESC);

-- 5. RLS
ALTER TABLE competitor_hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_scrape_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_rate_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage competitors" ON competitor_hotels FOR ALL USING (is_admin());
CREATE POLICY "Manager view competitors" ON competitor_hotels FOR SELECT USING (is_manager());

CREATE POLICY "Admin manage competitor rates" ON competitor_rates FOR ALL USING (is_admin());
CREATE POLICY "Manager view competitor rates" ON competitor_rates FOR SELECT USING (is_manager());

CREATE POLICY "Admin manage scrape logs" ON competitor_scrape_logs FOR ALL USING (is_admin());
CREATE POLICY "Manager view scrape logs" ON competitor_scrape_logs FOR SELECT USING (is_manager());

CREATE POLICY "Admin manage rate alerts" ON competitor_rate_alerts FOR ALL USING (is_admin());
CREATE POLICY "Manager view rate alerts" ON competitor_rate_alerts FOR SELECT USING (is_manager());

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Record a competitor rate
CREATE OR REPLACE FUNCTION record_competitor_rate(
  p_competitor_hotel_id UUID,
  p_stay_date DATE,
  p_rate NUMERIC,
  p_currency TEXT DEFAULT 'KES',
  p_room_type TEXT DEFAULT NULL,
  p_room_name TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual',
  p_source_url TEXT DEFAULT NULL,
  p_cancellation_policy TEXT DEFAULT NULL,
  p_meal_plan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate_id UUID;
  v_our_rate NUMERIC;
  v_old_rate NUMERIC;
BEGIN
  -- Insert the rate
  INSERT INTO competitor_rates (
    competitor_hotel_id, stay_date, rate, currency,
    room_type, room_name, source, source_url,
    cancellation_policy, meal_plan,
    search_check_in, search_check_out
  ) VALUES (
    p_competitor_hotel_id, p_stay_date, p_rate, p_currency,
    p_room_type, p_room_name, p_source, p_source_url,
    p_cancellation_policy, p_meal_plan,
    p_stay_date, p_stay_date + 1
  ) RETURNING id INTO v_rate_id;
  
  -- Get our rate for the same date (use average room type rate)
  SELECT AVG(base_rate) INTO v_our_rate
  FROM room_types WHERE is_active = true;
  
  -- Get previous competitor rate
  SELECT rate INTO v_old_rate
  FROM competitor_rates
  WHERE competitor_hotel_id = p_competitor_hotel_id
    AND stay_date = p_stay_date
    AND source = p_source
    AND id != v_rate_id
  ORDER BY scraped_at DESC
  LIMIT 1;
  
  -- Generate alerts
  IF v_old_rate IS NOT NULL AND v_old_rate != p_rate THEN
    IF p_rate < v_old_rate THEN
      INSERT INTO competitor_rate_alerts (competitor_hotel_id, alert_type, room_type, stay_date, old_rate, new_rate, our_rate, message)
      VALUES (p_competitor_hotel_id, 'price_drop', p_room_type, p_stay_date, v_old_rate, p_rate, v_our_rate,
        p_room_type || ' rate dropped from ' || v_old_rate || ' to ' || p_rate || ' ' || p_currency);
    ELSIF p_rate > v_old_rate THEN
      INSERT INTO competitor_rate_alerts (competitor_hotel_id, alert_type, room_type, stay_date, old_rate, new_rate, our_rate, message)
      VALUES (p_competitor_hotel_id, 'price_increase', p_room_type, p_stay_date, v_old_rate, p_rate, v_our_rate,
        p_room_type || ' rate increased from ' || v_old_rate || ' to ' || p_rate || ' ' || p_currency);
    END IF;
  END IF;
  
  -- Alert if below our rate
  IF v_our_rate IS NOT NULL AND p_rate < v_our_rate THEN
    INSERT INTO competitor_rate_alerts (competitor_hotel_id, alert_type, room_type, stay_date, old_rate, new_rate, our_rate, message)
    VALUES (p_competitor_hotel_id, 'below_ours', p_room_type, p_stay_date, v_old_rate, p_rate, v_our_rate,
        p_room_type || ' at ' || p_rate || ' ' || p_currency || ' is below our rate of ' || v_our_rate || ' KES');
  END IF;
  
  RETURN v_rate_id;
END;
$$;

-- Get competitor rate comparison
CREATE OR REPLACE FUNCTION get_competitor_comparison(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_our_avg NUMERIC;
BEGIN
  -- Get our average rate
  SELECT AVG(base_rate) INTO v_our_avg FROM room_types WHERE is_active = true;
  
  WITH latest_rates AS (
    SELECT DISTINCT ON (cr.competitor_hotel_id, cr.room_type)
      cr.competitor_hotel_id,
      cr.room_type,
      cr.rate,
      cr.currency,
      cr.source,
      cr.cancellation_policy,
      cr.meal_plan,
      cr.scraped_at
    FROM competitor_rates cr
    WHERE cr.stay_date = p_date
      AND cr.scraped_at > NOW() - INTERVAL '7 days'
    ORDER BY cr.competitor_hotel_id, cr.room_type, cr.scraped_at DESC
  )
  SELECT jsonb_build_object(
    'date', p_date,
    'our_average_rate', ROUND(v_our_avg, 0),
    'competitors', jsonb_agg(jsonb_build_object(
      'hotel_name', ch.name,
      'hotel_type', ch.hotel_type,
      'star_rating', ch.star_rating,
      'room_type', lr.room_type,
      'rate', lr.rate,
      'currency', lr.currency,
      'source', lr.source,
      'cancellation', lr.cancellation_policy,
      'meal_plan', lr.meal_plan,
      'vs_our_rate', ROUND(lr.rate - v_our_avg, 0),
      'vs_our_pct', CASE WHEN v_our_avg > 0 THEN ROUND((lr.rate - v_our_avg) / v_our_avg * 100, 1) ELSE 0 END,
      'last_scraped', lr.scraped_at
    ))
  ) INTO v_result
  FROM latest_rates lr
  JOIN competitor_hotels ch ON ch.id = lr.competitor_hotel_id
  WHERE ch.is_active = true;
  
  RETURN COALESCE(v_result, jsonb_build_object('date', p_date, 'our_average_rate', v_our_avg, 'competitors', '[]'::JSONB));
END;
$$;

-- Get rate trends for a competitor
CREATE OR REPLACE FUNCTION get_competitor_trends(
  p_competitor_hotel_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH daily_rates AS (
    SELECT 
      cr.stay_date,
      cr.room_type,
      AVG(cr.rate) as avg_rate,
      MIN(cr.rate) as min_rate,
      MAX(cr.rate) as max_rate,
      COUNT(*) as data_points
    FROM competitor_rates cr
    WHERE cr.competitor_hotel_id = p_competitor_hotel_id
      AND cr.scraped_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY cr.stay_date, cr.room_type
    ORDER BY cr.stay_date
  )
  SELECT jsonb_build_object(
    'competitor_id', p_competitor_hotel_id,
    'period_days', p_days,
    'trends', jsonb_agg(jsonb_build_object(
      'date', dr.stay_date,
      'room_type', dr.room_type,
      'avg_rate', ROUND(dr.avg_rate, 0),
      'min_rate', ROUND(dr.min_rate, 0),
      'max_rate', ROUND(dr.max_rate, 0),
      'data_points', dr.data_points
    ))
  ) INTO v_result
  FROM daily_rates dr;
  
  RETURN COALESCE(v_result, jsonb_build_object('competitor_id', p_competitor_hotel_id, 'trends', '[]'::JSONB));
END;
$$;

-- Get rate alerts
CREATE OR REPLACE FUNCTION get_rate_alerts(
  p_unread_only BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id', ra.id,
      'hotel_name', ch.name,
      'alert_type', ra.alert_type,
      'room_type', ra.room_type,
      'stay_date', ra.stay_date,
      'old_rate', ra.old_rate,
      'new_rate', ra.new_rate,
      'our_rate', ra.our_rate,
      'message', ra.message,
      'is_read', ra.is_read,
      'created_at', ra.created_at
    ))
    FROM competitor_rate_alerts ra
    JOIN competitor_hotels ch ON ch.id = ra.competitor_hotel_id
    WHERE (NOT p_unread_only OR ra.is_read = false)
    ORDER BY ra.created_at DESC
    LIMIT 50
  );
END;
$$;

-- Mark alert as read
CREATE OR REPLACE FUNCTION mark_alert_read(p_alert_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE competitor_rate_alerts SET is_read = true WHERE id = p_alert_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- SEED COMPETITOR HOTELS (Mwatate / Taita Hills area)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO competitor_hotels (name, location, hotel_type, star_rating, booking_com_url, is_active) VALUES
  ('Taita Rocks Hotel', 'Mwatate, Taita Taveta', 'mid_range', 3, 'https://www.booking.com/city/ke/mwatate.html', true),
  ('Taita Hills Safari Resort & Spa', 'Taita Hills, Tsavo West', 'resort', 4, 'https://www.booking.com/hotel/ke/sarova-taita-hills-game-lodge.html', true),
  ('Salt Lick Safari Lodge', 'Taita Hills Wildlife Sanctuary', 'lodge', 4, 'https://www.booking.com/hotel/ke/salt-lick-safari-lodge.html', true),
  ('Soroi Lions Bluff Lodge', 'Taita Hills Wildlife Sanctuary', 'lodge', 4, 'https://www.booking.com/hotel/ke/soroi-lions-bluff-lodge.html', true),
  ('Voi Wildlife Lodge', 'Voi, Taita Taveta', 'mid_range', 3, 'https://www.booking.com/hotel/ke/voi-wildlife-lodge.html', true),
  ('Afrika Lodges', 'Voi, Taita Taveta', 'budget', 2, NULL, true),
  ('Ilala House Voi', 'Voi Town', 'budget', 2, NULL, true)
ON CONFLICT DO NOTHING;
