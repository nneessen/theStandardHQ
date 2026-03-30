-- Lead Heat Index: AI-powered lead scoring for Close CRM
-- 5 tables: scores, agent weights, outcomes, scoring runs, AI analysis cache

-- ═══════════════════════════════════════════════════════════════════════
-- 1. lead_heat_scores — per-lead score storage (core table)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE lead_heat_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_lead_id   TEXT NOT NULL,
  display_name    TEXT,
  score           SMALLINT NOT NULL DEFAULT 0,
  heat_level      TEXT NOT NULL DEFAULT 'cold',
  trend           TEXT NOT NULL DEFAULT 'right',
  previous_score  SMALLINT,
  breakdown       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_insights     JSONB,
  signals         JSONB NOT NULL DEFAULT '{}'::jsonb,
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, close_lead_id)
);

CREATE INDEX idx_lhs_user_score ON lead_heat_scores(user_id, score DESC);
CREATE INDEX idx_lhs_user_level ON lead_heat_scores(user_id, heat_level);
CREATE INDEX idx_lhs_user_scored ON lead_heat_scores(user_id, scored_at);

ALTER TABLE lead_heat_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scores"
  ON lead_heat_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on lead_heat_scores"
  ON lead_heat_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════
-- 2. lead_heat_agent_weights — per-agent learned model weights
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE lead_heat_agent_weights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  weights         JSONB NOT NULL DEFAULT '{}'::jsonb,
  version         INT NOT NULL DEFAULT 1,
  sample_size     INT NOT NULL DEFAULT 0,
  last_trained_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_heat_agent_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own weights"
  ON lead_heat_agent_weights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on lead_heat_agent_weights"
  ON lead_heat_agent_weights FOR ALL
  USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════
-- 3. lead_heat_outcomes — feedback loop event log
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE lead_heat_outcomes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_lead_id        TEXT NOT NULL,
  outcome_type         TEXT NOT NULL,
  score_at_outcome     SMALLINT,
  breakdown_at_outcome JSONB,
  signals_at_outcome   JSONB,
  close_opp_id         TEXT,
  opp_value            NUMERIC,
  metadata             JSONB DEFAULT '{}'::jsonb,
  occurred_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lho_user_type ON lead_heat_outcomes(user_id, outcome_type);
CREATE INDEX idx_lho_user_occurred ON lead_heat_outcomes(user_id, occurred_at DESC);

ALTER TABLE lead_heat_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own outcomes"
  ON lead_heat_outcomes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on lead_heat_outcomes"
  ON lead_heat_outcomes FOR ALL
  USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════
-- 4. lead_heat_scoring_runs — audit/progress tracking
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE lead_heat_scoring_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'running',
  leads_scored  INT DEFAULT 0,
  leads_total   INT DEFAULT 0,
  ai_calls_made INT DEFAULT 0,
  duration_ms   INT,
  error_message TEXT,
  run_type      TEXT NOT NULL DEFAULT 'scheduled',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_lhsr_user_status ON lead_heat_scoring_runs(user_id, started_at DESC);

ALTER TABLE lead_heat_scoring_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scoring runs"
  ON lead_heat_scoring_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on lead_heat_scoring_runs"
  ON lead_heat_scoring_runs FOR ALL
  USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════
-- 5. lead_heat_ai_portfolio_analysis — cached AI insights
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE lead_heat_ai_portfolio_analysis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis        JSONB NOT NULL DEFAULT '{}'::jsonb,
  anomalies       JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  weight_adjustments JSONB DEFAULT '[]'::jsonb,
  model_used      TEXT,
  tokens_used     INT,
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours')
);

ALTER TABLE lead_heat_ai_portfolio_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own portfolio analysis"
  ON lead_heat_ai_portfolio_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on lead_heat_ai_portfolio_analysis"
  ON lead_heat_ai_portfolio_analysis FOR ALL
  USING (auth.role() = 'service_role');
