-- =============================================================================
-- Harden Underwriting Rule Reorder And Session Queries
-- =============================================================================
-- 1. Adds an atomic rule reorder RPC with explicit auth and row locking.
-- 2. Adds a composite index for agency session queries filtered by IMO.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reorder_underwriting_rules(
  p_rule_set_id UUID,
  p_rule_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_set_imo_id UUID;
  v_caller_imo_id UUID;
  v_array_length INTEGER;
  v_distinct_count INTEGER;
  v_actual_rule_count INTEGER;
  v_matching_rule_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  v_array_length := COALESCE(array_length(p_rule_ids, 1), 0);
  IF p_rule_set_id IS NULL OR v_array_length = 0 THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      'Rule set and at least one rule are required'
    );
  END IF;

  SELECT COUNT(DISTINCT rule_id)
  INTO v_distinct_count
  FROM unnest(p_rule_ids) AS input(rule_id);

  IF v_distinct_count <> v_array_length THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      'Duplicate rule IDs are not allowed'
    );
  END IF;

  SELECT imo_id
  INTO v_rule_set_imo_id
  FROM public.underwriting_rule_sets
  WHERE id = p_rule_set_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      'Rule set not found or access denied'
    );
  END IF;

  v_caller_imo_id := get_my_imo_id();
  IF v_caller_imo_id IS NULL
     OR v_rule_set_imo_id IS NULL
     OR v_rule_set_imo_id IS DISTINCT FROM v_caller_imo_id
     OR NOT is_imo_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  PERFORM 1
  FROM public.underwriting_rules
  WHERE rule_set_id = p_rule_set_id
  FOR UPDATE;

  SELECT COUNT(*)
  INTO v_actual_rule_count
  FROM public.underwriting_rules
  WHERE rule_set_id = p_rule_set_id;

  SELECT COUNT(*)
  INTO v_matching_rule_count
  FROM public.underwriting_rules
  WHERE rule_set_id = p_rule_set_id
    AND id = ANY(p_rule_ids);

  IF v_array_length <> v_actual_rule_count
     OR v_matching_rule_count <> v_array_length THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      'Rule list does not exactly match the current rule set'
    );
  END IF;

  UPDATE public.underwriting_rules
  SET
    priority = -priority - 1000000,
    updated_at = now()
  WHERE rule_set_id = p_rule_set_id;

  WITH ordered_rules AS (
    SELECT
      rule_id,
      ordinality::INTEGER * 10 AS new_priority
    FROM unnest(p_rule_ids) WITH ORDINALITY AS input(rule_id, ordinality)
  ),
  updated_rules AS (
    UPDATE public.underwriting_rules rules
    SET
      priority = ordered_rules.new_priority,
      updated_at = now()
    FROM ordered_rules
    WHERE rules.id = ordered_rules.rule_id
      AND rules.rule_set_id = p_rule_set_id
    RETURNING 1
  )
  SELECT COUNT(*)
  INTO v_updated_count
  FROM updated_rules;

  IF v_updated_count <> v_array_length THEN
    RAISE EXCEPTION 'Unexpected reorder count mismatch';
  END IF;

  RETURN jsonb_build_object(
    'success',
    true,
    'updated',
    v_updated_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      'Failed to reorder rules'
    );
END;
$$;

COMMENT ON FUNCTION public.reorder_underwriting_rules(UUID, UUID[]) IS
'Atomically reorders underwriting rules after locking the parent rule set and validating exact tenant-scoped membership.';

GRANT EXECUTE ON FUNCTION public.reorder_underwriting_rules(UUID, UUID[]) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_underwriting_sessions_agency_imo_created_at
ON public.underwriting_sessions (agency_id, imo_id, created_at DESC);
