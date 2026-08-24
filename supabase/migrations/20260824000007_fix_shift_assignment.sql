-- Fix staff_shifts: make department_id nullable and ensure new status values exist

-- 1. Make department_id nullable (not all shifts need a department)
ALTER TABLE staff_shifts ALTER COLUMN department_id DROP NOT NULL;

-- 2. Ensure the status check constraint includes all new values
ALTER TABLE staff_shifts DROP CONSTRAINT IF EXISTS staff_shifts_status_check;
ALTER TABLE staff_shifts ADD CONSTRAINT staff_shifts_status_check 
  CHECK (status IN ('not_started', 'assigned', 'accepted', 'active', 'ended', 'submitted', 'reconciled', 'closed', 'cancelled', 'rejected'));

-- 3. Add helpful comments
COMMENT ON COLUMN staff_shifts.department_id IS 'Department for this shift (optional for general shifts)';
