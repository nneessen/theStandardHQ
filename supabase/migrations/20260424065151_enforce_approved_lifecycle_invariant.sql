-- supabase/migrations/20260424065151_enforce_approved_lifecycle_invariant.sql
-- Add a CHECK constraint enforcing: status='approved' ⇒ lifecycle_status IS NOT NULL.
--
-- This is the belt-and-suspenders companion to the 20260424065150 backfill and
-- the PolicyRepository / usePolicyForm code fixes. With this constraint in
-- place, any future write path (form, edge function, psql session, bulk
-- import, raw INSERT) that violates the invariant will fail loudly at the DB
-- level instead of silently polluting the table.
--
-- The pre-condition (all existing rows satisfy the invariant) is established
-- by the backfill migration applied one second earlier. Re-verifying here
-- before the ALTER to surface the issue immediately if anything slipped.

DO $$
DECLARE
  violators integer;
BEGIN
  SELECT COUNT(*) INTO violators
  FROM policies
  WHERE status = 'approved' AND lifecycle_status IS NULL;

  IF violators > 0 THEN
    RAISE EXCEPTION
      'Cannot add CHECK constraint: % approved policies still have NULL lifecycle_status. '
      'Run the 20260424065150 backfill first.',
      violators;
  END IF;

  RAISE NOTICE 'Pre-check passed: 0 rows violate the invariant. Adding constraint...';
END
$$;

ALTER TABLE policies
  ADD CONSTRAINT policies_approved_has_lifecycle
  CHECK (status != 'approved' OR lifecycle_status IS NOT NULL)
  NOT VALID;

-- NOT VALID means PG doesn't re-scan existing rows (we already verified above).
-- VALIDATE forces that scan now, catching any race rows written between the
-- pre-check and the ALTER. Fast because Postgres re-uses the NOT-VALID
-- constraint's predicate, and we have an index on status.
ALTER TABLE policies
  VALIDATE CONSTRAINT policies_approved_has_lifecycle;

COMMENT ON CONSTRAINT policies_approved_has_lifecycle ON policies IS
  'Invariant: an approved policy must have a non-null lifecycle_status. Enforced Feb-4 decoupling intent that was silently violated until 2026-04-24.';
