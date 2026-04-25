-- supabase/migrations/20260424181319_uplines_delete_recruits_and_agents.sql
-- Allow direct uplines/recruiters to delete their own downlines whose role is
-- 'recruit' OR 'agent', without requiring super-admin.
--
-- Two layers updated:
--   1. RLS DELETE policies on user_profiles — accept 'recruit' OR 'agent'
--      (defense-in-depth; the RPC below is SECURITY DEFINER and bypasses RLS,
--       but client-side DELETE calls still hit the policies).
--   2. admin_deleteuser() — widen permission check to allow upline/recruiter
--      callers in addition to admins/staff. Cascade body unchanged.
--
-- Supersedes the recruit-only behavior introduced in:
--   20260209184757_allow_uplines_delete_recruits.sql
--   20260220135022_allow_staff_delete_recruits.sql

-- ─────────────────────────────────────────────────────────────
-- 1. RLS POLICIES
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Uplines can delete own recruits" ON public.user_profiles;
DROP POLICY IF EXISTS "Recruiters can delete own recruits" ON public.user_profiles;
DROP POLICY IF EXISTS "Uplines can delete own recruits or agents" ON public.user_profiles;
DROP POLICY IF EXISTS "Recruiters can delete own recruits or agents" ON public.user_profiles;

CREATE POLICY "Uplines can delete own recruits or agents"
  ON public.user_profiles FOR DELETE
  USING (
    auth.uid() = upline_id
    AND COALESCE(roles, ARRAY[]::text[]) && ARRAY['recruit', 'agent']::text[]
  );

CREATE POLICY "Recruiters can delete own recruits or agents"
  ON public.user_profiles FOR DELETE
  USING (
    auth.uid() = recruiter_id
    AND COALESCE(roles, ARRAY[]::text[]) && ARRAY['recruit', 'agent']::text[]
  );

