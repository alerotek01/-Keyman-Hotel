-- Fix: shift_status is an ENUM, not a CHECK constraint
-- Need to ALTER TYPE to add new values

-- 1. Add new values to the shift_status ENUM (idempotent)
DO $$ BEGIN
  ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'assigned';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'accepted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Also ensure the old CHECK constraint doesn't conflict
ALTER TABLE staff_shifts DROP CONSTRAINT IF EXISTS staff_shifts_status_check;

-- Add helpful comment
COMMENT ON TYPE shift_status IS 'Enum for staff shift lifecycle: not_started → assigned → accepted → active → ended → submitted → reconciled/closed. Also: rejected, cancelled.';
