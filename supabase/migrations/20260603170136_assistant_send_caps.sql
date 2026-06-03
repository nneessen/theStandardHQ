-- supabase/migrations/20260603170136_assistant_send_caps.sql
-- COUNT-based send caps for the executor (assistant-action-execute), enforced as
-- defense-in-depth BEHIND the human-approval gate. Two new axes that the simple
-- per-call counter (check_rate_limit / action-limits.ts) cannot express:
--
--   1) distinct-recipient/day (per user, per channel): bounds fan-out — how many
--      DIFFERENT people a single account can message in 24h via the assistant. A
--      repeat send to someone already contacted today does NOT consume a new slot
--      (recipient_already_24h lets the caller distinguish that case).
--   2) IMO-wide/day (per tenant, sms+email only): bounds aggregate org blast volume
--      even if it is spread thin across many users (each under their own caps).
--
-- SECURITY DEFINER is required because:
--   * the IMO-wide count must see sibling users' rows, but RLS on
--     assistant_action_requests is own-rows-only (user_id = auth.uid());
--   * COUNT(DISTINCT ...) is not expressible through PostgREST.
-- The identity is resolved SERVER-SIDE — auth.uid() for the per-user axes and
-- get_my_imo_id() for the tenant axis — so a caller can neither ask about another
-- user nor about another tenant. p_recipient is only ever matched against the
-- CALLER'S OWN rows, so passing it leaks nothing. The cap VALUES live in the edge
-- function (assistant-orchestrator/core/action-limits.ts); this RPC returns only
-- raw counts so the policy stays in one place and is unit-testable offline.
--
-- Counts COMMITTED sends only (executed_at IS NOT NULL within the last 24h). This is
-- a SECONDARY gate and is intentionally NOT race-atomic: two concurrent executions
-- can both read the same count and pass. That is acceptable because the per-call
-- counter already bounds burst volume atomically and human approval is the primary
-- control. Recipients are normalized to a canonical form (last-10 digits for phone,
-- lower(trim(...)) for email) so format variants of the same person collapse to one.
--
-- LIMITATION (documented, not fixed here): imo_id on action rows is stamped by the
-- orchestrator (get_my_imo_id() at draft time), not by a DB default/trigger, so a
-- user inserting rows via the raw user-scoped client could set a different imo_id and
-- dodge the IMO ceiling. That only lets them evade their OWN tenant's ceiling, which
-- is already bounded by the per-user caps + the approval gate, so a stamping trigger
-- (which would reach into the orchestrator insert path) is not worth its cost now.

CREATE OR REPLACE FUNCTION public.assistant_send_caps(
  p_channel   TEXT,
  p_recipient TEXT DEFAULT NULL
)
RETURNS TABLE (
  distinct_recipients_24h INTEGER,
  recipient_already_24h   BOOLEAN,
  imo_sends_24h           INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_imo  UUID := get_my_imo_id();
  v_norm TEXT;
BEGIN
  -- Normalize the candidate recipient the same way stored recipients are normalized
  -- below, so "(555) 123-4567" and "5551234567" (or case/space variants of an email)
  -- match the same person. NULL => "no specific recipient to check" (already=false).
  IF p_channel = 'sms' THEN
    v_norm := right(regexp_replace(coalesce(p_recipient, ''), '\D', '', 'g'), 10);
    IF length(v_norm) < 10 THEN v_norm := NULL; END IF;
  ELSE
    v_norm := nullif(lower(trim(coalesce(p_recipient, ''))), '');
  END IF;

  RETURN QUERY
  SELECT
    -- (1) distinct recipients this user has SENT to on this channel in the window.
    (
      SELECT COUNT(DISTINCT
               CASE WHEN aar.channel = 'sms'
                    THEN right(regexp_replace(coalesce(aar.recipient, ''), '\D', '', 'g'), 10)
                    ELSE lower(trim(aar.recipient)) END
             )::INTEGER
        FROM public.assistant_action_requests aar
       WHERE aar.user_id = auth.uid()
         AND aar.channel = p_channel
         AND aar.recipient IS NOT NULL
         AND aar.executed_at IS NOT NULL
         AND aar.executed_at >= now() - INTERVAL '24 hours'
    ),
    -- (2) has this exact recipient already been sent to in the window? (a repeat is
    --     allowed even at the distinct cap — it adds no NEW distinct recipient).
    (
      v_norm IS NOT NULL AND EXISTS (
        SELECT 1
          FROM public.assistant_action_requests aar
         WHERE aar.user_id = auth.uid()
           AND aar.channel = p_channel
           AND aar.executed_at IS NOT NULL
           AND aar.executed_at >= now() - INTERVAL '24 hours'
           AND (CASE WHEN p_channel = 'sms'
                     THEN right(regexp_replace(coalesce(aar.recipient, ''), '\D', '', 'g'), 10)
                     ELSE lower(trim(aar.recipient)) END) = v_norm
      )
    ),
    -- (3) total external sends (sms+email) across the caller's IMO in the window.
    --     Internal Close note/task writes are NOT counted — the ceiling targets
    --     external-message blast volume (reputation/TCPA), not CRM writes.
    (
      SELECT COUNT(*)::INTEGER
        FROM public.assistant_action_requests aar
       WHERE v_imo IS NOT NULL
         AND aar.imo_id = v_imo
         AND aar.channel IN ('sms', 'email')
         AND aar.executed_at IS NOT NULL
         AND aar.executed_at >= now() - INTERVAL '24 hours'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_send_caps(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_send_caps(TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.assistant_send_caps(TEXT, TEXT) IS
  'Executor send-cap counts (defense-in-depth, behind human approval). Returns the caller''s distinct-recipient count + repeat flag for p_channel and the IMO-wide sms+email send count, all over committed (executed) sends in the last 24h. SECURITY DEFINER; identity resolved server-side (auth.uid()/get_my_imo_id()). Cap VALUES live in core/action-limits.ts. Recipients normalized (last-10 phone / lower email).';

-- Partial indexes over committed sends so the window COUNTs stay cheap as volume grows.
CREATE INDEX IF NOT EXISTS idx_aar_user_channel_executed
  ON public.assistant_action_requests (user_id, channel, executed_at)
  WHERE executed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aar_imo_channel_executed
  ON public.assistant_action_requests (imo_id, channel, executed_at)
  WHERE executed_at IS NOT NULL;
