-- Contracting Hub — set_carrier_contract_status RPC
--
-- Agent-centric status writes on carrier_contracts for the new /contracting hub.
-- Authorization split:
--   approved | denied | terminated  → upline / same-IMO staff / super-admin only
--                                      (these are carrier decisions, surfaced by the upline)
--   submitted | pending             → the agent themselves (self-request, gated by the same
--                                      direct-upline eligibility rule as check_upline_carrier_contract)
--                                      OR upline / staff / super-admin
-- Validates carrier ∈ agent IMO and a closed status vocabulary. Server-stamps dates.
-- Does NOT reopen agent direct-write RLS (removed in 20260223121512) and does NOT
-- overload the self-service toggle_agent_carrier_contract (which keeps its approve/terminate shape).

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
  v_direct_upline  UUID;
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

  -- Authorization by target status
  IF p_status IN ('approved','denied','terminated') THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Access denied: only an upline or contracting staff can set status %', p_status;
    END IF;
  ELSE
    -- pending | submitted
    IF NOT (v_is_self OR v_is_manager) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;

    -- Self-initiated NEW request must satisfy the direct-upline eligibility rule
    -- (mirrors check_upline_carrier_contract). Advancing an existing row — e.g. one
    -- created by an approved sponsorship — is always allowed for the agent.
    IF v_is_self AND NOT v_is_manager
       AND NOT EXISTS (SELECT 1 FROM carrier_contracts
                       WHERE agent_id = p_agent_id AND carrier_id = p_carrier_id) THEN
      SELECT upline_id INTO v_direct_upline FROM user_profiles WHERE id = p_agent_id;
      IF v_direct_upline IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM carrier_contracts
        WHERE agent_id = v_direct_upline AND carrier_id = p_carrier_id AND status = 'approved'
      ) THEN
        RAISE EXCEPTION 'Not eligible: your upline does not have an approved contract for this carrier'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
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
  'Contracting hub status write on carrier_contracts. approved/denied/terminated require upline/staff/super-admin; submitted/pending allow the agent themselves (eligibility-gated for new requests) or a manager. Server-stamps submitted_date/approved_date; writing_number set only on approved.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('set_carrier_contract_status', '20260609203445')
ON CONFLICT (function_name) DO UPDATE SET
  current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
