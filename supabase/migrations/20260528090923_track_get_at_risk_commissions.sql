-- supabase/migrations/20260528090923_track_get_at_risk_commissions.sql
-- L3 hardening: bring get_at_risk_commissions into the tracked migrations tree.
--
-- This function predates the migration runner and was applied out-of-band (the
-- repo only had an `ALTER ... SET search_path` for it, never a CREATE). The Jarvis
-- briefing/policy-risk tools call it as get_at_risk_commissions(p_user_id, ...).
--
-- Verified before capture (local DB, 2026-05-28):
--   * SECURITY INVOKER (prosecdef = false) — it does NOT run as the definer, so RLS
--     on commissions/policies applies to the caller. It does not need (and must not
--     gain) an explicit `p_user_id != auth.uid()` guard: the function is also used in
--     team/downline contexts where a caller legitimately passes another user's id,
--     and RLS is the authorization boundary. Via the assistant the risk is bounded
--     because ctx.userId is always the verified caller (the model cannot inject an id).
--   * search_path is pinned to 'public'.
--
-- This is the EXACT current definition captured verbatim (no behavior change); it
-- exists only to make the definition tracked + reproducible. NOTE: this branch's DB
-- work is LOCAL-only. Before applying to remote at the prod-deploy gate, diff
-- pg_get_functiondef(local) vs pg_get_functiondef(remote) for this function and only
-- apply if identical (remote already has it; avoid silently overwriting drift).

CREATE OR REPLACE FUNCTION public.get_at_risk_commissions(p_user_id uuid, p_risk_threshold integer DEFAULT 3)
 RETURNS TABLE(commission_id uuid, policy_id uuid, advance_amount numeric, months_paid integer, earned_amount numeric, unearned_amount numeric, risk_level text, effective_date date, policy_status character varying)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id as commission_id,
    c.policy_id,
    c.amount as advance_amount,  -- FIXED: Use amount not advance_amount
    c.months_paid,
    c.earned_amount,
    c.unearned_amount,
    CASE
      WHEN c.months_paid = 0 THEN 'CRITICAL'
      WHEN c.months_paid < p_risk_threshold THEN 'HIGH'
      WHEN c.months_paid < 6 THEN 'MEDIUM'
      ELSE 'LOW'
    END as risk_level,
    p.effective_date,
    p.status as policy_status
  FROM commissions c
  JOIN policies p ON p.id = c.policy_id
  WHERE c.user_id = p_user_id
    AND c.status IN ('pending', 'earned')
    AND c.unearned_amount > 0
    AND c.months_paid < c.advance_months
  ORDER BY c.months_paid ASC, c.unearned_amount DESC;
END;
$function$;
