-- Fix RLS policies on users table: change roles from {public} to {authenticated}
-- The previous policies used 'TO public' (default) which doesn't apply to PostgREST's
-- authenticated role. All policies now explicitly target 'authenticated'.

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Managers can view all users" ON public.users;
DROP POLICY IF EXISTS "Managers can insert staff" ON public.users;
DROP POLICY IF EXISTS "Managers can update staff" ON public.users;

-- 1. Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 2. Managers (and admins) can view all users
CREATE POLICY "Managers can view all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (is_manager());

-- 3. Admins can manage all users (insert, update, delete)
CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 4. Managers can insert staff (non-admin roles only)
CREATE POLICY "Managers can insert staff"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    is_manager()
    AND role IN ('receptionist', 'waiter', 'chef', 'housekeeper', 'accountant', 'manager')
  );

-- 5. Managers can update staff (non-admin roles only)
CREATE POLICY "Managers can update staff"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    is_manager()
    AND role IN ('receptionist', 'waiter', 'chef', 'housekeeper', 'accountant', 'manager')
  )
  WITH CHECK (
    is_manager()
    AND role IN ('receptionist', 'waiter', 'chef', 'housekeeper', 'accountant', 'manager')
  );
