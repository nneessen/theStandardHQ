-- supabase/migrations/20260623142441_instagram_scheduled_posts.sql
-- Social Studio: scheduled Instagram FEED posts (the agency's branded leaderboard /
-- report / AOTW graphics). Mirrors the scheduled-DM queue (instagram_scheduled_messages)
-- but for the Content Publishing API, and is GRANT-HARDENED: authenticated gets SELECT
-- only; all writes flow through SECURITY DEFINER RPCs that re-derive imo_id/scheduled_by
-- from auth.uid() and validate ownership (so a caller can never schedule onto another
-- agency's account or backfill a past time).
--
-- The cron worker (instagram-process-scheduled-posts) runs as service role, bypasses RLS,
-- and publishes due rows. Cron + edge fns are deployed at go-live (separate cron migration).

-- ============================================================================
-- Enum: scheduled_post_status  (TS-enforced; NO CHECK constraint per project rule)
-- 'expired' = terminal can't-deliver state (no connected account / dead token at fire
-- time), the post analog of a DM's closed messaging window. Cancel is a HARD DELETE
-- (it also GCs the image), so there is intentionally no 'cancelled' value.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduled_post_status') THEN
    CREATE TYPE scheduled_post_status AS ENUM (
      'pending',
      'published',
      'failed',
      'expired'
    );
  END IF;
END$$;

COMMENT ON TYPE scheduled_post_status IS 'Status of a scheduled Instagram feed post (Social Studio)';

-- ============================================================================
-- Table: instagram_scheduled_posts
-- ============================================================================

CREATE TABLE IF NOT EXISTS instagram_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The integration connected when the post was scheduled (informational + cleanup).
  -- The worker resolves the imo's CURRENT connected account at fire time, so a
  -- reconnect (new integration row) between scheduling and firing still works.
  integration_id UUID REFERENCES instagram_integrations(id) ON DELETE SET NULL,
  imo_id UUID NOT NULL REFERENCES imos(id) ON DELETE CASCADE,

  -- Content
  image_url TEXT NOT NULL,                 -- public https URL in spotlight-assets the Graph API fetches
  caption TEXT,
  view TEXT,                               -- daily | weekly | monthly | aotw (for the list UI)
  card_theme TEXT,                         -- spotlight | editorial | lift (for the list UI)

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  scheduled_by UUID NOT NULL REFERENCES auth.users(id),

  -- Status tracking
  status scheduled_post_status NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  published_media_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- List query (UI): the agency's posts, newest scheduled first.
CREATE INDEX IF NOT EXISTS idx_instagram_scheduled_posts_imo
  ON instagram_scheduled_posts(imo_id, scheduled_for DESC);

-- Worker due-query: pending posts whose time has come.
CREATE INDEX IF NOT EXISTS idx_instagram_scheduled_posts_due
  ON instagram_scheduled_posts(status, scheduled_for)
  WHERE status = 'pending';

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_instagram_scheduled_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_instagram_scheduled_posts_updated_at ON instagram_scheduled_posts;
CREATE TRIGGER trigger_instagram_scheduled_posts_updated_at
  BEFORE UPDATE ON instagram_scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_scheduled_posts_updated_at();

-- ============================================================================
-- RLS — SELECT only for authenticated (imo-scoped). Writes are RPC-only (below).
-- ============================================================================

ALTER TABLE instagram_scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instagram_scheduled_posts_select" ON instagram_scheduled_posts;
CREATE POLICY "instagram_scheduled_posts_select"
  ON instagram_scheduled_posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND imo_id = instagram_scheduled_posts.imo_id
    )
  );

-- ============================================================================
-- Write RPCs (SECURITY DEFINER) — the ONLY write path for app users.
-- ============================================================================

-- Schedule a post. The client supplies the row id (so it can name the image object
-- {uid}/scheduled/{id}.png BEFORE inserting). imo_id + scheduled_by are derived from
-- auth.uid(), never trusted from the client. Future-only; integration must belong to
-- the caller's agency.
CREATE OR REPLACE FUNCTION schedule_instagram_post(
  p_id UUID,
  p_integration_id UUID,
  p_image_url TEXT,
  p_caption TEXT,
  p_view TEXT,
  p_card_theme TEXT,
  p_scheduled_for TIMESTAMPTZ
)
RETURNS instagram_scheduled_posts
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_imo UUID;
  v_row instagram_scheduled_posts;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT imo_id INTO v_imo FROM user_profiles WHERE id = v_uid;
  IF v_imo IS NULL THEN
    RAISE EXCEPTION 'No agency found for this account';
  END IF;

  IF p_scheduled_for IS NULL OR p_scheduled_for <= now() THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;

  IF p_image_url IS NULL OR p_image_url !~ '^https://' THEN
    RAISE EXCEPTION 'A public https image URL is required';
  END IF;

  IF p_caption IS NOT NULL AND char_length(p_caption) > 2200 THEN
    RAISE EXCEPTION 'Caption exceeds the 2200-character limit';
  END IF;

  -- The integration (if supplied) must belong to the caller's agency.
  IF p_integration_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM instagram_integrations
       WHERE id = p_integration_id AND imo_id = v_imo
     ) THEN
    RAISE EXCEPTION 'Instagram account not found for this agency';
  END IF;

  INSERT INTO instagram_scheduled_posts (
    id, integration_id, imo_id, image_url, caption, view, card_theme,
    scheduled_for, scheduled_by, status, retry_count
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_integration_id, v_imo, p_image_url,
    p_caption, p_view, p_card_theme, p_scheduled_for, v_uid, 'pending', 0
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Cancel a pending post: hard-delete the caller's own pending row and return it so the
-- client can GC the Storage image. Only the owner, only while still pending.
CREATE OR REPLACE FUNCTION cancel_instagram_scheduled_post(p_id UUID)
RETURNS instagram_scheduled_posts
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row instagram_scheduled_posts;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM instagram_scheduled_posts
  WHERE id = p_id
    AND scheduled_by = v_uid
    AND status = 'pending'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Scheduled post not found or no longer cancellable';
  END IF;

  RETURN v_row;
END;
$$;

-- ============================================================================
-- Grants — SELECT + RPC EXECUTE for authenticated; nothing for anon.
-- ============================================================================

REVOKE ALL ON instagram_scheduled_posts FROM anon;
GRANT SELECT ON instagram_scheduled_posts TO authenticated;
GRANT USAGE ON TYPE scheduled_post_status TO authenticated;

REVOKE ALL ON FUNCTION schedule_instagram_post(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cancel_instagram_scheduled_post(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION schedule_instagram_post(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_instagram_scheduled_post(UUID) TO authenticated;

COMMENT ON TABLE instagram_scheduled_posts IS 'Queue of scheduled Instagram feed posts (Social Studio); writes via schedule_instagram_post / cancel_instagram_scheduled_post';
