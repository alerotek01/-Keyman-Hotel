-- ============================================================
-- TIGHTEN folio_payments INSERT RLS
-- ============================================================
-- Before: Any authenticated user could INSERT (chef, waiter, housekeeper)
-- After: Only receptionist, manager, or admin can create payments
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated create folio_payments" ON folio_payments;

-- Create restricted policy: only reception + management roles
CREATE POLICY "Reception/manager/admin create folio_payments"
  ON folio_payments FOR INSERT
  WITH CHECK (is_receptionist() OR is_manager() OR is_admin());

-- Verify
COMMENT ON POLICY "Reception/manager/admin create folio_payments" ON folio_payments
  IS 'Only receptionists, managers, and admins can record folio payments. Chefs/waiters/housekeepers blocked.';
