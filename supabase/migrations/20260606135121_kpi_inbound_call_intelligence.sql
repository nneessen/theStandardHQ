-- ============================================================================
-- Inbound-Call KPI & Word-Track Intelligence (Epic Life /kpi section)
-- ============================================================================
-- New, self-contained schema for the inbound-call-only IMO. Separate from the
-- existing Close KPIs (close_kpi_*) and Lead Heat (lead_heat_*) features.
--
-- Five tables:
--   1. kpi_call_recordings     — manually-uploaded call recording + metadata +
--                                transcription state + transcript (with timing)
--   2. kpi_daily_call_metrics  — manual per-agent/per-day KPI capture (the dialer
--                                has no API → volume / spend / economics entered)
--   3. kpi_word_tracks         — user-maintained library of scripted phrases
--   4. kpi_word_track_detections — per-recording hits of a word track (WHEN +
--                                  verbatim + effectiveness signal)
--   5. kpi_discovered_phrases  — AI-surfaced candidate phrases (promotable)
--
-- PROJECT RULES honored here:
--   * NO CHECK constraints on enums — enum-typed TEXT columns are validated in
--     TypeScript (see the "-- ENUM (TS):" comments). Postgres stores plain TEXT.
--   * Multi-tenant: every table carries imo_id; RLS scopes per IMO + per agent
--     with manager/upline rollup visibility, reusing existing helper functions.
--   * Revocation kill-switch: the deny-by-default gate loop (20260526200139)
--     already ran over EXISTING tables, so new tables are NOT auto-gated. Each
--     table below gets an explicit RESTRICTIVE `revocation_deny` policy in the
--     InitPlan-optimized form. scripts/check-revocation-gate-completeness.sql
--     must stay green after this migration.
--
-- REUSED RLS HELPERS (all STABLE SECURITY DEFINER, search_path=public):
--   auth.uid()                       — current user
--   is_upline_of(target uuid)        — caller is in target's hierarchy_path
--                                      (LIVE def: IMO-wide, NOT same-agency;
--                                       per-row, cannot be InitPlan-hoisted)
--   is_imo_admin()                   — caller is imo_owner / imo_admin / super
--   is_imo_staff_role()              — caller is non-admin IMO staff
--   get_my_imo_id()                  — caller's effective IMO (honors acting)
--   get_effective_imo_id()           — acting-IMO escape hatch / revocation sentinel
--   super_admin_in_scope(row_imo_id) — super-admin, honoring acting_imo_id
--   is_access_revoked(uuid)          — revocation predicate (RESTRICTIVE gate)
--   update_updated_at_column()       — shared BEFORE UPDATE touch trigger
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- Integrity / tenant-scoping helpers (security-review fixes).
-- ════════════════════════════════════════════════════════════════════════════

-- Scoped admin check for the SHARED call-recordings bucket. is_imo_admin() has
-- NO IMO predicate and storage.objects carries no imo_id, so a bare is_imo_admin()
-- in the storage policies would let an admin in IMO A read/delete IMO B's
-- recordings. This confines an admin to recordings whose agent (folder[1]) is in
-- the admin's OWN IMO. (Per-row — takes the row's folder agent; not InitPlan-hoisted.)
CREATE OR REPLACE FUNCTION public.kpi_admin_can_access_agent(p_agent uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_imo_admin()
     AND p_agent IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.user_profiles up
       WHERE up.id = p_agent
         AND up.imo_id = public.get_my_imo_id()
     );
$$;
GRANT EXECUTE ON FUNCTION public.kpi_admin_can_access_agent(uuid) TO authenticated;

