-- Social Studio scheduling: give the feed-post cron worker an ATOMIC CLAIM so two
-- overlapping cron ticks can never publish the same row twice.
--
-- THE BUG (review #1, critical): instagram-process-scheduled-posts SELECTed status='pending'
-- rows and only flipped status to 'published' AFTER the publish flow finished. Carousels made
-- that flow minutes-long (up to 10 child-container creates + 1.5s polls each + a parent
-- carousel container + publish), so a run could outlast the */5 cron — the next tick re-SELECTed
-- the same still-'pending' rows and published a DUPLICATE carousel to the agency's public feed
-- (and late terminal updates, keyed only on id, could overwrite an already-'published' row).
--
-- THE FIX: mirror the house claim pattern (dequeue_workflow_runs) — a SECURITY DEFINER RPC that
-- atomically stamps a per-run claim_token + claimed_at on due rows via FOR UPDATE SKIP LOCKED and
-- RETURNs only the rows IT claimed. Two guards then stack:
--   1. claimed_at staleness — a freshly claimed row is invisible to other ticks until it goes
--      stale (p_stale_minutes), so a still-running tick's rows are NOT re-claimed. THIS is what
--      prevents the duplicate Instagram API call. It only works if worst-case batch runtime is
--      well under p_stale_minutes — hence p_limit defaults to 10 (cron is every 5 min, so a
--      backlog drains across ticks) and p_stale_minutes defaults to 45.
--   2. claim_token CAS — the worker tags every terminal UPDATE with .eq('claim_token', token),
--      so even if a row is re-claimed after going stale (crashed-worker recovery), the original
--      run's late writes hit 0 rows instead of clobbering the new owner.
-- A transient-failure retry clears claim_token/claimed_at so the row is re-claimable on the very
-- next tick (not delayed by the full stale window).

ALTER TABLE instagram_scheduled_posts
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at  timestamptz;

COMMENT ON COLUMN instagram_scheduled_posts.claim_token IS
  'Per-cron-run token stamped by claim_due_instagram_posts; the worker CAS-guards terminal updates on it. NULL = unclaimed.';
COMMENT ON COLUMN instagram_scheduled_posts.claimed_at IS
  'When the row was last claimed by a worker run. A claim older than the stale window is reclaimable (crashed-worker recovery).';

-- Atomically claim up to p_limit due, still-pending posts for one worker run. Service-role only
-- (the cron worker runs as service role). Returns the claimed rows (with claim_token set).
CREATE OR REPLACE FUNCTION claim_due_instagram_posts(
  p_claim_token   uuid,
  p_limit         integer DEFAULT 10,
  p_stale_minutes integer DEFAULT 45
)
RETURNS SETOF instagram_scheduled_posts
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE instagram_scheduled_posts p
     SET claim_token = p_claim_token,
         claimed_at  = now(),
         updated_at  = now()
   WHERE p.id IN (
     SELECT id
       FROM instagram_scheduled_posts
      WHERE status = 'pending'
        AND scheduled_for <= now()
        AND retry_count < 3   -- keep in sync with MAX_RETRIES in the worker
        AND (claimed_at IS NULL
             OR claimed_at < now() - make_interval(mins => p_stale_minutes))
      ORDER BY scheduled_for ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING p.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_due_instagram_posts(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_due_instagram_posts(uuid, integer, integer) TO service_role;
