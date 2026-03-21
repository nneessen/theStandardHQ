-- Prevent duplicate addon rows per user via UNIQUE constraint.
-- Fixes TOCTOU race in start_voice_trial where concurrent SELECT-then-INSERT
-- could create two rows for the same (user_id, addon_id) pair.

BEGIN;

-- Add unique constraint. Use IF NOT EXISTS via DO block for idempotency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_user_subscription_addons_user_addon'
  ) THEN
    ALTER TABLE user_subscription_addons
      ADD CONSTRAINT uq_user_subscription_addons_user_addon
      UNIQUE (user_id, addon_id);
  END IF;
END $$;

COMMIT;
