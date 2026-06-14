-- Contracting "held under" — ledger + candidate polish (code-review #6/#7/#8).
--
-- #6 Ledger ignored chargebacks: "owed back" summed override_commission_amount gross.
--    Now nets chargeback_amount (stored positive): amount - COALESCE(chargeback_amount,0).
-- #7 Ledger split one arrangement across the recipient's whole chain (Bob + Bob's uplines),
--    so the "Now goes to" column listed chain members and the per-row figures were confusing.
--    Now grouped by the held_under ARRANGEMENT (redirect_carrier_contract_id) with the
--    counterparty = the person you marked (carrier_contracts.held_under_id) — matching the
--    "Held under" column — and the total = the whole pool redirected off your leg (owner's
--    "all those overrides paid back by Bob"). NOTE: counterparty name reflects the CURRENT
--    held_under on that contract; if the target was later changed, historical rows show the
--    current target (no per-row history is stored — consistent with the Held-under column).
-- #8 get_held_under_candidates returned contract_level (comp tier) over the wire though the
--    picker shows name only. Dropped it from the result (still ordered by level internally).

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- #6 + #7 — reconciliation ledger
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_my_override_redirect_ledger()
RETURNS TABLE (
  agent_id uuid, agent_name text,
  carrier_id uuid, carrier_name text,
  recipient_id uuid, recipient_name text,
  policy_count bigint, total_amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT oc.base_agent_id,
         COALESCE(NULLIF(CONCAT_WS(' ', ag.first_name, ag.last_name), ''), ag.email),
         oc.carrier_id, c.name::text,
         cc.held_under_id,
         COALESCE(NULLIF(CONCAT_WS(' ', hu.first_name, hu.last_name), ''), hu.email,
                  cc.held_under_name, 'a different upline'),
         COUNT(DISTINCT oc.policy_id),
         COALESCE(SUM(oc.override_commission_amount - COALESCE(oc.chargeback_amount, 0)), 0)
  FROM override_commissions oc
  JOIN user_profiles ag ON ag.id = oc.base_agent_id
  JOIN carriers c ON c.id = oc.carrier_id
  LEFT JOIN carrier_contracts cc ON cc.id = oc.redirect_carrier_contract_id
  LEFT JOIN user_profiles hu ON hu.id = cc.held_under_id
  WHERE oc.redirected_from_upline_id = auth.uid()
    AND oc.status <> 'cancelled'
  GROUP BY oc.base_agent_id, ag.first_name, ag.last_name, ag.email,
           oc.carrier_id, c.name,
           cc.held_under_id, hu.first_name, hu.last_name, hu.email, cc.held_under_name
  HAVING COALESCE(SUM(oc.override_commission_amount - COALESCE(oc.chargeback_amount, 0)), 0) <> 0
  ORDER BY ag.last_name, ag.first_name, c.name;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_override_redirect_ledger() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_override_redirect_ledger() FROM anon, PUBLIC;

COMMENT ON FUNCTION public.get_my_override_redirect_ledger IS
'Reconciliation ledger for the bypassed party (redirected_from_upline_id = auth.uid()), grouped by held_under arrangement: agent → carrier → the marked held_under recipient, with policy counts and total $ NET of chargebacks. Zero-net arrangements are hidden.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_my_override_redirect_ledger', '20260613212259')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- #8 — candidate picker no longer exposes contract_level
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_held_under_candidates(uuid);
CREATE OR REPLACE FUNCTION public.get_held_under_candidates(p_agent_id uuid)
RETURNS TABLE (agent_id uuid, agent_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_agent_imo  uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT imo_id INTO v_agent_imo FROM user_profiles WHERE id = p_agent_id;
  IF v_agent_imo IS NULL THEN
    RETURN;  -- unknown agent → empty
  END IF;

  -- Authorization: agent self, their upline, IMO staff, or super-admin.
  IF NOT (
    v_caller = p_agent_id
    OR is_super_admin()
    OR is_upline_of(p_agent_id)
    OR EXISTS (
      SELECT 1 FROM user_profiles caller
      WHERE caller.id = v_caller
        AND caller.imo_id = v_agent_imo
        AND (caller.roles @> ARRAY['trainer']::text[]
             OR caller.roles @> ARRAY['contracting_manager']::text[]
             OR caller.is_admin = true)
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT up.id,
         COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email)
  FROM user_profiles up
  WHERE up.imo_id = v_agent_imo
    AND up.id <> p_agent_id
    -- exclude the agent's own downline (would create an override cycle)
    AND NOT (up.hierarchy_path IS NOT NULL
             AND up.hierarchy_path LIKE '%' || p_agent_id::text || '%')
  ORDER BY up.contract_level DESC NULLS LAST, up.last_name, up.first_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_held_under_candidates(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_held_under_candidates(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_held_under_candidates IS
'Candidate "other uplines" for the held_under picker: same-IMO agents other than the agent, excluding the agent''s own downline (cycle guard). Returns name only (contract_level not exposed). Ordered by level internally. Caller must be the agent, their upline, or IMO staff/super-admin.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_held_under_candidates', '20260613212259')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
