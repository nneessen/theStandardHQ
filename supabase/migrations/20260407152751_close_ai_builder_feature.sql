-- Close AI Builder feature: AI-generated Close CRM email/SMS templates + sequences
-- Adds:
--   1. close_ai_builder subscription feature flag (team = true, free/pro = false)
--   2. close_ai_generations table — audit log of every AI generation with prompt, output, tokens, close_id after save
--   3. RLS: users see only their own rows; super-admin sees all
--
-- Access pattern (enforced in edge function, not in this table):
--   super-admin OR features.close_ai_builder OR is_direct_downline_of_owner()

BEGIN;

-- ============================================================================
-- 1. Subscription plan feature flag
-- ============================================================================

UPDATE subscription_plans
SET features = features || jsonb_build_object('close_ai_builder', true)
WHERE name = 'team';

UPDATE subscription_plans
SET features = features || jsonb_build_object('close_ai_builder', false)
WHERE name IN ('free', 'pro');

DO $$
DECLARE
  team_has BOOLEAN;
BEGIN
  SELECT (features->>'close_ai_builder')::boolean INTO team_has
    FROM subscription_plans WHERE name = 'team';
  IF team_has IS NOT TRUE THEN
    -- Fail the migration loudly if the team plan is missing or didn't
    -- receive the flag. Silently warning would let the feature ship
    -- without its primary gating flag. If this fires, investigate
    -- subscription_plans state before re-running.
    RAISE EXCEPTION 'Team plan is missing or did not receive close_ai_builder flag — check subscription_plans row exists before re-running';
  END IF;
END $$;

-- ============================================================================
-- 2. close_ai_generations audit/history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS close_ai_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What kind of artifact was generated
  generation_type TEXT NOT NULL CHECK (generation_type IN ('email', 'sms', 'sequence')),

  -- User's original prompt + any structured options (tone, cadence, etc.)
  prompt          TEXT NOT NULL,
  options         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- AI output (full JSON payload before any user edits). Kept for regen/audit.
  output_json     JSONB NOT NULL,

  -- Cost/observability
  model_used      TEXT NOT NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER,

  -- Once the user saves to Close, we record the Close object ID here.
  -- NULL until saved. For sequences, this is the sequence ID; template IDs
  -- created as a side effect of saving a sequence are stored in close_child_ids.
  close_id        TEXT,
  close_child_ids TEXT[],

  saved_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. Indexes
-- ============================================================================

CREATE INDEX idx_close_ai_generations_user_created
  ON close_ai_generations(user_id, created_at DESC);

CREATE INDEX idx_close_ai_generations_user_type
  ON close_ai_generations(user_id, generation_type, created_at DESC);

CREATE INDEX idx_close_ai_generations_saved
  ON close_ai_generations(user_id, saved_at DESC)
  WHERE saved_at IS NOT NULL;

-- ============================================================================
-- 4. RLS policies
-- ============================================================================

ALTER TABLE close_ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own generations"
  ON close_ai_generations FOR SELECT
  USING (auth.uid() = user_id OR is_super_admin());

CREATE POLICY "Users insert own generations"
  ON close_ai_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own generations"
  ON close_ai_generations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own generations"
  ON close_ai_generations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on ai generations"
  ON close_ai_generations FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. updated_at trigger (reuses existing helper from close_kpi_dashboard migration)
-- ============================================================================

CREATE TRIGGER trg_close_ai_generations_updated
  BEFORE UPDATE ON close_ai_generations
  FOR EACH ROW EXECUTE FUNCTION update_close_kpi_updated_at();

-- ============================================================================
-- 6. Grants
-- ============================================================================

GRANT ALL ON close_ai_generations TO authenticated;
GRANT ALL ON close_ai_generations TO service_role;

COMMENT ON TABLE close_ai_generations IS
  'Audit log of AI-generated Close CRM templates and sequences. One row per generation, optionally linked to a created Close object via close_id after save. See close-ai-builder edge function.';

COMMIT;
