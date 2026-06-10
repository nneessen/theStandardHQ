-- Contracting Hub — read RPCs for non-staff uplines
--
-- carrier_contracts RLS is own-row + same-IMO staff only, so a plain upline (audience =
-- all approved agents) cannot directly SELECT a downline's contracts or other agents'
-- approved contracts. These SECURITY DEFINER reads expose exactly what the hub needs,
-- scoped by is_upline_of / get_my_imo_id, denormalized so the UI is trivial.

BEGIN;

-- All carrier contracts across the caller's downline subtree (roster + per-agent detail).
CREATE OR REPLACE FUNCTION public.get_my_downline_contracts()
RETURNS TABLE (
  agent_id uuid, agent_name text, contract_level integer,
  carrier_id uuid, carrier_name text, status text, writing_number text,
  requested_date date, submitted_date date, approved_date date, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cc.agent_id,
         COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email),
         up.contract_level,
         cc.carrier_id, c.name::text, cc.status, cc.writing_number,
         cc.requested_date, cc.submitted_date, cc.approved_date, cc.updated_at
  FROM carrier_contracts cc
  JOIN user_profiles up ON up.id = cc.agent_id
  JOIN carriers c ON c.id = cc.carrier_id
  WHERE is_upline_of(cc.agent_id)
  ORDER BY up.last_name, up.first_name, c.name;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_downline_contracts() TO authenticated;

-- Valid alternate-sponsor candidates for a carrier: same-IMO agents approved for it that
-- outrank the caller, excluding the caller, their downline, and their normal upline.
CREATE OR REPLACE FUNCTION public.get_eligible_sponsors(p_carrier_id uuid)
RETURNS TABLE (agent_id uuid, agent_name text, contract_level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT up.id,
         COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email),
         up.contract_level
  FROM carrier_contracts cc
  JOIN user_profiles up ON up.id = cc.agent_id
  WHERE cc.carrier_id = p_carrier_id
    AND cc.status = 'approved'
    AND up.imo_id = (SELECT get_my_imo_id())
    AND up.id <> auth.uid()
    AND up.id IS DISTINCT FROM (SELECT upline_id FROM user_profiles WHERE id = auth.uid())
    AND up.contract_level > (SELECT contract_level FROM user_profiles WHERE id = auth.uid())
    AND NOT is_upline_of(up.id)
  ORDER BY up.contract_level DESC, up.last_name, up.first_name;
$$;
GRANT EXECUTE ON FUNCTION public.get_eligible_sponsors(uuid) TO authenticated;

-- Sponsorship requests awaiting the caller's approval (as sponsor or sponsor's upline).
CREATE OR REPLACE FUNCTION public.get_my_sponsorship_inbox()
RETURNS TABLE (
  id uuid, requesting_agent_id uuid, requester_name text,
  carrier_id uuid, carrier_name text,
  alternate_sponsor_id uuid, sponsor_name text,
  overall_status text, sponsor_approval_status text, sponsor_upline_approval_status text,
  reason text, my_step text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT csr.id, csr.requesting_agent_id,
         COALESCE(NULLIF(CONCAT_WS(' ', req.first_name, req.last_name), ''), req.email),
         csr.carrier_id, c.name::text,
         csr.alternate_sponsor_id,
         COALESCE(NULLIF(CONCAT_WS(' ', spo.first_name, spo.last_name), ''), spo.email),
         csr.overall_status, csr.sponsor_approval_status, csr.sponsor_upline_approval_status,
         csr.reason,
         CASE WHEN csr.overall_status = 'pending_sponsor' AND csr.alternate_sponsor_id = auth.uid() THEN 'sponsor'
              WHEN csr.overall_status = 'pending_sponsor_upline' AND csr.alternate_sponsor_upline_id = auth.uid() THEN 'sponsor_upline'
         END,
         csr.created_at
  FROM carrier_sponsorship_requests csr
  JOIN carriers c ON c.id = csr.carrier_id
  JOIN user_profiles req ON req.id = csr.requesting_agent_id
  JOIN user_profiles spo ON spo.id = csr.alternate_sponsor_id
  WHERE (csr.overall_status = 'pending_sponsor' AND csr.alternate_sponsor_id = auth.uid())
     OR (csr.overall_status = 'pending_sponsor_upline' AND csr.alternate_sponsor_upline_id = auth.uid())
  ORDER BY csr.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_sponsorship_inbox() TO authenticated;

-- The caller's own outgoing sponsorship requests.
CREATE OR REPLACE FUNCTION public.get_my_sponsorships()
RETURNS TABLE (
  id uuid, carrier_id uuid, carrier_name text,
  alternate_sponsor_id uuid, sponsor_name text,
  overall_status text, sponsor_approval_status text, sponsor_upline_approval_status text,
  reason text, created_at timestamptz, approved_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT csr.id, csr.carrier_id, c.name::text,
         csr.alternate_sponsor_id,
         COALESCE(NULLIF(CONCAT_WS(' ', spo.first_name, spo.last_name), ''), spo.email),
         csr.overall_status, csr.sponsor_approval_status, csr.sponsor_upline_approval_status,
         csr.reason, csr.created_at, csr.approved_at
  FROM carrier_sponsorship_requests csr
  JOIN carriers c ON c.id = csr.carrier_id
  JOIN user_profiles spo ON spo.id = csr.alternate_sponsor_id
  WHERE csr.requesting_agent_id = auth.uid()
  ORDER BY csr.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_sponsorships() TO authenticated;

INSERT INTO supabase_migrations.function_versions (function_name, current_version) VALUES
  ('get_my_downline_contracts', '20260609211703'),
  ('get_eligible_sponsors', '20260609211703'),
  ('get_my_sponsorship_inbox', '20260609211703'),
  ('get_my_sponsorships', '20260609211703')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
