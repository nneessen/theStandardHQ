-- Discord integration tables (parallel to Slack, not replacing)
-- Supports Discord bot token auth (no OAuth needed)

-- Discord integration per workspace/guild
CREATE TABLE IF NOT EXISTS discord_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id UUID NOT NULL REFERENCES imos(id),
  agency_id UUID REFERENCES agencies(id),
  guild_id TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  bot_token_encrypted TEXT NOT NULL,
  bot_username TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connection_status TEXT NOT NULL DEFAULT 'connected',
  -- Channel configuration
  policy_channel_id TEXT,
  policy_channel_name TEXT,
  leaderboard_channel_id TEXT,
  leaderboard_channel_name TEXT,
  weekly_leaderboard_channel_id TEXT,
  weekly_leaderboard_channel_name TEXT,
  agency_leaderboard_channel_id TEXT,
  agency_leaderboard_channel_name TEXT,
  recruit_channel_id TEXT,
  recruit_channel_name TEXT,
  workspace_logo_url TEXT,
  last_error TEXT,
  last_connected_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one integration per guild per agency (or IMO-level if agency_id is null)
CREATE UNIQUE INDEX idx_discord_integrations_guild_agency
  ON discord_integrations (guild_id, COALESCE(agency_id, '00000000-0000-0000-0000-000000000000'));

-- RLS
ALTER TABLE discord_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discord integrations for their IMO"
  ON discord_integrations FOR SELECT
  USING (imo_id IN (SELECT imo_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage discord integrations"
  ON discord_integrations FOR ALL
  USING (imo_id IN (SELECT imo_id FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role full access to discord_integrations"
  ON discord_integrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_discord_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_discord_integrations_updated_at
  BEFORE UPDATE ON discord_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_discord_integrations_updated_at();

-- Discord message audit trail
CREATE TABLE IF NOT EXISTS discord_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id UUID NOT NULL REFERENCES imos(id),
  discord_integration_id UUID NOT NULL REFERENCES discord_integrations(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  notification_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message_text TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discord_messages_integration ON discord_messages(discord_integration_id);
CREATE INDEX idx_discord_messages_type ON discord_messages(notification_type, created_at DESC);

-- RLS
ALTER TABLE discord_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discord messages for their IMO"
  ON discord_messages FOR SELECT
  USING (imo_id IN (SELECT imo_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to discord_messages"
  ON discord_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant PostgREST access
GRANT SELECT, INSERT, UPDATE, DELETE ON discord_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON discord_integrations TO service_role;
GRANT SELECT, INSERT ON discord_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON discord_messages TO service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
