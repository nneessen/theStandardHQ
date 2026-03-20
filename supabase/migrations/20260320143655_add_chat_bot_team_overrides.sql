BEGIN;

CREATE TABLE chat_bot_team_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES user_profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_chat_bot_team_overrides_user_id ON chat_bot_team_overrides(user_id);

ALTER TABLE chat_bot_team_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on chat_bot_team_overrides"
  ON chat_bot_team_overrides FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own team override"
  ON chat_bot_team_overrides FOR SELECT
  USING (auth.uid() = user_id);

-- Seed Kerry Glass override
INSERT INTO chat_bot_team_overrides (user_id, granted_by, reason)
SELECT
  target.id,
  grantor.id,
  'Upline of app owner — one-off team access grant for SMS Chat Bot'
FROM user_profiles target
CROSS JOIN (SELECT id FROM user_profiles WHERE email = 'nickneessen@thestandardhq.com' LIMIT 1) grantor
WHERE target.email = 'kerryglass.ffl@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
