-- ═══════════════════════════════════════════════════════════════
-- AUDIT TRIGGERS: User creation, role changes, password resets
-- ═══════════════════════════════════════════════════════════════

-- 1. Audit function for public.users changes
CREATE OR REPLACE FUNCTION audit_user_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_action TEXT;
BEGIN
  -- Get the current user performing the action
  v_actor := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := 'user_created';
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data, created_at)
    VALUES (v_actor, v_action, 'users', NEW.id, to_jsonb(NEW), now());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Role change
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      v_action := 'role_changed';
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, created_at)
      VALUES (v_actor, v_action, 'users', NEW.id,
        jsonb_build_object('role', OLD.role),
        jsonb_build_object('role', NEW.role),
        now());
    END IF;

    -- Active status change (suspend/unsuspend)
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_action := CASE WHEN NEW.is_active THEN 'user_unsuspended' ELSE 'user_suspended' END;
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, created_at)
      VALUES (v_actor, v_action, 'users', NEW.id,
        jsonb_build_object('is_active', OLD.is_active),
        jsonb_build_object('is_active', NEW.is_active),
        now());
    END IF;

    -- Name or phone change
    IF OLD.full_name IS DISTINCT FROM NEW.full_name OR OLD.phone IS DISTINCT FROM NEW.phone THEN
      v_action := 'user_updated';
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, created_at)
      VALUES (v_actor, v_action, 'users', NEW.id,
        jsonb_build_object('full_name', OLD.full_name, 'phone', OLD.phone),
        jsonb_build_object('full_name', NEW.full_name, 'phone', NEW.phone),
        now());
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'user_deleted';
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, created_at)
    VALUES (v_actor, v_action, 'users', OLD.id, to_jsonb(OLD), now());
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. Attach trigger to public.users
DROP TRIGGER IF EXISTS trg_audit_user_changes ON public.users;
CREATE TRIGGER trg_audit_user_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_changes();

-- 3. Audit function for auth.users (password resets, email changes)
CREATE OR REPLACE FUNCTION audit_auth_user_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID;
  v_action TEXT;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'UPDATE' THEN
    -- Password changed (encrypted_password hash changed)
    IF OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password THEN
      v_action := 'password_reset';
      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data, created_at)
      VALUES (v_actor, v_action, 'auth.users', NEW.id,
        jsonb_build_object('email', NEW.email, 'method', 'admin_api'),
        now());
    END IF;

    -- Email confirmed
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
      v_action := 'email_confirmed';
      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data, created_at)
      VALUES (v_actor, v_action, 'auth.users', NEW.id,
        jsonb_build_object('email', NEW.email),
        now());
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- 4. Attach trigger to auth.users
DROP TRIGGER IF EXISTS trg_audit_auth_changes ON auth.users;
CREATE TRIGGER trg_audit_auth_changes
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION audit_auth_user_changes();

-- 5. Ensure audit_logs INSERT policy allows triggers (SECURITY DEFINER handles this)
-- The existing "Authenticated insert audit_logs" policy should cover app-level inserts
-- Trigger inserts via SECURITY DEFINER bypass RLS anyway

-- 6. Add index for fast compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action ON audit_logs (table_name, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
