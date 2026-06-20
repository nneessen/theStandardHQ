-- Garbage-collect expired public.rate_limits rows (daily pg_cron job).
--
-- WHY: check_rate_limit (mig 20260531161319) does INSERT … ON CONFLICT (bucket_key, window_start)
-- — one row per key+window — and never cleans up; its own header comment specced this GC as a
-- "future pg_cron job". The public crm-oauth-token DoS gate keys a per-IP bucket, so under a
-- spoofed-X-Forwarded-For flood this table accretes rows. The gate's global-first ordering bounds
-- that to ~30 new rows/min, but with no GC it still grows unbounded over time. The 2026-06-20
-- security review of the OAuth DoS rate-limit flagged this GC as a required follow-up.
--
-- 2 days >> the longest window in use (86400s daily token bucket), so no live window is ever deleted.
-- PREREQUISITE: pg_cron is already enabled on this project (the workflow worker uses it).

-- Idempotent re-schedule (matches the repo's existing cron migration pattern).
SELECT cron.unschedule('rate-limits-gc')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limits-gc');

SELECT cron.schedule(
  'rate-limits-gc',
  '17 3 * * *',  -- daily at 03:17 UTC (off the top-of-hour to avoid cron congestion)
  $$DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 days'$$
);
