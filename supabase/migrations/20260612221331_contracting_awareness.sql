-- Contracting Hub — upline awareness (notifications + read surfaces)
--
-- Three additive concerns, all contracts-only (no licensing), direct-upline scoped:
--   A) Notify an agent's DIRECT upline whenever the agent's carrier contract transitions
--      INTO submitted / approved / denied. New SEPARATE trigger (NOT folded into the shipped
--      notify_downline_carrier_eligible — function-version-regression risk).
--   B) Make the agent's DIRECT (bypassed) upline aware when the agent requests to contract
--      under an ALTERNATE sponsor: (1) a notification, (2) RLS so the normal upline can read
--      the request row, (3) a read RPC for the awareness panel.
--   C) get_contracting_activity(): a self-healing, current-state "recent downline activity"
--      read scoped by is_upline_of / super-admin / imo-admin (no history table).
--
-- All notifications go through the existing create_notification(p_user_id,p_type,p_title,
-- p_message,p_metadata,p_expires_at) RPC. Upline-facing deep-links use ?tab=downline
-- (router validateSearch keeps mine|downline; legacy ?tab=approvals resolves to mine).

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- A) notify_upline_contract_status_change
--    AFTER INSERT/UPDATE OF status on carrier_contracts → ping the agent's DIRECT upline.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notify_upline_contract_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        UUID := auth.uid();
  v_upline_id    UUID;
  v_carrier_name TEXT;
  v_agent_name   TEXT;
  v_title        TEXT;
  v_verb         TEXT;
BEGIN
  -- Only meaningful statuses; the alternate-sponsor pending-row INSERT writes 'pending'
  -- and is therefore naturally excluded.
  IF NEW.status NOT IN ('submitted','approved','denied') THEN
    RETURN NEW;
  END IF;
  -- Only a real transition (suppresses writing-number edits that re-set status='approved').
  IF TG_OP = 'UPDATE' AND NOT (OLD.status IS DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT upline_id INTO v_upline_id FROM user_profiles WHERE id = NEW.agent_id;
  IF v_upline_id IS NULL THEN
    RETURN NEW;  -- no direct upline to notify
  END IF;

  -- Don't ping the upline for an action the upline performed themselves
  -- (a self-edit by the agent, or a change by a super-admin, still notifies).
  IF v_actor IS NOT NULL AND v_actor = v_upline_id THEN
    RETURN NEW;
  END IF;

  SELECT c.name::text INTO v_carrier_name FROM carriers c WHERE c.id = NEW.carrier_id;
  SELECT COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email)
    INTO v_agent_name FROM user_profiles up WHERE up.id = NEW.agent_id;

  v_verb := CASE NEW.status
    WHEN 'submitted' THEN 'submitted a contract request for'
    WHEN 'approved'  THEN 'was approved for'
    WHEN 'denied'    THEN 'was denied for'
  END;
  v_title := COALESCE(v_agent_name, 'A downline agent') || CASE NEW.status
    WHEN 'submitted' THEN ' submitted a contract request'
    WHEN 'approved'  THEN ' was approved for a carrier'
    WHEN 'denied'    THEN ' was denied a carrier'
  END;

  PERFORM create_notification(
    v_upline_id,
    'downline_contract_status',
    v_title,
    COALESCE(v_agent_name, 'A downline agent') || ' ' || v_verb || ' '
      || COALESCE(v_carrier_name, 'a carrier') || '.',
    jsonb_build_object(
      'agent_id',       NEW.agent_id,
      'agent_name',     v_agent_name,
      'carrier_id',     NEW.carrier_id,
      'carrier_name',   v_carrier_name,
      'status',         NEW.status,
      'writing_number', NEW.writing_number,
      'link',           '/contracting?tab=downline'
    ),
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_upline_contract_status_change ON public.carrier_contracts;
CREATE TRIGGER trg_notify_upline_contract_status_change
  AFTER INSERT OR UPDATE OF status ON public.carrier_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_upline_contract_status_change();

COMMENT ON FUNCTION public.notify_upline_contract_status_change IS
  'AFTER INSERT/UPDATE trigger on carrier_contracts: on a real transition into submitted/approved/denied, notifies the agent''s DIRECT upline (downline_contract_status). Skips when the actor IS the upline. Separate from notify_downline_carrier_eligible.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('notify_upline_contract_status_change', '20260612221331')
ON CONFLICT (function_name) DO UPDATE SET
  current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- B1) create_sponsorship_request — branched VERBATIM from the shipped body
