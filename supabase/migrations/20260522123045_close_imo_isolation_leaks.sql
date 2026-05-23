-- Close remaining IMO isolation leaks.
--
-- After Layer 1 (20260521213701) hardened user_profiles/policies/commissions,
-- a full RLS audit (2026-05-22) found additional cross-IMO read paths via:
--   * "Admins can manage all" policies that bypass imo_id
--   * Tables that lack an imo_id column entirely (recruit_invitations)
--   * RLS disabled on a leftover table (message_templates)
--   * Globally-readable closed-data tables (close_webhook_logs)
--
-- Pattern for each table:
--   - Tables WITH imo_id: drop bare is_admin policy, recreate with
--     (imo_id = get_my_imo_id() AND imo_id IS NOT NULL) guard.
--   - Tables WITHOUT imo_id but linked via user_id: drop bare is_admin policy,
--     recreate with EXISTS subquery joining user_profiles.imo_id.
--   - Tables WITHOUT any scope column (recruit_invitations): add imo_id,
--     backfill from inviter, NOT NULL, fix RLS, update RPC.
--   - Tables with RLS off: enable RLS, add reasonable policies.
--
-- Super-admin policies are preserved unchanged so Nick retains cross-IMO
-- visibility.

-- ===========================================================================
-- 1. recruit_invitations: add imo_id column, backfill, NOT NULL, fix RLS.
-- ===========================================================================
ALTER TABLE public.recruit_invitations ADD COLUMN IF NOT EXISTS imo_id uuid REFERENCES public.imos(id);

-- Backfill imo_id from inviter's user_profiles.imo_id.
UPDATE public.recruit_invitations ri
SET imo_id = u.imo_id
FROM public.user_profiles u
WHERE ri.imo_id IS NULL
  AND ri.inviter_id = u.id
  AND u.imo_id IS NOT NULL;

-- Any orphan invitation (no inviter or inviter has no imo) falls back to Founders.
UPDATE public.recruit_invitations
SET imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
WHERE imo_id IS NULL
  AND EXISTS (SELECT 1 FROM public.imos WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);

DO $$
DECLARE v_null int;
BEGIN
  SELECT count(*) INTO v_null FROM public.recruit_invitations WHERE imo_id IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'Cannot backfill recruit_invitations.imo_id: % rows have no inviter and Founders sentinel missing', v_null;
  END IF;
END $$;

ALTER TABLE public.recruit_invitations ALTER COLUMN imo_id SET NOT NULL;

-- Trigger: populate imo_id on INSERT from inviter if not provided.
CREATE OR REPLACE FUNCTION public.set_recruit_invitation_imo_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_inviter_imo uuid;
BEGIN
  IF NEW.imo_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.inviter_id IS NOT NULL THEN
    SELECT imo_id INTO v_inviter_imo FROM public.user_profiles WHERE id = NEW.inviter_id;
  END IF;
  NEW.imo_id := COALESCE(v_inviter_imo, public.get_my_imo_id(), 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
  IF NEW.imo_id IS NULL THEN
    RAISE EXCEPTION 'recruit_invitations requires imo_id' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_recruit_invitation_imo_id ON public.recruit_invitations;
CREATE TRIGGER set_recruit_invitation_imo_id
  BEFORE INSERT ON public.recruit_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_recruit_invitation_imo_id();

-- Fix RLS: drop the leaky "Admins can manage all invitations" policy.
DROP POLICY IF EXISTS "Admins can manage all invitations" ON public.recruit_invitations;
DROP POLICY IF EXISTS "Admins can manage invitations in own IMO" ON public.recruit_invitations;
CREATE POLICY "Admins can manage invitations in own IMO"
  ON public.recruit_invitations FOR ALL TO authenticated
  USING (
    imo_id = public.get_my_imo_id() AND imo_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
  )
  WITH CHECK (
    imo_id = public.get_my_imo_id() AND imo_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
  );

-- Super-admin policy: missing, add explicitly so Nick keeps cross-IMO access.
DROP POLICY IF EXISTS "Super admins can manage all recruit invitations" ON public.recruit_invitations;
DROP POLICY IF EXISTS "Super admins can manage all recruit invitations" ON public.recruit_invitations;
CREATE POLICY "Super admins can manage all recruit invitations"
  ON public.recruit_invitations FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Update create_recruit_invitation RPC to populate imo_id explicitly.
CREATE OR REPLACE FUNCTION public.create_recruit_invitation(p_recruit_id uuid, p_email text, p_message text DEFAULT NULL::text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_inviter_id UUID;
  v_invitation_id UUID;
  v_token UUID;
  v_recruit user_profiles%ROWTYPE;
  v_inviter_imo UUID;
BEGIN
  v_inviter_id := auth.uid();
  IF v_inviter_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized', 'message', 'You must be logged in to send invitations.');
  END IF;

  SELECT * INTO v_recruit FROM user_profiles
   WHERE id = p_recruit_id AND (recruiter_id = v_inviter_id OR upline_id = v_inviter_id);
  IF v_recruit.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_found', 'message', 'Recruit not found or you do not have permission.');
  END IF;

  IF check_pending_invitation_exists(p_email, v_inviter_id) THEN
    RETURN json_build_object('success', false, 'error', 'duplicate', 'message', 'A pending invitation already exists for this email.');
  END IF;

  SELECT imo_id INTO v_inviter_imo FROM user_profiles WHERE id = v_inviter_id;

  v_token := gen_random_uuid();
  INSERT INTO recruit_invitations (recruit_id, inviter_id, invite_token, email, message, status, imo_id)
  VALUES (p_recruit_id, v_inviter_id, v_token, p_email, p_message, 'pending', COALESCE(v_inviter_imo, v_recruit.imo_id))
  RETURNING id INTO v_invitation_id;

  RETURN json_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;

-- ===========================================================================
-- 2. user_emails: replace bare-is_admin policies with imo-scoped equivalents.
-- ===========================================================================
DROP POLICY IF EXISTS user_emails_select_admin ON public.user_emails;
DROP POLICY IF EXISTS user_emails_select_admin ON public.user_emails;
DROP POLICY IF EXISTS user_emails_select_admin ON public.user_emails;
CREATE POLICY user_emails_select_admin ON public.user_emails FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt
                WHERE tgt.id = user_emails.user_id
                  AND tgt.imo_id = public.get_my_imo_id()
                  AND tgt.imo_id IS NOT NULL)
  );

