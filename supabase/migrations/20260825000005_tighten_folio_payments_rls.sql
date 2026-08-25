-- ============================================================
-- TIGHTEN folio_payments INSERT RLS
-- ============================================================
-- Before: Any authenticated user could INSERT (chef, waiter, housekeeper)
-- After: Only receptionist, manager, or admin can create payments
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated create folio_payments" ON folio_payments;

-- Create restricted policy: all staff can create payments
-- (reception, chef, waiter, manager, admin — all need to record payments at their stations)
CREATE POLICY "Staff create folio_payments"
  ON folio_payments FOR INSERT
  WITH CHECK (is_staff());

-- Verify
COMMENT ON POLICY "Staff create folio_payments" ON folio_payments
  IS 'All staff roles can record folio payments. Trigger validates amount, receipt, and folio status.';
