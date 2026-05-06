-- ============================================================================
-- Fix: Agency-wide training assignments invisible to non-staff users
-- ============================================================================
-- BUG:
--   Original SELECT policy on training_assignments only allowed:
--     1) assigned_to = auth.uid()  (individual)
--     2) staff in same imo
--   Agency-wide rows have assigned_to = NULL, so non-staff agents in the
--   target agency could never see them. Result: "Assign to Entire Agency"
--   silently produced rows that no agent could see on their My Training page.
--
-- FIX:
--   Add a third clause to the SELECT policy: a user can see an assignment
--   row when assigned_to IS NULL AND assignment_type = 'agency' AND the
--   row's agency_id matches the user's agency_id.
-- ============================================================================

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
    -- Training hub staff see every assignment in their IMO
    imo_id = (SELECT imo_id FROM user_profiles WHERE id = (SELECT auth.uid()))
    AND is_training_hub_staff((SELECT auth.uid()))
  )
);
