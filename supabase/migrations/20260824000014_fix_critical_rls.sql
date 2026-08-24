-- CRITICAL RLS FIX: Multiple tables have overly permissive policies
-- that allow anonymous/unauthenticated access to sensitive data.

-- ═══════════════════════════════════════════════════════════════
-- 1. STAFF TABLE — P0: Full CRUD by anyone (anon users!)
-- ═══════════════════════════════════════════════════════════════
-- Drop the dangerously permissive policies
DROP POLICY IF EXISTS "staff_select" ON public.staff;
DROP POLICY IF EXISTS "staff_insert" ON public.staff;
DROP POLICY IF EXISTS "staff_update" ON public.staff;
DROP POLICY IF EXISTS "staff_delete" ON public.staff;

-- Recreate with proper role-based access
CREATE POLICY "Staff can view all staff"
  ON public.staff FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Managers and admins can insert staff"
  ON public.staff FOR INSERT
  TO authenticated
  WITH CHECK (is_manager() OR is_admin());

CREATE POLICY "Managers and admins can update staff"
  ON public.staff FOR UPDATE
  TO authenticated
  USING (is_manager() OR is_admin())
  WITH CHECK (is_manager() OR is_admin());

CREATE POLICY "Only admins can delete staff"
  ON public.staff FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 2. RESERVATIONS — P0: "Public can view own" uses USING(true)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public can view own reservation" ON public.reservations;
DROP POLICY IF EXISTS "Guests see own reservations" ON public.reservations;

-- Guests see only their own reservations
CREATE POLICY "Guests see own reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    guest_id IN (SELECT id FROM guests WHERE user_id = auth.uid())
    OR is_admin()
    OR is_manager()
  );

-- ═══════════════════════════════════════════════════════════════
-- 3. BOOKING_PAYMENTS — P1: Anonymous INSERT
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "booking_payments_insert" ON public.booking_payments;

CREATE POLICY "Authenticated create booking_payments"
  ON public.booking_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_receptionist() OR is_admin() OR is_manager()
  );

-- ═══════════════════════════════════════════════════════════════
-- 4. CONFERENCE_ROOMS — P2: Public SELECT (intentional? keep)
-- ═══════════════════════════════════════════════════════════════
-- Conference rooms are public info, but restrict to authenticated
DROP POLICY IF EXISTS "cr_select" ON public.conference_rooms;

CREATE POLICY "Anyone can view conference rooms"
  ON public.conference_rooms FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 5. MEDIA_LIBRARY — P2: Public SELECT
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public view" ON public.media_library;

CREATE POLICY "Authenticated view media"
  ON public.media_library FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 6. ROOM_IMAGES — P2: Public SELECT (intentional — public site images)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public view" ON public.room_images;

CREATE POLICY "Anyone can view room images"
  ON public.room_images FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 7. SITE_SETTINGS — P2: Public SELECT (intentional — public config)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public view" ON public.site_settings;

CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 8. AUDIT_LOGS — P1: Anonymous INSERT
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "System insert" ON public.audit_logs;

CREATE POLICY "Authenticated insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 9. GUESTS — P1: Anonymous INSERT (intentional for guest signup?)
-- ═══════════════════════════════════════════════════════════════
-- Keep guests insert open for guest signup, but ensure SELECT is restricted
DROP POLICY IF EXISTS "Anyone create" ON public.guests;
DROP POLICY IF EXISTS "Guests see own" ON public.guests;
DROP POLICY IF EXISTS "Staff manage guests" ON public.guests;

CREATE POLICY "Guests can create profile"
  ON public.guests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Guests see own profile"
  ON public.guests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin()
    OR is_manager()
    OR is_receptionist()
  );

CREATE POLICY "Staff can update guests"
  ON public.guests FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_manager() OR is_receptionist())
  WITH CHECK (is_admin() OR is_manager() OR is_receptionist());
