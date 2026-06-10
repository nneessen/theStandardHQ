-- Contracting Hub — different-upline ("alternate sponsor") flow
--
-- When an agent cannot contract through their normal upline (6-month wait, carrier
-- denied the upline, etc.) they request to contract under an ALTERNATE SPONSOR.
-- This needs two approvals: the alternate sponsor, then the alternate sponsor's own
-- upline. On full approval the requester gets a pending carrier_contracts row (the
-- otherwise-blocked action) and override_recipient_id is set to the alternate sponsor
-- (owner decision: override rolls up the alternate sponsor's leg — see Phase 2 migration).
--
-- Snapshots (normal_upline_id, alternate_sponsor_upline_id, imo_id) are server-derived,
-- never client-supplied. All writes go through SECURITY DEFINER RPCs; RLS is SELECT-only
-- for the participants so the two approvers see their inbox.

BEGIN;

CREATE TABLE public.carrier_sponsorship_requests (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_agent_id           uuid NOT NULL REFERENCES public.user_profiles(id),
  carrier_id                    uuid NOT NULL REFERENCES public.carriers(id),
  normal_upline_id              uuid,                       -- snapshot of requester.upline_id
  alternate_sponsor_id          uuid NOT NULL REFERENCES public.user_profiles(id),
  alternate_sponsor_upline_id   uuid,                       -- snapshot of sponsor.upline_id (NULL ⇒ single approval)
  sponsor_approval_status       text NOT NULL DEFAULT 'pending',        -- pending | approved | denied
  sponsor_approved_by           uuid,
  sponsor_approved_at           timestamptz,
  sponsor_upline_approval_status text NOT NULL DEFAULT 'pending',       -- pending | approved | denied | skipped
  sponsor_upline_approved_by    uuid,
  sponsor_upline_approved_at    timestamptz,
  overall_status                text NOT NULL DEFAULT 'pending_sponsor',-- pending_sponsor | pending_sponsor_upline | approved | denied | cancelled
  reason                        text,
  override_recipient_id         uuid,                       -- set = alternate_sponsor_id on approval
  approved_at                   timestamptz,                -- overall approval time (used by override prospective rule)
  imo_id                        uuid NOT NULL REFERENCES public.imos(id),  -- snapshot
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- One live request per (agent, carrier); denied/cancelled don't block re-apply.
CREATE UNIQUE INDEX carrier_sponsorship_live_uq
  ON public.carrier_sponsorship_requests (requesting_agent_id, carrier_id)
  WHERE overall_status IN ('pending_sponsor','pending_sponsor_upline');

CREATE INDEX idx_csr_sponsor_inbox        ON public.carrier_sponsorship_requests (alternate_sponsor_id, overall_status);
CREATE INDEX idx_csr_sponsor_upline_inbox ON public.carrier_sponsorship_requests (alternate_sponsor_upline_id, overall_status);
CREATE INDEX idx_csr_requester            ON public.carrier_sponsorship_requests (requesting_agent_id);
CREATE INDEX idx_csr_carrier_approved     ON public.carrier_sponsorship_requests (requesting_agent_id, carrier_id, overall_status);

ALTER TABLE public.carrier_sponsorship_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER carrier_sponsorship_requests_set_updated_at
  BEFORE UPDATE ON public.carrier_sponsorship_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SELECT: requester, the two approvers, same-IMO admin, super-admin. InitPlan-hoisted.
CREATE POLICY csr_select ON public.carrier_sponsorship_requests
  FOR SELECT TO authenticated
  USING (
    requesting_agent_id = (SELECT auth.uid())
    OR alternate_sponsor_id = (SELECT auth.uid())
    OR alternate_sponsor_upline_id = (SELECT auth.uid())
    OR super_admin_in_scope(imo_id)
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
  );

-- Writes happen ONLY through the SECURITY DEFINER RPCs below (no authenticated write policy).

-- Mandatory revocation gate on every new table.
CREATE POLICY revocation_deny ON public.carrier_sponsorship_requests
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

GRANT SELECT ON public.carrier_sponsorship_requests TO authenticated;
GRANT ALL ON public.carrier_sponsorship_requests TO service_role;

COMMENT ON TABLE public.carrier_sponsorship_requests IS
  'Different-upline ("alternate sponsor") contracting requests with a two-approval chain (sponsor → sponsor''s upline). Snapshots server-derived. Writes via create/approve/cancel_sponsorship_request RPCs only.';

-- ════════════════════════════════════════════════════════════════════════════
-- create_sponsorship_request
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

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sponsorship_request(UUID, UUID, TEXT) TO authenticated;
INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('create_sponsorship_request', '20260609203645')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- approve_sponsorship_request  (caller must be the currently-awaited approver)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_sponsorship_request(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS public.carrier_sponsorship_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_req           public.carrier_sponsorship_requests;
  v_now           TIMESTAMPTZ := now();
  v_sponsor_level INTEGER;
  v_req_level     INTEGER;
  v_final         BOOLEAN := false;
  v_carrier_name  TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM carrier_sponsorship_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.overall_status NOT IN ('pending_sponsor','pending_sponsor_upline') THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  -- enforce the awaited approver
  IF v_req.overall_status = 'pending_sponsor' AND v_caller <> v_req.alternate_sponsor_id THEN
    RAISE EXCEPTION 'Only the alternate sponsor can act on this step';
  ELSIF v_req.overall_status = 'pending_sponsor_upline' AND v_caller <> v_req.alternate_sponsor_upline_id THEN
    RAISE EXCEPTION 'Only the alternate sponsor''s upline can act on this step';
  END IF;

  -- DENY (terminal)
  IF NOT p_approve THEN
    IF v_req.overall_status = 'pending_sponsor' THEN
      UPDATE carrier_sponsorship_requests SET
        sponsor_approval_status = 'denied', sponsor_approved_by = v_caller, sponsor_approved_at = v_now,
        overall_status = 'denied', updated_at = v_now
      WHERE id = p_request_id RETURNING * INTO v_req;
    ELSE
      UPDATE carrier_sponsorship_requests SET
        sponsor_upline_approval_status = 'denied', sponsor_upline_approved_by = v_caller, sponsor_upline_approved_at = v_now,
        overall_status = 'denied', updated_at = v_now
      WHERE id = p_request_id RETURNING * INTO v_req;
    END IF;

    PERFORM create_notification(
      v_req.requesting_agent_id, 'sponsorship_decision',
      'Sponsorship request denied',
      'Your request to contract with ' || (SELECT name FROM carriers WHERE id = v_req.carrier_id)
        || ' under a different upline was denied.',
      jsonb_build_object('sponsorship_id', v_req.id, 'carrier_id', v_req.carrier_id,
                         'decision', 'denied', 'link', '/contracting?tab=mine'),
      NULL
    );
    RETURN v_req;
  END IF;

  -- APPROVE — re-validate sponsor still approved for carrier and still outranks requester
  IF NOT EXISTS (
    SELECT 1 FROM carrier_contracts
    WHERE agent_id = v_req.alternate_sponsor_id AND carrier_id = v_req.carrier_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'The alternate sponsor is no longer approved for this carrier';
  END IF;
  SELECT contract_level INTO v_sponsor_level FROM user_profiles WHERE id = v_req.alternate_sponsor_id;
  SELECT contract_level INTO v_req_level     FROM user_profiles WHERE id = v_req.requesting_agent_id;
  IF v_sponsor_level IS NULL OR v_req_level IS NULL OR v_sponsor_level <= v_req_level THEN
    RAISE EXCEPTION 'The alternate sponsor no longer outranks the requesting agent';
  END IF;

  IF v_req.overall_status = 'pending_sponsor' THEN
    IF v_req.alternate_sponsor_upline_id IS NULL THEN
      v_final := true;  -- single-approval path
      UPDATE carrier_sponsorship_requests SET
        sponsor_approval_status = 'approved', sponsor_approved_by = v_caller, sponsor_approved_at = v_now,
        overall_status = 'approved', approved_at = v_now, override_recipient_id = alternate_sponsor_id,
        updated_at = v_now
      WHERE id = p_request_id RETURNING * INTO v_req;
    ELSE
      UPDATE carrier_sponsorship_requests SET
        sponsor_approval_status = 'approved', sponsor_approved_by = v_caller, sponsor_approved_at = v_now,
        overall_status = 'pending_sponsor_upline', updated_at = v_now
      WHERE id = p_request_id RETURNING * INTO v_req;
    END IF;
  ELSE  -- pending_sponsor_upline → final
    v_final := true;
    UPDATE carrier_sponsorship_requests SET
      sponsor_upline_approval_status = 'approved', sponsor_upline_approved_by = v_caller, sponsor_upline_approved_at = v_now,
      overall_status = 'approved', approved_at = v_now, override_recipient_id = alternate_sponsor_id,
      updated_at = v_now
    WHERE id = p_request_id RETURNING * INTO v_req;
  END IF;

  SELECT name::text INTO v_carrier_name FROM carriers WHERE id = v_req.carrier_id;

  IF v_final THEN
    -- Perform the otherwise-blocked action: give the requester a pending contract row.
    INSERT INTO carrier_contracts (agent_id, carrier_id, status, created_by)
    VALUES (v_req.requesting_agent_id, v_req.carrier_id, 'pending', v_caller)
    ON CONFLICT (agent_id, carrier_id) DO NOTHING;

    PERFORM create_notification(
      v_req.requesting_agent_id, 'sponsorship_decision',
      'Sponsorship approved — you can now contract with ' || COALESCE(v_carrier_name, 'this carrier'),
      'Your request to contract with ' || COALESCE(v_carrier_name, 'this carrier')
        || ' under a different upline was approved. You can now submit your contracting request.',
      jsonb_build_object('sponsorship_id', v_req.id, 'carrier_id', v_req.carrier_id,
                         'decision', 'approved', 'link', '/contracting?tab=mine'),
      NULL
    );
  ELSE
    -- advanced to the sponsor's upline — notify them
    PERFORM create_notification(
      v_req.alternate_sponsor_upline_id, 'sponsorship_request',
      'Sponsorship request awaiting your final approval',
      (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
         FROM user_profiles WHERE id = v_req.requesting_agent_id)
        || ' wants to contract with ' || COALESCE(v_carrier_name, 'a carrier')
        || ' under ' || (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
                          FROM user_profiles WHERE id = v_req.alternate_sponsor_id) || '.',
      jsonb_build_object('sponsorship_id', v_req.id, 'carrier_id', v_req.carrier_id,
                         'link', '/contracting?tab=approvals'),
      NULL
    );
  END IF;

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_sponsorship_request(UUID, BOOLEAN) TO authenticated;
INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('approve_sponsorship_request', '20260609203645')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- cancel_sponsorship_request (requester only, while pending)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cancel_sponsorship_request(p_request_id UUID)
RETURNS public.carrier_sponsorship_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_req    public.carrier_sponsorship_requests;
BEGIN
  SELECT * INTO v_req FROM carrier_sponsorship_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.requesting_agent_id <> v_caller THEN
    RAISE EXCEPTION 'Only the requesting agent can cancel this request';
  END IF;
  IF v_req.overall_status NOT IN ('pending_sponsor','pending_sponsor_upline') THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  UPDATE carrier_sponsorship_requests
  SET overall_status = 'cancelled', updated_at = now()
  WHERE id = p_request_id RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sponsorship_request(UUID) TO authenticated;
INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('cancel_sponsorship_request', '20260609203645')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
