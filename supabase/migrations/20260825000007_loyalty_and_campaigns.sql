-- ═══════════════════════════════════════════════════════════════
-- LOYALTY POINTS SYSTEM + CAMPAIGN MANAGEMENT
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. SITE SETTINGS: Loyalty Configuration ───
-- These are editable by admin/manager via the Loyalty Settings UI

INSERT INTO site_settings (key, value) VALUES
  ('loyalty_enabled', 'true'),
  ('loyalty_points_value_kes', '0.20'),
  ('loyalty_earn_rate', '10'),
  ('loyalty_direct_booking_bonus', '50'),
  ('loyalty_restaurant_earn_rate', '20'),
  ('loyalty_review_bonus', '100'),
  ('loyalty_birthday_multiplier', '2'),
  ('loyalty_returning_guest_multiplier', '1.5'),
  ('loyalty_referral_bonus_points', '200'),
  ('loyalty_referral_discount_percent', '15'),
  ('loyalty_tier_regular_threshold', '500'),
  ('loyalty_tier_vip_threshold', '2500'),
  ('loyalty_tier_regular_multiplier', '1.1'),
  ('loyalty_tier_vip_multiplier', '1.3'),
  ('loyalty_points_expiry_months', '12'),
  ('campaign_default_pause', 'false')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. GUESTS: Add loyalty columns ───
ALTER TABLE guests ADD COLUMN IF NOT EXISTS loyalty_points_balance INTEGER DEFAULT 0;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'guest' CHECK (loyalty_tier IN ('guest', 'regular', 'vip'));
ALTER TABLE guests ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS total_stays INTEGER DEFAULT 0;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS birthday DATE;

-- Auto-generate referral code for existing guests
UPDATE guests SET referral_code = UPPER(SUBSTRING(id::text, 1, 8) || '-REF') WHERE referral_code IS NULL;

-- ─── 3. LOYALTY TRANSACTIONS ───
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust', 'bonus')),
  points INTEGER NOT NULL CHECK (points != 0),
  description TEXT NOT NULL,
  reservation_id UUID REFERENCES reservations(id),
  order_id UUID,
  campaign_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_tx_guest ON loyalty_transactions(guest_id);
CREATE INDEX idx_loyalty_tx_type ON loyalty_transactions(type);
CREATE INDEX idx_loyalty_tx_created ON loyalty_transactions(created_at);

-- ─── 4. REFERRALS ───
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_guest_id UUID NOT NULL REFERENCES guests(id),
  referred_guest_id UUID REFERENCES guests(id),
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  bonus_points_awarded INTEGER DEFAULT 0,
  discount_applied NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_guest_id);

-- ─── 5. CAMPAIGNS ───
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('occupancy', 'winback', 'birthday', 'referral', 'seasonal', 'custom', 'points_reminder')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'whatsapp', 'in_app')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'paused', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  target_filter JSONB DEFAULT '{}',
  target_guests_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_type ON campaigns(type);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at);

-- ─── 6. CAMPAIGN RECIPIENTS ───
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'bounced', 'converted')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_guest ON campaign_recipients(guest_id);

-- ─── 7. RLS POLICIES ───

-- loyalty_transactions: admin/manager full, guest reads own
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager full loyalty"
  ON loyalty_transactions FOR ALL
  USING (is_admin() OR is_manager());

CREATE POLICY "Guest reads own loyalty"
  ON loyalty_transactions FOR SELECT
  USING (guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));

-- referrals: admin/manager full, guest reads own
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager full referrals"
  ON referrals FOR ALL
  USING (is_admin() OR is_manager());

CREATE POLICY "Guest reads own referrals"
  ON referrals FOR SELECT
  USING (referrer_guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));

-- campaigns: admin/manager full
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager full campaigns"
  ON campaigns FOR ALL
  USING (is_admin() OR is_manager());

CREATE POLICY "Staff reads campaigns"
  ON campaigns FOR SELECT
  USING (is_chef() OR is_waiter() OR is_receptionist() OR is_housekeeper());

-- campaign_recipients: admin/manager full
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager full campaign_recipients"
  ON campaign_recipients FOR ALL
  USING (is_admin() OR is_manager());

-- ─── 8. LOYALTY HELPER FUNCTIONS ───

-- Award points to a guest
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_guest_id UUID,
  p_points INTEGER,
  p_description TEXT,
  p_type TEXT DEFAULT 'earn',
  p_reservation_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
  v_multiplier NUMERIC := 1.0;
  v_guest RECORD;
