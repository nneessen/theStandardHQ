-- ============================================================================
-- Fix: Training assignments invisible to users in sub-agencies of an IMO
-- ============================================================================
-- BUG (followup to 20260506124638_fix_agency_assignment_visibility.sql):
--   The previous fix added an OR clause for agency-wide assignments, but it
--   only matches when the user's agency_id equals the assignment's agency_id.
--   In production, multiple sub-agencies live under one IMO (The Standard).
--   All 9 carrier-training assignments target agency_id =
--   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' (The Standard's main agency), so
--   any user in a sub-agency under the same IMO sees ZERO assignments.
--   Only the super-admin sees them, via is_training_hub_staff().
--
-- FIX:
--   1) Add an 'imo' assignment_type. RLS allows visibility when the row's
--      imo_id matches the user's imo_id, regardless of sub-agency.
--   2) Add a CHECK constraint to lock assignment_type to a known vocabulary
--      so future seeds cannot silently break visibility with a typo.
--   3) Promote the 9 existing carrier-training assignments from 'agency' to
--      'imo' so they become visible to every user in The Standard IMO.
-- ============================================================================

-- (a) Replace the SELECT policy on training_assignments with a 4-clause version
DROP POLICY IF EXISTS "Users can view their own assignments" ON training_assignments;

CREATE POLICY "Users can view their own assignments"
ON training_assignments FOR SELECT TO authenticated
USING (
  -- Individual assignment targeted at this user
  assigned_to = (SELECT auth.uid())
  OR (
    -- Agency-wide assignment in the user's agency
    assigned_to IS NULL
    AND assignment_type = 'agency'
    AND agency_id = (SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid()))
  )
  OR (
    -- IMO-wide assignment visible to every user in the IMO
    assigned_to IS NULL
    AND assignment_type = 'imo'
    AND imo_id = (SELECT imo_id FROM user_profiles WHERE id = (SELECT auth.uid()))
  )
  OR (
    -- Training hub staff see every assignment in their IMO
    imo_id = (SELECT imo_id FROM user_profiles WHERE id = (SELECT auth.uid()))
    AND is_training_hub_staff((SELECT auth.uid()))
  )
);

-- (b) Lock assignment_type to a known vocabulary
ALTER TABLE training_assignments
  DROP CONSTRAINT IF EXISTS training_assignments_assignment_type_check;
ALTER TABLE training_assignments
  ADD CONSTRAINT training_assignments_assignment_type_check
  CHECK (assignment_type IN ('individual', 'agency', 'imo'));

-- (c) Promote IMO-wide carrier-training assignments to the new 'imo' scope.
--     Targets the 9 currently-broken rows (all under The Standard IMO,
--     all assigned_to IS NULL, all assignment_type = 'agency').
UPDATE training_assignments
SET assignment_type = 'imo'
WHERE assignment_type = 'agency'
  AND assigned_to IS NULL
  AND module_id IN (
    SELECT id FROM training_modules
    WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  );
