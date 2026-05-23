-- Fix user creation regression introduced by 20260521213701_harden_imo_scoped_operational.sql.
--
-- The enforce_user_profile_imo_consistency trigger raises check_violation when no
-- imo_id can be derived. The handle_new_user trigger fires from
-- auth.admin.createUser under service-role context (auth.uid() = NULL), and the
-- generated INSERT has no agency_id / recruiter_id / upline_id yet — those are
-- set by a subsequent UPDATE from create-auth-user. Result: every new user
-- creation in production currently fails with:
--   user_profile requires an IMO (no explicit imo_id, agency, recruiter, upline,
--   or caller IMO available)
--
-- This migration patches two functions:
--
-- 1. enforce_user_profile_imo_consistency — falls back to the Founders IMO
--    sentinel UUID when nothing else resolves, instead of raising. RLS still
--    hides Founders-attributed rows from Epic Life (and vice versa), so an
--    unattributed orphan signup defaulting to Founders is consistent with the
--    pre-Epic-Life status quo. The consistency check (explicit imo_id must
--    match agency's imo_id) is retained.
--
-- 2. handle_new_user — reads imo_id / agency_id / recruiter_id / upline_id from
--    NEW.raw_user_meta_data when present, so admin-created users land in the
--    correct IMO from the first INSERT instead of via a follow-up UPDATE.
--
-- Together, this means:
--   - create-auth-user / complete-recruit-registration / check-user-exists can
--     pass imo_id via user_metadata and have it stick on the initial INSERT.
--   - Any auth signup path that does NOT pass imo_id (public auth.signUp, or
--     legacy edge function callers we haven't updated) defaults to Founders
--     rather than failing the request.
--   - Cross-IMO consistency is still enforced: if explicit imo_id mismatches
--     the agency's imo_id on the same INSERT, the trigger still raises.

-- ---------------------------------------------------------------------------
-- 1. Permissive imo_id derivation with Founders fallback.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_profile_imo_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_imo_id uuid;
  v_recruiter_imo_id uuid;
  v_upline_imo_id uuid;
  v_caller_imo_id uuid;
  v_founders_id constant uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid;
BEGIN
  IF NEW.agency_id IS NOT NULL THEN
    SELECT imo_id INTO v_agency_imo_id FROM public.agencies WHERE id = NEW.agency_id;
  END IF;
  IF NEW.recruiter_id IS NOT NULL THEN
    SELECT imo_id INTO v_recruiter_imo_id FROM public.user_profiles WHERE id = NEW.recruiter_id;
  END IF;
  IF NEW.upline_id IS NOT NULL THEN
    SELECT imo_id INTO v_upline_imo_id FROM public.user_profiles WHERE id = NEW.upline_id;
  END IF;
  v_caller_imo_id := public.get_my_imo_id();

  NEW.imo_id := COALESCE(NEW.imo_id, v_agency_imo_id, v_recruiter_imo_id, v_upline_imo_id, v_caller_imo_id);

  -- Final fallback: orphan signups (no caller context, no relationships) land
  -- in Founders rather than failing. Only applied if Founders exists in the
  -- imos table (test DBs may not have it).
  IF NEW.imo_id IS NULL AND EXISTS (SELECT 1 FROM public.imos WHERE id = v_founders_id) THEN
    NEW.imo_id := v_founders_id;
  END IF;

  IF NEW.imo_id IS NULL THEN
    RAISE EXCEPTION 'user_profile requires an IMO and no fallback (Founders sentinel %) was found in imos table',
      v_founders_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Defensive: if explicit imo_id conflicts with agency's IMO, reject.
  IF v_agency_imo_id IS NOT NULL AND NEW.imo_id IS DISTINCT FROM v_agency_imo_id THEN
    RAISE EXCEPTION 'user_profile IMO must match agency IMO' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger definition unchanged; CREATE OR REPLACE FUNCTION above is enough.

-- ---------------------------------------------------------------------------
-- 2. handle_new_user — extract IMO/agency/recruiter/upline from metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles text[];
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_imo_id uuid;
  v_agency_id uuid;
  v_recruiter_id uuid;
  v_upline_id uuid;
BEGIN
  -- Disable RLS for this insert (trigger runs as the new user, not an admin)
  SET LOCAL row_security = off;

  -- Roles: default to agent on any parse error.
  BEGIN
    v_roles := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')),
      ARRAY['agent']::text[]
    );
    IF array_length(v_roles, 1) IS NULL OR array_length(v_roles, 1) = 0 THEN
      v_roles := ARRAY['agent']::text[];
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_roles := ARRAY['agent']::text[];
    RAISE WARNING 'handle_new_user: Failed to parse roles for % (ID: %): % | Defaulting to agent',
      NEW.email, NEW.id, SQLERRM;
  END;

  -- Names from full_name / email prefix.
  BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    IF v_full_name != '' AND position(' ' in v_full_name) > 0 THEN
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name := substring(v_full_name from position(' ' in v_full_name) + 1);
    ELSIF v_full_name != '' THEN
      v_first_name := v_full_name;
      v_last_name := NULL;
    ELSE
      v_first_name := split_part(NEW.email, '@', 1);
      v_last_name := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_first_name := split_part(NEW.email, '@', 1);
    v_last_name := NULL;
    RAISE WARNING 'handle_new_user: Failed to parse names for % (ID: %): %',
      NEW.email, NEW.id, SQLERRM;
  END;

  -- IMO + relational context from metadata (set by create-auth-user et al).
  -- Casts are wrapped in BEGIN/EXCEPTION so a malformed UUID downgrades to NULL
  -- rather than failing the whole signup.
  BEGIN
    v_imo_id := NULLIF(NEW.raw_user_meta_data->>'imo_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN v_imo_id := NULL; END;

  BEGIN
    v_agency_id := NULLIF(NEW.raw_user_meta_data->>'agency_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN v_agency_id := NULL; END;

  BEGIN
    v_recruiter_id := NULLIF(NEW.raw_user_meta_data->>'recruiter_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN v_recruiter_id := NULL; END;

  BEGIN
    v_upline_id := NULLIF(NEW.raw_user_meta_data->>'upline_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN v_upline_id := NULL; END;

  -- INSERT. imo_id may be NULL here; enforce_user_profile_imo_consistency
  -- trigger fires BEFORE this row lands and derives / falls back as needed.
  BEGIN
    INSERT INTO user_profiles (
      id,
      email,
      approval_status,
      is_admin,
      approved_at,
      upline_id,
      recruiter_id,
      agency_id,
      imo_id,
      roles,
      first_name,
      last_name,
      onboarding_status,
      agent_status
    )
    VALUES (
      NEW.id,
      NEW.email,
      'pending',
      false,
      NULL,
      v_upline_id,
      v_recruiter_id,
      v_agency_id,
      v_imo_id,
      v_roles,
      v_first_name,
      v_last_name,
      NULL,
      'not_applicable'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();

    RAISE NOTICE 'handle_new_user: Created profile for % (ID: %) imo=% roles=%',
      NEW.email, NEW.id, v_imo_id, v_roles;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert profile for % (ID: %): % | SQLSTATE: %',
      NEW.email, NEW.id, SQLERRM, SQLSTATE;
    RAISE;
  END;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user: Unexpected error for % (ID: %): % | SQLSTATE: %',
    NEW.email, NEW.id, SQLERRM, SQLSTATE;
  RAISE;
END;
$$;
