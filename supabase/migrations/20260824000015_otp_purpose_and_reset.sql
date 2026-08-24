-- ═══════════════════════════════════════════════════════════════
-- Add purpose column to otp_codes for password reset vs staff invite
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'guest_signup';

-- ═══════════════════════════════════════════════════════════════
-- Update generate_and_store_otp to accept purpose parameter
-- ═══════════════════════════════════════════════════════════════
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

  -- Generate 6-digit code
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  -- Insert OTP
  INSERT INTO otp_codes (email, code, purpose, expires_at)
  VALUES (p_email, v_code, p_purpose, NOW() + INTERVAL '10 minutes');

  RETURN jsonb_build_object(
    'success', true,
    'code', v_code,
    'expires_in', 600
  );
END;
$$;

GRANT EXECUTE ON FUNCTION generate_and_store_otp(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_and_store_otp(TEXT, TEXT) TO anon;

-- Keep backward compatibility for the old 1-param signature
CREATE OR REPLACE FUNCTION generate_and_store_otp(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN generate_and_store_otp(p_email, 'guest_signup');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_and_store_otp(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_and_store_otp(TEXT) TO anon;

-- ═══════════════════════════════════════════════════════════════
-- Update verify_otp_safe to accept purpose parameter
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION verify_otp_safe(
  p_email TEXT,
  p_code TEXT,
  p_purpose TEXT DEFAULT 'guest_signup'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_attempt_count INT;
BEGIN
  -- Get the OTP record
  SELECT * INTO v_record
  FROM otp_codes
  WHERE email = p_email
    AND purpose = p_purpose
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired code. Please request a new one.'
    );
  END IF;

  -- Check attempts (max 5 per OTP)
  SELECT count(*) INTO v_attempt_count
  FROM otp_codes
  WHERE email = p_email
    AND purpose = p_purpose
    AND created_at >= v_record.created_at
    AND code != p_code;

  IF v_attempt_count >= 5 THEN
    -- Mark as expired
    UPDATE otp_codes SET expires_at = NOW() - INTERVAL '1 minute'
    WHERE id = v_record.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many failed attempts. Please request a new code.'
    );
  END IF;

  -- Verify code
  IF v_record.code = p_code THEN
    -- Delete used OTP
    DELETE FROM otp_codes WHERE id = v_record.id;
    RETURN jsonb_build_object(
      'success', true,
      'email', p_email
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Incorrect code. Please try again.'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_otp_safe(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_otp_safe(TEXT, TEXT, TEXT) TO anon;

-- Keep backward compatibility
CREATE OR REPLACE FUNCTION verify_otp_safe(p_email TEXT, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN verify_otp_safe(p_email, p_code, 'guest_signup');
END;
$$;

GRANT EXECUTE ON FUNCTION verify_otp_safe(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_otp_safe(TEXT, TEXT) TO anon;

-- ═══════════════════════════════════════════════════════════════
-- Function to set password after OTP verification (for password reset)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reset_password_with_otp(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_hash TEXT;
BEGIN
  -- Find user in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No account found with this email.'
    );
  END IF;

  -- Hash the password with bcrypt
  v_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

  -- Update the password in auth.users
  UPDATE auth.users
  SET encrypted_password = v_hash,
      updated_at = NOW(),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = v_user_id;

  -- Also update public.users if it exists
  UPDATE public.users
  SET is_active = true
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_password_with_otp(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_password_with_otp(TEXT, TEXT) TO anon;

-- ═══════════════════════════════════════════════════════════════
-- Index for purpose-based queries
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_otp_codes_purpose
  ON otp_codes (email, purpose, created_at);