-- ─────────────────────────────────────────────────────────────
-- 2. admin_deleteuser() — widened permission check
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_deleteuser(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_is_admin boolean;
  v_caller_roles text[];
  v_is_staff boolean;
  v_target_roles text[];
  v_target_upline_id uuid;
  v_target_recruiter_id uuid;
  v_is_target_upline boolean;
  v_auth_user_id uuid;
  v_user_email text;
  v_result jsonb;
  v_deleted_count int := 0;
  v_table_counts jsonb := '{}';
BEGIN
  -- Caller flags
  SELECT is_admin, roles INTO v_is_admin, v_caller_roles
  FROM user_profiles
  WHERE id = auth.uid();

  v_is_staff := COALESCE(v_caller_roles, ARRAY[]::text[]) && ARRAY['trainer', 'contracting_manager'];

  -- Target lookup (used by both permission check and cascade)
  SELECT roles, upline_id, recruiter_id
    INTO v_target_roles, v_target_upline_id, v_target_recruiter_id
  FROM user_profiles
  WHERE id = target_user_id;

  -- Direct upline/recruiter of a recruit-or-agent target
  v_is_target_upline := (
    (v_target_upline_id = auth.uid() OR v_target_recruiter_id = auth.uid())
    AND COALESCE(v_target_roles, ARRAY[]::text[]) && ARRAY['recruit', 'agent']::text[]
  );

  -- Authorization: admin OR staff(recruit-only) OR direct upline/recruiter(recruit-or-agent)
  IF COALESCE(v_is_admin, false) THEN
    -- allowed
    NULL;
  ELSIF COALESCE(v_is_target_upline, false) THEN
    -- allowed
    NULL;
  ELSIF COALESCE(v_is_staff, false) THEN
    IF NOT ('recruit' = ANY(COALESCE(v_target_roles, ARRAY[]::text[]))) THEN
      RAISE EXCEPTION 'Staff can only delete recruit users';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized to delete this user';
  END IF;

  -- Verify target user exists AND get the auth user_id and email
  SELECT id, email INTO v_auth_user_id, v_user_email
  FROM user_profiles
  WHERE id = target_user_id;

  IF v_auth_user_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
      v_auth_user_id := target_user_id;
      SELECT email INTO v_user_email FROM auth.users WHERE id = target_user_id;
    ELSE
      RAISE EXCEPTION 'User % not found', target_user_id;
    END IF;
  END IF;

  -- ─── Cascade cleanup (children before parents) ────────────────
  -- Body identical to 20260220135022. Any change here must also update
  -- the next admin_deleteuser migration.

  -- RECRUIT INVITATIONS
  DELETE FROM recruit_invitations
  WHERE recruit_id = target_user_id
     OR (recruit_id IS NULL AND email = v_user_email)
     OR inviter_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('recruit_invitations', v_deleted_count);

  -- Workflow related
  DELETE FROM workflow_email_tracking WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('workflow_email_tracking', v_deleted_count);

  DELETE FROM workflow_rate_limits WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('workflow_rate_limits', v_deleted_count);

  -- Activity and audit logs
  DELETE FROM user_activity_log WHERE user_id = target_user_id OR performed_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('user_activity_log', v_deleted_count);

  DELETE FROM system_audit_log WHERE performed_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('system_audit_log', v_deleted_count);

  -- Documents and files
  DELETE FROM user_documents WHERE user_id = target_user_id OR uploaded_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('user_documents', v_deleted_count);

  -- Email related
  DELETE FROM user_emails WHERE user_id = target_user_id OR sender_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('user_emails', v_deleted_count);

  DELETE FROM user_email_oauth_tokens WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('user_email_oauth_tokens', v_deleted_count);

  DELETE FROM email_watch_subscriptions WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('email_watch_subscriptions', v_deleted_count);

  DELETE FROM email_quota_tracking WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('email_quota_tracking', v_deleted_count);

  DELETE FROM email_queue WHERE recipient_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('email_queue', v_deleted_count);

  DELETE FROM email_triggers WHERE created_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('email_triggers', v_deleted_count);

  DELETE FROM email_templates WHERE created_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('email_templates', v_deleted_count);

  -- Messaging
  DELETE FROM messages WHERE sender_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('messages', v_deleted_count);

  DELETE FROM message_threads WHERE created_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('message_threads', v_deleted_count);

  -- Notifications
  DELETE FROM notifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('notifications', v_deleted_count);

  -- Recruiting progress
  DELETE FROM recruit_checklist_progress
  WHERE user_id = target_user_id
     OR completed_by = target_user_id
     OR verified_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('recruit_checklist_progress', v_deleted_count);

  DELETE FROM recruit_phase_progress WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('recruit_phase_progress', v_deleted_count);

  DELETE FROM onboarding_phases WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('onboarding_phases', v_deleted_count);

  -- Hierarchy
  DELETE FROM hierarchy_invitations
  WHERE inviter_id = target_user_id
     OR invitee_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('hierarchy_invitations', v_deleted_count);

  -- Commissions
  DELETE FROM override_commissions
  WHERE base_agent_id = target_user_id
     OR override_agent_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('override_commissions', v_deleted_count);

  DELETE FROM commissions WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('commissions', v_deleted_count);

  -- Policies and clients
  DELETE FROM policies WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('policies', v_deleted_count);

  DELETE FROM clients WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('clients', v_deleted_count);

  -- Expenses (note: expense_categories table doesn't exist)
  DELETE FROM expenses WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('expenses', v_deleted_count);

  DELETE FROM expense_templates WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('expense_templates', v_deleted_count);

  -- User settings and targets
  DELETE FROM settings WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('settings', v_deleted_count);

  DELETE FROM user_targets WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('user_targets', v_deleted_count);

  -- Pipeline templates
  DELETE FROM pipeline_templates WHERE created_by = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('pipeline_templates', v_deleted_count);

  -- Handle user_profiles self-references
  UPDATE user_profiles SET recruiter_id = NULL WHERE recruiter_id = target_user_id;
  UPDATE user_profiles SET upline_id = NULL WHERE upline_id = target_user_id;
  UPDATE user_profiles SET archived_by = NULL WHERE archived_by = target_user_id;

  -- Delete the user profile
  DELETE FROM user_profiles WHERE id = target_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('user_profiles', v_deleted_count);

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = v_auth_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_table_counts := v_table_counts || jsonb_build_object('auth_users', v_deleted_count);

  v_result := jsonb_build_object(
    'success', true,
    'profile_id', target_user_id,
    'auth_user_id', v_auth_user_id,
    'email', v_user_email,
    'deleted_from_tables', v_table_counts,
    'message', 'User and all related data successfully deleted'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting user: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;
