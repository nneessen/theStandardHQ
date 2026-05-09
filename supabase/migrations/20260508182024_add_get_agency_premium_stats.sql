-- Migration: 20260508182024_add_get_agency_premium_stats.sql
-- Purpose: Provide agency-wide policy-premium aggregates for the Targets page
-- realistic plan calculation. Replaces the per-user avg-premium read so new
-- agents (and agents with skewed personal books) get a stable baseline.
--
-- Returns mean, median, count, and source for the requesting user's IMO.
-- Falls back: current-year → active → all → no-data, mirroring the legacy
-- per-user logic in useHistoricalAverages.
--
-- SECURITY DEFINER so the function can read aggregate stats across users in
-- the same IMO without each row needing to pass RLS individually. Only
-- aggregates are returned — never raw policy rows. Auth gate: caller must
-- be authenticated AND must be requesting their own user's stats (or
-- super_admin / IMO admin).

CREATE OR REPLACE FUNCTION public.get_agency_premium_stats(
    p_user_id uuid
)
RETURNS TABLE (
    source text,
    mean_premium numeric,
    median_premium numeric,
    policy_count integer,
    -- personal stats for popover/comparison context
    personal_source text,
    personal_mean_premium numeric,
    personal_median_premium numeric,
    personal_policy_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_imo_id uuid;
    v_year_start date := date_trunc('year', CURRENT_DATE);
    v_agency_premiums numeric[];
    v_personal_premiums numeric[];
    v_agency_source text;
    v_personal_source text;
BEGIN
    -- Auth gate: caller must be self or admin
    IF p_user_id != auth.uid() AND NOT is_super_admin() AND NOT is_imo_admin() THEN
        RAISE EXCEPTION 'Unauthorized: cannot read other users premium stats';
    END IF;

    -- Resolve IMO from the requesting user's profile
    SELECT imo_id INTO v_imo_id
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_imo_id IS NULL THEN
        RETURN QUERY SELECT
            'no-data'::text, 0::numeric, 0::numeric, 0::integer,
            'no-data'::text, 0::numeric, 0::numeric, 0::integer;
        RETURN;
    END IF;

    -- ── Agency cohort: current year first, fall back through active → all ──
    SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
    INTO v_agency_premiums
    FROM policies p
    INNER JOIN user_profiles up ON up.id = p.user_id
    WHERE up.imo_id = v_imo_id
      AND p.annual_premium > 0
      AND p.effective_date >= v_year_start;
    v_agency_source := 'current-year';

    IF v_agency_premiums IS NULL OR array_length(v_agency_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_agency_premiums
        FROM policies p
        INNER JOIN user_profiles up ON up.id = p.user_id
        WHERE up.imo_id = v_imo_id
          AND p.annual_premium > 0
          AND p.status = 'active';
        v_agency_source := 'active-policies-fallback';
    END IF;

    IF v_agency_premiums IS NULL OR array_length(v_agency_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_agency_premiums
        FROM policies p
        INNER JOIN user_profiles up ON up.id = p.user_id
        WHERE up.imo_id = v_imo_id
          AND p.annual_premium > 0;
        v_agency_source := 'all-policies-fallback';
    END IF;

    IF v_agency_premiums IS NULL OR array_length(v_agency_premiums, 1) = 0 THEN
        v_agency_source := 'no-data';
        v_agency_premiums := ARRAY[]::numeric[];
    END IF;

    -- ── Personal cohort: same fallback chain, scoped to caller only ─────
    SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
    INTO v_personal_premiums
    FROM policies p
    WHERE p.user_id = p_user_id
      AND p.annual_premium > 0
      AND p.effective_date >= v_year_start;
    v_personal_source := 'current-year';

    IF v_personal_premiums IS NULL OR array_length(v_personal_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_personal_premiums
        FROM policies p
        WHERE p.user_id = p_user_id
          AND p.annual_premium > 0
          AND p.status = 'active';
        v_personal_source := 'active-policies-fallback';
    END IF;

    IF v_personal_premiums IS NULL OR array_length(v_personal_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_personal_premiums
        FROM policies p
        WHERE p.user_id = p_user_id
          AND p.annual_premium > 0;
        v_personal_source := 'all-policies-fallback';
    END IF;

    IF v_personal_premiums IS NULL OR array_length(v_personal_premiums, 1) = 0 THEN
        v_personal_source := 'no-data';
        v_personal_premiums := ARRAY[]::numeric[];
    END IF;

    -- Compute aggregates for both cohorts. percentile_cont gives the median
    -- with linear interpolation when the cohort size is even.
    RETURN QUERY
    SELECT
        v_agency_source,
        COALESCE(
            (SELECT AVG(p) FROM unnest(v_agency_premiums) AS p),
            0
        )::numeric AS mean_premium,
        COALESCE(
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY p) FROM unnest(v_agency_premiums) AS p),
            0
        )::numeric AS median_premium,
        COALESCE(array_length(v_agency_premiums, 1), 0)::integer AS policy_count,

        v_personal_source,
        COALESCE(
            (SELECT AVG(p) FROM unnest(v_personal_premiums) AS p),
            0
        )::numeric AS personal_mean_premium,
        COALESCE(
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY p) FROM unnest(v_personal_premiums) AS p),
            0
        )::numeric AS personal_median_premium,
        COALESCE(array_length(v_personal_premiums, 1), 0)::integer AS personal_policy_count;
END;
$$;

COMMENT ON FUNCTION public.get_agency_premium_stats IS
'Agency-wide annual_premium aggregates (mean + median + count) scoped to the requesting user''s IMO, plus the requesting user''s personal aggregates for comparison context. Powers the realistic-plan avg-premium divisor on the Targets page so new agents and agents with skewed personal books get a stable baseline.';

GRANT EXECUTE ON FUNCTION public.get_agency_premium_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_premium_stats TO service_role;
