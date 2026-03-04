-- Feature Spotlights system
-- Replaces static SubscriptionAnnouncementDialog with dynamic, admin-configurable spotlights

-- ============================================
-- Table: feature_spotlights
-- ============================================
CREATE TABLE IF NOT EXISTS feature_spotlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  highlights JSONB NOT NULL DEFAULT '[]',
  cta_text TEXT NOT NULL DEFAULT 'Learn More',
  cta_link TEXT NOT NULL DEFAULT '/',
  hero_icon TEXT NOT NULL DEFAULT 'Sparkles',
  accent_color TEXT NOT NULL DEFAULT '#3b82f6',
  target_audience TEXT NOT NULL DEFAULT 'all',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE feature_spotlights IS 'Admin-configurable feature spotlights shown to users on login';
COMMENT ON COLUMN feature_spotlights.target_audience IS 'Targeting: all, plan:<name>, missing_addon:<name>';
COMMENT ON COLUMN feature_spotlights.highlights IS 'JSON array of {icon: string, label: string}';

-- ============================================
-- Table: user_spotlight_views
-- ============================================
CREATE TABLE IF NOT EXISTS user_spotlight_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotlight_id UUID NOT NULL REFERENCES feature_spotlights(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, spotlight_id)
);

COMMENT ON TABLE user_spotlight_views IS 'Tracks which spotlights each user has dismissed';

-- ============================================
-- Indexes (IF NOT EXISTS for idempotency)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_spotlights_active_priority ON feature_spotlights(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_spotlight_views_user ON user_spotlight_views(user_id);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE feature_spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_spotlight_views ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first for idempotency
DROP POLICY IF EXISTS "Authenticated users can view active spotlights" ON feature_spotlights;
DROP POLICY IF EXISTS "Super admins full access to spotlights" ON feature_spotlights;
DROP POLICY IF EXISTS "Users can manage own spotlight views" ON user_spotlight_views;
DROP POLICY IF EXISTS "Super admins can view all spotlight views" ON user_spotlight_views;

-- feature_spotlights: authenticated users can SELECT active spotlights
CREATE POLICY "Authenticated users can view active spotlights"
  ON feature_spotlights FOR SELECT
  TO authenticated
  USING (is_active = true);

-- feature_spotlights: super-admins full CRUD
CREATE POLICY "Super admins full access to spotlights"
  ON feature_spotlights FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  );

-- user_spotlight_views: users manage own rows
CREATE POLICY "Users can manage own spotlight views"
  ON user_spotlight_views FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_spotlight_views: super-admins can SELECT all (analytics)
CREATE POLICY "Super admins can view all spotlight views"
  ON user_spotlight_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  );

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_feature_spotlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feature_spotlights_updated_at ON feature_spotlights;
CREATE TRIGGER trg_feature_spotlights_updated_at
  BEFORE UPDATE ON feature_spotlights
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_spotlights_updated_at();

-- ============================================
-- Seed: AI Chatbot Spotlight (only if not already inserted)
-- ============================================
INSERT INTO feature_spotlights (
  title, subtitle, description, highlights,
  cta_text, cta_link, hero_icon, accent_color,
  target_audience, priority
)
SELECT
  'AI-Powered SMS Appointment Setter',
  'Never miss a lead again',
  'Responds to inbound leads instantly, has real conversations, and books appointments on your calendar. Works 24/7 with Close CRM, Calendly, and Google Calendar integration.',
  '[{"icon":"Bot","label":"AI-powered natural conversations"},{"icon":"Calendar","label":"Auto-books on Calendly or Google Calendar"},{"icon":"Zap","label":"Instant response to inbound leads"},{"icon":"Clock","label":"Works 24/7, never takes a day off"},{"icon":"BarChart3","label":"Full analytics & ROI tracking"},{"icon":"Users","label":"Close CRM integration built-in"}]'::jsonb,
  'Explore AI Chat Bot',
  '/chat-bot',
  'Bot',
  '#3b82f6',
  'missing_addon:ai_chat_bot',
  100
WHERE NOT EXISTS (
  SELECT 1 FROM feature_spotlights WHERE title = 'AI-Powered SMS Appointment Setter'
);
