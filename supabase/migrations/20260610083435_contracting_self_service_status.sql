-- Contracting Hub — self-service status writes (relax set_carrier_contract_status)
--
-- Product decision (Jun 10, 2026): the /contracting page is where an agent manages THEIR
-- OWN carrier contracts end-to-end. Previously approved/denied/terminated were reserved for
-- an upline/staff/super-admin, and a self-initiated NEW request was gated to carriers the
-- direct upline was already approved for. That blocked an agent from recording their own
-- approval + writing number, or adding a carrier directly.
--
-- This migration relaxes the RPC so ANY agent can fully manage their own contracts:
--   * self OR manager may set any valid status on the target row
--   * the self-initiated direct-upline eligibility gate is removed
-- Unchanged: managers keep their downline scope (is_upline_of / staff roles); the
-- carrier-∈-IMO validation stays (no contracting with carriers outside your org); all
-- server-side date / writing_number stamping is identical. No financial logic gates on
-- carrier_contracts.status, so this only relaxes a workflow step, not money.
--
-- ⚠️ Branched verbatim from the CURRENT shipped body (20260609203445) per the
-- function-version-regression lesson — only the authorization block changed.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_carrier_contract_status(
  p_agent_id UUID,
  p_carrier_id UUID,
  p_status TEXT,
  p_writing_number TEXT DEFAULT NULL
)
RETURNS public.carrier_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller         UUID := auth.uid();
  v_is_self        BOOLEAN;
  v_is_manager     BOOLEAN;
  v_agent_imo_id   UUID;
  v_carrier_imo_id UUID;
  v_row            public.carrier_contracts;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('pending','submitted','approved','denied','terminated') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING ERRCODE = 'check_violation';
  END IF;

  -- Agent + IMO
  SELECT up.imo_id INTO v_agent_imo_id FROM user_profiles up WHERE up.id = p_agent_id;
  IF v_agent_imo_id IS NULL THEN
    RAISE EXCEPTION 'Agent not found or has no IMO';
  END IF;

  -- Carrier must belong to the agent's IMO and be active
  SELECT c.imo_id INTO v_carrier_imo_id
  FROM carriers c WHERE c.id = p_carrier_id AND c.is_active = true;
  IF v_carrier_imo_id IS NULL OR v_carrier_imo_id <> v_agent_imo_id THEN
    RAISE EXCEPTION 'Carrier not found, inactive, or outside the agent''s organization';
  END IF;

  v_is_self := (v_caller = p_agent_id);
  v_is_manager := (
    is_super_admin()
    OR is_upline_of(p_agent_id)
    OR EXISTS (
      SELECT 1 FROM user_profiles caller
      WHERE caller.id = v_caller
        AND caller.imo_id = v_agent_imo_id
        AND (caller.roles @> ARRAY['trainer']::text[]
             OR caller.roles @> ARRAY['contracting_manager']::text[]
             OR caller.is_admin = true)
    )
  );

  -- Authorization: an agent manages their own contracts fully (self-service contracting);
  -- a manager manages contracts within their scope (downline / staff). No status-based
  -- restriction and no direct-upline eligibility gate — those were removed Jun 10, 2026.
  IF NOT (v_is_self OR v_is_manager) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO carrier_contracts (
    agent_id, carrier_id, status, writing_number, submitted_date, approved_date, created_by
  )
  VALUES (
    p_agent_id, p_carrier_id, p_status,
    CASE WHEN p_status = 'approved' THEN p_writing_number ELSE NULL END,
    CASE WHEN p_status = 'submitted' THEN CURRENT_DATE ELSE NULL END,
    CASE WHEN p_status = 'approved' THEN CURRENT_DATE ELSE NULL END,
    v_caller
  )
  ON CONFLICT (agent_id, carrier_id) DO UPDATE SET
    status = p_status,
    writing_number = CASE
      WHEN p_status = 'approved' THEN COALESCE(p_writing_number, carrier_contracts.writing_number)
      ELSE carrier_contracts.writing_number
    END,
    submitted_date = CASE
      WHEN p_status = 'submitted' AND carrier_contracts.submitted_date IS NULL THEN CURRENT_DATE
      ELSE carrier_contracts.submitted_date
    END,
    approved_date = CASE
      WHEN p_status = 'approved' THEN COALESCE(carrier_contracts.approved_date, CURRENT_DATE)
      ELSE carrier_contracts.approved_date
    END,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_carrier_contract_status(UUID, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_carrier_contract_status IS
  'Contracting hub status write on carrier_contracts. Self-service: an agent may set any valid status on their own contracts; a manager (upline/staff/super-admin) may manage within scope. Validates carrier ∈ agent IMO. Server-stamps submitted_date/approved_date; writing_number set only on approved. (Self-approval + direct-upline eligibility gate relaxed 20260610.)';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('set_carrier_contract_status', '20260610083435')
ON CONFLICT (function_name) DO UPDATE SET
  current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
