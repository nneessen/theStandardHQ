-- supabase/migrations/20260630063602_reel_jobs.sql
-- Social Studio: YouTube → Reels. A user pastes a YouTube watch URL; the generate-reels
-- edge fn submits it to Vizard (AI highlight clips) and inserts a reel_jobs row; the
-- reels-poll cron worker polls Vizard and writes the resulting reel_clips when ready.
--
-- GRANT-HARDENED like instagram_scheduled_posts: authenticated gets SELECT ONLY (imo-scoped
-- via RLS). There is NO client write path — both the submit edge fn and the cron worker run
-- as service role (bypass RLS) and derive imo_id from auth.uid() at submit time. status is
-- TS-enforced text ('processing' | 'ready' | 'failed'), NO CHECK constraint (project rule).

-- ============================================================================
-- Table: reel_jobs  (one row per submitted YouTube video)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reel_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id UUID NOT NULL REFERENCES imos(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  source_url TEXT NOT NULL,                  -- YouTube watch URL the user submitted
  vizard_project_id TEXT,                    -- Vizard projectId (set right after create)

  status TEXT NOT NULL DEFAULT 'processing', -- processing | ready | failed  (TS-enforced)
  params JSONB NOT NULL DEFAULT '{}'::jsonb, -- maxClipNumber, ratioOfClip, lang, ... (audit)
  error TEXT,                                -- human-readable failure reason
  clip_count INTEGER NOT NULL DEFAULT 0,     -- # of reel_clips once ready

  -- Atomic-claim columns for the cron worker (mirror instagram_scheduled_posts).
  claim_token UUID,
  claimed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Table: reel_clips  (Vizard output metadata; one row per generated clip)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reel_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES reel_jobs(id) ON DELETE CASCADE,

  vizard_video_id TEXT,
  title TEXT,
  transcript TEXT,
  viral_score NUMERIC,        -- 0-10 ranking from Vizard
  viral_reason TEXT,
  duration_ms INTEGER,
  source_url TEXT,            -- Vizard temp mp4 URL (expires ~7 days)
  stored_url TEXT,            -- Phase 2: re-host into spotlight-assets (NULL for now)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
-- List query (UI): the agency's jobs, newest first.
CREATE INDEX IF NOT EXISTS idx_reel_jobs_imo
  ON reel_jobs(imo_id, created_at DESC);

-- Worker due-query: processing jobs the cron should poll.
CREATE INDEX IF NOT EXISTS idx_reel_jobs_processing
  ON reel_jobs(status, claimed_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_reel_clips_job
  ON reel_clips(job_id);

-- ============================================================================
-- updated_at trigger (reel_jobs)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_reel_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reel_jobs_updated_at ON reel_jobs;
CREATE TRIGGER trigger_reel_jobs_updated_at
  BEFORE UPDATE ON reel_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_reel_jobs_updated_at();

-- ============================================================================
-- RLS — SELECT only for authenticated (imo-scoped). Writes are service-role only.
-- ============================================================================
ALTER TABLE reel_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_jobs_select" ON reel_jobs;
CREATE POLICY "reel_jobs_select"
  ON reel_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
        AND imo_id = reel_jobs.imo_id
    )
  );

DROP POLICY IF EXISTS "reel_clips_select" ON reel_clips;
CREATE POLICY "reel_clips_select"
  ON reel_clips
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM reel_jobs j
        JOIN user_profiles up ON up.imo_id = j.imo_id
       WHERE j.id = reel_clips.job_id
         AND up.id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- Atomic claim for the reels-poll cron (mirror claim_due_instagram_posts).
-- Two overlapping ticks can never poll/finalize the same job twice:
--   1. claimed_at staleness hides a freshly-claimed job until it goes stale.
--   2. claim_token CAS — the worker tags terminal updates with .eq('claim_token', token).
-- Only claims jobs that already have a vizard_project_id (i.e. successfully submitted).
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_processing_reel_jobs(
  p_claim_token   uuid,
  p_limit         integer DEFAULT 5,
  p_stale_minutes integer DEFAULT 30
)
RETURNS SETOF reel_jobs
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE reel_jobs r
     SET claim_token = p_claim_token,
         claimed_at  = now(),
         updated_at  = now()
   WHERE r.id IN (
     SELECT id
       FROM reel_jobs
      WHERE status = 'processing'
        AND vizard_project_id IS NOT NULL
        AND (claimed_at IS NULL
             OR claimed_at < now() - make_interval(mins => p_stale_minutes))
      ORDER BY created_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING r.*;
END;
$$;

-- ============================================================================
-- Grants — SELECT only for authenticated; nothing for anon; claim RPC service-role only.
-- (REVOKE ALL from authenticated first so default privileges can't leave INSERT/UPDATE/
--  DELETE/TRUNCATE behind — the known grant-leak this project has been closing.)
-- ============================================================================
REVOKE ALL ON reel_jobs  FROM anon, authenticated;
REVOKE ALL ON reel_clips FROM anon, authenticated;
GRANT SELECT ON reel_jobs  TO authenticated;
GRANT SELECT ON reel_clips TO authenticated;

REVOKE ALL ON FUNCTION claim_processing_reel_jobs(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_processing_reel_jobs(uuid, integer, integer) TO service_role;

COMMENT ON TABLE reel_jobs IS 'YouTube→Reels jobs (Social Studio / Vizard). Writes via generate-reels edge fn + reels-poll cron (service role); authenticated has SELECT only.';
COMMENT ON TABLE reel_clips IS 'Generated reel clips (Vizard output metadata) for a reel_jobs row.';
