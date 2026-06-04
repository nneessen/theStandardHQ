-- supabase/migrations/20260604070726_jarvis_memory.sql
-- Jarvis "second brain" Phase A: durable per-user memory.
--
-- A BOUNDED set of facts/preferences the assistant injects straight into the
-- system prompt every session (see assistant-orchestrator/core/memory.ts), so
-- Jarvis "remembers you" across conversations WITHOUT any embedding/RAG infra.
-- (The unbounded pgvector knowledge corpus is a separate, later phase.)
--
-- Scoping mirrors assistant_foundation exactly: every row carries user_id and is
-- RLS-scoped to user_id = auth.uid(). The orchestrator runs with the USER's JWT,
-- so inserts happen as the authenticated user and satisfy RLS with no service-role
-- access. imo_id is denormalized for tenant analytics only (no FK: get_effective_imo_id()
-- may resolve to a sentinel that is not a row in imos).
--
-- Enum-like columns (kind, source) are plain TEXT with NO CHECK constraints, per
-- project convention — valid values are enforced in TypeScript (tools/saveMemory.ts).

CREATE TABLE IF NOT EXISTS jarvis_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  imo_id UUID,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'fact',
  memory_key TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  pinned BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Injection read path: active rows for a user, pinned first then most-recent.
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_user_active
  ON jarvis_memory(user_id, active, pinned DESC, updated_at DESC);

-- Upsert-by-key uniqueness for keyed preferences (e.g. memory_key='goal' updates
-- rather than duplicates). Freeform facts (memory_key IS NULL) may repeat. Created
-- now so a future upsert RPC has its ON CONFLICT target; only enforced for keyed rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_jarvis_memory_user_key
  ON jarvis_memory(user_id, memory_key) WHERE memory_key IS NOT NULL;

ALTER TABLE jarvis_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jarvis_memory_select_policy" ON jarvis_memory
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "jarvis_memory_insert_policy" ON jarvis_memory
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "jarvis_memory_update_policy" ON jarvis_memory
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "jarvis_memory_delete_policy" ON jarvis_memory
  FOR DELETE USING (user_id = auth.uid());

-- updated_at trigger (reuse canonical update_updated_at_column() from assistant_foundation).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_jarvis_memory_updated_at') THEN
    CREATE TRIGGER update_jarvis_memory_updated_at
      BEFORE UPDATE ON jarvis_memory
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE jarvis_memory IS 'Jarvis durable per-user memory (bounded facts/preferences injected into the system prompt). RLS-scoped to user_id = auth.uid().';
COMMENT ON COLUMN jarvis_memory.kind IS 'fact|preference|goal|context (TS-enforced; no CHECK per project convention).';
COMMENT ON COLUMN jarvis_memory.memory_key IS 'Optional stable key for upsertable prefs (unique per user when set); NULL = freeform fact.';
COMMENT ON COLUMN jarvis_memory.source IS 'user|assistant — who created the memory. Phase A only writes user (no auto-capture).';
COMMENT ON COLUMN jarvis_memory.imo_id IS 'Denormalized tenant id for analytics; no FK (may be a sentinel from get_effective_imo_id()).';