DROP POLICY IF EXISTS user_emails_update_admin ON public.user_emails;
DROP POLICY IF EXISTS user_emails_update_admin ON public.user_emails;
DROP POLICY IF EXISTS user_emails_update_admin ON public.user_emails;
CREATE POLICY user_emails_update_admin ON public.user_emails FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt
                WHERE tgt.id = user_emails.user_id
                  AND tgt.imo_id = public.get_my_imo_id()
                  AND tgt.imo_id IS NOT NULL)
  );

DROP POLICY IF EXISTS user_emails_delete_admin ON public.user_emails;
DROP POLICY IF EXISTS user_emails_delete_admin ON public.user_emails;
DROP POLICY IF EXISTS user_emails_delete_admin ON public.user_emails;
CREATE POLICY user_emails_delete_admin ON public.user_emails FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt
                WHERE tgt.id = user_emails.user_id
                  AND tgt.imo_id = public.get_my_imo_id()
                  AND tgt.imo_id IS NOT NULL)
  );

-- ===========================================================================
-- 3. agent_state_licenses: drop is_admin bypass; keep is_same_agency + upline.
--    Super-admin retains via dedicated policy.
-- ===========================================================================
DROP POLICY IF EXISTS agent_state_licenses_select_policy ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_select_policy ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_select_policy ON public.agent_state_licenses;
CREATE POLICY agent_state_licenses_select_policy ON public.agent_state_licenses FOR SELECT TO authenticated
  USING (
    agent_id = (SELECT auth.uid())
    OR is_same_agency(agent_id)
    OR is_upline_of(agent_id)
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.user_profiles tgt
                  WHERE tgt.id = agent_state_licenses.agent_id
                    AND tgt.imo_id = public.get_my_imo_id()
                    AND tgt.imo_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS agent_state_licenses_update_policy ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_update_policy ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_update_policy ON public.agent_state_licenses;
CREATE POLICY agent_state_licenses_update_policy ON public.agent_state_licenses FOR UPDATE TO authenticated
  USING (
    agent_id = (SELECT auth.uid())
    OR is_upline_of(agent_id)
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.user_profiles tgt
                  WHERE tgt.id = agent_state_licenses.agent_id
                    AND tgt.imo_id = public.get_my_imo_id()
                    AND tgt.imo_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS agent_state_licenses_delete_policy ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_delete_policy ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_delete_policy ON public.agent_state_licenses;
CREATE POLICY agent_state_licenses_delete_policy ON public.agent_state_licenses FOR DELETE TO authenticated
  USING (
    agent_id = (SELECT auth.uid())
    OR is_upline_of(agent_id)
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.user_profiles tgt
                  WHERE tgt.id = agent_state_licenses.agent_id
                    AND tgt.imo_id = public.get_my_imo_id()
                    AND tgt.imo_id IS NOT NULL)
    )
  );