-- Reject a row whose agent_id does not belong to the row's imo_id. WITH CHECK
-- already pins imo_id = get_my_imo_id(), but agent_id (an auth.users FK, no IMO
-- predicate) could otherwise be set by an admin to a user in ANOTHER IMO, who
-- would then read the row via the agent_id = auth.uid() branch (cross-tenant
-- injection). Used by the per-agent KPI tables below.
CREATE OR REPLACE FUNCTION public.kpi_assert_agent_imo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agent_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles up
       WHERE up.id = NEW.agent_id AND up.imo_id = NEW.imo_id
     ) THEN
    RAISE EXCEPTION 'agent_id % does not belong to imo_id % (cross-tenant attribution blocked)',
      NEW.agent_id, NEW.imo_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Same as kpi_assert_agent_imo but for owner-keyed tables (kpi_word_tracks):
-- reject an owner_id whose IMO disagrees with the row's imo_id (admin cross-tenant
-- attribution variant, symmetric with the agent_id guard).
CREATE OR REPLACE FUNCTION public.kpi_assert_owner_imo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles up
       WHERE up.id = NEW.owner_id AND up.imo_id = NEW.imo_id
     ) THEN
    RAISE EXCEPTION 'owner_id % does not belong to imo_id % (cross-tenant attribution blocked)',
      NEW.owner_id, NEW.imo_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Derive the denormalized tenant columns on detections FROM THE PARENT recording,
-- so a client can never forge imo_id/agent_id that diverge from the real recording
-- (the recording_id/word_track_id FKs check existence only, not tenancy).
CREATE OR REPLACE FUNCTION public.kpi_detection_set_denorm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imo uuid;
  v_agent uuid;
BEGIN
  SELECT r.imo_id, r.agent_id INTO v_imo, v_agent
  FROM public.kpi_call_recordings r
  WHERE r.id = NEW.recording_id;
  IF v_imo IS NULL THEN
    RAISE EXCEPTION 'kpi_word_track_detections: parent recording % not found', NEW.recording_id;
  END IF;
  NEW.imo_id := v_imo;       -- derive tenancy from the parent; never trust the client
  NEW.agent_id := v_agent;
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Storage bucket for the uploaded recordings (private).
--    Path convention: {agent_id}/{yyyy}/{mm}/{timestamp}_{sanitized_filename}
--    foldername[1] = agent_id → drives storage RLS. NOTE: the global
--    `revocation_deny_storage` policy (20260528083601) is allowlisted to only
--    {user-documents, contract-documents, presentation-recordings} and does NOT
--    cover this bucket — a dedicated revocation_deny_call_recordings policy is
--    added below.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  false,
  524288000, -- 500 MB
  ARRAY[
    'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/webm','audio/mp4',
    'audio/m4a','audio/x-m4a','audio/aac','audio/ogg','audio/flac','video/mp4'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Upload into the call's agent folder: the agent themselves, the agent's upline,
-- or an IMO admin. (regex guard ensures the ::uuid cast only runs on a real uuid)
DROP POLICY IF EXISTS "call_recordings_storage_insert" ON storage.objects;
CREATE POLICY "call_recordings_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'call-recordings'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      -- CASE is an evaluation-order barrier: the ::uuid cast only runs when the
      -- folder is a real uuid, so a non-uuid name in ANY bucket can never raise
      -- "invalid input syntax for type uuid" on storage.objects. Both helpers
      -- return false for NULL. The admin check is IMO-scoped (NOT bare is_imo_admin).
      OR public.kpi_admin_can_access_agent(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
      OR is_upline_of(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
    )
  );

DROP POLICY IF EXISTS "call_recordings_storage_select" ON storage.objects;
CREATE POLICY "call_recordings_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      -- CASE is an evaluation-order barrier: the ::uuid cast only runs when the
      -- folder is a real uuid, so a non-uuid name in ANY bucket can never raise
      -- "invalid input syntax for type uuid" on storage.objects. Both helpers
      -- return false for NULL. The admin check is IMO-scoped (NOT bare is_imo_admin).
      OR public.kpi_admin_can_access_agent(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
      OR is_upline_of(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
    )
  );

DROP POLICY IF EXISTS "call_recordings_storage_delete" ON storage.objects;
CREATE POLICY "call_recordings_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      -- CASE is an evaluation-order barrier: the ::uuid cast only runs when the
      -- folder is a real uuid, so a non-uuid name in ANY bucket can never raise
      -- "invalid input syntax for type uuid" on storage.objects. Both helpers
      -- return false for NULL. The admin check is IMO-scoped (NOT bare is_imo_admin).
      OR public.kpi_admin_can_access_agent(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
      OR is_upline_of(
        CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN ((storage.foldername(name))[1])::uuid END
      )
    )
  );

