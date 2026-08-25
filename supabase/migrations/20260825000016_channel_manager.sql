-- ═══════════════════════════════════════════════════════════════
-- CHANNEL MANAGER — OTA Integration (Booking.com, Expedia, Airbnb)
-- ═══════════════════════════════════════════════════════════════

-- 1. CHANNELS — Connected OTAs
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- 'Booking.com', 'Expedia', 'Airbnb'
  code TEXT UNIQUE NOT NULL,                   -- 'booking_com', 'expedia', 'airbnb'
  logo_url TEXT,
  
  -- API Configuration
  api_base_url TEXT,
  auth_type TEXT DEFAULT 'oauth2' CHECK (auth_type IN ('api_key', 'oauth2', 'basic')),
  
  -- Credentials (encrypted at rest via Supabase Vault or app-level)
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Connection Status
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'testing')),
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Settings
  auto_sync_rates BOOLEAN DEFAULT true,
  auto_sync_availability BOOLEAN DEFAULT true,
  auto_pull_bookings BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 60,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CHANNEL ROOM MAPPINGS — Map our room types to OTA room types
CREATE TABLE IF NOT EXISTS channel_room_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  
  -- Our side
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  
  -- OTA side
  ota_room_type_id TEXT NOT NULL,              -- Booking.com's room_type_id
  ota_room_name TEXT,                          -- Human-readable name on OTA
  ota_rate_plan_id TEXT,                       -- Rate plan on OTA
  ota_rate_plan_name TEXT,
  
  -- Pricing
  rate_multiplier NUMERIC(5,4) DEFAULT 1.0,   -- e.g., 1.10 = 10% markup on OTA
  rate_offset NUMERIC(10,2) DEFAULT 0,        -- Fixed KES adjustment
  
  -- Availability
  is_active BOOLEAN DEFAULT true,
  ota_allotment INTEGER,                       -- Max rooms to sell on this OTA
  
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(channel_id, room_type_id, ota_rate_plan_id)
);

-- 3. CHANNEL SYNC LOG — Track every sync operation
CREATE TABLE IF NOT EXISTS channel_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  
  sync_type TEXT NOT NULL CHECK (sync_type IN (
    'rate_push',           -- Push rates from Keyman to OTA
    'availability_push',   -- Push room availability to OTA
    'booking_pull',        -- Pull reservations from OTA
    'status_push',         -- Push room status change
    'full_sync'            -- Full rate + availability sync
  )),
  
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  
  -- What was synced
  room_types_synced INTEGER DEFAULT 0,
  dates_synced INTEGER DEFAULT 0,
  bookings_synced INTEGER DEFAULT 0,
  
  -- Result details
  request_payload JSONB,
  response_summary TEXT,
  error_details TEXT,
  
  -- Performance
  duration_ms INTEGER,
  
  triggered_by TEXT DEFAULT 'auto',            -- 'auto', 'manual', 'webhook'
  triggered_by_user UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CHANNEL BOOKINGS — Bookings pulled from OTAs (maps to our reservations)
CREATE TABLE IF NOT EXISTS channel_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id),  -- Our linked reservation
  
  -- OTA booking details
  ota_booking_id TEXT NOT NULL,                -- Booking.com/Expedia reservation ID
  ota_guest_name TEXT,
  ota_guest_email TEXT,
  ota_guest_phone TEXT,
  
  -- Stay details
  room_type_id UUID REFERENCES room_types(id),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_adults INTEGER DEFAULT 1,
  num_children INTEGER DEFAULT 0,
  
  -- Financials
  ota_rate NUMERIC(10,2),                      -- Rate as reported by OTA
  ota_total NUMERIC(10,2),
  ota_commission NUMERIC(10,2),                -- OTA's commission
  net_revenue NUMERIC(10,2),                   -- What we actually receive
  
  -- Status
  ota_status TEXT,                              -- Status from OTA
  sync_status TEXT DEFAULT 'pulled' CHECK (sync_status IN (
    'pulled',           -- Received from OTA
    'mapped',           -- Mapped to our reservation
    'confirmed',        -- Check-in confirmed
    'modified',         -- OTA modified the booking
    'cancelled'         -- OTA cancelled
  )),
  
  -- Special requests
  ota_special_requests TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(channel_id, ota_booking_id)
);

-- 5. CHANNEL RATE OVERRIDES — Per-channel rate adjustments
CREATE TABLE IF NOT EXISTS channel_rate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  rate_override NUMERIC(10,2),                 -- Override rate (if set, ignores multiplier)
  rate_multiplier NUMERIC(5,4),                -- Multiplier on effective rate
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CHECK (end_date >= start_date)
);

