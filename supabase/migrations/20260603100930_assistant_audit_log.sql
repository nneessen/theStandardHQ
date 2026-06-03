-- supabase/migrations/20260603100930_assistant_audit_log.sql
-- Append-only governance/forensics ledger for the Jarvis agentic platform.
--
-- Distinct from assistant_tool_calls (the conversational-UI record): this is the
-- tamper-evident audit trail of every gated action — who/what/when/decision/params —
-- across all surfaces (text, voice, desktop, system). It is APPEND-ONLY:
--   * RLS has NO insert/update/delete policy, so an authenticated user can NEVER write,
--     alter, or delete a row directly.
--   * Writes go ONLY through log_assistant_audit() (SECURITY DEFINER, pinned search_path),
--     which stamps actor_user_id := auth.uid() server-side so a caller cannot forge a row
--     for another user, and stamps created_at server-side.
--   * Reads: owner reads their own rows; IMO admins read their tenant's rows; super-admins
--     read all (mirrors the proven lead_purchases admin-read pattern with is_imo_admin()/
--     get_my_imo_id()/is_super_admin()).
--
-- Enum-like columns (surface, event, action_class, decision) are plain TEXT with NO CHECK
-- constraints, per project convention — values are enforced in TypeScript.

-- =============================================================================
-- assistant_audit_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.assistant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL (not CASCADE): the audit trail must SURVIVE the actor's deletion.
  actor_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  imo_id UUID,
  surface TEXT NOT NULL DEFAULT 'text', -- text | voice | desktop | system
  event TEXT NOT NULL, -- e.g. tool_call | tool_denied | action_executed
  tool_name TEXT,
  action_class TEXT, -- read | draft | outbound | local | irreversible
  decision TEXT, -- allowed | denied | success | error
  decision_reason TEXT,
  action_request_id UUID, -- ties to assistant_action_requests when applicable (no FK: may be cross-table/expired)
  params_redacted JSONB,
  result_redacted JSONB,
  recipient_hash TEXT, -- sha256 of a recipient, never raw PII
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_audit_log_actor_recent
  ON public.assistant_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_audit_log_imo_recent
  ON public.assistant_audit_log(imo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_audit_log_action_request
  ON public.assistant_audit_log(action_request_id);

ALTER TABLE public.assistant_audit_log ENABLE ROW LEVEL SECURITY;

-- READ policies (multiple permissive policies are OR'd). NO write policies exist — see header.
CREATE POLICY "assistant_audit_log_select_own" ON public.assistant_audit_log
  FOR SELECT USING (actor_user_id = auth.uid());
CREATE POLICY "assistant_audit_log_select_imo_admin" ON public.assistant_audit_log
  FOR SELECT USING (is_imo_admin() AND imo_id = get_my_imo_id());
CREATE POLICY "assistant_audit_log_select_super_admin" ON public.assistant_audit_log
  FOR SELECT USING (is_super_admin());

-- =============================================================================
-- log_assistant_audit() — the ONLY writer. SECURITY DEFINER bypasses the table's
-- (write-less) RLS; actor_user_id is taken from auth.uid(), never a parameter, so a
-- caller can only ever append a row attributed to themselves (NULL for service-role /
-- system events). Returns the new row id.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_assistant_audit(
  p_surface TEXT,
  p_event TEXT,
  p_tool_name TEXT DEFAULT NULL,
  p_action_class TEXT DEFAULT NULL,
  p_decision TEXT DEFAULT NULL,
  p_decision_reason TEXT DEFAULT NULL,
  p_action_request_id UUID DEFAULT NULL,
  p_imo_id UUID DEFAULT NULL,
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
    auth.uid(), p_imo_id, p_surface, p_event, p_tool_name, p_action_class,
    p_decision, p_decision_reason, p_action_request_id, p_params_redacted,
    p_result_redacted, p_recipient_hash
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The orchestrator runs as the END USER (anon key + user JWT), so the writer is granted to
-- authenticated (it self-stamps actor = auth.uid()) as well as service_role (system/cron).
-- anon and PUBLIC get nothing.
REVOKE ALL ON FUNCTION public.log_assistant_audit(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_assistant_audit(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT
) TO authenticated, service_role;

COMMENT ON TABLE public.assistant_audit_log IS 'Append-only governance/forensics ledger for Jarvis actions (all surfaces). Writes only via log_assistant_audit(); no write RLS policies. Distinct from assistant_tool_calls (the UI record).';
COMMENT ON FUNCTION public.log_assistant_audit(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT) IS 'Sole writer for assistant_audit_log. SECURITY DEFINER; stamps actor_user_id := auth.uid() (anti-forgery) and created_at server-side.';
