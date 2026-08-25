-- Fix user creation: SECURITY DEFINER functions that bypass RLS
-- These handle the orphan cleanup + auth user creation properly

-- 1. Function to clean orphan public.users rows
CREATE OR REPLACE FUNCTION cleanup_orphan_users(p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Delete public.users rows where email matches but no auth.users record
  DELETE FROM public.users
  WHERE email = LOWER(p_email)
    AND id NOT IN (SELECT id FROM auth.users);
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_orphan_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orphan_users(TEXT) TO anon;

-- 2. Fix reset_password_with_otp to also set email_confirmed_at properly
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
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = LOWER(p_email);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No account found with this email.'
    );
  END IF;

  -- Use Supabase's internal password update (proper bcrypt with correct cost)
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at = NOW(),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmation_token = '',
      recovery_token = ''
  WHERE id = v_user_id;

  -- Ensure user is active
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
