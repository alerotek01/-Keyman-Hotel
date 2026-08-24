-- Staff-Guest Boundary Enforcement
-- Prevents staff from accessing guest features and ensures email/phone uniqueness

-- 1. Add unique constraint on guests.email (using COALESCE for NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_email_unique 
  ON guests (COALESCE(email, ''));
  
-- 2. Add unique constraint on guests.phone (using COALESCE for NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_phone_unique 
  ON guests (COALESCE(phone, ''));

-- 3. Create a trigger function to prevent staff from creating guest accounts
CREATE OR REPLACE FUNCTION prevent_staff_guest_creation()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check if the current user has a role in the users table
  SELECT role INTO user_role 
  FROM users 
  WHERE id = auth.uid();
  
  -- If user has a staff role, block guest record creation
  IF user_role IN ('admin', 'manager', 'receptionist', 'chef', 'waiter', 'housekeeper', 'accountant') THEN
    RAISE EXCEPTION 'Staff members cannot create guest accounts. Please use the staff dashboard.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger on the guests table
DROP TRIGGER IF EXISTS trg_prevent_staff_guest_creation ON guests;
CREATE TRIGGER trg_prevent_staff_guest_creation
  BEFORE INSERT ON guests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_staff_guest_creation();

-- 5. Create a trigger to prevent staff from signing up as guests via the users table
CREATE OR REPLACE FUNCTION prevent_staff_guest_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- If someone is being created with role 'guest', check if they already have a staff role
  IF NEW.role = 'guest' THEN
    -- Check if this email already exists with a staff role
    IF EXISTS (
      SELECT 1 FROM users 
      WHERE email = NEW.email 
      AND role IN ('admin', 'manager', 'receptionist', 'chef', 'waiter', 'housekeeper', 'accountant')
    ) THEN
      RAISE EXCEPTION 'This email is already registered as staff. Please use the staff login.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create the trigger on the users table
DROP TRIGGER IF EXISTS trg_prevent_staff_guest_signup ON users;
CREATE TRIGGER trg_prevent_staff_guest_signup
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_staff_guest_signup();

-- 7. Add helpful comments
COMMENT ON FUNCTION prevent_staff_guest_creation() IS 'Blocks staff members from creating guest accounts';
COMMENT ON FUNCTION prevent_staff_guest_signup() IS 'Prevents staff emails from being used for guest signups';
COMMENT ON INDEX idx_guests_email_unique IS 'Ensures guest email addresses are unique';
COMMENT ON INDEX idx_guests_phone_unique IS 'Ensures guest phone numbers are unique';
