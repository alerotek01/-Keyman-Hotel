-- ============================================================
-- DISCOUNT CODES — Rooms & Kitchen Campaigns
-- ============================================================
-- Manager/Admin can: create, edit, activate/deactivate, view stats
-- Staff can: view active codes, apply to orders
-- Guest can: apply valid codes at booking/checkout
-- ============================================================

-- 1. Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('rooms', 'kitchen', 'both')),
  min_amount NUMERIC(10,2) DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add discount columns to reservations and restaurant_orders
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id);
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active, valid_from, valid_until);

-- 4. Enable RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Manager/Admin: full CRUD
CREATE POLICY "Managers/admins manage discounts"
  ON discount_codes FOR ALL
  USING (is_manager());

-- Staff: read active codes
CREATE POLICY "Staff view active discounts"
  ON discount_codes FOR SELECT
  USING (is_staff() AND is_active = true);

-- Anon: read active codes (for website booking)
CREATE POLICY "Public view active discounts"
  ON discount_codes FOR SELECT
  USING (is_active = true AND (valid_from <= NOW()) AND (valid_until IS NULL OR valid_until >= NOW()));

-- 6. Validate and apply discount function
CREATE OR REPLACE FUNCTION validate_discount_code(
  p_code TEXT,
  p_applies_to TEXT,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discount RECORD;
  v_discount_amount NUMERIC;
  v_final_amount NUMERIC;
BEGIN
  -- Find the code
  SELECT * INTO v_discount
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND valid_from <= NOW()
    AND (valid_until IS NULL OR valid_until >= NOW());

  IF v_discount IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or expired discount code');
  END IF;

  -- Check applies_to
  IF v_discount.applies_to != 'both' AND v_discount.applies_to != p_applies_to THEN
    RETURN json_build_object('valid', false, 'error', 'This code is only valid for ' || v_discount.applies_to);
  END IF;

  -- Check min amount
  IF p_amount < v_discount.min_amount THEN
    RETURN json_build_object('valid', false, 'error', 'Minimum order amount is KES ' || v_discount.min_amount);
  END IF;

  -- Check usage limit
  IF v_discount.max_uses IS NOT NULL AND v_discount.used_count >= v_discount.max_uses THEN
    RETURN json_build_object('valid', false, 'error', 'This code has reached its usage limit');
  END IF;

  -- Calculate discount
  IF v_discount.discount_type = 'percentage' THEN
    v_discount_amount := ROUND(p_amount * v_discount.discount_value / 100, 2);
  ELSE
    v_discount_amount := LEAST(v_discount.discount_value, p_amount);
  END IF;

  v_final_amount := p_amount - v_discount_amount;

  RETURN json_build_object(
    'valid', true,
    'discount_code_id', v_discount.id,
    'code', v_discount.code,
    'description', v_discount.description,
    'discount_type', v_discount.discount_type,
    'discount_value', v_discount.discount_value,
    'discount_amount', v_discount_amount,
    'original_amount', p_amount,
    'final_amount', v_final_amount
  );
END;
$$;

-- 7. Apply discount (increment used_count atomically)
CREATE OR REPLACE FUNCTION apply_discount_code(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discount RECORD;
BEGIN
  SELECT * INTO v_discount
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code) AND is_active = true
  FOR UPDATE;

  IF v_discount IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Code not found');
  END IF;

  IF v_discount.max_uses IS NOT NULL AND v_discount.used_count >= v_discount.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Usage limit reached');
  END IF;

  UPDATE discount_codes
  SET used_count = used_count + 1
  WHERE id = v_discount.id;

  RETURN json_build_object('success', true, 'discount_code_id', v_discount.id);
END;
$$;

GRANT EXECUTE ON FUNCTION validate_discount_code(TEXT, TEXT, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION apply_discount_code(TEXT) TO authenticated;

-- 8. Audit trigger
CREATE OR REPLACE FUNCTION audit_discount_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
    VALUES (auth.uid(), 'discount_created', 'discount_codes', NEW.id,
      jsonb_build_object('code', NEW.code, 'type', NEW.discount_type, 'value', NEW.discount_value, 'applies_to', NEW.applies_to));
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (auth.uid(), 'discount_deactivated', 'discount_codes', NEW.id,
      jsonb_build_object('is_active', true), jsonb_build_object('is_active', false));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_discounts ON discount_codes;
CREATE TRIGGER trg_audit_discounts
  AFTER INSERT OR UPDATE ON discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION audit_discount_changes();

COMMENT ON TABLE discount_codes IS 'Discount codes for rooms and kitchen — manager/admin CRUD, staff/guest apply';
COMMENT ON FUNCTION validate_discount_code IS 'Validates a discount code and calculates the discount amount';
COMMENT ON FUNCTION apply_discount_code IS 'Atomically increments usage count for a discount code';
