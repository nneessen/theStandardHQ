-- Reversal for supabase/migrations/20260407152751_close_ai_builder_feature.sql
--
-- WARNING: Applying this drops the audit table close_ai_generations. Every
-- generation history row (prompt, output JSON, token counts, close_id
-- linkage) is lost permanently. Rolling back a feature that has already
-- seen production use is destructive. Only run this if:
--   - The feature is being fully removed, AND
--   - The operator has accepted the loss of generation history
--
-- This script does NOT drop the update_close_kpi_updated_at() trigger
-- function because it is shared with other tables.

BEGIN;

-- 1. Drop the audit table (CASCADE removes the trigger and all indexes)
DROP TABLE IF EXISTS close_ai_generations CASCADE;

-- 2. Remove the close_ai_builder feature flag from all subscription plans
UPDATE subscription_plans
SET features = features - 'close_ai_builder'
WHERE features ? 'close_ai_builder';

-- 3. Remove the migration tracking row so a re-apply would re-run cleanly
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260407152751';

COMMIT;

-- Post-revert checklist:
--   1. Regenerate src/types/database.types.ts (the close_ai_generations
--      type will disappear)
--   2. Remove the close_ai_builder entry from
--      src/constants/features.ts:FEATURE_REGISTRY
--   3. Remove "close_ai_builder" from
--      src/hooks/subscription/useOwnerDownlineAccess.ts:OWNER_DOWNLINE_GRANTED_FEATURES
--   4. Remove the close_ai_builder field from
--      src/services/subscription/SubscriptionRepository.ts:SubscriptionFeatures
--   5. Remove default from
--      src/services/subscription/adminSubscriptionService.ts
--   6. Delete src/features/close-ai-builder/ entirely
--   7. Delete supabase/functions/close-ai-builder/ and run
--      `supabase functions delete close-ai-builder --project-ref <ref>`
--   8. Remove the route + sidebar entries from router.tsx and Sidebar.tsx
--   9. Remove display name from
--      src/hooks/subscription/useFeatureAccess.ts:FEATURE_DISPLAY_NAMES
