-- Persistent log of every Close webhook delivered to close-webhook-handler.
-- One row per inbound webhook (whether ignored, succeeded, or errored), so that
-- we can verify the chain end-to-end after enabling Close lead-status writeback
-- in standard-chat-bot.
--
-- Retention: capped to 30 days via a future cleanup cron; for now, manual.

CREATE TABLE IF NOT EXISTS close_webhook_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id TEXT,
  lead_id         TEXT,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_action    TEXT,
  status_label    TEXT,
  changed_fields  TEXT[],
  outcome         TEXT NOT NULL,           -- ignored | created | updated | updated_existing | skipped | error | no_matching_config | missing_ids | no_event
  outcome_reason  TEXT,
  opportunity_id  TEXT,
  error_message   TEXT,
  raw_payload     JSONB
);

CREATE INDEX IF NOT EXISTS close_webhook_logs_received_at_idx
  ON close_webhook_logs (received_at DESC);

CREATE INDEX IF NOT EXISTS close_webhook_logs_org_idx
  ON close_webhook_logs (organization_id, received_at DESC);

CREATE INDEX IF NOT EXISTS close_webhook_logs_lead_idx
  ON close_webhook_logs (lead_id, received_at DESC);

COMMENT ON TABLE close_webhook_logs IS
  'Audit log of inbound Close CRM webhooks processed by close-webhook-handler edge function.';
COMMENT ON COLUMN close_webhook_logs.outcome IS
  'High-level result: ignored, created, updated, updated_existing, skipped, error, no_matching_config, missing_ids, no_event';
COMMENT ON COLUMN close_webhook_logs.raw_payload IS
  'Truncated/minimal copy of the inbound payload for debugging';
