-- Bot Playground feature: persisted history of dry-run bot reply tests
--
-- Each row captures one "what would the bot say?" test a user ran via the
-- Bot Playground UI (new tab in Bot Configuration). The UI surfaces the
-- last N runs per agent so users can compare prompt experiments over time
-- and copy previous outputs back into the input fields to iterate.
--
-- The actual AI call happens in standard-chat-bot's
--   POST /api/external/agents/:agentId/dry-run-reply
-- endpoint (see docs/external-api-reference.md "Bot Playground (Dry-Run)").
-- This table is ONLY the persistence layer for the commissionTracker UI —
-- standard-chat-bot does not read from or write to it.
--
-- Zero cross-repo dependencies. Dropping this table does not break the bot;
-- it only removes the playground history UI view.

BEGIN;

-- ============================================================================
-- chat_bot_playground_runs — history of bot dry-run tests
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_bot_playground_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who ran the test
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The standard-chat-bot agent ID (UUID) the test was run against. Not a
  -- foreign key because the agents table lives in standard-chat-bot's
  -- Postgres (Railway), not in commissionTracker's Supabase. We cannot
  -- foreign-key across databases.
  chat_bot_agent_id   UUID NOT NULL,

  -- Which lead was simulated against (Close lead ID, opaque string)
  close_lead_id       TEXT NOT NULL,

  -- Input parameters
  mode                TEXT NOT NULL CHECK (mode IN ('ai-reply', 're-engage')),
  inbound_override    TEXT,                       -- null = used the lead's actual latest inbound
  system_prompt_override TEXT,                    -- null = used the default prompt builder

  -- Results from the dry-run endpoint response
  raw_reply           TEXT NOT NULL,              -- rawReply
  final_reply         TEXT NOT NULL,              -- finalReply (post-guardrails, sanitized)
  would_send          BOOLEAN NOT NULL,           -- wouldSend
  guardrail_violations JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Rich metadata (lead name, tokens, timing, etc.) — stored as JSONB so we
  -- don't have to migrate every time standard-chat-bot adds a field.
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- The full system prompt that was sent to Anthropic. Large (5–15KB).
  -- Kept for prompt-debugging in the UI's collapsible "show prompt" view.
  system_prompt       TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup: "show me the last 20 playground runs for this user+agent"
CREATE INDEX IF NOT EXISTS idx_chat_bot_playground_runs_user_agent_created
  ON chat_bot_playground_runs (user_id, chat_bot_agent_id, created_at DESC);

-- Also allow filtering by the specific lead inside an agent (e.g. "show me
-- all past playground runs for this specific Close lead")
CREATE INDEX IF NOT EXISTS idx_chat_bot_playground_runs_user_lead_created
  ON chat_bot_playground_runs (user_id, close_lead_id, created_at DESC);

-- ============================================================================
-- RLS — users can only read/insert/delete their own playground runs
-- ============================================================================

ALTER TABLE chat_bot_playground_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_playground_runs"
  ON chat_bot_playground_runs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_playground_runs"
  ON chat_bot_playground_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_playground_runs"
  ON chat_bot_playground_runs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypasses RLS by default, so the `chat-bot-api` edge function
-- (which runs with the service role key) can insert rows on behalf of users
-- after verifying the JWT.

COMMIT;