-- 6. INDEXES
CREATE INDEX idx_channel_sync_log_channel ON channel_sync_log(channel_id, created_at DESC);
CREATE INDEX idx_channel_sync_log_type ON channel_sync_log(sync_type, status);
CREATE INDEX idx_channel_room_mappings_channel ON channel_room_mappings(channel_id, is_active);
CREATE INDEX idx_channel_bookings_channel ON channel_bookings(channel_id, ota_status);
CREATE INDEX idx_channel_bookings_dates ON channel_bookings(check_in, check_out);
CREATE INDEX idx_channel_rate_overrides_dates ON channel_rate_overrides(channel_id, room_type_id, start_date, end_date);

-- 7. RLS POLICIES
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_room_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_rate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage channels" ON channels FOR ALL USING (is_admin());
CREATE POLICY "Manager view channels" ON channels FOR SELECT USING (is_manager());

CREATE POLICY "Admin manage mappings" ON channel_room_mappings FOR ALL USING (is_admin());
CREATE POLICY "Manager view mappings" ON channel_room_mappings FOR SELECT USING (is_manager());

CREATE POLICY "Admin manage sync log" ON channel_sync_log FOR ALL USING (is_admin());
CREATE POLICY "Manager view sync log" ON channel_sync_log FOR SELECT USING (is_manager());

CREATE POLICY "Admin manage channel bookings" ON channel_bookings FOR ALL USING (is_admin());
CREATE POLICY "Manager view channel bookings" ON channel_bookings FOR SELECT USING (is_manager());
CREATE POLICY "Receptionist view channel bookings" ON channel_bookings FOR SELECT USING (is_receptionist());

