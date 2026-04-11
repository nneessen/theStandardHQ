-- Agent Roadmap schema hardening — addresses M-3 and M-7 from the review.
--
-- M-3: The FK `roadmap_item_progress.item_id` has no supporting index, so
-- ON DELETE CASCADE on roadmap_items triggers a sequential scan of the
-- progress table for every row deleted. At current scale this is invisible;
-- at 10k+ progress rows it becomes a visible stall on every item delete.
--
-- M-7: The denormalized columns `agency_id` (on sections/items/progress)
-- and `roadmap_id` (on items/progress) are populated by BEFORE INSERT
-- triggers from the parent row, but have NO foreign key constraints. In
-- normal operation the triggers keep them consistent. If a trigger is ever
-- disabled for maintenance, or a service-role write bypasses the trigger,
-- invalid IDs can land in the columns. Adding FKs is a cheap defense with
-- zero runtime cost that makes misconfiguration fail loudly instead of
-- silently corrupting RLS enforcement.
--
-- This migration is purely additive: no existing rows are modified, no
-- columns are dropped, no behavior changes for correctly-inserted rows.

-- ============================================================================
-- 1. Index on roadmap_item_progress(item_id) for cascade delete performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_roadmap_progress_item
  ON public.roadmap_item_progress(item_id);

-- ============================================================================
-- 2. FK constraints on denormalized columns
-- ============================================================================
-- All four constraints use ON DELETE CASCADE to match the inheritance
-- semantics: if the parent goes, the child goes with it. This is consistent
-- with how the tables already cascade via the non-denormalized parent FK
-- (section_id, roadmap_id, item_id) so no new deletion behavior is introduced.
--
-- We use DO blocks + IF NOT EXISTS checks so the migration is idempotent
-- against re-runs and against databases where these may have been added
-- manually.

-- roadmap_sections.agency_id → agencies(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roadmap_sections_agency_id_fkey'
  ) THEN
    ALTER TABLE public.roadmap_sections
      ADD CONSTRAINT roadmap_sections_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- roadmap_items.agency_id → agencies(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roadmap_items_agency_id_fkey'
  ) THEN
    ALTER TABLE public.roadmap_items
      ADD CONSTRAINT roadmap_items_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- roadmap_items.roadmap_id → roadmap_templates(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roadmap_items_roadmap_id_fkey'
  ) THEN
    ALTER TABLE public.roadmap_items
      ADD CONSTRAINT roadmap_items_roadmap_id_fkey
      FOREIGN KEY (roadmap_id) REFERENCES public.roadmap_templates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- roadmap_item_progress.agency_id → agencies(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roadmap_item_progress_agency_id_fkey'
  ) THEN
    ALTER TABLE public.roadmap_item_progress
      ADD CONSTRAINT roadmap_item_progress_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- roadmap_item_progress.roadmap_id → roadmap_templates(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roadmap_item_progress_roadmap_id_fkey'
  ) THEN
    ALTER TABLE public.roadmap_item_progress
      ADD CONSTRAINT roadmap_item_progress_roadmap_id_fkey
      FOREIGN KEY (roadmap_id) REFERENCES public.roadmap_templates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 3. Column documentation (L-2-adjacent — makes the denormalization explicit)
-- ============================================================================

COMMENT ON COLUMN public.roadmap_sections.agency_id IS
  'Denormalized from roadmap_templates.agency_id via trg_roadmap_sections_inherit. '
  'Keeps RLS policies flat. Read-only from the caller''s perspective — the '
  'trigger overwrites whatever value the INSERT provides.';

COMMENT ON COLUMN public.roadmap_items.roadmap_id IS
  'Denormalized from the parent section''s roadmap_id via trg_roadmap_items_inherit.';

COMMENT ON COLUMN public.roadmap_items.agency_id IS
  'Denormalized from the parent section''s agency_id via trg_roadmap_items_inherit.';

COMMENT ON COLUMN public.roadmap_item_progress.roadmap_id IS
  'Denormalized from the target item''s roadmap_id via trg_roadmap_progress_inherit.';

COMMENT ON COLUMN public.roadmap_item_progress.agency_id IS
  'Denormalized from the target item''s agency_id via trg_roadmap_progress_inherit.';

NOTIFY pgrst, 'reload schema';
