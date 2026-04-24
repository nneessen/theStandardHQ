-- supabase/migrations/20260424065150_backfill_policy_lifecycle_status.sql
-- Backfill lifecycle_status for approved policies where it was silently written as NULL.
--
-- Context:
--   The Feb 4 decoupling migration (20260204141628) split status into two columns:
--     - status:           application outcome (pending / approved / denied / withdrawn)
--     - lifecycle_status: policy state after approval (active / lapsed / cancelled / expired)
--
--   The invariant was: status='approved'  ⇔  lifecycle_status IS NOT NULL.
--
--   In practice, PolicyRepository.transformToDB used `!== undefined` as its
--   guard for writing lifecycle_status, and the form never initialized the
--   field, so every new approved-policy INSERT from the UI omitted the column
--   → DB defaulted to NULL. Result: 342 rows in violation of the invariant
--   as of 2026-04-23 (30.3% of all approved policies).
--
-- Why this matters:
--   Any query filtering `lifecycle_status='active'` silently drops these rows.
--   A previous leaderboard change (20260423191840, since reverted by
--   20260423201058) made this visible by erasing $14,843 of Nick's April IP.
--
-- Backfill logic:
--   We infer the correct lifecycle_status from adjacent columns:
--     cancellation_date IS NOT NULL          → 'cancelled'
--     expiration_date IS NOT NULL
--       AND expiration_date < CURRENT_DATE   → 'expired'
--     otherwise                              → 'active'
--
--   This is conservative. A row with an unset cancellation_date but an actual
--   off-the-books status is out of our detection range; those will be
--   mis-labeled 'active' until a user corrects them via the UI (via lapse/cancel).
--   Acceptable because the alternative (leaving them NULL) silently drops them
--   from any lifecycle-aware query.
--
-- Paired with:
--   - PolicyRepository.transformToDB now defaults 'active' on create when
--     status='approved' and lifecycleStatus is undefined.
--   - usePolicyForm initializes lifecycleStatus and auto-sets 'active' on
--     status-flip-to-approved.
--   - Follow-up migration 20260424065151 adds a CHECK constraint to make this
--     invariant un-violable from any write path.

DO $$
DECLARE
  pre_count   integer;
  post_count  integer;
  active_set  integer;
  cancelled_set integer;
  expired_set integer;
BEGIN
  SELECT COUNT(*) INTO pre_count
  FROM policies
  WHERE status = 'approved' AND lifecycle_status IS NULL;

  RAISE NOTICE 'Pre-backfill: % approved policies with NULL lifecycle_status', pre_count;

  UPDATE policies
  SET lifecycle_status = CASE
    WHEN cancellation_date IS NOT NULL THEN 'cancelled'
    WHEN expiration_date  IS NOT NULL
         AND expiration_date < CURRENT_DATE THEN 'expired'
    ELSE 'active'
  END
  WHERE status = 'approved'
    AND lifecycle_status IS NULL;

  -- Post-check: verify the set is now empty
  SELECT COUNT(*) INTO post_count
  FROM policies
  WHERE status = 'approved' AND lifecycle_status IS NULL;

  -- Breakdown of what we just wrote
  SELECT
    COUNT(*) FILTER (WHERE lifecycle_status = 'active'),
    COUNT(*) FILTER (WHERE lifecycle_status = 'cancelled'),
    COUNT(*) FILTER (WHERE lifecycle_status = 'expired')
  INTO active_set, cancelled_set, expired_set
  FROM policies
  WHERE status = 'approved';

  RAISE NOTICE 'Post-backfill: % approved policies with NULL lifecycle_status (should be 0)', post_count;
  RAISE NOTICE 'Current approved distribution: active=%, cancelled=%, expired=% (lapsed preserved from prior state)', active_set, cancelled_set, expired_set;

  IF post_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows still violate the invariant', post_count;
  END IF;
END
$$;
