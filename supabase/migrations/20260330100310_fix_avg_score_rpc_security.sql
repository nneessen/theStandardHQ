-- Fix avg_lead_heat_score RPC: enforce caller = p_user_id to prevent cross-tenant reads.
-- The original was SECURITY DEFINER with no caller check — any authenticated user
-- could read another user's average score.

CREATE OR REPLACE FUNCTION avg_lead_heat_score(p_user_id UUID)
RETURNS TABLE(avg_score NUMERIC) AS $$
BEGIN
  -- Enforce tenant boundary: caller must be querying their own data
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: cannot query another user''s scores';
  END IF;

  RETURN QUERY
    SELECT COALESCE(AVG(lead_heat_scores.score)::NUMERIC, 0) AS avg_score
    FROM lead_heat_scores
    WHERE lead_heat_scores.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