--     (20260609203645) with ONE addition: notify the requester's bypassed normal upline.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_sponsorship_request(
  p_carrier_id UUID,
  p_alternate_sponsor_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.carrier_sponsorship_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester       UUID := auth.uid();
  v_imo             UUID;
  v_requester_level INTEGER;
  v_normal_upline   UUID;
  v_sponsor_level   INTEGER;
  v_sponsor_upline  UUID;
  v_carrier_imo     UUID;
  v_row             public.carrier_sponsorship_requests;
BEGIN
  IF v_requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_alternate_sponsor_id = v_requester THEN RAISE EXCEPTION 'You cannot sponsor yourself'; END IF;

  SELECT imo_id, contract_level, upline_id
    INTO v_imo, v_requester_level, v_normal_upline
  FROM user_profiles WHERE id = v_requester;
  IF v_imo IS NULL THEN RAISE EXCEPTION 'Requester has no IMO'; END IF;

  IF p_alternate_sponsor_id = v_normal_upline THEN
    RAISE EXCEPTION 'That is already your normal upline — no sponsorship needed';
  END IF;

  -- requester must not be an ancestor of the sponsor (no contracting under your own downline / cycle)
  IF is_upline_of(p_alternate_sponsor_id) THEN
    RAISE EXCEPTION 'You cannot contract under one of your own downline agents';
  END IF;

  SELECT contract_level, upline_id INTO v_sponsor_level, v_sponsor_upline
  FROM user_profiles WHERE id = p_alternate_sponsor_id AND imo_id = v_imo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alternate sponsor not found in your organization'; END IF;

  SELECT imo_id INTO v_carrier_imo FROM carriers WHERE id = p_carrier_id AND is_active = true;
  IF v_carrier_imo IS NULL OR v_carrier_imo <> v_imo THEN
    RAISE EXCEPTION 'Carrier not found, inactive, or outside your organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM carrier_contracts
    WHERE agent_id = p_alternate_sponsor_id AND carrier_id = p_carrier_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'The alternate sponsor is not approved for this carrier';
  END IF;

  IF v_sponsor_level IS NULL OR v_requester_level IS NULL OR v_sponsor_level <= v_requester_level THEN
    RAISE EXCEPTION 'The alternate sponsor''s contract level must be higher than yours';
  END IF;

  BEGIN
    INSERT INTO carrier_sponsorship_requests (
      requesting_agent_id, carrier_id, normal_upline_id,
      alternate_sponsor_id, alternate_sponsor_upline_id,
      sponsor_upline_approval_status, overall_status, reason, imo_id
    ) VALUES (
      v_requester, p_carrier_id, v_normal_upline,
      p_alternate_sponsor_id, v_sponsor_upline,
      CASE WHEN v_sponsor_upline IS NULL THEN 'skipped' ELSE 'pending' END,
      'pending_sponsor', p_reason, v_imo
    )
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have a pending sponsorship request for this carrier';
  END;

  PERFORM create_notification(
    p_alternate_sponsor_id, 'sponsorship_request',
    'Sponsorship request awaiting your approval',
    (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
       FROM user_profiles WHERE id = v_requester)
      || ' wants to contract with '
      || (SELECT name FROM carriers WHERE id = p_carrier_id) || ' under you.',
    jsonb_build_object('sponsorship_id', v_row.id, 'carrier_id', p_carrier_id,
                       'link', '/contracting?tab=approvals'),
    NULL
  );

  -- ADDED 2026-06-12: make the requester's DIRECT (bypassed) upline aware that their
  -- downline is contracting under a different upline.
  IF v_normal_upline IS NOT NULL THEN
    PERFORM create_notification(
      v_normal_upline, 'sponsorship_bypass',
      'A downline is contracting under a different upline',
      (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
         FROM user_profiles WHERE id = v_requester)
        || ' requested to contract with '
        || (SELECT name FROM carriers WHERE id = p_carrier_id)
        || ' under '
        || (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
              FROM user_profiles WHERE id = p_alternate_sponsor_id)
        || ' instead of you.',
      jsonb_build_object('sponsorship_id', v_row.id, 'carrier_id', p_carrier_id,
                         'requesting_agent_id', v_requester,
                         'alternate_sponsor_id', p_alternate_sponsor_id,
                         'link', '/contracting?tab=downline'),
      NULL
    );
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sponsorship_request(UUID, UUID, TEXT) TO authenticated;
INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('create_sponsorship_request', '20260612221331')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- B2) RLS — let the bypassed normal upline read the sponsorship request row.
--     (Verbatim from the shipped csr_select + one added clause.)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS csr_select ON public.carrier_sponsorship_requests;
CREATE POLICY csr_select ON public.carrier_sponsorship_requests
  FOR SELECT TO authenticated
  USING (
    requesting_agent_id = (SELECT auth.uid())
    OR alternate_sponsor_id = (SELECT auth.uid())
    OR alternate_sponsor_upline_id = (SELECT auth.uid())
    OR normal_upline_id = (SELECT auth.uid())
    OR super_admin_in_scope(imo_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- B3) get_downline_sponsorships — alternate-upline arrangements involving my downline
--     (caller = bypassed normal upline) or, for super-admin / imo-admin, the whole IMO.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_downline_sponsorships()
RETURNS TABLE (
  id uuid,
  requesting_agent_id uuid,
  requester_name text,
  carrier_id uuid,
  carrier_name text,
  alternate_sponsor_id uuid,
  sponsor_name text,
  overall_status text,
  reason text,
  created_at timestamptz,
  approved_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    csr.id,
    csr.requesting_agent_id,
    COALESCE(NULLIF(CONCAT_WS(' ', req.first_name, req.last_name), ''), req.email),
    csr.carrier_id,
    c.name::text,
    csr.alternate_sponsor_id,
    COALESCE(NULLIF(CONCAT_WS(' ', spo.first_name, spo.last_name), ''), spo.email),
    csr.overall_status,
    csr.reason,
    csr.created_at,
    csr.approved_at
  FROM carrier_sponsorship_requests csr
  JOIN user_profiles req ON req.id = csr.requesting_agent_id
  JOIN user_profiles spo ON spo.id = csr.alternate_sponsor_id
  JOIN carriers c ON c.id = csr.carrier_id
  WHERE
    is_super_admin()
    OR (is_imo_admin() AND csr.imo_id = get_my_imo_id())
    OR csr.normal_upline_id = auth.uid()
  ORDER BY csr.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_downline_sponsorships() TO authenticated;

COMMENT ON FUNCTION public.get_downline_sponsorships IS
  'Alternate-upline ("sponsorship") arrangements where the caller is the bypassed normal upline; super-admin / imo-admin see the whole IMO. Drives the Downline Activity panel.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_downline_sponsorships', '20260612221331')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- C) get_contracting_activity — current-state "recent downline activity" feed.
