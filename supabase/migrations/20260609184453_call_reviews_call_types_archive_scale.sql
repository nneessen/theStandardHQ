-- Call Reviews v2: DB-stored call types ("angles"), soft-archive, and scale indexes.
--
-- 1. kpi_call_types — IMO-scoped, super-admin/IMO-admin-managed vocabulary that
--    replaces the free-text "caller name" on upload (Cash Out, Consolidation,
--    Term to Perm, …). Agents in the IMO read it; only admins write it.
-- 2. kpi_call_recordings gains call_type_id + soft-archive (archived_at/by).
-- 3. Indexes for SERVER-SIDE pagination + search at thousands of recordings:
--    a partial (non-archived) IMO/time index, a call_type index, and pg_trgm GIN
--    indexes so ILIKE search over caller/filename/transcript stays index-backed.
--
-- Mirrors the conventions in 20260609074223_call_reviews_training_platform.sql:
-- (SELECT helper()) InitPlan-hoist, mandatory RESTRICTIVE revocation_deny, grants.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. kpi_call_types
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.kpi_call_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id      uuid NOT NULL REFERENCES public.imos(id),
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness per IMO; fast active-list fetch for the dropdown.
CREATE UNIQUE INDEX kpi_call_types_imo_name_key
  ON public.kpi_call_types (imo_id, lower(name));
CREATE INDEX idx_kpi_call_types_imo_active
  ON public.kpi_call_types (imo_id, is_active, sort_order);

ALTER TABLE public.kpi_call_types ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER kpi_call_types_set_updated_at
  BEFORE UPDATE ON public.kpi_call_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Read: any member of the IMO (agents need the dropdown). InitPlan-hoisted.
CREATE POLICY kpi_call_types_select ON public.kpi_call_types
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

-- Write: super-admin (in scope) or IMO admin — "the super admin manages these".
CREATE POLICY kpi_call_types_insert ON public.kpi_call_types
  FOR INSERT TO authenticated
  WITH CHECK (
    super_admin_in_scope(imo_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
  );
CREATE POLICY kpi_call_types_update ON public.kpi_call_types
  FOR UPDATE TO authenticated
  USING (
    super_admin_in_scope(imo_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
  )
  WITH CHECK (
    super_admin_in_scope(imo_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
  );
CREATE POLICY kpi_call_types_delete ON public.kpi_call_types
  FOR DELETE TO authenticated
  USING (
    super_admin_in_scope(imo_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
  );

-- Mandatory on every new table (revocation gate completeness check enforces it).
CREATE POLICY revocation_deny ON public.kpi_call_types
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_call_types TO authenticated;
GRANT ALL ON public.kpi_call_types TO service_role;

COMMENT ON TABLE public.kpi_call_types IS
  'IMO-scoped call "angle" vocabulary for Call Reviews uploads (e.g. Cash Out, Consolidation, Term to Perm). Read by IMO members, written by super-admin/IMO-admin.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. kpi_call_recordings: call_type_id + soft-archive
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN call_type_id uuid REFERENCES public.kpi_call_types(id) ON DELETE SET NULL,
  ADD COLUMN archived_at  timestamptz,
  ADD COLUMN archived_by  uuid;

COMMENT ON COLUMN public.kpi_call_recordings.call_type_id IS
  'FK to kpi_call_types — the call angle selected at upload (replaces free-text caller_name in the UI).';
COMMENT ON COLUMN public.kpi_call_recordings.archived_at IS
  'Soft-archive timestamp; archived rows are hidden from the default library view but retained.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Scale indexes (server-side pagination + search)
-- ════════════════════════════════════════════════════════════════════════════
-- Default library = non-archived, newest first, per IMO. Partial index stays
-- small as the archived set grows.
CREATE INDEX idx_kpi_rec_imo_active_callat
  ON public.kpi_call_recordings (imo_id, call_at DESC NULLS LAST, created_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX idx_kpi_rec_call_type
  ON public.kpi_call_recordings (call_type_id) WHERE call_type_id IS NOT NULL;

-- Trigram GIN so ILIKE '%term%' search over caller / filename / transcript is
-- index-backed instead of a full seq-scan at scale.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_kpi_rec_caller_trgm
  ON public.kpi_call_recordings USING gin (caller_name gin_trgm_ops);
CREATE INDEX idx_kpi_rec_filename_trgm
  ON public.kpi_call_recordings USING gin (original_filename gin_trgm_ops);
CREATE INDEX idx_kpi_rec_transcript_trgm
  ON public.kpi_call_recordings USING gin (transcript_text gin_trgm_ops);

NOTIFY pgrst, 'reload schema';

COMMIT;
