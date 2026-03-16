BEGIN;

-- Defense-in-depth helpers for recruiting pipeline RPCs.
-- These RPCs remain SECURITY DEFINER to preserve the single-transaction
-- lockup mitigation, but now enforce actor/tenant checks internally.

CREATE OR REPLACE FUNCTION public.recruiting_actor_can_manage_recruit(
  p_actor_id UUID,
  p_recruit_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor user_profiles%ROWTYPE;
  v_recruit user_profiles%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF p_actor_id IS NULL OR p_recruit_id IS NULL OR p_actor_id = p_recruit_id THEN
    RETURN false;
  END IF;

  SELECT * INTO v_actor
  FROM public.user_profiles
  WHERE id = p_actor_id;

  SELECT * INTO v_recruit
  FROM public.user_profiles
  WHERE id = p_recruit_id;

  IF v_actor.id IS NULL OR v_recruit.id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(v_actor.is_admin, false)
     OR COALESCE(v_actor.roles, ARRAY[]::TEXT[]) && ARRAY['admin']::TEXT[] THEN
    RETURN true;
  END IF;

  IF COALESCE(v_actor.roles, ARRAY[]::TEXT[]) && ARRAY['trainer', 'contracting_manager']::TEXT[]
     AND v_actor.imo_id IS NOT DISTINCT FROM v_recruit.imo_id THEN
    RETURN true;
  END IF;

  IF v_recruit.recruiter_id = p_actor_id OR v_recruit.upline_id = p_actor_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.recruiting_actor_can_self_progress(
  p_actor_id UUID,
  p_recruit_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
    OR (
      p_actor_id IS NOT NULL
      AND p_actor_id = p_recruit_id
      AND EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = p_recruit_id
          AND COALESCE(up.roles, ARRAY[]::TEXT[]) @> ARRAY['recruit']::TEXT[]
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.recruiting_actor_can_manage_recruit(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recruiting_actor_can_self_progress(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recruiting_actor_can_manage_recruit(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recruiting_actor_can_self_progress(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.advance_recruit_phase(
  p_user_id UUID,
  p_current_phase_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_current_progress RECORD;
  v_current_phase RECORD;
  v_next_phase RECORD;
  v_next_phase_status TEXT;
  v_result JSONB;
BEGIN
  IF NOT public.recruiting_actor_can_manage_recruit(v_actor_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied to advance recruit phase'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Get current phase progress with phase details
  SELECT rpp.*, pp.phase_order, pp.template_id AS phase_template_id
  INTO v_current_progress
  FROM recruit_phase_progress rpp
  JOIN pipeline_phases pp ON pp.id = rpp.phase_id
  WHERE rpp.user_id = p_user_id
    AND rpp.phase_id = p_current_phase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Phase progress not found for user % phase %', p_user_id, p_current_phase_id;
  END IF;

  -- 2. Mark current phase as completed
  UPDATE recruit_phase_progress
  SET status = 'completed',
      completed_at = NOW(),
      notes = COALESCE(notes, '') || ' Auto-completed',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND phase_id = p_current_phase_id;

  -- 3. Find next active phase (next higher phase_order)
  SELECT pp.*
  INTO v_next_phase
  FROM pipeline_phases pp
  WHERE pp.template_id = v_current_progress.template_id
    AND pp.is_active = true
    AND pp.phase_order > v_current_progress.phase_order
  ORDER BY pp.phase_order ASC
  LIMIT 1;

  IF NOT FOUND THEN
    -- No next phase = recruiting complete
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

  -- 4. Ensure phase progress record exists for next phase, then mark in_progress
  INSERT INTO recruit_phase_progress (user_id, phase_id, template_id, status, started_at, imo_id, agency_id)
  SELECT p_user_id, v_next_phase.id, v_next_phase.template_id, 'in_progress', NOW(),
         up.imo_id, up.agency_id
  FROM user_profiles up
  WHERE up.id = p_user_id
  ON CONFLICT (user_id, phase_id)
  DO UPDATE SET status = 'in_progress', started_at = NOW(), updated_at = NOW();

  -- 5. Initialize checklist progress for next phase (upsert all items as not_started)
  INSERT INTO recruit_checklist_progress (user_id, checklist_item_id, status)
  SELECT p_user_id, pci.id, 'not_started'
  FROM phase_checklist_items pci
  WHERE pci.phase_id = v_next_phase.id
    AND pci.is_active = true
  ON CONFLICT (user_id, checklist_item_id) DO NOTHING;

  -- 6. Update user_profiles with new phase status
  v_next_phase_status := lower(replace(replace(v_next_phase.phase_name, '-', '_'), ' ', '_'));

  UPDATE user_profiles
  SET onboarding_status = v_next_phase_status,
      current_onboarding_phase = v_next_phase.phase_name
  WHERE id = p_user_id;

  -- 7. Return result
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
$$;

REVOKE EXECUTE ON FUNCTION public.advance_recruit_phase(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_recruit_phase(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_and_auto_advance_phase(
  p_user_id UUID,
  p_checklist_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_phase RECORD;
  v_required_count INT;
  v_completed_count INT;
  v_all_count INT;
  v_all_completed_count INT;
  v_should_advance BOOLEAN := false;
  v_advance_result JSONB;
BEGIN
  IF NOT (
    public.recruiting_actor_can_manage_recruit(v_actor_id, p_user_id)
    OR public.recruiting_actor_can_self_progress(v_actor_id, p_user_id)
  ) THEN
    RAISE EXCEPTION 'Access denied to auto-advance recruit phase'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Get the phase for this checklist item
  SELECT pp.*
  INTO v_phase
  FROM phase_checklist_items pci
  JOIN pipeline_phases pp ON pp.id = pci.phase_id
  WHERE pci.id = p_checklist_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('advanced', false, 'reason', 'checklist_item_not_found');
  END IF;

  -- 2. Check if auto_advance is enabled
  IF NOT v_phase.auto_advance THEN
    RETURN jsonb_build_object('advanced', false, 'reason', 'auto_advance_disabled');
  END IF;

  -- 3. Count required items and their completion status
  SELECT COUNT(*) INTO v_required_count
  FROM phase_checklist_items
  WHERE phase_id = v_phase.id AND is_active = true AND is_required = true;

  IF v_required_count > 0 THEN
    -- Check required items only
    SELECT COUNT(*) INTO v_completed_count
    FROM phase_checklist_items pci
    JOIN recruit_checklist_progress rcp ON rcp.checklist_item_id = pci.id AND rcp.user_id = p_user_id
    WHERE pci.phase_id = v_phase.id
      AND pci.is_active = true
      AND pci.is_required = true
      AND rcp.status IN ('approved', 'completed');

    v_should_advance := (v_completed_count >= v_required_count);
  ELSE
    -- No required items: check ALL items
    SELECT COUNT(*) INTO v_all_count
    FROM phase_checklist_items
    WHERE phase_id = v_phase.id AND is_active = true;

    SELECT COUNT(*) INTO v_all_completed_count
    FROM phase_checklist_items pci
    JOIN recruit_checklist_progress rcp ON rcp.checklist_item_id = pci.id AND rcp.user_id = p_user_id
    WHERE pci.phase_id = v_phase.id
      AND pci.is_active = true
      AND rcp.status IN ('approved', 'completed');

    v_should_advance := (v_all_count > 0 AND v_all_completed_count >= v_all_count);
  END IF;

  -- 4. If all items complete, advance using the advance_recruit_phase function
  IF v_should_advance THEN
    v_advance_result := advance_recruit_phase(p_user_id, v_phase.id);
    RETURN jsonb_build_object(
      'advanced', true,
      'phase_id', v_phase.id,
      'advance_result', v_advance_result
    );
  END IF;

  RETURN jsonb_build_object('advanced', false, 'reason', 'items_incomplete');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_auto_advance_phase(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_auto_advance_phase(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.initialize_recruit_progress(
  p_user_id UUID,
  p_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_existing_count INT;
  v_user_profile RECORD;
  v_first_phase RECORD;
  v_first_phase_status TEXT;
  v_phase_count INT;
BEGIN
  IF NOT public.recruiting_actor_can_manage_recruit(v_actor_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied to initialize recruit progress'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Check if user already has pipeline progress (prevent duplicates)
  SELECT COUNT(*) INTO v_existing_count
  FROM recruit_phase_progress
  WHERE user_id = p_user_id;

  IF v_existing_count > 0 THEN
    -- Return existing progress
    RETURN jsonb_build_object(
      'initialized', false,
      'reason', 'already_enrolled',
      'existing_phases', v_existing_count
    );
  END IF;

  -- 2. Get user profile for RLS fields
  SELECT imo_id, agency_id
  INTO v_user_profile
  FROM user_profiles
  WHERE id = p_user_id;

  -- 3. Get all active phases for template
  SELECT COUNT(*) INTO v_phase_count
  FROM pipeline_phases
  WHERE template_id = p_template_id AND is_active = true;

  IF v_phase_count = 0 THEN
    RAISE EXCEPTION 'No phases found for template %', p_template_id;
  END IF;

  -- 4. Get first phase (lowest phase_order)
  SELECT *
  INTO v_first_phase
  FROM pipeline_phases
  WHERE template_id = p_template_id AND is_active = true
  ORDER BY phase_order ASC
  LIMIT 1;

  -- 5. Create all phase progress records in one INSERT
  INSERT INTO recruit_phase_progress (user_id, phase_id, template_id, status, started_at, imo_id, agency_id)
  SELECT
    p_user_id,
    pp.id,
    p_template_id,
    CASE WHEN pp.id = v_first_phase.id THEN 'in_progress' ELSE 'not_started' END,
    CASE WHEN pp.id = v_first_phase.id THEN NOW() ELSE NULL END,
    v_user_profile.imo_id,
    v_user_profile.agency_id
  FROM pipeline_phases pp
  WHERE pp.template_id = p_template_id AND pp.is_active = true
  ORDER BY pp.phase_order;

  -- 6. Initialize checklist progress for first phase
  INSERT INTO recruit_checklist_progress (user_id, checklist_item_id, status)
  SELECT p_user_id, pci.id, 'not_started'
  FROM phase_checklist_items pci
  WHERE pci.phase_id = v_first_phase.id
    AND pci.is_active = true
  ON CONFLICT (user_id, checklist_item_id) DO NOTHING;

  -- 7. Update user_profiles with first phase status
  v_first_phase_status := lower(replace(replace(v_first_phase.phase_name, '-', '_'), ' ', '_'));

  UPDATE user_profiles
  SET pipeline_template_id = p_template_id,
      onboarding_status = v_first_phase_status,
      current_onboarding_phase = v_first_phase.phase_name
  WHERE id = p_user_id;

  -- 8. Return result
  RETURN jsonb_build_object(
    'initialized', true,
    'template_id', p_template_id,
    'phase_count', v_phase_count,
    'first_phase_id', v_first_phase.id,
    'first_phase_name', v_first_phase.phase_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initialize_recruit_progress(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_recruit_progress(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revert_recruit_phase(
  p_user_id UUID,
  p_phase_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_current_progress RECORD;
  v_phase RECORD;
  v_subsequent RECORD;
  v_result JSONB;
  v_phase_status TEXT;
BEGIN
  IF NOT public.recruiting_actor_can_manage_recruit(v_actor_id, p_user_id) THEN
    RAISE EXCEPTION 'Access denied to revert recruit phase'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Validate current phase progress exists and is completed
  SELECT rpp.id, rpp.status, rpp.template_id
  INTO v_current_progress
  FROM recruit_phase_progress rpp
  WHERE rpp.user_id = p_user_id
    AND rpp.phase_id = p_phase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Phase progress not found';
  END IF;

  IF v_current_progress.status != 'completed' THEN
    RAISE EXCEPTION 'Can only revert completed phases';
  END IF;

  -- 2. Get the phase details
  SELECT pp.id, pp.phase_name, pp.phase_order, pp.template_id
  INTO v_phase
  FROM pipeline_phases pp
  WHERE pp.id = p_phase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Phase not found';
  END IF;

  -- 3. Reset all subsequent phases (higher phase_order) to not_started in one UPDATE
  UPDATE recruit_phase_progress
  SET status = 'not_started',
      started_at = NULL,
      completed_at = NULL,
      notes = 'Reset due to phase revert',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND phase_id IN (
      SELECT pp.id
      FROM pipeline_phases pp
      WHERE pp.template_id = v_phase.template_id
        AND pp.phase_order > v_phase.phase_order
    );

  -- 4. Set the target phase back to in_progress
  UPDATE recruit_phase_progress
  SET status = 'in_progress',
      completed_at = NULL,
      notes = 'Reverted by recruiter',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND phase_id = p_phase_id;

  -- 5. Update user_profiles with the reverted phase status
  v_phase_status := lower(replace(replace(v_phase.phase_name, '-', '_'), ' ', '_'));

  UPDATE user_profiles
  SET onboarding_status = v_phase_status,
      current_onboarding_phase = v_phase.phase_name
  WHERE id = p_user_id;

  -- 6. Return the updated phase progress
  SELECT jsonb_build_object(
    'id', rpp.id,
    'user_id', rpp.user_id,
    'phase_id', rpp.phase_id,
    'template_id', rpp.template_id,
    'status', rpp.status,
    'started_at', rpp.started_at,
    'completed_at', rpp.completed_at,
    'notes', rpp.notes
  )
  INTO v_result
  FROM recruit_phase_progress rpp
  WHERE rpp.user_id = p_user_id
    AND rpp.phase_id = p_phase_id;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revert_recruit_phase(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_recruit_phase(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_recruits_checklist_summary(recruit_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  current_phase_id UUID,
  total_items INT,
  completed_items INT,
  is_last_item BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_recruit_id UUID;
  v_recruit_count INT := COALESCE(array_length(recruit_ids, 1), 0);
BEGIN
  IF v_recruit_count = 0 THEN
    RETURN;
  END IF;

  IF v_recruit_count > 100 THEN
    RAISE EXCEPTION 'Too many recruit IDs requested'
      USING ERRCODE = '22023';
  END IF;

  FOREACH v_recruit_id IN ARRAY recruit_ids LOOP
    IF NOT (
      public.recruiting_actor_can_manage_recruit(v_actor_id, v_recruit_id)
      OR public.recruiting_actor_can_self_progress(v_actor_id, v_recruit_id)
    ) THEN
      RAISE EXCEPTION 'Access denied to recruit checklist summary'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    rpp.user_id,
    rpp.phase_id AS current_phase_id,
    COALESCE(ci.total_items, 0)::INT AS total_items,
    COALESCE(cp.completed_items, 0)::INT AS completed_items,
    (COALESCE(ci.total_items, 0) - COALESCE(cp.completed_items, 0) = 1) AS is_last_item
  FROM recruit_phase_progress rpp
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INT AS total_items
    FROM phase_checklist_items pci
    WHERE pci.phase_id = rpp.phase_id
      AND pci.is_active = true
  ) ci ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INT AS completed_items
    FROM recruit_checklist_progress rcp
    WHERE rcp.user_id = rpp.user_id
      AND rcp.checklist_item_id IN (
        SELECT pci2.id FROM phase_checklist_items pci2
        WHERE pci2.phase_id = rpp.phase_id AND pci2.is_active = true
      )
      AND rcp.status IN ('completed', 'verified', 'approved')
  ) cp ON true
  WHERE rpp.user_id = ANY(recruit_ids)
    AND rpp.status = 'in_progress';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_recruits_checklist_summary(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recruits_checklist_summary(UUID[]) TO authenticated, service_role;

COMMIT;
