-- =============================================================================
-- assert_in_acting_scope() — defensive guard for SECURITY DEFINER write RPCs
-- =============================================================================
--
-- SECURITY DEFINER functions BYPASS RLS. If a super-admin acting as IMO B
-- directly POSTs an RPC referencing a row in IMO A (e.g. by crafting curl
-- with a foreign p_user_id), the RPC has no native protection — it would
-- happily mutate IMO A's data.
--
-- This helper RAISES if the caller has set acting_imo_id AND the target row's
-- imo doesn't match. Call it at the top of any SECURITY DEFINER write RPC
-- that operates on imo-scoped data:
--
--   PERFORM public.assert_in_acting_scope(
--     (SELECT imo_id FROM user_profiles WHERE id = p_user_id)
--   );
--
-- Safe defaults:
--   - effective_imo IS NULL (not acting):       allow
--   - target_imo IS NULL (un-scoped row):       allow
--   - effective_imo = target_imo:               allow
--   - effective_imo != target_imo (and both set): RAISE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assert_in_acting_scope(target_imo uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective uuid;
BEGIN
  v_effective := public.get_effective_imo_id();
  IF v_effective IS NOT NULL
     AND target_imo IS NOT NULL
     AND target_imo <> v_effective THEN
    RAISE EXCEPTION
      'Cross-IMO operation blocked: target IMO % does not match acting IMO %',
      target_imo, v_effective
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_in_acting_scope(uuid) IS
  'Guard for SECURITY DEFINER RPCs: raises 42501 if caller is acting as one IMO but the target row belongs to a different IMO. NULL on either side is permissive (not acting / un-scoped row).';

GRANT EXECUTE ON FUNCTION public.assert_in_acting_scope(uuid) TO authenticated;

-- =============================================================================
-- Patch the three recruit-progression RPCs to guard against cross-IMO use
-- =============================================================================
-- All three take p_user_id (target recruit). Target IMO is the recruit's imo.

-- ----------------------------------------------------------------------------
-- advance_recruit_phase
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_recruit_phase(
  p_user_id uuid,
  p_current_phase_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current_progress RECORD;
  v_next_phase RECORD;
  v_next_phase_status text;
  v_result jsonb;
BEGIN
  -- Cross-IMO guard: caller's acting IMO (if any) must match recruit's IMO
  PERFORM public.assert_in_acting_scope(
    (SELECT imo_id FROM user_profiles WHERE id = p_user_id)
  );

  SELECT rpp.*, pp.phase_order, pp.template_id AS phase_template_id
  INTO v_current_progress
  FROM recruit_phase_progress rpp
  JOIN pipeline_phases pp ON pp.id = rpp.phase_id
  WHERE rpp.user_id = p_user_id
    AND rpp.phase_id = p_current_phase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Phase progress not found for user % phase %', p_user_id, p_current_phase_id;
  END IF;

  UPDATE recruit_phase_progress
  SET status = 'completed',
      completed_at = NOW(),
      notes = COALESCE(notes, '') || ' Auto-completed',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND phase_id = p_current_phase_id;

  SELECT pp.*
  INTO v_next_phase
  FROM pipeline_phases pp
  WHERE pp.template_id = v_current_progress.template_id
    AND pp.is_active = true
    AND pp.phase_order > v_current_progress.phase_order
  ORDER BY pp.phase_order ASC
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE user_profiles
    SET onboarding_status = 'completed',
        onboarding_completed_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'completed', true,
      'next_phase_id', NULL,
      'current_phase_id', p_current_phase_id
    );
  END IF;

  INSERT INTO recruit_phase_progress (user_id, phase_id, template_id, status, started_at, imo_id, agency_id)
  SELECT p_user_id, v_next_phase.id, v_next_phase.template_id, 'in_progress', NOW(),
         up.imo_id, up.agency_id
  FROM user_profiles up
  WHERE up.id = p_user_id
  ON CONFLICT (user_id, phase_id)
  DO UPDATE SET status = 'in_progress', started_at = NOW(), updated_at = NOW();

  INSERT INTO recruit_checklist_progress (user_id, checklist_item_id, status)
  SELECT p_user_id, pci.id, 'not_started'
  FROM phase_checklist_items pci
  WHERE pci.phase_id = v_next_phase.id
    AND pci.is_active = true
  ON CONFLICT (user_id, checklist_item_id) DO NOTHING;

  v_next_phase_status := lower(replace(replace(v_next_phase.phase_name, '-', '_'), ' ', '_'));

  UPDATE user_profiles
  SET onboarding_status = v_next_phase_status,
      current_onboarding_phase = v_next_phase.phase_name
  WHERE id = p_user_id;

  SELECT jsonb_build_object(
    'completed', false,
    'next_phase_id', v_next_phase.id,
    'next_phase_name', v_next_phase.phase_name,
    'next_phase_order', v_next_phase.phase_order,
    'current_phase_id', p_current_phase_id,
    'progress', jsonb_build_object(
      'id', rpp.id,
      'user_id', rpp.user_id,
      'phase_id', rpp.phase_id,
      'template_id', rpp.template_id,
      'status', rpp.status,
      'started_at', rpp.started_at
    )
  )
  INTO v_result
  FROM recruit_phase_progress rpp
  WHERE rpp.user_id = p_user_id
    AND rpp.phase_id = v_next_phase.id;

  RETURN v_result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- revert_recruit_phase
-- ----------------------------------------------------------------------------
-- Note: the original body is preserved; only the assert is added at the top.
-- Pulling the rest verbatim from the catalog isn't possible here without the
-- full body, so we redefine using the dump from /tmp/write-rpcs.txt that
-- mirrors the existing function. If any drift was applied locally, this
-- migration will preserve the upstream version + the new guard.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_body text;
  v_new_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname='public' AND p.proname='revert_recruit_phase';

  -- Inject the assert call right after the BEGIN line.
  v_new_body := regexp_replace(
    v_body,
    E'(AS \\$function\\$\\s*\\nDECLARE[\\s\\S]*?\\nBEGIN\\s*\\n)',
    E'\\1  PERFORM public.assert_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id));\n',
    'g'
  );

  EXECUTE v_new_body;
END $$;

-- ----------------------------------------------------------------------------
-- initialize_recruit_progress
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_body text;
  v_new_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname='public' AND p.proname='initialize_recruit_progress';

  v_new_body := regexp_replace(
    v_body,
    E'(AS \\$function\\$\\s*\\nDECLARE[\\s\\S]*?\\nBEGIN\\s*\\n)',
    E'\\1  PERFORM public.assert_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id));\n',
    'g'
  );

  EXECUTE v_new_body;
END $$;

-- ----------------------------------------------------------------------------
-- check_and_auto_advance_phase
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_body text;
  v_new_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname='public' AND p.proname='check_and_auto_advance_phase';

  v_new_body := regexp_replace(
    v_body,
    E'(AS \\$function\\$\\s*\\nDECLARE[\\s\\S]*?\\nBEGIN\\s*\\n)',
    E'\\1  PERFORM public.assert_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id));\n',
    'g'
  );

  EXECUTE v_new_body;
END $$;
