-- Generalize Close KPI cache entries so prebuilt rollups can be cached
-- without creating synthetic dashboard/widget rows.

ALTER TABLE close_kpi_cache
  ADD COLUMN IF NOT EXISTS resource_scope TEXT NOT NULL DEFAULT 'widget',
  ADD COLUMN IF NOT EXISTS resource_key TEXT;

UPDATE close_kpi_cache
SET resource_key = widget_id::text
WHERE resource_key IS NULL;

ALTER TABLE close_kpi_cache
  ALTER COLUMN resource_key SET NOT NULL;

ALTER TABLE close_kpi_cache
  ALTER COLUMN widget_id DROP NOT NULL;

ALTER TABLE close_kpi_cache
  DROP CONSTRAINT IF EXISTS close_kpi_cache_widget_id_cache_key_key;

ALTER TABLE close_kpi_cache
  ADD CONSTRAINT close_kpi_cache_user_id_resource_scope_resource_key_cache_key_key
  UNIQUE (user_id, resource_scope, resource_key, cache_key);

CREATE INDEX IF NOT EXISTS idx_close_kpi_cache_scope_lookup
  ON close_kpi_cache(user_id, resource_scope, resource_key, expires_at);
