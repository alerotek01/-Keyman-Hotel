-- Admin/Manager Feature Enhancements

-- 1. Add recall columns to staff_shifts
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS recall_reason TEXT;
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ;
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS recalled_by UUID REFERENCES users(id);

-- 2. Add 'cancelled' to shift status check (for recalled shifts)
ALTER TABLE staff_shifts DROP CONSTRAINT IF EXISTS staff_shifts_status_check;
ALTER TABLE staff_shifts ADD CONSTRAINT staff_shifts_status_check 
  CHECK (status IN ('not_started', 'active', 'ended', 'submitted', 'reconciled', 'closed', 'cancelled'));

-- 3. Conference booking edit audit trail
ALTER TABLE conference_bookings ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES users(id);
ALTER TABLE conference_bookings ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- 4. Add helpful comments
COMMENT ON COLUMN staff_shifts.recall_reason IS 'Reason when manager recalls/reassigns a shift';
COMMENT ON COLUMN staff_shifts.recalled_at IS 'Timestamp when shift was recalled';
COMMENT ON COLUMN staff_shifts.recalled_by IS 'Manager who recalled the shift';
