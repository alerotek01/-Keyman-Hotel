-- Shift Assignment Workflow: Assigned → Accepted → Active → Ended
-- Also supports: Rejected (by staff), Recalled (by manager), Reassigned

-- 1. Add new columns for shift workflow
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Update status check to include new workflow states
ALTER TABLE staff_shifts DROP CONSTRAINT IF EXISTS staff_shifts_status_check;
ALTER TABLE staff_shifts ADD CONSTRAINT staff_shifts_status_check 
  CHECK (status IN ('assigned', 'accepted', 'active', 'ended', 'submitted', 'reconciled', 'closed', 'cancelled', 'rejected'));

-- 3. Set assigned_at for existing active shifts (backfill)
UPDATE staff_shifts SET assigned_at = created_at WHERE assigned_at IS NULL;

-- 4. Add helpful comments
COMMENT ON COLUMN staff_shifts.status IS 'Workflow: assigned → accepted/rejected → active → ended → submitted → reconciled/closed';
COMMENT ON COLUMN staff_shifts.accepted_at IS 'Timestamp when staff accepted the shift assignment';
COMMENT ON COLUMN staff_shifts.rejected_at IS 'Timestamp when staff rejected the shift assignment';
COMMENT ON COLUMN staff_shifts.assigned_at IS 'Timestamp when manager assigned the shift';
