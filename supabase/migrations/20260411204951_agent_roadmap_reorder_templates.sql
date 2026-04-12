-- Agent Roadmap: roadmap_reorder_templates RPC
--
-- Lets a super-admin reorder roadmap templates within an agency by
-- rewriting roadmap_templates.sort_order in a single transaction.
--
-- The column already exists (from 20260411150237_agent_roadmap_schema.sql
-- line 68) — this migration only adds the RPC that mutates it.
--
-- Note: unlike roadmap_sections and roadmap_items, roadmap_templates has
-- NO unique constraint on sort_order, so the batch UPDATE doesn't need
-- DEFERRABLE semantics. A plain UPDATE with unnest WITH ORDINALITY works.
--
-- Default roadmap (is_default=true) is always included in the orderedIds
-- array at position 0 by the caller so this RPC's "must pass all" check
-- succeeds. The list query orders by `is_default DESC, sort_order ASC`
-- so the default stays pinned at the top of the render regardless of its
-- actual sort_order value.

CREATE OR REPLACE FUNCTION public.roadmap_reorder_templates(
  p_agency_id   uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count     int;
  v_total     int;
  v_array_len int;
BEGIN
  -- Fast-fail super-admin guard. The rt_update RLS policy would also block
  -- a non-super-admin's UPDATE, but that path returns silent "0 rows
  -- affected" instead of a specific error. The guard surfaces the problem
  -- at call time with a clear message.
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'roadmap_reorder_templates: super-admin required'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  v_array_len := COALESCE(array_length(p_ordered_ids, 1), 0);

  IF v_array_len = 0 THEN
    RAISE EXCEPTION 'roadmap_reorder_templates: p_ordered_ids must not be empty';
  END IF;

  -- Every id must belong to this agency. Prevents a super-admin in Agency A
  -- from reordering Agency B's roadmaps through a crafted payload.
  SELECT count(*) INTO v_count
  FROM public.roadmap_templates
  WHERE id = ANY(p_ordered_ids) AND agency_id = p_agency_id;

  IF v_count <> v_array_len THEN
    RAISE EXCEPTION 'roadmap_reorder_templates: one or more ids do not belong to agency %', p_agency_id;
  END IF;

  -- Must pass ALL templates in the agency. Catches the stale-cache race
  -- where the caller has N-1 roadmaps in their cache but N exist in the DB
  -- (because another tab created one). Without this check, the missing
  -- roadmap silently keeps its old sort_order and ends up out of place.
  SELECT count(*) INTO v_total
  FROM public.roadmap_templates
  WHERE agency_id = p_agency_id;

  IF v_count <> v_total THEN
    RAISE EXCEPTION 'roadmap_reorder_templates: caller passed % ids but agency has % templates', v_count, v_total;
  END IF;

  UPDATE public.roadmap_templates AS t
  SET sort_order = idx.new_order - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS idx(id, new_order)
  WHERE t.id = idx.id AND t.agency_id = p_agency_id;
END $$;

COMMENT ON FUNCTION public.roadmap_reorder_templates IS
  'Batch reorder roadmap templates within an agency. Super-admin only. '
  'Validates ownership of every id and requires the caller to pass ALL '
  'templates in the agency (no partial reorders). Mirrors the existing '
  'roadmap_reorder_sections / roadmap_reorder_items RPCs.';

GRANT EXECUTE ON FUNCTION public.roadmap_reorder_templates(uuid, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
