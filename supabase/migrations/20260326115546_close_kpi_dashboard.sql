-- Close CRM KPI Dashboard tables
-- Configurable widget-based KPI system for monitoring Close CRM metrics

-- ─── Dashboard container (one per user) ────────────────────────────
CREATE TABLE IF NOT EXISTS close_kpi_dashboards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'My Dashboard',
  global_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE close_kpi_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboards"
  ON close_kpi_dashboards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Individual widget definitions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS close_kpi_widgets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id   UUID NOT NULL REFERENCES close_kpi_dashboards(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type    TEXT NOT NULL,
  title          TEXT NOT NULL,
  size           TEXT NOT NULL DEFAULT 'medium',
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_order INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE close_kpi_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own widgets"
  ON close_kpi_widgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_close_kpi_widgets_dashboard ON close_kpi_widgets(dashboard_id);
CREATE INDEX idx_close_kpi_widgets_user ON close_kpi_widgets(user_id);

-- ─── Cached widget results (performance layer) ────────────────────
CREATE TABLE IF NOT EXISTS close_kpi_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_id  UUID NOT NULL REFERENCES close_kpi_widgets(id) ON DELETE CASCADE,
  cache_key  TEXT NOT NULL,
  result     JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  UNIQUE(widget_id, cache_key)
);

ALTER TABLE close_kpi_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own cache"
  ON close_kpi_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_close_kpi_cache_widget ON close_kpi_cache(widget_id);
CREATE INDEX idx_close_kpi_cache_expiry ON close_kpi_cache(expires_at);

-- ─── Preset widget templates (seeded, read-only for users) ────────
CREATE TABLE IF NOT EXISTS close_kpi_widget_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL,
  widget_type    TEXT NOT NULL,
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  icon           TEXT,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Templates are public read-only (no user data)
ALTER TABLE close_kpi_widget_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates"
  ON close_kpi_widget_templates FOR SELECT
  USING (true);

-- ─── Seed preset templates ─────────────────────────────────────────
INSERT INTO close_kpi_widget_templates (name, description, category, widget_type, default_config, icon, sort_order) VALUES
  ('New Leads This Week', 'Count of leads created this week', 'leads', 'stat_card',
   '{"metric": "lead_count", "dateRange": "this_week", "comparison": "previous_period"}'::jsonb,
   'UserPlus', 1),
  ('Leads by Status', 'Distribution of leads across statuses', 'leads', 'status_distribution',
   '{"groupBy": "status", "dateRange": "this_month"}'::jsonb,
   'BarChart3', 2),
  ('Leads by Source', 'Lead count grouped by source', 'leads', 'status_distribution',
   '{"groupBy": "source", "dateRange": "this_month"}'::jsonb,
   'Target', 3),
  ('Smart View Monitor', 'Track lead counts across selected smart views', 'leads', 'smart_view_monitor',
   '{"smartViewIds": [], "statusIds": [], "dateRange": "this_month"}'::jsonb,
   'Eye', 4),
  ('Pipeline Overview', 'Active opportunity pipeline summary', 'pipeline', 'opportunity_summary',
   '{"statusType": "active"}'::jsonb,
   'TrendingUp', 5),
  ('Won Deals This Month', 'Deals closed-won this month', 'pipeline', 'stat_card',
   '{"metric": "opportunity_won", "dateRange": "this_month", "comparison": "previous_period"}'::jsonb,
   'Trophy', 6),
  ('Call Volume', 'Daily call activity over time', 'activity', 'activity_timeline',
   '{"activityTypes": ["call"], "timeBucket": "day", "dateRange": "this_week"}'::jsonb,
   'Phone', 7),
  ('Email + SMS Activity', 'Outbound messaging volume over time', 'activity', 'activity_timeline',
   '{"activityTypes": ["email", "sms"], "timeBucket": "day", "dateRange": "this_week"}'::jsonb,
   'Mail', 8),
  ('Lead to Sold Speed', 'Average time from lead creation to sale', 'lifecycle', 'lifecycle_tracker',
   '{"fromStatus": "New", "toStatus": null, "dateRange": "this_month"}'::jsonb,
   'Timer', 9),
  ('Cross-Reference Matrix', 'Smart view rows vs status columns', 'leads', 'cross_reference',
   '{"smartViewIds": [], "statusIds": [], "dateRange": "this_month"}'::jsonb,
   'Grid3X3', 10),
  ('Week over Week Leads', 'Compare lead counts across weeks', 'leads', 'stat_card',
   '{"metric": "lead_count", "dateRange": "this_week", "comparison": "previous_period"}'::jsonb,
   'ArrowUpDown', 11);

-- ─── Updated_at triggers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_close_kpi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_close_kpi_dashboards_updated
  BEFORE UPDATE ON close_kpi_dashboards
  FOR EACH ROW EXECUTE FUNCTION update_close_kpi_updated_at();

CREATE TRIGGER trg_close_kpi_widgets_updated
  BEFORE UPDATE ON close_kpi_widgets
  FOR EACH ROW EXECUTE FUNCTION update_close_kpi_updated_at();