-- Add super_admin policy if not exists
DROP POLICY IF EXISTS agent_state_licenses_super_admin_all ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_super_admin_all ON public.agent_state_licenses;
DROP POLICY IF EXISTS agent_state_licenses_super_admin_all ON public.agent_state_licenses;
CREATE POLICY agent_state_licenses_super_admin_all ON public.agent_state_licenses FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ===========================================================================
-- 4. override_commissions: drop bare-is_admin policies; imo_admin + super_admin already exist.
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can view all override commissions" ON public.override_commissions;
DROP POLICY IF EXISTS "Admins can update override commissions" ON public.override_commissions;
DROP POLICY IF EXISTS "Admins can delete override commissions" ON public.override_commissions;
DROP POLICY IF EXISTS "Admins can insert override commissions" ON public.override_commissions;

-- ===========================================================================
-- 5. workflows / workflow_runs / workflow_events: drop bare-admin policies.
--    Replace with imo-scoped admin via JOIN through workflows.created_by ->
--    user_profiles.imo_id.
-- ===========================================================================
DROP POLICY IF EXISTS "Admins/trainers can view all workflows" ON public.workflows;
DROP POLICY IF EXISTS "Admins/trainers can view workflows in own IMO" ON public.workflows;
DROP POLICY IF EXISTS "Admins/trainers can view workflows in own IMO" ON public.workflows;
CREATE POLICY "Admins/trainers can view workflows in own IMO" ON public.workflows FOR SELECT TO authenticated
  USING (
    public.can_manage_workflows((SELECT auth.uid()))
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can view their workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can view their workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can view their workflows" ON public.workflows;
CREATE POLICY "Users can view their workflows" ON public.workflows FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins/trainers can view all workflow runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Admins/trainers can view workflow runs in own IMO" ON public.workflow_runs;
DROP POLICY IF EXISTS "Admins/trainers can view workflow runs in own IMO" ON public.workflow_runs;
CREATE POLICY "Admins/trainers can view workflow runs in own IMO" ON public.workflow_runs FOR SELECT TO authenticated
  USING (
    public.can_manage_workflows((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.workflows w
      WHERE w.id = workflow_runs.workflow_id
        AND w.imo_id = public.get_my_imo_id()
        AND w.imo_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can view runs of their workflows" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can view runs of their own workflows" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can view runs of their own workflows" ON public.workflow_runs;
CREATE POLICY "Users can view runs of their own workflows" ON public.workflow_runs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.workflows w
            WHERE w.id = workflow_runs.workflow_id AND w.created_by = (SELECT auth.uid()))
  );

-- workflow_events has no user_id/imo_id column. It's a global event log.
-- Restrict to super_admin only — this is a system-level table not user-facing.
DROP POLICY IF EXISTS "Users can view workflow events" ON public.workflow_events;
DROP POLICY IF EXISTS "Super admins can view workflow events" ON public.workflow_events;
DROP POLICY IF EXISTS "Super admins can view workflow events" ON public.workflow_events;
CREATE POLICY "Super admins can view workflow events" ON public.workflow_events FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- ===========================================================================
-- 6. hierarchy_invitations: tighten admin policies.
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can view all invitations" ON public.hierarchy_invitations;
DROP POLICY IF EXISTS "Admins can view invitations in own IMO" ON public.hierarchy_invitations;
DROP POLICY IF EXISTS "Admins can view invitations in own IMO" ON public.hierarchy_invitations;
CREATE POLICY "Admins can view invitations in own IMO" ON public.hierarchy_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND (
      EXISTS (SELECT 1 FROM public.user_profiles inv WHERE inv.id = hierarchy_invitations.inviter_id AND inv.imo_id = public.get_my_imo_id() AND inv.imo_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.user_profiles invitee WHERE invitee.id = hierarchy_invitations.invitee_id AND invitee.imo_id = public.get_my_imo_id() AND invitee.imo_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Admins can update any invitation" ON public.hierarchy_invitations;
DROP POLICY IF EXISTS "Admins can update invitations in own IMO" ON public.hierarchy_invitations;
DROP POLICY IF EXISTS "Admins can update invitations in own IMO" ON public.hierarchy_invitations;
CREATE POLICY "Admins can update invitations in own IMO" ON public.hierarchy_invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND (
      EXISTS (SELECT 1 FROM public.user_profiles inv WHERE inv.id = hierarchy_invitations.inviter_id AND inv.imo_id = public.get_my_imo_id() AND inv.imo_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.user_profiles invitee WHERE invitee.id = hierarchy_invitations.invitee_id AND invitee.imo_id = public.get_my_imo_id() AND invitee.imo_id IS NOT NULL)
    )
  );

-- ===========================================================================
-- 7. email_quota_tracking, email_triggers, workflow_rate_limits,
--    workflow_email_tracking: tighten admin bypasses via user_id join.
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can manage all quotas" ON public.email_quota_tracking;
DROP POLICY IF EXISTS "Admins can manage quotas in own IMO" ON public.email_quota_tracking;
DROP POLICY IF EXISTS "Admins can manage quotas in own IMO" ON public.email_quota_tracking;
CREATE POLICY "Admins can manage quotas in own IMO" ON public.email_quota_tracking FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = email_quota_tracking.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = email_quota_tracking.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  );

-- email_triggers has created_by, not user_id. Join via created_by.
DROP POLICY IF EXISTS "Admins can manage triggers" ON public.email_triggers;
DROP POLICY IF EXISTS "Admins can manage triggers in own IMO" ON public.email_triggers;
DROP POLICY IF EXISTS "Admins can manage triggers in own IMO" ON public.email_triggers;
CREATE POLICY "Admins can manage triggers in own IMO" ON public.email_triggers FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles creator WHERE creator.id = email_triggers.created_by AND creator.imo_id = public.get_my_imo_id() AND creator.imo_id IS NOT NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles creator WHERE creator.id = email_triggers.created_by AND creator.imo_id = public.get_my_imo_id() AND creator.imo_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Admins can manage rate limits" ON public.workflow_rate_limits;
DROP POLICY IF EXISTS "Admins can manage rate limits in own IMO" ON public.workflow_rate_limits;
DROP POLICY IF EXISTS "Admins can manage rate limits in own IMO" ON public.workflow_rate_limits;
CREATE POLICY "Admins can manage rate limits in own IMO" ON public.workflow_rate_limits FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND (
      workflow_rate_limits.user_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = workflow_rate_limits.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND (
      workflow_rate_limits.user_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = workflow_rate_limits.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "View rate limits" ON public.workflow_rate_limits;
DROP POLICY IF EXISTS "View rate limits scoped to own user" ON public.workflow_rate_limits;
DROP POLICY IF EXISTS "View rate limits scoped to own user" ON public.workflow_rate_limits;
CREATE POLICY "View rate limits scoped to own user" ON public.workflow_rate_limits FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can view own email tracking" ON public.workflow_email_tracking;
DROP POLICY IF EXISTS "Users can view own email tracking" ON public.workflow_email_tracking;
DROP POLICY IF EXISTS "Users can view own email tracking" ON public.workflow_email_tracking;
CREATE POLICY "Users can view own email tracking" ON public.workflow_email_tracking FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = workflow_email_tracking.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
    )
  );

-- ===========================================================================
-- 8. usage_tracking, subscription_events, subscription_payments,
--    user_subscriptions: tighten admin bypasses.
-- ===========================================================================
DROP POLICY IF EXISTS usage_tracking_admin_all ON public.usage_tracking;
DROP POLICY IF EXISTS usage_tracking_admin_in_own_imo ON public.usage_tracking;
DROP POLICY IF EXISTS usage_tracking_admin_in_own_imo ON public.usage_tracking;
CREATE POLICY usage_tracking_admin_in_own_imo ON public.usage_tracking FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = usage_tracking.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = usage_tracking.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  );

DROP POLICY IF EXISTS subscription_events_admin_all ON public.subscription_events;
DROP POLICY IF EXISTS subscription_events_admin_in_own_imo ON public.subscription_events;
DROP POLICY IF EXISTS subscription_events_admin_in_own_imo ON public.subscription_events;
CREATE POLICY subscription_events_admin_in_own_imo ON public.subscription_events FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = subscription_events.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = subscription_events.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  );

