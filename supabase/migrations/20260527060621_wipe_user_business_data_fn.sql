-- ============================================================================
-- wipe_user_business_data(p_user_id, p_reassign_to_user_id)  — IRREVERSIBLE
-- ============================================================================
-- Switch B of the platform-sunset flow: the permanent, per-user data wipe.
-- Invoked by the `confirm-and-wipe-account` edge function (service-role) after
-- the user has downloaded their export bundle and confirmed, and by the day-7
-- auto-purge sweep. This function removes ONLY the user's business data + the
-- profile row. It does NOT touch storage, Stripe, or auth.users — those are the
-- edge function's responsibility (it wraps this call). It does NOT write the
-- account_deletion_log either (the edge fn does, so the row survives the wipe).
--
-- DRIVEN BY THE OWNED-TABLES REGISTRY: the table/column lists below MUST mirror
-- supabase/functions/_shared/owned-tables.ts. The same registry feeds
-- generate-user-export-bundle, so export ⊆ wipe parity holds (a parity test
-- guards drift). If you add an owned table, add it to BOTH the registry and the
-- matching array here.
--
-- WHY THIS IS SEPARATE FROM hard_delete_user: hard_delete_user blocks on
-- downlines, asserts acting scope, and only clears a handful of tables (it
-- predates commissions/policies/etc.). The sunset wipe is whole-account and
-- whole-IMO; downlines on the same revoked IMO are wiped independently. Leaving
-- hard_delete_user untouched preserves its other callers.
--
-- DELETION ORDER (FK-safe, verified empirically against the live catalog):
--   1. NULL the nullable NO-ACTION actor refs (who-created/verified pointers).
--   2. Reassign the NOT-NULL actor refs to the super-admin so shared content
--      (training modules/challenges/assignments, roadmap templates) survives.
--   2.5 Defuse commissions' self-FK (related_advance_id, NO ACTION) by nulling
--      any inbound reference to this user's commissions. A bulk DELETE resolves
--      intra-user links at statement end, but a SURVIVING user's commission
--      pointing at this user's row would raise an FK violation and roll the
--      whole wipe back — so null those first. Belt-and-suspenders for an
--      irreversible op (cross-user links are expected to be rare/impossible).
--   3. DELETE every wipe:"explicit" table by its owner column. Order among these
--      is irrelevant: the only intra-owned NO-ACTION FK is the commissions
--      self-reference defused in 2.5. Every other owned table is CASCADE-only.
--   4. DELETE user_profiles — CASCADE removes every wipe:"cascade" table. All 17
--      NO-ACTION refs to user_profiles are handled in steps 1-2; upline_id and
--      recruiter_id are SET NULL, so downline pointers null harmlessly.
--
-- SAFETY GUARDS (entry): refuses to run unless the target is a non-super-admin
-- whose IMO is revoked, and the reassign target is a distinct super-admin. This
-- makes it impossible to wipe a live Epic Life user or the owner by mistake.
--
-- ATOMIC: plpgsql functions run in the caller's transaction; any mid-wipe error
-- rolls the ENTIRE wipe back — there is no half-wiped user. Idempotent: a second
-- call after the profile is gone returns a noop manifest.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.wipe_user_business_data(
  p_user_id uuid,
  p_reassign_to_user_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  r            record;
  v_n          bigint;
  v_by_table   jsonb := '{}'::jsonb;
  v_nulled     jsonb := '{}'::jsonb;
  v_reassigned jsonb := '{}'::jsonb;
  v_del_total  bigint := 0;
  v_upd_total  bigint := 0;

  -- ACTOR_REFS_TO_NULL (nullable NO-ACTION refs -> SET NULL). Mirrors
  -- owned-tables.ts ACTOR_REFS_TO_NULL.
  c_null_tables text[] := ARRAY[
    'agency_slack_credentials','carrier_contract_requests','carrier_contract_requests',
    'carrier_contracts','chat_bot_team_overrides','recruit_checklist_progress',
    'recruit_checklist_progress','subscription_settings','system_audit_log',
    'training_modules','user_profiles'
  ];
  c_null_cols text[] := ARRAY[
    'created_by','updated_by','created_by',
    'created_by','granted_by','completed_by',
    'verified_by','updated_by','performed_by',
    'updated_by','archived_by'
  ];

  -- ACTOR_REFS_TO_REASSIGN (NOT-NULL refs -> reassign to super-admin). Mirrors
  -- owned-tables.ts ACTOR_REFS_TO_REASSIGN.
  c_reassign_tables text[] := ARRAY[
    'lead_drop_jobs','lead_drop_jobs','roadmap_templates',
    'training_assignments','training_challenges','training_modules'
  ];
  c_reassign_cols text[] := ARRAY[
    'sender_user_id','recipient_user_id','created_by',
    'assigned_by','created_by','created_by'
  ];

  -- wipe:"explicit" tables (no cascade to user_profiles -> must delete here).
  -- Mirrors owned-tables.ts rows with wipe:"explicit" (EXPORTED + WIPE_ONLY).
  c_explicit_tables text[] := ARRAY[
    -- exported
    'policies','clients','commissions','expenses','expense_templates',
    'user_expense_categories','lead_purchases','daily_sales_logs',
    'close_kpi_dashboards','close_kpi_widgets','lead_heat_scores','lead_heat_outcomes',
    'lead_heat_ai_portfolio_analysis','bulk_email_campaigns','custom_domains','recruiting_page_settings',
    -- wipe-only
    'close_ai_generations','close_kpi_cache','email_labels','email_scheduled','email_signatures',
    'email_snippets','email_threads','gmail_integrations','usage_tracking','lead_heat_agent_weights',
    'lead_heat_scoring_runs','lead_heat_status_config','notification_preferences','communication_preferences',
    'contact_favorites','settings','user_slack_preferences','subscription_events','bot_policy_attributions',
    'instagram_integrations','instagram_template_categories','instagram_usage_tracking','instagram_message_templates',
    'recommendation_outcomes','scheduling_integrations','signature_submitters','writing_number_history',
    'user_quick_quote_presets'
  ];
  c_explicit_cols text[] := ARRAY[
    -- exported
    'user_id','user_id','user_id','user_id','user_id',
    'user_id','user_id','first_seller_id',
    'user_id','user_id','user_id','user_id',
    'user_id','user_id','user_id','user_id',
    -- wipe-only
    'user_id','user_id','user_id','user_id','user_id',
    'user_id','user_id','user_id','user_id','user_id',
    'user_id','user_id','user_id','user_id',
    'user_id','user_id','user_id','user_id','user_id',
    'user_id','user_id','user_id','user_id',
    'user_id','user_id','user_id','agent_id',
    'user_id'
  ];
BEGIN
  -- -------------------------------------------------------------------------
  -- Entry guards
  -- -------------------------------------------------------------------------
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'wipe_user_business_data: p_user_id is required';
  END IF;

  -- Idempotent: nothing to do if the profile is already gone.
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'status', 'noop',
      'reason', 'user_not_found',
      'user_id', p_user_id
    );
  END IF;

  -- Never wipe a super-admin (the owner is on the FFG IMO; is_access_revoked
  -- would still pass under service-role since is_super_admin() reads the
  -- session, not p_user_id — so this column check is the real guard).
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND is_super_admin IS TRUE) THEN
    RAISE EXCEPTION 'wipe_user_business_data: refusing to wipe a super-admin (%)', p_user_id;
  END IF;

  -- Only wipe users whose IMO access has been revoked. Prevents ever wiping a
  -- live (e.g. Epic Life) user. Under service-role is_super_admin()=false, so
  -- this reduces to "is p_user_id's IMO revoked".
  IF NOT public.is_access_revoked(p_user_id) THEN
    RAISE EXCEPTION 'wipe_user_business_data: user % is not in a revoked IMO; refusing', p_user_id;
  END IF;

  -- Reassign target must be a distinct super-admin (a stable system user) so
  -- shared content survives without re-pointing at the user being wiped.
  IF p_reassign_to_user_id IS NULL OR p_reassign_to_user_id = p_user_id THEN
    RAISE EXCEPTION 'wipe_user_business_data: p_reassign_to_user_id must be a distinct user';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_reassign_to_user_id AND is_super_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'wipe_user_business_data: p_reassign_to_user_id (%) must be a super-admin', p_reassign_to_user_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 1 — NULL nullable actor refs (unblocks the profile delete)
  -- -------------------------------------------------------------------------
  FOR r IN
    SELECT t AS tbl, c AS col
    FROM unnest(c_null_tables, c_null_cols) AS x(t, c)
  LOOP
    IF to_regclass('public.' || quote_ident(r.tbl)) IS NULL THEN
      RAISE WARNING 'wipe: table public.% not found, skipping NULL of %', r.tbl, r.col;
      CONTINUE;
    END IF;
    EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I = $1', r.tbl, r.col, r.col)
      USING p_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      v_nulled := v_nulled || jsonb_build_object(r.tbl || '.' || r.col, v_n);
      v_upd_total := v_upd_total + v_n;
    END IF;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- Step 2 — Reassign NOT-NULL actor refs to the super-admin
  -- -------------------------------------------------------------------------
  FOR r IN
    SELECT t AS tbl, c AS col
    FROM unnest(c_reassign_tables, c_reassign_cols) AS x(t, c)
  LOOP
    IF to_regclass('public.' || quote_ident(r.tbl)) IS NULL THEN
      RAISE WARNING 'wipe: table public.% not found, skipping reassign of %', r.tbl, r.col;
      CONTINUE;
    END IF;
    EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
      USING p_reassign_to_user_id, p_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      v_reassigned := v_reassigned || jsonb_build_object(r.tbl || '.' || r.col, v_n);
      v_upd_total := v_upd_total + v_n;
    END IF;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- Step 2.5 — Defuse the commissions self-FK (related_advance_id, NO ACTION).
  -- Null every inbound reference to this user's commissions so the bulk DELETE
  -- in Step 3 can never be blocked by a surviving (other-user) commission that
  -- points at one of this user's rows. Rows owned by p_user_id are nulled here
  -- and deleted in Step 3 regardless, so this is always safe.
  -- -------------------------------------------------------------------------
  IF to_regclass('public.commissions') IS NOT NULL THEN
    UPDATE public.commissions
       SET related_advance_id = NULL
     WHERE related_advance_id IN (
       SELECT id FROM public.commissions WHERE user_id = p_user_id
     );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      v_nulled := v_nulled || jsonb_build_object('commissions.related_advance_id', v_n);
      v_upd_total := v_upd_total + v_n;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- Step 3 — DELETE the explicit (non-cascading) owned tables
  -- -------------------------------------------------------------------------
  FOR r IN
    SELECT t AS tbl, c AS col
    FROM unnest(c_explicit_tables, c_explicit_cols) AS x(t, c)
  LOOP
    IF to_regclass('public.' || quote_ident(r.tbl)) IS NULL THEN
      RAISE WARNING 'wipe: table public.% not found, skipping delete', r.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col)
      USING p_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      v_by_table := v_by_table || jsonb_build_object(r.tbl, v_n);
      v_del_total := v_del_total + v_n;
    END IF;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- Step 4 — DELETE the profile (CASCADE clears all wipe:"cascade" tables)
  -- -------------------------------------------------------------------------
  DELETE FROM public.user_profiles WHERE id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_del_total := v_del_total + v_n;
  IF v_n > 0 THEN
    v_by_table := v_by_table || jsonb_build_object('user_profiles', v_n);
  END IF;

  RETURN jsonb_build_object(
    'status', 'wiped',
    'user_id', p_user_id,
    'reassigned_to', p_reassign_to_user_id,
    'rows_deleted_total', v_del_total,
    'rows_updated_total', v_upd_total,
    'by_table', v_by_table,
    'actor_refs', jsonb_build_object('nulled', v_nulled, 'reassigned', v_reassigned),
    'profile_deleted', (v_n > 0),
    'wiped_at', now()
  );
END;
$fn$;

-- Service-role only: the wipe edge function executes as service_role. No
-- authenticated/anon/public access — this is the irreversible switch.
REVOKE ALL ON FUNCTION public.wipe_user_business_data(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wipe_user_business_data(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.wipe_user_business_data(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.wipe_user_business_data(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.wipe_user_business_data(uuid, uuid) IS
  'IRREVERSIBLE per-user business-data wipe for the platform-sunset flow. Driven by the owned-tables registry. Service-role only. Refuses unless target is a non-super-admin in a revoked IMO and the reassign target is a distinct super-admin. Does NOT touch storage/Stripe/auth.users/account_deletion_log (the confirm-and-wipe-account edge fn owns those).';

COMMIT;
