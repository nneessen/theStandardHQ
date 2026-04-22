-- Drop the feature-spotlight popup system.
-- The product decision to stop selling premium plans retired all user-facing
-- spotlight popups; the UI, hooks, service, and admin tooling were removed
-- on 2026-04-22. This migration removes the last remaining artifacts.

-- Child table first (FK to feature_spotlights).
DROP TABLE IF EXISTS public.user_spotlight_views CASCADE;

-- Parent table.
DROP TABLE IF EXISTS public.feature_spotlights CASCADE;

-- Refresh the PostgREST schema cache so regenerated types
-- and API consumers observe the drop immediately.
NOTIFY pgrst, 'reload schema';
