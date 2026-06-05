-- 20260605080009_guard_user_profiles_privileged_columns.sql
--
-- CRITICAL privilege-escalation fix.
--
-- Proven on prod (rolled-back txn): any authenticated user could
--   UPDATE user_profiles SET is_super_admin = true WHERE id = auth.uid();
-- and become super-admin, because:
--   - is_super_admin() reads the user_profiles.is_super_admin COLUMN;
--   - the `authenticated` role holds column UPDATE grants on is_super_admin/
--     roles/imo_id/agency_id;
--   - RLS policy user_profiles_update_own is row-scoped only (auth.uid() = id),
--     with no column restriction;
--   - no trigger pinned the privileged columns.
-- This also defeated revocation (is_access_revoked = NOT is_super_admin() AND …).
--
-- FIX: a BEFORE INSERT/UPDATE trigger that
--   (a) lets trusted backend contexts through untouched (auth.uid() IS NULL =
--       service_role / SECURITY DEFINER signup / seeds / cron);
--   (b) lets an existing super-admin do anything;
--   (c) allows is_super_admin to change ONLY when the caller is already a
--       super-admin (so no admin/imo_admin can mint a super-admin, and no one
--       can self-promote);
--   (d) on a SELF-edit by a non-super-admin (auth.uid() = OLD.id), pins
--       roles / imo_id / agency_id back to their prior values.
--
-- Why this does NOT break legitimate admin flows: admins assign roles / move
-- users between IMOs by editing OTHER users' rows (auth.uid() <> id), which (d)
-- leaves untouched. Only granting/removing super-admin is locked to existing
-- super-admins, matching the intent of the "Super admins can update all users"
-- policy. Changes are pinned silently (not rejected) so a legit same-statement
-- update of non-privileged columns (e.g. name) still succeeds.
--
-- FOLLOW-UPS (not done here): (1) verify no self-service onboarding flow
-- legitimately sets the caller's own roles/imo_id/agency_id; (2) consider moving
-- role/super-admin mutation to dedicated SECURITY DEFINER RPCs and revoking the
-- column UPDATE grants from `authenticated` for true least-privilege.

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
    -- (c) A non-super-admin can never bootstrap super-admin on insert.
    IF COALESCE(NEW.is_super_admin, false) THEN
      NEW.is_super_admin := false;
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' below.

  -- (c) Only an existing super-admin may ever flip is_super_admin (blocks both
  --     self-promotion and an admin minting a super-admin on another row).
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    NEW.is_super_admin := OLD.is_super_admin;
  END IF;

  -- (d) Self-edit by a non-super-admin may not change tenancy/role columns.
  --     Admin edits target OTHER users' rows (auth.uid() <> id) and are
  --     unaffected.
  IF v_caller = OLD.id THEN
    NEW.roles     := OLD.roles;
    NEW.imo_id    := OLD.imo_id;
    NEW.agency_id := OLD.agency_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_user_profile_privileged_columns ON public.user_profiles;

-- Fires before enforce_user_profile_imo_consistency is irrelevant to correctness
-- (both only matter for self-edits, where imo_id is pinned to OLD either way).
CREATE TRIGGER guard_user_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_privileged_columns();
