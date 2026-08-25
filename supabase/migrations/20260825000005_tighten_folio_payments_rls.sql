-- ============================================================
-- TIGHTEN folio_payments INSERT RLS
-- ============================================================
-- Before: Any authenticated user could INSERT (chef, waiter, housekeeper)
-- After: Only receptionist, manager, or admin can create payments
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated create folio_payments" ON folio_payments;

-- Create restricted policy: reception + management + chef (kitchen counter payments)
CREATE POLICY "Reception/manager/admin/chef create folio_payments"
  ON folio_payments FOR INSERT
  WITH CHECK (is_receptionist() OR is_manager() OR is_admin() OR get_user_role(auth.uid()) = 'chef');

-- Verify
COMMENT ON POLICY "Reception/manager/admin/chef create folio_payments" ON folio_payments
  IS 'Receptionists, managers, admins, and chefs can record folio payments. Chefs need this for kitchen counter payments. Waiters/housekeepers blocked.';
