-- Tighten runtime access for authoritative underwriting persistence and session reads.

-- Remove stale broad session policies that bypass the backend-authoritative path.
DROP POLICY IF EXISTS "Users can insert sessions for their IMO"
ON public.underwriting_sessions;

DROP POLICY IF EXISTS "Users can view sessions from their IMO"
ON public.underwriting_sessions;

DROP POLICY IF EXISTS "Users can update sessions from their IMO"
ON public.underwriting_sessions;

DROP POLICY IF EXISTS "Users can delete sessions from their IMO"
ON public.underwriting_sessions;

-- Tighten evaluation-log reads to sessions the caller can actually access.
DROP POLICY IF EXISTS eval_log_select
ON public.underwriting_rule_evaluation_log;

CREATE POLICY eval_log_select
ON public.underwriting_rule_evaluation_log
FOR SELECT
TO authenticated
USING (
  imo_id = get_my_imo_id()
  AND session_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.underwriting_sessions s
    WHERE s.id = underwriting_rule_evaluation_log.session_id
      AND s.imo_id = get_my_imo_id()
      AND (
        s.created_by = (SELECT auth.uid())
        OR is_upline_of(s.created_by)
        OR is_imo_admin()
      )
  )
);

-- The raw-input-only save RPC is no longer part of the public runtime surface.
REVOKE ALL
ON FUNCTION public.save_underwriting_session_v2(JSONB)
FROM PUBLIC, anon, authenticated, service_role;

-- The authoritative persist RPC is backend-only.
REVOKE ALL
ON FUNCTION public.persist_underwriting_run_v1(UUID, JSONB, JSONB, JSONB)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.persist_underwriting_run_v1(UUID, JSONB, JSONB, JSONB)
TO service_role;

-- Direct audit RPC access stays disabled; audit rows are written inside the authoritative persist transaction.
REVOKE ALL
ON FUNCTION public.log_underwriting_rule_evaluation(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  JSONB,
  TEXT
)
FROM PUBLIC, anon, authenticated, service_role;

-- Session-history read models should be callable only by signed-in users.
REVOKE ALL
ON FUNCTION public.list_my_underwriting_sessions_v1(INTEGER, INTEGER, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.list_my_underwriting_sessions_v1(INTEGER, INTEGER, TEXT)
TO authenticated;

REVOKE ALL
ON FUNCTION public.list_agency_underwriting_sessions_v1(INTEGER, INTEGER, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.list_agency_underwriting_sessions_v1(INTEGER, INTEGER, TEXT)
TO authenticated;
