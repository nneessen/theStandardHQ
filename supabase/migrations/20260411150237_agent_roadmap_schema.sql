-- Agent Roadmap: schema + triggers + RPCs
-- Feature: agent-roadmap (gated to The Standard via UI layer)
-- See plan: /Users/nickneessen/.claude/plans/parsed-coalescing-star.md
--
-- Tables created:
--   roadmap_templates         — top-level container (many per agency, one default)
--   roadmap_sections          — groups of items within a roadmap
--   roadmap_items             — checkoff units with jsonb content_blocks
--   roadmap_item_progress     — per-user, per-item state + private notes
--
-- Triggers:
--   denormalize roadmap_id / agency_id down the tree so RLS stays flat
--
-- RPCs:
--   roadmap_reorder_sections, roadmap_reorder_items,
--   roadmap_move_item, roadmap_set_default

-- ============================================================================
-- 1. ENUM
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE roadmap_progress_status AS ENUM (
    'not_started', 'in_progress', 'completed', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- roadmap_templates
CREATE TABLE IF NOT EXISTS public.roadmap_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  imo_id       uuid REFERENCES public.imos(id) ON DELETE SET NULL,
  title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description  text,
  icon         text,
  is_published boolean NOT NULL DEFAULT false,
  is_default   boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0,
  created_by   uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_templates_agency
  ON public.roadmap_templates(agency_id, is_published);

-- At most one default roadmap per agency, enforced at DB layer
CREATE UNIQUE INDEX IF NOT EXISTS uniq_roadmap_templates_default_per_agency
  ON public.roadmap_templates(agency_id) WHERE is_default = true;

COMMENT ON TABLE public.roadmap_templates IS
  'Agent onboarding roadmaps. Many per agency; exactly one may be is_default (the "START HERE").';

-- roadmap_sections
CREATE TABLE IF NOT EXISTS public.roadmap_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id  uuid NOT NULL REFERENCES public.roadmap_templates(id) ON DELETE CASCADE,
  agency_id   uuid NOT NULL,
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text,
  sort_order  int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_roadmap_sections_order UNIQUE (roadmap_id, sort_order) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_roadmap_sections_roadmap
  ON public.roadmap_sections(roadmap_id, sort_order);

COMMENT ON TABLE public.roadmap_sections IS
  'Sections group roadmap items. agency_id is denormalized from roadmap_templates via trigger.';

-- roadmap_items
CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id        uuid NOT NULL REFERENCES public.roadmap_sections(id) ON DELETE CASCADE,
  roadmap_id        uuid NOT NULL,
  agency_id         uuid NOT NULL,
  title             text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  summary           text,
  content_blocks    jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required       boolean NOT NULL DEFAULT true,
  is_published      boolean NOT NULL DEFAULT true,
  estimated_minutes int,
  sort_order        int NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_roadmap_items_order UNIQUE (section_id, sort_order) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT content_blocks_is_array CHECK (jsonb_typeof(content_blocks) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_roadmap_items_section
  ON public.roadmap_items(section_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_roadmap_items_roadmap_pub
  ON public.roadmap_items(roadmap_id) WHERE is_published = true;

COMMENT ON TABLE public.roadmap_items IS
  'Individual checkoff items. content_blocks is a discriminated union validated client-side.';

-- roadmap_item_progress
CREATE TABLE IF NOT EXISTS public.roadmap_item_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  roadmap_id   uuid NOT NULL,
  agency_id    uuid NOT NULL,
  status       roadmap_progress_status NOT NULL DEFAULT 'not_started',
  started_at   timestamptz,
  completed_at timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_roadmap_item_progress UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_progress_user_roadmap
  ON public.roadmap_item_progress(user_id, roadmap_id);

CREATE INDEX IF NOT EXISTS idx_roadmap_progress_roadmap_status
  ON public.roadmap_item_progress(roadmap_id, status);

COMMENT ON TABLE public.roadmap_item_progress IS
  'Per-user, per-item state with private notes. Uncheck transitions status; rows are never DELETEd by users.';

-- ============================================================================
-- 3. TRIGGERS — keep denormalized columns in sync
-- ============================================================================

CREATE OR REPLACE FUNCTION public.roadmap_sections_inherit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  SELECT agency_id INTO NEW.agency_id
  FROM public.roadmap_templates
  WHERE id = NEW.roadmap_id;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_roadmap_sections_inherit ON public.roadmap_sections;
CREATE TRIGGER trg_roadmap_sections_inherit
  BEFORE INSERT OR UPDATE OF roadmap_id ON public.roadmap_sections
  FOR EACH ROW EXECUTE FUNCTION public.roadmap_sections_inherit();

CREATE OR REPLACE FUNCTION public.roadmap_items_inherit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  SELECT roadmap_id, agency_id
    INTO NEW.roadmap_id, NEW.agency_id
  FROM public.roadmap_sections
  WHERE id = NEW.section_id;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_roadmap_items_inherit ON public.roadmap_items;
CREATE TRIGGER trg_roadmap_items_inherit
  BEFORE INSERT OR UPDATE OF section_id ON public.roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.roadmap_items_inherit();

CREATE OR REPLACE FUNCTION public.roadmap_progress_inherit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  SELECT roadmap_id, agency_id
    INTO NEW.roadmap_id, NEW.agency_id
  FROM public.roadmap_items
  WHERE id = NEW.item_id;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_roadmap_progress_inherit ON public.roadmap_item_progress;
CREATE TRIGGER trg_roadmap_progress_inherit
  BEFORE INSERT OR UPDATE OF item_id ON public.roadmap_item_progress
  FOR EACH ROW EXECUTE FUNCTION public.roadmap_progress_inherit();

-- Also bump updated_at on any UPDATE (not just section_id changes)
CREATE OR REPLACE FUNCTION public.roadmap_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_roadmap_templates_touch ON public.roadmap_templates;
CREATE TRIGGER trg_roadmap_templates_touch
  BEFORE UPDATE ON public.roadmap_templates
  FOR EACH ROW EXECUTE FUNCTION public.roadmap_touch_updated_at();

-- ============================================================================
-- 4. RPCs — transactional multi-row operations
-- ============================================================================

-- roadmap_reorder_sections
-- Rewrites sort_order for all sections in a roadmap in one transaction.
-- Relies on DEFERRABLE INITIALLY DEFERRED unique constraint.
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
BEGIN
  -- Every id must belong to this roadmap (prevents cross-roadmap tampering)
  SELECT count(*) INTO v_count
  FROM public.roadmap_sections
  WHERE id = ANY(p_ordered_ids) AND roadmap_id = p_roadmap_id;

  IF v_count <> array_length(p_ordered_ids, 1) THEN
    RAISE EXCEPTION 'roadmap_reorder_sections: one or more ids do not belong to roadmap %', p_roadmap_id;
  END IF;

  UPDATE public.roadmap_sections AS s
  SET sort_order = idx.new_order - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS idx(id, new_order)
  WHERE s.id = idx.id AND s.roadmap_id = p_roadmap_id;
END $$;

COMMENT ON FUNCTION public.roadmap_reorder_sections IS
  'Batch reorder sections in a roadmap. Validates ownership.';

-- roadmap_reorder_items
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
BEGIN
  SELECT count(*) INTO v_count
  FROM public.roadmap_items
  WHERE id = ANY(p_ordered_ids) AND section_id = p_section_id;

  IF v_count <> array_length(p_ordered_ids, 1) THEN
    RAISE EXCEPTION 'roadmap_reorder_items: one or more ids do not belong to section %', p_section_id;
  END IF;

  UPDATE public.roadmap_items AS i
  SET sort_order = idx.new_order - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS idx(id, new_order)
  WHERE i.id = idx.id AND i.section_id = p_section_id;
END $$;

COMMENT ON FUNCTION public.roadmap_reorder_items IS
  'Batch reorder items within a section. Validates ownership.';

-- roadmap_move_item — cross-section drag
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
  SELECT section_id INTO v_source_section_id
  FROM public.roadmap_items WHERE id = p_item_id;

  IF v_source_section_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_move_item: item % not found', p_item_id;
  END IF;

  -- Ensure both sections belong to the same roadmap
  SELECT roadmap_id INTO v_source_roadmap_id FROM public.roadmap_sections WHERE id = v_source_section_id;
  SELECT roadmap_id INTO v_target_roadmap_id FROM public.roadmap_sections WHERE id = p_target_section_id;

  IF v_source_roadmap_id IS NULL OR v_target_roadmap_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_move_item: source or target section not found';
  END IF;

  IF v_source_roadmap_id <> v_target_roadmap_id THEN
    RAISE EXCEPTION 'roadmap_move_item: cannot move item across roadmaps';
  END IF;

  -- Same-section move simplifies to a reorder: compute new ordering from current state
  -- and call roadmap_reorder_items. For cross-section, we need to (a) shift target
  -- section items at >= p_new_index, (b) update the item, (c) compact source section.

  IF v_source_section_id = p_target_section_id THEN
    -- Same-section: rebuild ordering with the item in its new slot
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

  -- Cross-section move: temporarily set sort_order to a safe high value so the
  -- DEFERRED unique constraint doesn't bite mid-operation, then place properly.

  -- 1. Shift target section items at or after p_new_index up by 1
  UPDATE public.roadmap_items
  SET sort_order = sort_order + 1
  WHERE section_id = p_target_section_id
    AND sort_order >= p_new_index;

  -- 2. Move the item (trigger updates roadmap_id + agency_id, though they stay
  --    the same because we validated source == target roadmap above)
  UPDATE public.roadmap_items
  SET section_id = p_target_section_id,
      sort_order = p_new_index
  WHERE id = p_item_id;

  -- 3. Compact source section (fill the gap the item left behind)
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
  'Move an item within or across sections (same roadmap only). Compacts source, shifts target.';

-- roadmap_set_default — clear siblings then set target; partial unique index requires this atomicity
CREATE OR REPLACE FUNCTION public.roadmap_set_default(p_roadmap_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
BEGIN
  SELECT agency_id INTO v_agency_id
  FROM public.roadmap_templates
  WHERE id = p_roadmap_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'roadmap_set_default: roadmap % not found', p_roadmap_id;
  END IF;

  -- Clear is_default on all other roadmaps in the same agency
  UPDATE public.roadmap_templates
  SET is_default = false
  WHERE agency_id = v_agency_id
    AND id <> p_roadmap_id
    AND is_default = true;

  -- Set is_default on the target
  UPDATE public.roadmap_templates
  SET is_default = true
  WHERE id = p_roadmap_id;
END $$;

COMMENT ON FUNCTION public.roadmap_set_default IS
  'Atomically mark a roadmap as the default for its agency, clearing any previous default.';

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_templates     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_sections      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_items         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_item_progress TO authenticated;

GRANT EXECUTE ON FUNCTION public.roadmap_reorder_sections(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.roadmap_reorder_items(uuid, uuid[])    TO authenticated;
GRANT EXECUTE ON FUNCTION public.roadmap_move_item(uuid, uuid, int)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.roadmap_set_default(uuid)              TO authenticated;

-- Reload PostgREST schema cache so new tables/functions are visible immediately
NOTIFY pgrst, 'reload schema';
