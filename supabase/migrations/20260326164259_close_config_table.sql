-- Close CRM API key storage (encrypted)
-- Stores per-user Close API credentials for direct Close API access
-- Pattern follows elevenlabs_config and gmail_integrations

CREATE TABLE IF NOT EXISTS close_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  organization_id   TEXT,
  organization_name TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_verified_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can only access their own row
ALTER TABLE close_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own close config"
  ON close_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own close config"
  ON close_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own close config"
  ON close_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own close config"
  ON close_config FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass for edge functions
CREATE POLICY "Service role full access"
  ON close_config FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX idx_close_config_user_active ON close_config(user_id) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER trg_close_config_updated
  BEFORE UPDATE ON close_config
  FOR EACH ROW EXECUTE FUNCTION update_close_kpi_updated_at();

-- Grant access
GRANT ALL ON close_config TO authenticated;
GRANT ALL ON close_config TO service_role;
