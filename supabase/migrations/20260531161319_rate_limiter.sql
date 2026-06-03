-- Rate limiter: Postgres-backed per-user request + token counters for edge functions.
--
-- WHY POSTGRES (not module-level Map):
--   Supabase Edge Functions run ephemeral, per-region Deno isolates that are
--   cold-started per request. A module-level counter resets on every cold start
--   and is never shared across concurrent isolates — useless for enforcement.
--   Counters must live in Postgres.
--
-- TABLE: public.rate_limits
--   bucket_key    — opaque string key, e.g.
--                   "ratelimit:req:assistant-orchestrator:<uid>" (per-fn request)
--                   "ratelimit:tok:<uid>"                        (cross-fn daily tokens)
--   window_start  — floor of the current time-window (computed by the function)
--   request_count — monotonically incrementing request counter within the window
--   token_count   — monotonically incrementing token counter within the window
--
-- PRIMARY KEY (bucket_key, window_start) — one row per key+window. Old windows
-- are never cleaned up here; a future pg_cron job should:
--   DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 days';
--
-- INDEX: rate_limits_window_start_idx — supports that GC query efficiently.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket_key    text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count int         NOT NULL DEFAULT 0,
  token_count   bigint      NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx
  ON public.rate_limits (window_start);

-- Revoke all public access (table is only touched by the SECURITY DEFINER function).
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL  ON public.rate_limits TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: public.check_rate_limit
--
-- Atomic upsert: increment request_count by 1 and token_count by p_tokens in a
-- single INSERT ... ON CONFLICT DO UPDATE ... RETURNING. Returns whether the
-- call is allowed AFTER the increment, plus context for Retry-After headers.
--
-- Parameters:
--   p_key            — bucket key string (caller constructs, e.g. "ratelimit:req:fn:uid")
--   p_max_requests   — max allowed request_count in the window (pass 2000000000 to
--                      disable the request axis, e.g. for token-only buckets)
--   p_window_seconds — window duration in seconds (3600 = hourly, 86400 = daily)
--   p_tokens         — tokens to add this call (0 at request start; actual usage after)
--   p_max_tokens     — NULL to skip the token axis; otherwise max token_count in window
--
-- Returns one row: { allowed boolean, requests_used int, tokens_used bigint, retry_after_seconds int }
--   allowed = false if request_count > p_max_requests OR
--             (p_max_tokens IS NOT NULL AND token_count > p_max_tokens)
--
-- search_path is pinned to prevent search_path privilege escalation — this repo
-- had a prior audit finding about SECURITY DEFINER functions with unpinned paths.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            text,
  p_max_requests   int,
  p_window_seconds int,
  p_tokens         int     DEFAULT 0,
  p_max_tokens     bigint  DEFAULT NULL
)
RETURNS TABLE (
  allowed            boolean,
  requests_used      int,
  tokens_used        bigint,
  retry_after_seconds int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_start  timestamptz;
  v_window_end    timestamptz;
  v_req_count     int;
  v_tok_count     bigint;
  v_retry_secs    int;
  v_allowed       boolean;
BEGIN
  -- Floor the current epoch to the window boundary.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );
  v_window_end := v_window_start + (p_window_seconds * interval '1 second');

  -- Atomic increment: INSERT or bump existing counters in one round-trip.
  INSERT INTO public.rate_limits (bucket_key, window_start, request_count, token_count)
  VALUES (p_key, v_window_start, 1, p_tokens)
  ON CONFLICT (bucket_key, window_start) DO UPDATE
    SET request_count = rate_limits.request_count + 1,
        token_count   = rate_limits.token_count   + p_tokens
  RETURNING rate_limits.request_count, rate_limits.token_count
  INTO v_req_count, v_tok_count;

  -- Seconds remaining until the window resets (minimum 1 to avoid Retry-After: 0).
  v_retry_secs := greatest(1, extract(epoch FROM (v_window_end - now()))::int);

  -- Allowed iff neither axis is exceeded (after the increment).
  v_allowed := (v_req_count <= p_max_requests)
           AND (p_max_tokens IS NULL OR v_tok_count <= p_max_tokens);

  RETURN QUERY SELECT v_allowed, v_req_count, v_tok_count, v_retry_secs;
END;
$$;

-- Grant EXECUTE to service_role only. Edge functions call this via the admin
-- client (service-role key). anon and authenticated must never call it directly.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, int, int, int, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(text, int, int, int, bigint) TO service_role;