--    Scoped: subtree via is_upline_of, OR super-admin / imo-admin whole IMO. No history table.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_contracting_activity(p_limit integer DEFAULT 50)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  upline_id uuid,
  carrier_id uuid,
  carrier_name text,
  status text,
  writing_number text,
  submitted_date date,
  approved_date date,
  updated_at timestamptz,
  activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cc.agent_id,
    COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email),
    up.upline_id,
    cc.carrier_id,
    c.name::text,
    cc.status,
    cc.writing_number,
    cc.submitted_date,
    cc.approved_date,
    cc.updated_at,
    GREATEST(
      cc.updated_at,
      cc.created_at,
      cc.submitted_date::timestamptz,
      cc.approved_date::timestamptz
    )
  FROM carrier_contracts cc
  JOIN user_profiles up ON up.id = cc.agent_id
  JOIN carriers c ON c.id = cc.carrier_id
  WHERE
    is_super_admin()
    OR (is_imo_admin() AND up.imo_id = get_my_imo_id())
    OR is_upline_of(cc.agent_id)
  ORDER BY 11 DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_contracting_activity(integer) TO authenticated;

COMMENT ON FUNCTION public.get_contracting_activity IS
  'Current-state recent contracting activity across the caller''s downline subtree (is_upline_of); super-admin / imo-admin see the whole IMO. Ordered by most-recent change. No history table — derives from carrier_contracts current state.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_contracting_activity', '20260612221331')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
