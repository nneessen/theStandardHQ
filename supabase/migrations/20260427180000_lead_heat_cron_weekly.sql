-- Reschedule lead-heat-scoring cron from every 30 minutes to once a week.
--
-- Reason: every-30-min cadence × Sonnet 4.6 portfolio model was burning
-- ~$20/hr in Anthropic charges (multiple users + 4hr TTL was not enough
-- to gate cost). Weekly cadence + Haiku model (reverted in same change)
-- brings ongoing cost back to a few cents per run.
--
-- Schedule: every Monday at 11:00 UTC (matches sync-ai-hot-leads-view).

SELECT cron.unschedule('lead-heat-scoring')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lead-heat-scoring');

SELECT cron.schedule(
  'lead-heat-scoring',
  '0 11 * * 1',
  'SELECT invoke_lead_heat_scoring();'
);
