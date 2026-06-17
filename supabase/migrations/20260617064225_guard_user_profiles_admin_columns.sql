-- 20260617064225_guard_user_profiles_admin_columns.sql
--
-- Follow-up to 20260605080009_guard_user_profiles_privileged_columns.sql.
--
-- That trigger closed self-promotion to is_super_admin and pinned
-- roles/imo_id/agency_id on self-edits, BUT left two privileged columns
-- unguarded: is_admin and approval_status. Proven (rolled-back txn): a normal
-- authenticated user could
--   UPDATE user_profiles SET is_admin = true, approval_status = 'approved'
--     WHERE id = auth.uid();
-- and become an agency admin AND self-approve, because is_admin() reads the
-- is_admin column directly and the `authenticated` role holds a column UPDATE
-- grant on it, while RLS policy user_profiles_update_own is row-scoped only.
--
-- FIX: extend guard_user_profile_privileged_columns to also pin is_admin and
-- approval_status on a SELF-edit by a non-super-admin, and to block a
-- non-super-admin from bootstrapping is_admin = true on INSERT (mirroring the
-- existing is_super_admin handling).
--
-- Why this does NOT break legitimate admin flows: admins grant admin / approve
-- users by editing OTHER users' rows (auth.uid() <> id), which branch (d) leaves
-- untouched. Existing super-admins (branch b) and trusted backend contexts
-- (branch a, auth.uid() IS NULL: service_role / SECURITY DEFINER signup / seeds /
-- the create-auth-user edge function) are also untouched. Changes are pinned
-- silently (not rejected), so a same-statement update of non-privileged columns
-- (e.g. name) still succeeds.
--
-- Defense-in-depth only; the primary signup-metadata-injection vector
-- (handle_new_user trusting raw_user_meta_data roles/imo_id on public signup) is
-- addressed separately. Disabling public signup remains the immediate mitigation.

CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_columns()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_is_super boolean;
BEGIN
  -- (a) Trusted backend context: no end-user JWT → leave unguarded.
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_is_super := public.is_super_admin();

  -- (b) Existing super-admin may set anything on anyone.
  IF v_caller_is_super THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- (c) A non-super-admin can never bootstrap super-admin or admin on insert.
    IF COALESCE(NEW.is_super_admin, false) THEN
      NEW.is_super_admin := false;
    END IF;
    IF COALESCE(NEW.is_admin, false) THEN
      NEW.is_admin := false;
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' below.

  -- (c) Only an existing super-admin may ever flip is_super_admin (blocks both
  --     self-promotion and an admin minting a super-admin on another row).
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    NEW.is_super_admin := OLD.is_super_admin;
  END IF;

  -- (d) Self-edit by a non-super-admin may not change tenancy / role / privilege
  --     columns. Admin edits target OTHER users' rows (auth.uid() <> id) and are
  --     unaffected.
  IF v_caller = OLD.id THEN
    NEW.roles           := OLD.roles;
    NEW.imo_id          := OLD.imo_id;
    NEW.agency_id       := OLD.agency_id;
    NEW.is_admin        := OLD.is_admin;        -- NEW: block self-promote to admin
    NEW.approval_status := OLD.approval_status; -- NEW: block self-approval
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger definition is unchanged; recreate idempotently for safety.
DROP TRIGGER IF EXISTS guard_user_profile_privileged_columns ON public.user_profiles;

CREATE TRIGGER guard_user_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_privileged_columns();