BEGIN
  -- Get guest tier for multiplier
  SELECT loyalty_tier INTO v_guest FROM guests WHERE id = p_guest_id;
  
  IF v_guest.loyalty_tier = 'vip' THEN
    v_multiplier := COALESCE((SELECT value::NUMERIC FROM site_settings WHERE key = 'loyalty_tier_vip_multiplier'), 1.3);
  ELSIF v_guest.loyalty_tier = 'regular' THEN
    v_multiplier := COALESCE((SELECT value::NUMERIC FROM site_settings WHERE key = 'loyalty_tier_regular_multiplier'), 1.1);
  END IF;

  -- Apply multiplier to earn type
  IF p_type = 'earn' OR p_type = 'bonus' THEN
    p_points := GREATEST(1, ROUND(p_points * v_multiplier));
  END IF;

  -- Insert transaction
  INSERT INTO loyalty_transactions (guest_id, type, points, description, reservation_id, campaign_id)
  VALUES (p_guest_id, p_type, p_points, p_description, p_reservation_id, p_campaign_id);

  -- Update balance
  UPDATE guests 
  SET loyalty_points_balance = loyalty_points_balance + p_points
  WHERE id = p_guest_id
  RETURNING loyalty_points_balance INTO v_new_balance;

  -- Update tier based on balance
  UPDATE guests SET loyalty_tier = CASE
    WHEN loyalty_points_balance >= COALESCE((SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_tier_vip_threshold'), 2500) THEN 'vip'
    WHEN loyalty_points_balance >= COALESCE((SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_tier_regular_threshold'), 500) THEN 'regular'
    ELSE 'guest'
  END WHERE id = p_guest_id;

  RETURN v_new_balance;
END;
$$;

-- Redeem points
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_guest_id UUID,
  p_points INTEGER,
  p_description TEXT,
  p_reservation_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT loyalty_points_balance INTO v_current_balance FROM guests WHERE id = p_guest_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Guest not found';
  END IF;

  IF v_current_balance < p_points THEN
    RAISE EXCEPTION 'Insufficient points. Current: %, Requested: %', v_current_balance, p_points;
  END IF;

  IF p_points <= 0 THEN
    RAISE EXCEPTION 'Points to redeem must be positive';
  END IF;

  -- Insert negative transaction
  INSERT INTO loyalty_transactions (guest_id, type, points, description, reservation_id)
  VALUES (p_guest_id, 'redeem', -p_points, p_description, p_reservation_id);

  -- Update balance
  UPDATE guests 
  SET loyalty_points_balance = loyalty_points_balance - p_points
  WHERE id = p_guest_id
  RETURNING loyalty_points_balance INTO v_new_balance;

  -- Update tier
  UPDATE guests SET loyalty_tier = CASE
    WHEN loyalty_points_balance >= COALESCE((SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_tier_vip_threshold'), 2500) THEN 'vip'
    WHEN loyalty_points_balance >= COALESCE((SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_tier_regular_threshold'), 500) THEN 'regular'
    ELSE 'guest'
  END WHERE id = p_guest_id;

  RETURN v_new_balance;
END;
$$;

-- Get loyalty settings as a single row
CREATE OR REPLACE FUNCTION get_loyalty_settings()
RETURNS TABLE (
  enabled BOOLEAN,
  points_value_kes NUMERIC,
  earn_rate INTEGER,
  direct_booking_bonus INTEGER,
  restaurant_earn_rate INTEGER,
  review_bonus INTEGER,
  birthday_multiplier INTEGER,
  returning_guest_multiplier NUMERIC,
  referral_bonus_points INTEGER,
  referral_discount_percent INTEGER,
  tier_regular_threshold INTEGER,
  tier_vip_threshold INTEGER,
  tier_regular_multiplier NUMERIC,
  tier_vip_multiplier NUMERIC,
  points_expiry_months INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT value = 'true' FROM site_settings WHERE key = 'loyalty_enabled'),
    (SELECT value::NUMERIC FROM site_settings WHERE key = 'loyalty_points_value_kes'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_earn_rate'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_direct_booking_bonus'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_restaurant_earn_rate'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_review_bonus'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_birthday_multiplier'),
    (SELECT value::NUMERIC FROM site_settings WHERE key = 'loyalty_returning_guest_multiplier'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_referral_bonus_points'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_referral_discount_percent'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_tier_regular_threshold'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_tier_vip_threshold'),
    (SELECT value::NUMERIC FROM site_settings WHERE key = 'loyalty_tier_regular_multiplier'),
    (SELECT value::NUMERIC FROM site_settings WHERE key = 'loyalty_tier_vip_multiplier'),
    (SELECT value::INTEGER FROM site_settings WHERE key = 'loyalty_points_expiry_months');
END;
$$;

-- Update a single loyalty setting (admin/manager only)
CREATE OR REPLACE FUNCTION update_loyalty_setting(
  p_key TEXT,
  p_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_admin() OR is_manager()) THEN
    RAISE EXCEPTION 'Only admin or manager can update loyalty settings';
  END IF;

  UPDATE site_settings 
  SET value = p_value, updated_at = now()
  WHERE key = p_key;

  IF NOT FOUND THEN
    INSERT INTO site_settings (key, value) VALUES (p_key, p_value);
  END IF;
END;
$$;

-- Toggle campaign pause/resume
CREATE OR REPLACE FUNCTION toggle_campaign_status(
  p_campaign_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current TEXT;
  v_new TEXT;
BEGIN
  IF NOT (is_admin() OR is_manager()) THEN
    RAISE EXCEPTION 'Only admin or manager can manage campaigns';
  END IF;

  SELECT status INTO v_current FROM campaigns WHERE id = p_campaign_id;

  IF v_current = 'paused' THEN
    v_new := 'scheduled';
  ELSIF v_current IN ('draft', 'scheduled') THEN
    v_new := 'paused';
  ELSE
    RAISE EXCEPTION 'Cannot toggle campaign in % status', v_current;
  END IF;

  UPDATE campaigns SET status = v_new, updated_at = now() WHERE id = p_campaign_id;
  
  RETURN v_new;
END;
$$;
