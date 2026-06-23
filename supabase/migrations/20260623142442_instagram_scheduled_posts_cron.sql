-- supabase/migrations/20260623142442_instagram_scheduled_posts_cron.sql
-- pg_cron schedule for the scheduled-POST worker (instagram-process-scheduled-posts).
--
-- ⚠️ GO-LIVE / PROD-ONLY: this targets the prod functions URL and carries the prod
-- service-role bearer (same token the existing instagram-process-scheduled cron uses,
-- per 20260106_003_fix_instagram_cron_auth.sql — current_setting() did not work).
-- Do NOT apply this against a local DB. Apply on prod only AFTER the worker fn is
-- deployed (--no-verify-jwt) and the instagram_scheduled_posts migration is on prod.
--
-- PREREQUISITE: pg_cron extension enabled (it already is — the DM cron uses it).

-- Idempotent: drop a prior copy of this job before recreating.
SELECT cron.unschedule('instagram-process-scheduled-posts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'instagram-process-scheduled-posts'
);

-- Every 5 minutes: hit the worker, which publishes due posts.
SELECT cron.schedule(
  'instagram-process-scheduled-posts',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/instagram-process-scheduled-posts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeWFxd29kbnlycGthaW9qbnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MTA5MiwiZXhwIjoyMDczNTQ3MDkyfQ.XX7b-WjJHpx1V7b3rl2fBg_HPVfWz3CCt5IUtsluo1Y'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'instagram-process-scheduled-posts';
