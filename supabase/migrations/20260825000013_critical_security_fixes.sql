-- ═══════════════════════════════════════════════════════════════
-- CRITICAL SECURITY FIXES
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. FIX: Role Escalation — Prevent direct role UPDATE ───
-- The users table had no RLS, allowing anyone to change their own role

-- Drop existing overly-permissive policies on users if they exist
DROP POLICY IF EXISTS "Users read own profile" ON users;
DROP POLICY IF EXISTS "Users update own profile" ON users;
DROP POLICY IF EXISTS "Admin full access users" ON users;
DROP POLICY IF EXISTS "Manager read users" ON users;
DROP POLICY IF EXISTS "Staff read users" ON users;

-- Recreate: Only allow role changes via RPC, not direct UPDATE
CREATE POLICY "Users read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile (no role)"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admin full access users"
  ON users FOR ALL
  USING (is_admin());

CREATE POLICY "Manager read users"
  ON users FOR SELECT
  USING (is_manager());

CREATE POLICY "Staff read users"
  ON users FOR SELECT
  USING (is_chef() OR is_waiter() OR is_receptionist() OR is_housekeeper());

-- ─── 2. FIX: Discount Code Validation ───
-- Add CHECK constraints to prevent abuse

-- Add CHECK constraint for discount_value
ALTER TABLE discount_codes 
  ADD CONSTRAINT discount_value_positive CHECK (discount_value > 0);

ALTER TABLE discount_codes 
  ADD CONSTRAINT discount_percentage_max CHECK (
    discount_type != 'percentage' OR discount_value <= 100
  );

ALTER TABLE discount_codes 
  ADD CONSTRAINT discount_fixed_max CHECK (
    discount_type != 'fixed' OR discount_value <= 50000
  );

-- Add CHECK for min_amount
ALTER TABLE discount_codes 
  ADD CONSTRAINT min_amount_positive CHECK (
    min_amount IS NULL OR min_amount >= 0
  );

-- Add CHECK for max_uses
ALTER TABLE discount_codes 
  ADD CONSTRAINT max_uses_positive CHECK (
    max_uses IS NULL OR max_uses > 0
  );

-- ─── 3. FIX: Loyalty RLS — Prevent direct points manipulation ───
-- Guests table should only be updatable via RPC functions

DROP POLICY IF EXISTS "Admin/manager full guests" ON guests;
DROP POLICY IF EXISTS "Guests read own data" ON guests;
DROP POLICY IF EXISTS "Guests update own data" ON guests;

CREATE POLICY "Guests read own data"
  ON guests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Guests update own non-loyalty data"
  ON guests FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND loyalty_points_balance = (SELECT loyalty_points_balance FROM guests WHERE id = guests.id)
    AND loyalty_tier = (SELECT loyalty_tier FROM guests WHERE id = guests.id)
    AND referral_code = (SELECT referral_code FROM guests WHERE id = guests.id)
  );

CREATE POLICY "Admin/manager full guests"
  ON guests FOR ALL
  USING (is_admin() OR is_manager());

CREATE POLICY "Receptionist read guests"
  ON guests FOR SELECT
  USING (is_receptionist());

-- ─── 4. Guest requests table RLS ───
-- Note: guest_requests table may not exist yet, skip if missing
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_requests') THEN
    ALTER TABLE guest_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Guests read own requests" ON guest_requests;
    DROP POLICY IF EXISTS "Guests create own requests" ON guest_requests;
    DROP POLICY IF EXISTS "Staff manage guest requests" ON guest_requests;
    
    CREATE POLICY "Guests read own requests"
      ON guest_requests FOR SELECT
      USING (guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));
    
    CREATE POLICY "Guests create own requests"
      ON guest_requests FOR INSERT
      WITH CHECK (guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid()));
    
    CREATE POLICY "Staff manage guest requests"
      ON guest_requests FOR ALL
      USING (is_receptionist() OR is_housekeeper() OR is_manager() OR is_admin());
  END IF;
END $$;

-- ─── 5. Messages RLS (if missing) ───
-- Messages use channel_id, not receiver_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') 
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own messages' AND tablename = 'messages') THEN
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users read own messages"
      ON messages FOR SELECT
      USING (sender_id = auth.uid());
    
    CREATE POLICY "Users send messages"
      ON messages FOR INSERT
      WITH CHECK (sender_id = auth.uid());
  END IF;
END $$;