CREATE POLICY "Admin manage channel rate overrides" ON channel_rate_overrides FOR ALL USING (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- CHANNEL SYNC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Get effective rate for a channel (with multiplier and override)
CREATE OR REPLACE FUNCTION get_channel_rate(
  p_channel_id UUID,
  p_room_type_id UUID,
  p_date DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_rate NUMERIC;
  v_multiplier NUMERIC;
  v_offset NUMERIC;
  v_override NUMERIC;
BEGIN
  -- Get base effective rate
  v_effective_rate := get_effective_rate(p_room_type_id, p_date, NULL);
  
  -- Get channel mapping multiplier/offset
  SELECT rate_multiplier, rate_offset
  INTO v_multiplier, v_offset
  FROM channel_room_mappings
  WHERE channel_id = p_channel_id
    AND room_type_id = p_room_type_id
    AND is_active = true;
  
  v_multiplier := COALESCE(v_multiplier, 1.0);
  v_offset := COALESCE(v_offset, 0);
  
  -- Apply multiplier and offset
  v_effective_rate := (v_effective_rate * v_multiplier) + v_offset;
  
  -- Check for channel-specific override
  SELECT rate_override INTO v_override
  FROM channel_rate_overrides
  WHERE channel_id = p_channel_id
    AND room_type_id = p_room_type_id
    AND is_active = true
    AND start_date <= p_date
    AND end_date >= p_date
  LIMIT 1;
  
  IF v_override IS NOT NULL THEN
    v_effective_rate := v_override;
  END IF;
  
  -- Ensure positive
  RETURN GREATEST(100, ROUND(v_effective_rate));
END;
$$;

-- Generate rate push payload for a channel
CREATE OR REPLACE FUNCTION generate_rate_push_payload(
  p_channel_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel RECORD;
  v_mapping RECORD;
  v_date DATE;
  v_rate NUMERIC;
  v_payload JSONB := '{}'::JSONB;
  v_rates JSONB := '[]'::JSONB;
BEGIN
  -- Get channel info
  SELECT * INTO v_channel FROM channels WHERE id = p_channel_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Channel not found');
  END IF;
  
  -- Build rates per room type per date
  FOR v_mapping IN
    SELECT * FROM channel_room_mappings
    WHERE channel_id = p_channel_id AND is_active = true
  LOOP
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      v_rate := get_channel_rate(p_channel_id, v_mapping.room_type_id, v_date);
      
      v_rates := v_rates || jsonb_build_object(
        'room_type_id', v_mapping.ota_room_type_id,
        'room_name', v_mapping.ota_room_name,
        'rate_plan_id', v_mapping.ota_rate_plan_id,
        'date', v_date,
        'rate', v_rate,
        'currency', 'KES',
        'min_stay', 1,
        'closed_to_arrival', false
      );
      
      v_date := v_date + 1;
    END LOOP;
  END LOOP;
  
  v_payload := jsonb_build_object(
    'channel', v_channel.code,
    'hotel_id', v_channel.api_key_encrypted,  -- OTA hotel ID stored here
    'start_date', p_start_date,
    'end_date', p_end_date,
    'rates', v_rates,
    'generated_at', now()
  );
  
  RETURN v_payload;
END;
$$;

-- Generate availability push payload
CREATE OR REPLACE FUNCTION generate_availability_push_payload(
  p_channel_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel RECORD;
  v_mapping RECORD;
  v_date DATE;
  v_total_rooms INTEGER;
  v_booked INTEGER;
  v_available INTEGER;
  v_payload JSONB;
  v_avail JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_channel FROM channels WHERE id = p_channel_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Channel not found');
  END IF;
  
  FOR v_mapping IN
    SELECT * FROM channel_room_mappings
    WHERE channel_id = p_channel_id AND is_active = true
  LOOP
    -- Count total rooms of this type
    SELECT COUNT(*) INTO v_total_rooms
    FROM rooms
    WHERE room_type_id = v_mapping.room_type_id AND is_active = true;
    
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      -- Count booked rooms for this date
      SELECT COUNT(*) INTO v_booked
      FROM reservations
      WHERE room_type_id = v_mapping.room_type_id
        AND status IN ('confirmed', 'checked_in')
        AND check_in <= v_date
        AND check_out > v_date;
      
      v_available := GREATEST(0, v_total_rooms - v_booked);
      
      -- Apply allotment cap
      IF v_mapping.ota_allotment IS NOT NULL THEN
        v_available := LEAST(v_available, v_mapping.ota_allotment);
      END IF;
      
      v_avail := v_avail || jsonb_build_object(
        'room_type_id', v_mapping.ota_room_type_id,
        'date', v_date,
        'available', v_available,
        'total', v_total_rooms,
        'booked', v_booked
      );
      
      v_date := v_date + 1;
    END LOOP;
  END LOOP;
  
  v_payload := jsonb_build_object(
    'channel', v_channel.code,
    'hotel_id', v_channel.api_key_encrypted,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'availability', v_avail,
    'generated_at', now()
  );
  
  RETURN v_payload;
END;
$$;

-- Log a sync operation
CREATE OR REPLACE FUNCTION log_channel_sync(
  p_channel_id UUID,
  p_sync_type TEXT,
  p_status TEXT,
  p_room_types_synced INTEGER DEFAULT 0,
  p_dates_synced INTEGER DEFAULT 0,
  p_bookings_synced INTEGER DEFAULT 0,
  p_response_summary TEXT DEFAULT NULL,
  p_error_details TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO channel_sync_log (
    channel_id, sync_type, status,
    room_types_synced, dates_synced, bookings_synced,
    response_summary, error_details, duration_ms,
    triggered_by_user
  ) VALUES (
    p_channel_id, p_sync_type, p_status,
    p_room_types_synced, p_dates_synced, p_bookings_synced,
    p_response_summary, p_error_details, p_duration_ms,
    auth.uid()
  ) RETURNING id INTO v_log_id;
  
  -- Update channel's last_sync_at
  UPDATE channels SET last_sync_at = now(), updated_at = now() WHERE id = p_channel_id;
  
  RETURN v_log_id;
END;
$$;

-- Get channel sync summary
CREATE OR REPLACE FUNCTION get_channel_sync_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'channel_id', c.id,
    'channel_name', c.name,
    'channel_code', c.code,
    'status', c.status,
    'last_sync_at', c.last_sync_at,
    'auto_sync', c.auto_sync_rates,
    'mappings_count', (SELECT COUNT(*) FROM channel_room_mappings crm WHERE crm.channel_id = c.id AND crm.is_active),
    'recent_syncs', (
      SELECT jsonb_agg(jsonb_build_object(
        'sync_type', cs.sync_type,
        'status', cs.status,
        'created_at', cs.created_at,
        'room_types_synced', cs.room_types_synced,
        'dates_synced', cs.dates_synced
      ))
      FROM channel_sync_log cs
      WHERE cs.channel_id = c.id
      ORDER BY cs.created_at DESC
      LIMIT 5
    )
  )) INTO v_result
  FROM channels c
  WHERE c.is_active = true
  ORDER BY c.name;
  
  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Seed default channels
INSERT INTO channels (name, code, auth_type, status, is_active) VALUES
  ('Booking.com', 'booking_com', 'oauth2', 'disconnected', true),
  ('Expedia', 'expedia', 'oauth2', 'disconnected', true),
  ('Airbnb', 'airbnb', 'api_key', 'disconnected', true),
  ('Google Hotels', 'google_hotels', 'oauth2', 'disconnected', true),
  ('TripAdvisor', 'tripadvisor', 'api_key', 'disconnected', true)
ON CONFLICT (code) DO NOTHING;
