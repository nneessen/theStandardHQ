-- Agent Roadmap RPC hardening — addresses B-3, M-2, L-10 from the review.
--
-- B-3 (Blocking): roadmap_upsert_progress did not verify that the target item
-- was visible (published + in a published roadmap + in the caller's agency)
-- before inserting a progress row. A user could iterate UUIDs and learn which
-- draft items exist by observing RPC success vs. error. Fix: add an EXISTS
-- check at the top of the RPC so non-visible items raise a specific error.
--
-- M-2 (Medium): roadmap_move_item's cross-section path does three sequential
-- UPDATEs without row-level locking. Concurrent moves in the same roadmap
-- can cause DEFERRABLE unique-constraint violations at commit time. Fix:
-- SELECT ... FOR UPDATE on both source and target section items early to
-- serialize concurrent moves within the affected sections.
--
-- L-10 (Quality): reorder RPCs silently no-op on empty arrays (COALESCE wraps
-- array_length NULL). Fix: raise an explicit error so clients see a clear
-- message instead of a mysterious "nothing happened."
--
-- All three RPCs remain SECURITY INVOKER so RLS continues to apply. Super-
-- admin guard checks at the top are preserved.

-- ============================================================================
-- B-3 + function rewrite: roadmap_upsert_progress with visibility check
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
  v_user_id uuid := auth.uid();
  v_row     public.roadmap_item_progress;
  v_visible boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_upsert_progress: no authenticated user';
  END IF;

  -- B-3 visibility gate: the caller must be able to SEE the item via the
  -- published-item SELECT policy. We check this explicitly (rather than
  -- delegating to RLS) because RLS on roadmap_item_progress only checks
  -- agency_id, not whether the item is actually published+visible. Without
  -- this check, an agent can create progress rows against draft items in
  -- their own agency and learn the draft UUIDs by observing success/error.
  --
  -- Super-admins bypass the published-item gate so they can test-drive
  -- roadmaps in draft mode.
  SELECT EXISTS (
    SELECT 1
    FROM public.roadmap_items i
    JOIN public.roadmap_templates t ON t.id = i.roadmap_id
    WHERE i.id = p_item_id
      AND (
        public.is_super_admin()
        OR (
          i.is_published = true
          AND t.is_published = true
          AND t.agency_id IN (
            SELECT agency_id FROM public.user_profiles WHERE id = v_user_id
          )
        )
      )
  ) INTO v_visible;

  IF NOT v_visible THEN
    RAISE EXCEPTION 'roadmap_upsert_progress: item % is not accessible', p_item_id
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  -- INSERT first, fall through to UPDATE on conflict. The DO UPDATE block
  -- uses the EXISTING row's started_at (preserving the audit trail) and
  -- derives completed_at from the new status. Notes are preserved unless
  -- a non-NULL value is passed.
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
    started_at = CASE
      WHEN EXCLUDED.status IN ('in_progress', 'completed')
        THEN COALESCE(public.roadmap_item_progress.started_at, now())
      WHEN EXCLUDED.status = 'not_started'
        THEN NULL
      ELSE public.roadmap_item_progress.started_at
    END,
    completed_at = CASE
      WHEN EXCLUDED.status = 'completed' THEN now()
      ELSE NULL
    END,
    notes = COALESCE(EXCLUDED.notes, public.roadmap_item_progress.notes),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

COMMENT ON FUNCTION public.roadmap_upsert_progress IS
  'Transition progress status on an item for the current user. Verifies the '
  'item is visible to the caller (B-3 fix), preserves earliest started_at '
  'across transitions, and never clobbers notes when p_notes is NULL.';

GRANT EXECUTE ON FUNCTION public.roadmap_upsert_progress(uuid, public.roadmap_progress_status, text) TO authenticated;

-- ============================================================================
-- L-10: roadmap_reorder_sections with explicit empty-array rejection
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
  v_count     int;
  v_total     int;
  v_array_len int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'roadmap_reorder_sections: super-admin required'
      USING ERRCODE = '42501';
  END IF;

  v_array_len := COALESCE(array_length(p_ordered_ids, 1), 0);

  IF v_array_len = 0 THEN
    RAISE EXCEPTION 'roadmap_reorder_sections: p_ordered_ids must not be empty';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.roadmap_sections
  WHERE id = ANY(p_ordered_ids) AND roadmap_id = p_roadmap_id;

  IF v_count <> v_array_len THEN
    RAISE EXCEPTION 'roadmap_reorder_sections: one or more ids do not belong to roadmap %', p_roadmap_id;
  END IF;

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

-- ============================================================================
-- L-10: roadmap_reorder_items with explicit empty-array rejection
-- ============================================================================

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
  v_count     int;
  v_total     int;
  v_array_len int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'roadmap_reorder_items: super-admin required'
      USING ERRCODE = '42501';
  END IF;

  v_array_len := COALESCE(array_length(p_ordered_ids, 1), 0);

  IF v_array_len = 0 THEN
    RAISE EXCEPTION 'roadmap_reorder_items: p_ordered_ids must not be empty';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.roadmap_items
  WHERE id = ANY(p_ordered_ids) AND section_id = p_section_id;

  IF v_count <> v_array_len THEN
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

-- ============================================================================
-- M-2: roadmap_move_item with SELECT ... FOR UPDATE locking
-- ============================================================================

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
    RAISE EXCEPTION 'roadmap_move_item: super-admin required'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_index < 0 THEN
    RAISE EXCEPTION 'roadmap_move_item: p_new_index must be non-negative (got %)', p_new_index;
  END IF;

  -- Look up the source section, locking the item row so concurrent callers
  -- serialize on the same item.
  SELECT section_id INTO v_source_section_id
  FROM public.roadmap_items
  WHERE id = p_item_id
  FOR UPDATE;

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

  -- M-2: Lock every item in both affected sections BEFORE any UPDATE.
  -- This serializes concurrent move_item calls that touch overlapping
  -- sections, preventing transient unique-constraint violations even with
  -- the DEFERRABLE constraint. The lock is held until the end of the
  -- transaction (which is the end of this RPC invocation).
  PERFORM 1
  FROM public.roadmap_items
  WHERE section_id IN (v_source_section_id, p_target_section_id)
  ORDER BY id
  FOR UPDATE;

  -- Same-section move: delegate to reorder_items with the item in its
  -- new slot. The reorder RPC also takes FOR UPDATE locks, but those are
  -- already held from the PERFORM above.
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

  -- Cross-section move (already locked above). The DEFERRABLE unique
  -- constraint lets these statements run in any order without transient
  -- violations; the locks prevent other transactions from interleaving.
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

COMMENT ON FUNCTION public.roadmap_move_item IS
  'Move an item within or across sections (same roadmap only). Uses FOR UPDATE '
  'locks on both affected sections to serialize concurrent moves (M-2 fix). '
  'Delegates same-section moves to roadmap_reorder_items.';

NOTIFY pgrst, 'reload schema';
