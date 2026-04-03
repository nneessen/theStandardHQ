-- Add column to track the Close saved_search ID for the AI Hot Leads Smart View.
-- Each user gets one auto-managed Smart View containing their top 100 AI-scored leads.

ALTER TABLE close_config
  ADD COLUMN IF NOT EXISTS ai_smart_view_id TEXT,
  ADD COLUMN IF NOT EXISTS ai_smart_view_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN close_config.ai_smart_view_id IS 'Close saved_search ID for the AI Hot 100 Smart View';
COMMENT ON COLUMN close_config.ai_smart_view_synced_at IS 'Last time the AI Smart View was synced';
