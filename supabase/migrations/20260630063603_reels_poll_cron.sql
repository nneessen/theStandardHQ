-- supabase/migrations/20260630063603_reels_poll_cron.sql
-- pg_cron schedule for the reels poller (reels-poll). Every minute it claims processing
-- reel_jobs, queries Vizard, and writes reel_clips / flips status when a job is done.
--
-- ⚠️ GO-LIVE / PROD-ONLY: targets the prod functions URL and carries the prod service-role
-- bearer (the same token every existing cron migration in this repo uses). Do NOT apply
-- against a local DB. Apply on prod ONLY AFTER the reels-poll fn is deployed (--no-verify-jwt)
-- and the 20260630063602_reel_jobs migration is on prod.
--
-- PREREQUISITE: pg_cron extension enabled (already is — other crons use it).

-- Idempotent: drop a prior copy of this job before recreating.
SELECT cron.unschedule('reels-poll')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reels-poll'
);

-- Every minute: hit the worker, which polls Vizard for due jobs.
SELECT cron.schedule(
  'reels-poll',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/reels-poll',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeWFxd29kbnlycGthaW9qbnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MTA5MiwiZXhwIjoyMDczNTQ3MDkyfQ.XX7b-WjJHpx1V7b3rl2fBg_HPVfWz3CCt5IUtsluo1Y'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'reels-poll';
