-- Agent Roadmap progress upsert RPCs (fixes audit-trail bugs found in review)
--
-- Background: the TypeScript service layer was using Supabase's .upsert() for
-- progress rows, which generates INSERT ... ON CONFLICT DO UPDATE SET <all cols>.
-- This had two bugs:
--
--   H-1: updateNotes() hard-coded status='not_started' in the upsert payload,
--        so typing a note on a completed item wiped the completion state.
--   H-2: upsertProgress() overwrote started_at on every completion, losing
--        the original start timestamp (breaks time-on-item analytics).
--
-- Both are fixed by moving the state transition logic into SQL RPCs that
-- use ON CONFLICT with column-level COALESCE semantics — the new value is
-- only written when it's "better" than the old one, and other columns are
-- preserved from the existing row.
--
-- These RPCs are SECURITY INVOKER so RLS still applies — a user can only
-- upsert their own progress rows (enforced by rp_insert/rp_update policies).

-- ============================================================================
-- roadmap_upsert_progress — transitions status with audit-preserving timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION public.roadmap_upsert_progress(
  p_item_id uuid,
  p_status  public.roadmap_progress_status,
  p_notes   text DEFAULT NULL
)
RETURNS public.roadmap_item_progress
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_row       public.roadmap_item_progress;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_upsert_progress: no authenticated user';
  END IF;

  -- INSERT first, fall through to UPDATE on conflict. The DO UPDATE block
  -- uses the EXISTING row's started_at (preserving the audit trail) and
  -- derives completed_at from the new status.
  --
  -- Note: we do NOT include notes in the DO UPDATE SET clause so this RPC
  -- ONLY touches status + timestamps. Notes are updated via a separate RPC
  -- (roadmap_update_progress_notes) so "type a note on a completed item"
  -- cannot clobber completion state.
  INSERT INTO public.roadmap_item_progress
    (user_id, item_id, status, started_at, completed_at, notes)
  VALUES (
    v_user_id,
    p_item_id,
    p_status,
    CASE
      WHEN p_status IN ('in_progress', 'completed') THEN now()
      ELSE NULL
    END,
    CASE WHEN p_status = 'completed' THEN now() ELSE NULL END,
    p_notes
  )
  ON CONFLICT (user_id, item_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    -- Preserve the earliest started_at. For a fresh transition into
    -- in_progress/completed we use the existing started_at if set, otherwise
    -- now(). For not_started/skipped we clear started_at.
    started_at = CASE
      WHEN EXCLUDED.status IN ('in_progress', 'completed')
        THEN COALESCE(public.roadmap_item_progress.started_at, now())
      WHEN EXCLUDED.status = 'not_started'
        THEN NULL
      ELSE public.roadmap_item_progress.started_at  -- skipped keeps history
    END,
    completed_at = CASE
      WHEN EXCLUDED.status = 'completed' THEN now()
      ELSE NULL
    END,
    -- Only overwrite notes if the caller passed a non-NULL value.
    -- Passing NULL leaves existing notes alone (important when transitioning
    -- status without touching notes — the client can send p_notes => NULL).
    notes = COALESCE(EXCLUDED.notes, public.roadmap_item_progress.notes),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

COMMENT ON FUNCTION public.roadmap_upsert_progress IS
  'Transition progress status for the current user on an item. Preserves '
  'earliest started_at across state changes to keep the audit trail intact. '
  'Pass p_notes=NULL to avoid touching notes.';

GRANT EXECUTE ON FUNCTION public.roadmap_upsert_progress(uuid, public.roadmap_progress_status, text) TO authenticated;

-- ============================================================================
-- roadmap_update_progress_notes — notes-only update that never touches status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.roadmap_update_progress_notes(
  p_item_id uuid,
  p_notes   text
)
RETURNS public.roadmap_item_progress
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row     public.roadmap_item_progress;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_update_progress_notes: no authenticated user';
  END IF;

  INSERT INTO public.roadmap_item_progress
    (user_id, item_id, status, notes)
  VALUES (v_user_id, p_item_id, 'not_started', p_notes)
  ON CONFLICT (user_id, item_id) DO UPDATE
  SET
    notes      = EXCLUDED.notes,
    updated_at = now()
    -- Deliberately do NOT touch status, started_at, or completed_at.
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

COMMENT ON FUNCTION public.roadmap_update_progress_notes IS
  'Update an agent''s private notes on a roadmap item without touching '
  'status or timestamps. Preserves completion state when the agent types '
  'a note on a completed item.';

GRANT EXECUTE ON FUNCTION public.roadmap_update_progress_notes(uuid, text) TO authenticated;

-- ============================================================================
-- Defense-in-depth: block non-super-admin calls to reorder RPCs early
-- (M-2 from review). These RPCs currently silently no-op under RLS for
-- non-super-admins because the UPDATE policy blocks the actual write.
-- Adding an explicit guard surfaces the error at call time instead of
-- returning a fake success.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.roadmap_reorder_sections(
  p_roadmap_id  uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_total int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'roadmap_reorder_sections: super-admin required';
  END IF;

  -- Every id must belong to this roadmap (prevents cross-roadmap tampering)
  SELECT count(*) INTO v_count
  FROM public.roadmap_sections
  WHERE id = ANY(p_ordered_ids) AND roadmap_id = p_roadmap_id;

  IF v_count <> COALESCE(array_length(p_ordered_ids, 1), 0) THEN
    RAISE EXCEPTION 'roadmap_reorder_sections: one or more ids do not belong to roadmap %', p_roadmap_id;
  END IF;

  -- M-1: the caller must pass ALL sections in the roadmap, not a subset
  SELECT count(*) INTO v_total
  FROM public.roadmap_sections
  WHERE roadmap_id = p_roadmap_id;

  IF v_count <> v_total THEN
    RAISE EXCEPTION 'roadmap_reorder_sections: caller passed % ids but roadmap has % sections', v_count, v_total;
  END IF;

  UPDATE public.roadmap_sections AS s
  SET sort_order = idx.new_order - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS idx(id, new_order)
  WHERE s.id = idx.id AND s.roadmap_id = p_roadmap_id;
END $$;

CREATE OR REPLACE FUNCTION public.roadmap_reorder_items(
  p_section_id  uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_total int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'roadmap_reorder_items: super-admin required';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.roadmap_items
  WHERE id = ANY(p_ordered_ids) AND section_id = p_section_id;

  IF v_count <> COALESCE(array_length(p_ordered_ids, 1), 0) THEN
    RAISE EXCEPTION 'roadmap_reorder_items: one or more ids do not belong to section %', p_section_id;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.roadmap_items
  WHERE section_id = p_section_id;

  IF v_count <> v_total THEN
    RAISE EXCEPTION 'roadmap_reorder_items: caller passed % ids but section has % items', v_count, v_total;
  END IF;

  UPDATE public.roadmap_items AS i
  SET sort_order = idx.new_order - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS idx(id, new_order)
  WHERE i.id = idx.id AND i.section_id = p_section_id;
END $$;

CREATE OR REPLACE FUNCTION public.roadmap_move_item(
  p_item_id           uuid,
  p_target_section_id uuid,
  p_new_index         int
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_source_section_id uuid;
  v_target_roadmap_id uuid;
  v_source_roadmap_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'roadmap_move_item: super-admin required';
  END IF;

  SELECT section_id INTO v_source_section_id
  FROM public.roadmap_items WHERE id = p_item_id;

  IF v_source_section_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_move_item: item % not found', p_item_id;
  END IF;

  SELECT roadmap_id INTO v_source_roadmap_id FROM public.roadmap_sections WHERE id = v_source_section_id;
  SELECT roadmap_id INTO v_target_roadmap_id FROM public.roadmap_sections WHERE id = p_target_section_id;

  IF v_source_roadmap_id IS NULL OR v_target_roadmap_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_move_item: source or target section not found';
  END IF;

  IF v_source_roadmap_id <> v_target_roadmap_id THEN
    RAISE EXCEPTION 'roadmap_move_item: cannot move item across roadmaps';
  END IF;

  IF v_source_section_id = p_target_section_id THEN
    PERFORM public.roadmap_reorder_items(
      p_target_section_id,
      (
        WITH curr AS (
          SELECT id, sort_order
          FROM public.roadmap_items
          WHERE section_id = p_target_section_id
            AND id <> p_item_id
          ORDER BY sort_order
        ),
        indexed AS (
          SELECT id, row_number() OVER () - 1 AS rn FROM curr
        ),
        before_item AS (
          SELECT id FROM indexed WHERE rn < p_new_index ORDER BY rn
        ),
        after_item AS (
          SELECT id FROM indexed WHERE rn >= p_new_index ORDER BY rn
        )
        SELECT array_agg(id ORDER BY ord)
        FROM (
          SELECT id, 1 AS ord FROM before_item
          UNION ALL
          SELECT p_item_id, 2
          UNION ALL
          SELECT id, 3 FROM after_item
        ) t
      )
    );
    RETURN;
  END IF;

  UPDATE public.roadmap_items
  SET sort_order = sort_order + 1
  WHERE section_id = p_target_section_id AND sort_order >= p_new_index;

  UPDATE public.roadmap_items
  SET section_id = p_target_section_id, sort_order = p_new_index
  WHERE id = p_item_id;

  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort_order) - 1 AS new_order
    FROM public.roadmap_items
    WHERE section_id = v_source_section_id
  )
  UPDATE public.roadmap_items AS i
  SET sort_order = ranked.new_order
  FROM ranked
  WHERE i.id = ranked.id;
END $$;

CREATE OR REPLACE FUNCTION public.roadmap_set_default(p_roadmap_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'roadmap_set_default: super-admin required';
  END IF;

  SELECT agency_id INTO v_agency_id
  FROM public.roadmap_templates
  WHERE id = p_roadmap_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_set_default: roadmap % not found', p_roadmap_id;
  END IF;

  UPDATE public.roadmap_templates
  SET is_default = false
  WHERE agency_id = v_agency_id AND id <> p_roadmap_id AND is_default = true;

  UPDATE public.roadmap_templates
  SET is_default = true
  WHERE id = p_roadmap_id;
END $$;

NOTIFY pgrst, 'reload schema';