-- The global revocation_deny_storage gate does NOT cover this bucket (see above),
-- so add an explicit per-bucket RESTRICTIVE revocation gate: a revoked user loses
-- storage read/upload/delete on call recordings too (mirrors the per-table gate).
DROP POLICY IF EXISTS "revocation_deny_call_recordings" ON storage.objects;
CREATE POLICY "revocation_deny_call_recordings"
  ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    bucket_id <> 'call-recordings'
    OR NOT (SELECT public.is_access_revoked(auth.uid()))
  )
  WITH CHECK (
    bucket_id <> 'call-recordings'
    OR NOT (SELECT public.is_access_revoked(auth.uid()))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 1. kpi_call_recordings — uploaded recording + call metadata + transcript
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.kpi_call_recordings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id               UUID NOT NULL REFERENCES public.imos(id),
  agent_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- whose call (per-agent attribution)
  uploader_id          UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL, -- who performed the upload

  -- storage
  storage_bucket       TEXT NOT NULL DEFAULT 'call-recordings',
  storage_path         TEXT NOT NULL,                 -- {agent_id}/yyyy/mm/ts_file
  original_filename    TEXT,
  mime_type            TEXT,
  file_size_bytes      BIGINT,

  -- call metadata
  call_direction       TEXT NOT NULL DEFAULT 'inbound', -- ENUM (TS): inbound | outbound (inbound-only today)
  call_at              TIMESTAMPTZ,                   -- when the call happened (nullable; may be unknown)
  duration_seconds     INTEGER,                       -- total call length
  talk_time_seconds    INTEGER,                       -- agent talk time (manual or future diarization; NOT from current STT)

  -- caller demographics (all nullable — frequently unknown on inbound)
  caller_name          TEXT,
  caller_age           SMALLINT,                      -- nullable
  caller_age_band      TEXT,                          -- ENUM (TS): under_30|30_39|40_49|50_59|60_69|70_plus|unknown
  caller_gender        TEXT,                          -- ENUM (TS): male|female|other|unknown
  caller_state         TEXT,                          -- ENUM (TS): USPS 2-letter code; nullable
  caller_zip           TEXT,

  -- outcome / economics
  outcome              TEXT,                          -- ENUM (TS): sold|not_sold|callback|no_sale_followup|wrong_number|not_qualified|do_not_call|other (nullable until reviewed)
  policies_count       INTEGER NOT NULL DEFAULT 0,    -- policies sold on this call (policies-per-client)
  premium_amount       NUMERIC(12,2),                 -- annualized premium written on the call
  acquisition_cost     NUMERIC(12,2),                 -- cost attributed to this acquisition (CPA), nullable

  -- transcription
  transcription_status TEXT NOT NULL DEFAULT 'pending', -- ENUM (TS): pending|processing|completed|failed|skipped
  transcription_error  TEXT,
  transcript_text      TEXT,
  transcript_segments  JSONB,                         -- Whisper verbose_json segments/words (WHEN-in-call timing)
  transcript_language  TEXT,
  transcription_model  TEXT,
  transcribed_at       TIMESTAMPTZ,

  -- word-track + AI-discovery analysis run state
  analysis_status      TEXT NOT NULL DEFAULT 'pending', -- ENUM (TS): pending|processing|completed|failed|skipped
  analysis_model       TEXT,
  analyzed_at          TIMESTAMPTZ,
  last_analysis_run_id UUID,                          -- correlates detections/discoveries from the latest re-analysis

  notes                TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX idx_kpi_rec_imo_agent_callat ON public.kpi_call_recordings (imo_id, agent_id, call_at DESC);
CREATE INDEX idx_kpi_rec_agent_callat     ON public.kpi_call_recordings (agent_id, call_at DESC);
CREATE INDEX idx_kpi_rec_imo_outcome      ON public.kpi_call_recordings (imo_id, outcome);
CREATE INDEX idx_kpi_rec_imo_state        ON public.kpi_call_recordings (imo_id, caller_state);
CREATE INDEX idx_kpi_rec_txn_queue        ON public.kpi_call_recordings (transcription_status)
  WHERE transcription_status IN ('pending','processing'); -- transcription worker queue
CREATE INDEX idx_kpi_rec_analysis_queue   ON public.kpi_call_recordings (analysis_status)
  WHERE analysis_status IN ('pending','processing');

ALTER TABLE public.kpi_call_recordings ENABLE ROW LEVEL SECURITY;

-- Read + write: the agent, the agent's upline, an IMO admin, or super-admin
-- (all within the caller's IMO). FOR ALL mirrors close_kpi's idiom; the team
-- visibility comes from is_upline_of(agent_id) per the agent-data convention
-- (agent_contracts / agent_writing_numbers / agent_state_licenses use this).
CREATE POLICY kpi_call_recordings_rw ON public.kpi_call_recordings
  FOR ALL TO authenticated
  USING (
    agent_id = (SELECT auth.uid())
    OR is_upline_of(agent_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    imo_id = (SELECT get_my_imo_id())
    AND (
      agent_id = (SELECT auth.uid())
      OR is_upline_of(agent_id)
      OR (SELECT is_imo_admin())
    )
  );

CREATE POLICY revocation_deny ON public.kpi_call_recordings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

CREATE TRIGGER trg_kpi_call_recordings_updated_at
  BEFORE UPDATE ON public.kpi_call_recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kpi_call_recordings_assert_agent_imo
  BEFORE INSERT OR UPDATE ON public.kpi_call_recordings
  FOR EACH ROW EXECUTE FUNCTION public.kpi_assert_agent_imo();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. kpi_daily_call_metrics — manual per-agent/per-day KPI & economics capture.
--    Dialer has no API → totals not derivable from uploaded recordings live here.
--    Derived KPIs (closing %, CPA, policies-per-client) are computed in the app
--    from these columns, never stored (no stale derived data).
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.kpi_daily_call_metrics (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id                   UUID NOT NULL REFERENCES public.imos(id),
  agent_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date              DATE NOT NULL,

  total_inbound_calls      INTEGER NOT NULL DEFAULT 0, -- call volume (denominator for closing %)
  answered_calls           INTEGER,
  missed_calls             INTEGER,
  total_talk_time_seconds  INTEGER,                    -- aggregate talk time (CPA / economics)

  leads_received           INTEGER,
  clients_sold             INTEGER NOT NULL DEFAULT 0, -- distinct clients (policies-per-client numerator base)
  policies_sold            INTEGER NOT NULL DEFAULT 0,
  premium_written          NUMERIC(12,2),

  lead_spend               NUMERIC(12,2),              -- cost of leads for the day (CPA)
  marketing_spend          NUMERIC(12,2),              -- other acquisition spend (CPA / economics)

  notes                    TEXT,
  entered_by               UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (agent_id, metric_date)                       -- one manual row per agent per day (upsertable)
);

CREATE INDEX idx_kpi_daily_imo_date   ON public.kpi_daily_call_metrics (imo_id, metric_date DESC);
CREATE INDEX idx_kpi_daily_agent_date ON public.kpi_daily_call_metrics (agent_id, metric_date DESC);

ALTER TABLE public.kpi_daily_call_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_daily_call_metrics_rw ON public.kpi_daily_call_metrics
  FOR ALL TO authenticated
  USING (
    agent_id = (SELECT auth.uid())
    OR is_upline_of(agent_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    imo_id = (SELECT get_my_imo_id())
    AND (
      agent_id = (SELECT auth.uid())
      OR is_upline_of(agent_id)
      OR (SELECT is_imo_admin())
    )
  );

CREATE POLICY revocation_deny ON public.kpi_daily_call_metrics
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

CREATE TRIGGER trg_kpi_daily_call_metrics_updated_at
  BEFORE UPDATE ON public.kpi_daily_call_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kpi_daily_call_metrics_assert_agent_imo
  BEFORE INSERT OR UPDATE ON public.kpi_daily_call_metrics
  FOR EACH ROW EXECUTE FUNCTION public.kpi_assert_agent_imo();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. kpi_word_tracks — user-maintained library of scripted phrases.
--    Versioning: never mutate a tracked phrase that has detections — create a new
--    row (version+1, supersedes_id = old.id) and set the old row is_active=false.
--    Detections always point at the specific version they matched.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.kpi_word_tracks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id                   UUID NOT NULL REFERENCES public.imos(id),
  owner_id                 UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  scope                    TEXT NOT NULL DEFAULT 'personal', -- ENUM (TS): personal|team|imo (ownership + visibility)
  label                    TEXT NOT NULL,               -- short display name
  phrase                   TEXT NOT NULL,               -- the scripted phrase / sample text
  match_type               TEXT NOT NULL DEFAULT 'fuzzy', -- ENUM (TS): exact|fuzzy|regex|semantic
  match_pattern            TEXT,                        -- explicit regex/pattern when match_type='regex'
  category                 TEXT NOT NULL DEFAULT 'general', -- ENUM (TS): greeting|rapport|discovery|pitch|objection_handling|close|compliance|cross_sell|general
  expected_timing          TEXT NOT NULL DEFAULT 'any', -- ENUM (TS): opening|early|mid|late|closing|any (WHEN it should appear)
  expected_window_start_pct SMALLINT,                   -- optional finer window, 0-100 of call duration
  expected_window_end_pct   SMALLINT,

  is_active                BOOLEAN NOT NULL DEFAULT true,
  priority                 SMALLINT NOT NULL DEFAULT 0,
  version                  INTEGER NOT NULL DEFAULT 1,
  supersedes_id            UUID REFERENCES public.kpi_word_tracks(id) ON DELETE SET NULL, -- prior version
  source                   TEXT NOT NULL DEFAULT 'manual', -- ENUM (TS): manual|ai_promoted
  promoted_from_id         UUID,                        -- FK added after kpi_discovered_phrases exists (below)

  created_by               UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_wt_imo_scope_active ON public.kpi_word_tracks (imo_id, scope, is_active);
CREATE INDEX idx_kpi_wt_owner            ON public.kpi_word_tracks (owner_id);
CREATE INDEX idx_kpi_wt_imo_category     ON public.kpi_word_tracks (imo_id, category) WHERE is_active;

ALTER TABLE public.kpi_word_tracks ENABLE ROW LEVEL SECURITY;

-- Read: own; team/imo-scoped within the IMO; an upline can see a rep's PERSONAL
-- tracks; IMO admin; super-admin.
CREATE POLICY kpi_word_tracks_select ON public.kpi_word_tracks
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR (scope <> 'personal' AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR (scope = 'personal' AND is_upline_of(owner_id))
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  );

-- Write: an owner manages their own library entries; an IMO admin manages any
-- entry in the IMO; super-admin in scope. (team/imo entries are curated by their
-- owner or an IMO admin — not editable by every team member.)
CREATE POLICY kpi_word_tracks_write ON public.kpi_word_tracks
  FOR ALL TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    imo_id = (SELECT get_my_imo_id())
    AND (
      owner_id = (SELECT auth.uid())
      OR (SELECT is_imo_admin())
    )
  );

CREATE POLICY revocation_deny ON public.kpi_word_tracks
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

CREATE TRIGGER trg_kpi_word_tracks_updated_at
  BEFORE UPDATE ON public.kpi_word_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kpi_word_tracks_assert_owner_imo
  BEFORE INSERT OR UPDATE ON public.kpi_word_tracks
  FOR EACH ROW EXECUTE FUNCTION public.kpi_assert_owner_imo();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. kpi_word_track_detections — per-recording hits of a word track.
--    imo_id + agent_id are denormalized from the parent recording for tenant
--    scoping, per-agent rollups, and RLS without a join. Re-analysis: delete all
--    rows for a recording_id, then re-insert under a new analysis_run_id.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.kpi_word_track_detections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id              UUID NOT NULL REFERENCES public.imos(id), -- denormalized (= recording.imo_id); derived from parent by trigger
  recording_id        UUID NOT NULL REFERENCES public.kpi_call_recordings(id) ON DELETE CASCADE,
  word_track_id       UUID NOT NULL REFERENCES public.kpi_word_tracks(id) ON DELETE CASCADE, -- specific version detected
  agent_id            UUID NOT NULL,                  -- denormalized (= recording.agent_id) for rollups + RLS
  analysis_run_id     UUID,                           -- groups detections from one analysis pass (re-analysis)

  detected_phrase     TEXT NOT NULL,                  -- verbatim matched text from the transcript
  char_start          INTEGER,                        -- offset in transcript_text
  char_end            INTEGER,
  time_start_seconds  NUMERIC(8,2),                   -- WHEN in the call (from transcript_segments)
  time_end_seconds    NUMERIC(8,2),
  position_pct        SMALLINT,                        -- 0-100 of call duration (timing distribution)
  timing_bucket       TEXT,                            -- ENUM (TS): opening|early|mid|late|closing (derived at detection)
  on_expected_timing  BOOLEAN,                         -- landed within the word track's expected window
  match_confidence    NUMERIC(4,3),                    -- 0-1 for fuzzy/semantic matches

  -- effectiveness signal (snapshot of the parent call's outcome at detection time)
  led_to_sale         BOOLEAN,
  effectiveness_score NUMERIC(5,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_det_recording  ON public.kpi_word_track_detections (recording_id);
CREATE INDEX idx_kpi_det_wt_timing  ON public.kpi_word_track_detections (word_track_id, on_expected_timing);
CREATE INDEX idx_kpi_det_wt_sale    ON public.kpi_word_track_detections (word_track_id, led_to_sale);
CREATE INDEX idx_kpi_det_imo_agent  ON public.kpi_word_track_detections (imo_id, agent_id);

ALTER TABLE public.kpi_word_track_detections ENABLE ROW LEVEL SECURITY;

-- Visibility follows the parent recording (agent_id / upline / IMO admin / super).
CREATE POLICY kpi_word_track_detections_rw ON public.kpi_word_track_detections
  FOR ALL TO authenticated
  USING (
    agent_id = (SELECT auth.uid())
    OR is_upline_of(agent_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    imo_id = (SELECT get_my_imo_id())
    AND (
      agent_id = (SELECT auth.uid())
      OR is_upline_of(agent_id)
      OR (SELECT is_imo_admin())
    )
  );

CREATE POLICY revocation_deny ON public.kpi_word_track_detections
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

-- Derive imo_id/agent_id from the parent recording (never trust the client),
-- closing the cross-tenant forge/divergence path on the denormalized columns.
CREATE TRIGGER trg_kpi_det_set_denorm
  BEFORE INSERT OR UPDATE ON public.kpi_word_track_detections
  FOR EACH ROW EXECUTE FUNCTION public.kpi_detection_set_denorm();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. kpi_discovered_phrases — AI-surfaced candidate phrases (promotable).
--    agent_id NULL = IMO-wide discovery (across many agents' calls); set =
--    surfaced from one agent's calls. Dedup per IMO on normalized_phrase.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.kpi_discovered_phrases (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id                 UUID NOT NULL REFERENCES public.imos(id),
  agent_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL = IMO-wide candidate

  phrase                 TEXT NOT NULL,
  normalized_phrase      TEXT NOT NULL,               -- lowercased/trimmed for dedupe
  suggested_category     TEXT,                        -- ENUM (TS): same set as kpi_word_tracks.category
  suggested_timing       TEXT,                        -- ENUM (TS): opening|early|mid|late|closing|any
  rationale              TEXT,                        -- AI explanation of why high-impact

  impact_score           NUMERIC(5,2),               -- AI effectiveness estimate
  correlation_with_sale  NUMERIC(4,3),               -- lift signal vs outcome
  sample_size            INTEGER,                     -- calls the phrase was observed in
  example_recording_ids  UUID[],                      -- supporting recordings
  example_quotes         JSONB NOT NULL DEFAULT '[]'::jsonb,

  status                 TEXT NOT NULL DEFAULT 'candidate', -- ENUM (TS): candidate|promoted|dismissed
  promoted_word_track_id UUID REFERENCES public.kpi_word_tracks(id) ON DELETE SET NULL,
  reviewed_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,

  discovery_run_id       UUID,
  discovered_by_model    TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (imo_id, normalized_phrase)
);

CREATE INDEX idx_kpi_disc_imo_status   ON public.kpi_discovered_phrases (imo_id, status);
CREATE INDEX idx_kpi_disc_imo_impact   ON public.kpi_discovered_phrases (imo_id, impact_score DESC);
CREATE INDEX idx_kpi_disc_agent        ON public.kpi_discovered_phrases (agent_id) WHERE agent_id IS NOT NULL;

ALTER TABLE public.kpi_discovered_phrases ENABLE ROW LEVEL SECURITY;

-- Read/manage (promote / dismiss): the agent whose calls surfaced it, that
-- agent's upline, an IMO admin (also sees IMO-wide agent_id IS NULL candidates),
-- or super-admin.
CREATE POLICY kpi_discovered_phrases_rw ON public.kpi_discovered_phrases
  FOR ALL TO authenticated
  USING (
    (agent_id IS NOT NULL AND (agent_id = (SELECT auth.uid()) OR is_upline_of(agent_id)))
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    imo_id = (SELECT get_my_imo_id())
    AND (
      (agent_id IS NOT NULL AND (agent_id = (SELECT auth.uid()) OR is_upline_of(agent_id)))
      OR (SELECT is_imo_admin())
    )
  );

CREATE POLICY revocation_deny ON public.kpi_discovered_phrases
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

CREATE TRIGGER trg_kpi_discovered_phrases_updated_at
  BEFORE UPDATE ON public.kpi_discovered_phrases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kpi_discovered_phrases_assert_agent_imo
  BEFORE INSERT OR UPDATE ON public.kpi_discovered_phrases
  FOR EACH ROW EXECUTE FUNCTION public.kpi_assert_agent_imo();

-- Deferred FK: word track promoted from a discovered phrase (both tables now exist)
ALTER TABLE public.kpi_word_tracks
  ADD CONSTRAINT kpi_word_tracks_promoted_from_fk
  FOREIGN KEY (promoted_from_id) REFERENCES public.kpi_discovered_phrases(id) ON DELETE SET NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- Grants. RLS does the row filtering; PostgREST needs table-level privileges.
-- authenticated only (NEVER anon). service_role bypasses RLS (edge functions:
-- transcription, analysis, AI discovery) but still needs the grant.
-- ════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.kpi_call_recordings,
  public.kpi_daily_call_metrics,
  public.kpi_word_tracks,
  public.kpi_word_track_detections,
  public.kpi_discovered_phrases
TO authenticated;

GRANT ALL ON
  public.kpi_call_recordings,
  public.kpi_daily_call_metrics,
  public.kpi_word_tracks,
  public.kpi_word_track_detections,
  public.kpi_discovered_phrases
TO service_role;

COMMIT;
