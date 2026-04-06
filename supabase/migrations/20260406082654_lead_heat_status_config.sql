-- Per-user Close lead status classification for AI Hot 100 filtering.
--
-- Problem: The previous AI Hot 100 implementation filtered leads by hardcoded
-- substring patterns against the Close status LABEL string. This is fragile
-- in a multi-tenant SaaS where every agent has their own Close pipeline with
-- custom status names. New "dead lead" statuses (e.g. "Bad Contact Info",
-- "Missed Payment", "DISABLE BOT") silently leaked into the Hot 100 because
-- no global pattern list could keep up with every user's labels.
--
-- Solution: Per-user table classifying each Close status_id (immutable) as
-- rankable or excluded. Auto-populated on first scoring run by the edge
-- function via a hybrid heuristic (blacklist → whitelist → default deny).
-- Filtering downstream becomes a JOIN against this table on the immutable
-- close_status_id, not a substring match against the mutable label.

CREATE TABLE lead_heat_status_config (
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_status_id      TEXT NOT NULL,
  close_status_label   TEXT NOT NULL,
  is_rankable          BOOLEAN NOT NULL,
  classification_source TEXT NOT NULL CHECK (classification_source IN ('heuristic', 'user_override')),
  classified_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, close_status_id)
);

-- Hot path: filtering scored leads by rankable statuses for a user.
CREATE INDEX idx_lhsc_user_rankable
  ON lead_heat_status_config(user_id, is_rankable);

ALTER TABLE lead_heat_status_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own status config"
  ON lead_heat_status_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own status config"
  ON lead_heat_status_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on lead_heat_status_config"
  ON lead_heat_status_config FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE lead_heat_status_config IS
'Per-user classification of Close lead statuses as rankable (eligible for the
AI Hot 100) or excluded (dead/agent-touched/terminal). Auto-populated by the
close-lead-heat-score edge function on first scoring run via a hybrid
heuristic. Users can override the heuristic later via a settings UI.';

COMMENT ON COLUMN lead_heat_status_config.close_status_id IS
'Immutable Close lead status ID (e.g. stat_xxx). NEVER use the label for
filtering — labels can be renamed silently in Close.';

COMMENT ON COLUMN lead_heat_status_config.classification_source IS
'How this status was classified: "heuristic" (auto by pattern matching at
scoring time) or "user_override" (manual flip via settings UI).';
