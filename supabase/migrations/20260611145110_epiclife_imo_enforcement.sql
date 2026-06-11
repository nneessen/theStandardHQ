-- ============================================================================
-- Epic Life IMO enforcement — "FFG is done", everything new lands on Epic Life
-- ============================================================================
-- Owner directive (Jun 11 2026):
--   1. ANY user whose email contains 'epiclife' MUST be on the Epic Life IMO —
--      now and on every future insert/imo change. Period.
--   2. The orphan/no-context fallback for a brand-new user_profile must be
--      Epic Life, NOT Founders Financial Group (FFG is sunset).
--
-- Mechanism: enforce_user_profile_imo_consistency() is the BEFORE INSERT OR
-- UPDATE OF (agency_id, imo_id) chokepoint that already normalizes a new
-- profile's imo_id. We branch from its CURRENT shipped body (preserving the
-- SECURITY DEFINER + search_path hardening and the agency-consistency guard)
-- and add the two rules above.
--
-- Epic Life's uuid differs from FFG and is resolved BY NAME ('Epic Life') so
-- this is portable across LOCAL and PROD (both currently 2fd256e9...) and never
-- hardcodes an env-specific id. If Epic Life is somehow absent (bare test DBs),
-- we fall back to the original Founders sentinel only as a last resort so an
-- insert never fails outright.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_user_profile_imo_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_imo_id uuid;
  v_recruiter_imo_id uuid;
  v_upline_imo_id uuid;
  v_caller_imo_id uuid;
  v_epic_id uuid;
  v_founders_id constant uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid;
BEGIN
  -- The active platform tenant. Resolved by name so no env-specific uuid is
  -- baked into the function body.
  SELECT id INTO v_epic_id FROM public.imos WHERE name = 'Epic Life' LIMIT 1;

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

  -- RULE 1 (owner directive): any 'epiclife' email is ALWAYS Epic Life,
  -- overriding whatever imo_id was passed/inferred. This is absolute.
  IF v_epic_id IS NOT NULL AND NEW.email IS NOT NULL AND NEW.email ILIKE '%epiclife%' THEN
    NEW.imo_id := v_epic_id;
  END IF;

  -- RULE 2 (owner directive): orphan signups (no caller context, no
  -- relationships) land in Epic Life — the active tenant — NOT Founders.
  IF NEW.imo_id IS NULL AND v_epic_id IS NOT NULL THEN
    NEW.imo_id := v_epic_id;
  END IF;

  -- Last-resort fallback ONLY for stripped test DBs that have neither Epic Life
  -- nor any context (real LOCAL/PROD always have Epic Life, so they never reach
  -- this). Kept so a bare test insert never hard-fails.
  IF NEW.imo_id IS NULL AND EXISTS (SELECT 1 FROM public.imos WHERE id = v_founders_id) THEN
    NEW.imo_id := v_founders_id;
  END IF;

  IF NEW.imo_id IS NULL THEN
    RAISE EXCEPTION 'user_profile requires an IMO and no fallback (Epic Life / Founders %) was found in imos table',
      v_founders_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Defensive: if explicit imo_id conflicts with agency's IMO, reject.
  IF v_agency_imo_id IS NOT NULL AND NEW.imo_id IS DISTINCT FROM v_agency_imo_id THEN
    RAISE EXCEPTION 'user_profile IMO must match agency IMO' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- One-time data correction
-- ============================================================================
DO $$
DECLARE
  v_epic_id uuid;
  v_moved int;
BEGIN
  SELECT id INTO v_epic_id FROM public.imos WHERE name = 'Epic Life' LIMIT 1;
  IF v_epic_id IS NULL THEN
    RAISE NOTICE 'Epic Life IMO not found — skipping data backfill (test DB).';
    RETURN;
  END IF;

  -- (a) Any 'epiclife' email not already on Epic Life -> Epic Life.
  UPDATE public.user_profiles
     SET imo_id = v_epic_id
   WHERE email ILIKE '%epiclife%'
     AND imo_id IS DISTINCT FROM v_epic_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Backfill: % epiclife-email profiles moved to Epic Life.', v_moved;

  -- (b) Owner-confirmed: move the two stranded test agent accounts (on the
  --     revoked Sunset Test Agency, no agency/upline/recruiter) to Epic Life.
  UPDATE public.user_profiles
     SET imo_id = v_epic_id
   WHERE email IN ('nick.neessen@gmail.com', 'nickneessen.ffl@gmail.com')
     AND imo_id IS DISTINCT FROM v_epic_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Moved % stranded Sunset accounts to Epic Life.', v_moved;
END $$;
