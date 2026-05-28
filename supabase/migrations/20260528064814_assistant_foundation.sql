-- supabase/migrations/20260528064814_assistant_foundation.sql
-- Foundation for the embedded agentic "Jarvis" Command Center.
-- Five per-user tables: preferences, conversations, messages, tool_calls, action_requests.
--
-- Scoping: every table carries user_id and is RLS-scoped to user_id = auth.uid().
-- The orchestrator edge function runs with the USER's JWT (anon key + Authorization
-- header), so all inserts/updates happen as the authenticated user and satisfy RLS
-- with no service-role access. imo_id is denormalized for tenant analytics only (no FK:
-- get_effective_imo_id() may resolve to a sentinel that is not a row in imos).
--
-- Enum-like columns (role, channel, status, risk_level, category) are plain TEXT with NO
-- CHECK constraints, per project convention — valid values are enforced in TypeScript
-- (see assistant-orchestrator/core/state-machine.ts and registry.ts).

-- =============================================================================
-- assistant_preferences - per-user assistant configuration
-- =============================================================================
CREATE TABLE IF NOT EXISTS assistant_preferences (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  assistant_name TEXT NOT NULL DEFAULT 'Jarvis',
  enabled_agents TEXT[] NOT NULL DEFAULT ARRAY['executive-briefing']::TEXT[],
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  tone TEXT NOT NULL DEFAULT 'professional',
  briefing_style TEXT NOT NULL DEFAULT 'concise',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE assistant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_preferences_select_policy" ON assistant_preferences
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "assistant_preferences_insert_policy" ON assistant_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_preferences_update_policy" ON assistant_preferences
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_preferences_delete_policy" ON assistant_preferences
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- assistant_conversations - one row per assistant conversation thread
-- =============================================================================
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  imo_id UUID,
  title TEXT,
  agent_key TEXT NOT NULL DEFAULT 'executive-briefing',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_id
  ON assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_recent
  ON assistant_conversations(user_id, last_message_at DESC);

ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_conversations_select_policy" ON assistant_conversations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "assistant_conversations_insert_policy" ON assistant_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_conversations_update_policy" ON assistant_conversations
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_conversations_delete_policy" ON assistant_conversations
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- assistant_messages - user/assistant/tool/system turns (immutable; no updated_at)
-- content is the Anthropic content-block array (text, tool_use, tool_result).
-- =============================================================================
CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '[]'::JSONB,
  agent_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
  ON assistant_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_user_id
  ON assistant_messages(user_id);

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_messages_select_policy" ON assistant_messages
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "assistant_messages_insert_policy" ON assistant_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_messages_update_policy" ON assistant_messages
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_messages_delete_policy" ON assistant_messages
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- assistant_tool_calls - audit log of every tool invocation (redacted I/O)
-- =============================================================================
CREATE TABLE IF NOT EXISTS assistant_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES assistant_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  category TEXT,
  risk_level TEXT,
  input_redacted JSONB,
  output_redacted JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_tool_calls_conversation
  ON assistant_tool_calls(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_tool_calls_user_id
  ON assistant_tool_calls(user_id);

ALTER TABLE assistant_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_tool_calls_select_policy" ON assistant_tool_calls
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "assistant_tool_calls_insert_policy" ON assistant_tool_calls
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_tool_calls_update_policy" ON assistant_tool_calls
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_tool_calls_delete_policy" ON assistant_tool_calls
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- assistant_action_requests - draft -> approval -> execution lifecycle for
-- external sends (email/sms). The LLM may only create a draft row; the human
-- approves in the UI and the assistant-action-execute edge function performs
-- the send. Status lifecycle (enforced in TS state-machine):
--   draft -> pending_approval -> approved -> executing -> executed
--                                                      \-> failed
--   (pending_approval|approved) -> cancelled
--   pending_approval -> expired (past expires_at)
-- =============================================================================
CREATE TABLE IF NOT EXISTS assistant_action_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES assistant_conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  imo_id UUID,
  channel TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  draft_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result_redacted JSONB,
  error TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_action_requests_user_status
  ON assistant_action_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_assistant_action_requests_status_expiry
  ON assistant_action_requests(status, expires_at);

ALTER TABLE assistant_action_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_action_requests_select_policy" ON assistant_action_requests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "assistant_action_requests_insert_policy" ON assistant_action_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_action_requests_update_policy" ON assistant_action_requests
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "assistant_action_requests_delete_policy" ON assistant_action_requests
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- updated_at triggers (reuse canonical update_updated_at_column())
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assistant_preferences_updated_at') THEN
    CREATE TRIGGER update_assistant_preferences_updated_at
      BEFORE UPDATE ON assistant_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assistant_conversations_updated_at') THEN
    CREATE TRIGGER update_assistant_conversations_updated_at
      BEFORE UPDATE ON assistant_conversations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assistant_action_requests_updated_at') THEN
    CREATE TRIGGER update_assistant_action_requests_updated_at
      BEFORE UPDATE ON assistant_action_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- Documentation
-- =============================================================================
COMMENT ON TABLE assistant_preferences IS 'Per-user configuration for the Jarvis command center (name, enabled agents, voice, tone).';
COMMENT ON TABLE assistant_conversations IS 'Assistant conversation threads, RLS-scoped to the owning user.';
COMMENT ON TABLE assistant_messages IS 'Immutable assistant turns; content holds the Anthropic content-block array.';
COMMENT ON TABLE assistant_tool_calls IS 'Audit log of tool invocations with redacted/truncated input and output.';
COMMENT ON TABLE assistant_action_requests IS 'Draft->approval->execution lifecycle for external sends (email/sms). The LLM only drafts; humans approve; assistant-action-execute sends.';
COMMENT ON COLUMN assistant_action_requests.status IS 'draft|pending_approval|approved|executing|executed|failed|cancelled|expired (enforced in TS).';
COMMENT ON COLUMN assistant_conversations.imo_id IS 'Denormalized tenant id for analytics; no FK (may be a sentinel from get_effective_imo_id()).';
