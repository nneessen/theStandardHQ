-- supabase/migrations/20260603114600_harden_log_assistant_audit_imo.sql
-- Hardening (code-review M1/L1): derive imo_id SERVER-SIDE in log_assistant_audit instead of
-- trusting a caller-supplied p_imo_id.
--
-- The function is granted to `authenticated` (the orchestrator runs as the user), so a caller
-- could previously call the RPC directly and pass ANY p_imo_id — injecting an audit row into
-- another tenant's admin view (the read policy is `is_imo_admin() AND imo_id = get_my_imo_id()`).
-- actor_user_id was already forgery-proof (auth.uid()); this closes the imo_id gap and also
-- guarantees write/read consistency by using the SAME function the SELECT policy uses.
--
-- Drops the old 11-arg overload and recreates the writer with 10 args (no p_imo_id).

DROP FUNCTION IF EXISTS public.log_assistant_audit(
  text, text, text, text, text, text, uuid, uuid, jsonb, jsonb, text
);

CREATE OR REPLACE FUNCTION public.log_assistant_audit(
  p_surface TEXT,
  p_event TEXT,
  p_tool_name TEXT DEFAULT NULL,
  p_action_class TEXT DEFAULT NULL,
  p_decision TEXT DEFAULT NULL,
  p_decision_reason TEXT DEFAULT NULL,
  p_action_request_id UUID DEFAULT NULL,
  p_params_redacted JSONB DEFAULT NULL,
  p_result_redacted JSONB DEFAULT NULL,
  p_recipient_hash TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.assistant_audit_log (
    actor_user_id, imo_id, surface, event, tool_name, action_class,
    decision, decision_reason, action_request_id, params_redacted,
    result_redacted, recipient_hash
  ) VALUES (
    auth.uid(), get_my_imo_id(), p_surface, p_event, p_tool_name, p_action_class,
    p_decision, p_decision_reason, p_action_request_id, p_params_redacted,
    p_result_redacted, p_recipient_hash
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_assistant_audit(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, JSONB, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_assistant_audit(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, JSONB, TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION public.log_assistant_audit(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, JSONB, TEXT) IS 'Sole writer for assistant_audit_log. SECURITY DEFINER; stamps actor_user_id := auth.uid() AND imo_id := get_my_imo_id() server-side (anti-forgery) + created_at. No caller-supplied tenant id.';
