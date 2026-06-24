-- Server-side aggregate for the Policies page metrics band.
--
-- WHY: PolicyList previously computed the metrics band in the browser by loading
-- the agent's ENTIRE commission set (useCommissions(), unpaginated) plus, when
-- any filter was active, EVERY matching policy object — then reduced in JS. For a
-- top-of-hierarchy agent with thousands of policies/commissions that is a large
-- payload and O(n) client memory on every render. This function returns a single
-- aggregated row instead.
--
-- SCOPING: SECURITY INVOKER so the caller's RLS applies to BOTH policies and
-- commissions, and we additionally pin policies to user_id = auth.uid() to match
-- the existing policy-list scoping (PolicyService.getCurrentUserId -> auth.uid).
--
-- PARITY: mirrors PolicyRepository.getAggregateMetrics + the client-side
-- commission math exactly:
--   active/lapsed/cancelled  -> by lifecycle_status
--   pending                  -> by status = 'pending'
--   avg_premium              -> sum(coalesce(premium,0)) / total count (null
--                               premiums count as 0 in the numerator AND the
--                               denominator, matching the JS reduce/length)
--   ytd_*                    -> effective_date in the current calendar year
--   earned_commission        -> sum(earned_amount) where commission status='paid'
--   pending_commission       -> sum(amount)        where commission status='pending'
-- Date range targets submit_date or effective_date per p_date_field (default
-- submit_date), same as the repository.

CREATE OR REPLACE FUNCTION get_policy_dashboard_metrics(
  p_status           text DEFAULT NULL,
  p_lifecycle_status text DEFAULT NULL,
  p_carrier_id       uuid DEFAULT NULL,
  p_product          text DEFAULT NULL,
  p_date_from        date DEFAULT NULL,
  p_date_to          date DEFAULT NULL,
  p_date_field       text DEFAULT 'submit_date',
  p_search           text DEFAULT NULL
)
RETURNS TABLE (
  total_policies      bigint,
  active_policies     bigint,
  pending_policies    bigint,
  lapsed_policies     bigint,
  cancelled_policies  bigint,
  total_premium       numeric,
  avg_premium         numeric,
  ytd_policies        bigint,
  ytd_premium         numeric,
  earned_commission   numeric,
  pending_commission  numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  WITH filtered AS (
    SELECT
      p.id,
      p.status,
      p.lifecycle_status,
      coalesce(p.annual_premium, 0) AS annual_premium,
      p.effective_date
    FROM policies p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.user_id = auth.uid()
      -- status/product are enum types; cast to text for comparison with the
      -- text params (lifecycle_status is already text).
      AND (p_status IS NULL OR p.status::text = p_status)
      AND (p_lifecycle_status IS NULL OR p.lifecycle_status::text = p_lifecycle_status)
      AND (p_carrier_id IS NULL OR p.carrier_id = p_carrier_id)
      AND (p_product IS NULL OR p.product::text = p_product)
      AND (
        p_date_from IS NULL
        OR (CASE WHEN p_date_field = 'effective_date' THEN p.effective_date ELSE p.submit_date END) >= p_date_from
      )
      AND (
        p_date_to IS NULL
        OR (CASE WHEN p_date_field = 'effective_date' THEN p.effective_date ELSE p.submit_date END) <= p_date_to
      )
      AND (
        p_search IS NULL OR p_search = ''
        OR p.policy_number ILIKE '%' || p_search || '%'
        OR c.name ILIKE '%' || p_search || '%'
      )
  )
  SELECT
    count(*)                                                              AS total_policies,
    count(*) FILTER (WHERE lifecycle_status = 'active')                   AS active_policies,
    count(*) FILTER (WHERE status = 'pending')                           AS pending_policies,
    count(*) FILTER (WHERE lifecycle_status = 'lapsed')                   AS lapsed_policies,
    count(*) FILTER (WHERE lifecycle_status = 'cancelled')                AS cancelled_policies,
    coalesce(sum(annual_premium), 0)                                     AS total_premium,
    coalesce(sum(annual_premium) / nullif(count(*), 0), 0)               AS avg_premium,
    count(*) FILTER (
      WHERE extract(year FROM effective_date) = extract(year FROM current_date)
    )                                                                     AS ytd_policies,
    coalesce(sum(annual_premium) FILTER (
      WHERE extract(year FROM effective_date) = extract(year FROM current_date)
    ), 0)                                                                 AS ytd_premium,
    coalesce((
      SELECT sum(cm.earned_amount)
      FROM commissions cm
      WHERE cm.policy_id IN (SELECT id FROM filtered)
        AND cm.status = 'paid'
    ), 0)                                                                 AS earned_commission,
    coalesce((
      SELECT sum(cm.amount)
      FROM commissions cm
      WHERE cm.policy_id IN (SELECT id FROM filtered)
        AND cm.status = 'pending'
    ), 0)                                                                 AS pending_commission
  FROM filtered;
$$;

COMMENT ON FUNCTION get_policy_dashboard_metrics(text, text, uuid, text, date, date, text, text) IS
  'Single-row aggregate for the Policies page metrics band (counts, premium, YTD, earned/pending commission) for the caller''s own policies matching the given filters. SECURITY INVOKER; replaces client-side useCommissions()+all-policies loading.';

REVOKE ALL ON FUNCTION get_policy_dashboard_metrics(text, text, uuid, text, date, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_policy_dashboard_metrics(text, text, uuid, text, date, date, text, text) TO authenticated;