DROP POLICY IF EXISTS subscription_payments_admin_all ON public.subscription_payments;
DROP POLICY IF EXISTS subscription_payments_admin_in_own_imo ON public.subscription_payments;
DROP POLICY IF EXISTS subscription_payments_admin_in_own_imo ON public.subscription_payments;
CREATE POLICY subscription_payments_admin_in_own_imo ON public.subscription_payments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = subscription_payments.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
    AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = subscription_payments.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
  );

DROP POLICY IF EXISTS user_subscriptions_admin_all ON public.user_subscriptions;
DROP POLICY IF EXISTS user_subscriptions_admin_in_own_imo ON public.user_subscriptions;
DROP POLICY IF EXISTS user_subscriptions_admin_in_own_imo ON public.user_subscriptions;
CREATE POLICY user_subscriptions_admin_in_own_imo ON public.user_subscriptions FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = user_subscriptions.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.user_profiles tgt WHERE tgt.id = user_subscriptions.user_id AND tgt.imo_id = public.get_my_imo_id() AND tgt.imo_id IS NOT NULL)
    )
  );

-- ===========================================================================
-- 9. state_classifications: tighten is_admin bypass.
-- ===========================================================================
DROP POLICY IF EXISTS state_classifications_select_policy ON public.state_classifications;
DROP POLICY IF EXISTS state_classifications_select_policy ON public.state_classifications;
DROP POLICY IF EXISTS state_classifications_select_policy ON public.state_classifications;
CREATE POLICY state_classifications_select_policy ON public.state_classifications FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_profiles up
               WHERE up.id = (SELECT auth.uid())
                 AND up.agency_id = state_classifications.agency_id)
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.agencies a
                  WHERE a.id = state_classifications.agency_id AND a.imo_id = public.get_my_imo_id())
    )
  );

