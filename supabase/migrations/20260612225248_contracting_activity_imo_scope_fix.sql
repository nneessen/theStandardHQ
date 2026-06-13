-- Contracting awareness — IMO-scope the super-admin branch of the two new read RPCs.
--
-- BUG (caught in review): get_contracting_activity / get_downline_sponsorships gated the
-- super-admin branch on BARE is_super_admin() (global), so a super-admin (the owner) would
-- see contracting activity/sponsorships from EVERY IMO in the Downline Activity panel, while
-- every other panel on the same page (Newly Eligible, My Contracting, getCarriers) honors the
-- acting IMO via get_effective_imo_id(). That is cross-IMO bleed and self-inconsistent.
--
-- FIX: mirror the csr_select RLS policy on the same table — use super_admin_in_scope(imo_id)
-- (= is_super_admin() AND (effective IS NULL "see-all" OR row.imo = effective)) plus the
-- imo-admin branch (is_imo_admin() AND imo = get_my_imo_id()). The is_upline_of /
-- normal_upline_id branches are intrinsically intra-IMO and unchanged.

BEGIN;

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
    super_admin_in_scope(up.imo_id)
    OR (is_imo_admin() AND up.imo_id = get_my_imo_id())
    OR is_upline_of(cc.agent_id)
  ORDER BY 11 DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_contracting_activity(integer) TO authenticated;

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_contracting_activity', '20260612225248')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

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
    super_admin_in_scope(csr.imo_id)
    OR (is_imo_admin() AND csr.imo_id = get_my_imo_id())
    OR csr.normal_upline_id = auth.uid()
  ORDER BY csr.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_downline_sponsorships() TO authenticated;

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_downline_sponsorships', '20260612225248')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
