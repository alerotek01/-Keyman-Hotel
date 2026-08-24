-- Fix OTP constraints that were causing 409 errors
-- 1. Drop the unique-per-email-only index (replaced with per email+purpose)
DROP INDEX IF EXISTS idx_otp_email;
CREATE UNIQUE INDEX idx_otp_email ON otp_codes (email, purpose);

-- 2. Update generate_and_store_otp to delete old OTPs before inserting
CREATE OR REPLACE FUNCTION generate_and_store_otp(
  p_email TEXT,
  p_purpose TEXT DEFAULT 'guest_signup'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_attempts INT;
BEGIN
  -- Rate limit: max 5 OTP requests per email per hour
  SELECT count(*) INTO v_attempts
  FROM otp_codes
  WHERE email = p_email
    AND purpose = p_purpose
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many requests. Please wait before trying again.'
    );
  END IF;

  -- Delete any existing OTP for this email+purpose
  DELETE FROM otp_codes
  WHERE email = p_email AND purpose = p_purpose;

  -- Generate 6-digit code
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  -- Insert new OTP
  INSERT INTO otp_codes (email, code, purpose, expires_at)
  VALUES (p_email, v_code, p_purpose, NOW() + INTERVAL '10 minutes');

  RETURN jsonb_build_object(
    'success', true,
    'code', v_code,
    'expires_in', 600
  );
END;
$$;

-- Remove old 1-param overload (was causing PostgREST 409)
DROP FUNCTION IF EXISTS generate_and_store_otp(TEXT);
DROP FUNCTION IF EXISTS verify_otp_safe(TEXT, TEXT);

-- Trigger schema reload
NOTIFY pgrst, 'reload schema';