DROP POLICY IF EXISTS state_classifications_update_policy ON public.state_classifications;
DROP POLICY IF EXISTS state_classifications_update_policy ON public.state_classifications;
DROP POLICY IF EXISTS state_classifications_update_policy ON public.state_classifications;
CREATE POLICY state_classifications_update_policy ON public.state_classifications FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_profiles up
               WHERE up.id = (SELECT auth.uid())
                 AND up.agency_id = state_classifications.agency_id)
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.agencies a
                  WHERE a.id = state_classifications.agency_id AND a.imo_id = public.get_my_imo_id())
    )
  );

DROP POLICY IF EXISTS state_classifications_delete_policy ON public.state_classifications;
DROP POLICY IF EXISTS state_classifications_delete_policy ON public.state_classifications;
DROP POLICY IF EXISTS state_classifications_delete_policy ON public.state_classifications;
CREATE POLICY state_classifications_delete_policy ON public.state_classifications FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_profiles up
               WHERE up.id = (SELECT auth.uid())
                 AND up.agency_id = state_classifications.agency_id)
    OR (
      EXISTS (SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid()) AND up.is_admin = true)
      AND EXISTS (SELECT 1 FROM public.agencies a
                  WHERE a.id = state_classifications.agency_id AND a.imo_id = public.get_my_imo_id())
    )
  );

-- ===========================================================================
-- 10. message_templates: this is a VIEW selecting from instagram_message_templates.
--     RLS cannot be applied to views directly. The underlying table has its own
--     SELECT policy. Set security_invoker=true so the view applies the caller's
--     RLS instead of the view owner's superuser bypass (PG 15+ feature).
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='message_templates' AND c.relkind='v') THEN
    EXECUTE 'ALTER VIEW public.message_templates SET (security_invoker = true)';
  END IF;
END $$;

-- ===========================================================================
-- 11. close_webhook_logs (remote only): enable RLS + super_admin only.
--     Existence is conditional — wrap in DO block so local doesn't error.
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname='public' AND c.relname='close_webhook_logs' AND c.relkind='r') THEN
    EXECUTE 'ALTER TABLE public.close_webhook_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS close_webhook_logs_super_admin_all ON public.close_webhook_logs';
    EXECUTE 'CREATE POLICY close_webhook_logs_super_admin_all ON public.close_webhook_logs FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- ===========================================================================
-- 12. phase_checklist_items: drop the bare authenticated-can-read policy.
--     Keep the staff/template-derived policies that already exist.
-- ===========================================================================
DROP POLICY IF EXISTS "Authenticated users can view phase checklist items" ON public.phase_checklist_items;
DROP POLICY IF EXISTS "Authenticated users can update phase checklist items" ON public.phase_checklist_items;
DROP POLICY IF EXISTS "Authenticated users can delete phase checklist items" ON public.phase_checklist_items;
DROP POLICY IF EXISTS "Authenticated users can insert phase checklist items" ON public.phase_checklist_items;

-- Replace SELECT with an imo-scoped variant derived through pipeline_templates.imo_id.
DROP POLICY IF EXISTS phase_checklist_items_select_own_imo ON public.phase_checklist_items;
DROP POLICY IF EXISTS phase_checklist_items_select_own_imo ON public.phase_checklist_items;
CREATE POLICY phase_checklist_items_select_own_imo ON public.phase_checklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pipeline_phases pp
      JOIN public.pipeline_templates pt ON pt.id = pp.template_id
      WHERE pp.id = phase_checklist_items.phase_id
        AND (pt.imo_id = public.get_my_imo_id() OR pt.imo_id IS NULL)
    )
  );
