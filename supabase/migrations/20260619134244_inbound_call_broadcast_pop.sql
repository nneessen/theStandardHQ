-- Inbound-CRM scale fix #4 (DRAFT — the headline pop-delivery change).
--
-- Deliver the screen-pop via BROADCAST-FROM-TRIGGER instead of postgres_changes, so a ~1000-call
-- burst does NOT serialize through Supabase Realtime's single-threaded WAL reader + its
-- per-event-per-subscriber RLS sweep. An AFTER trigger on inbound_calls sends a targeted broadcast
-- to the resolved agent's PRIVATE topic `inbound:<agent_id>`; authorization becomes a single
-- channel-join RLS check on realtime.messages, not O(changes × subscribers).
--
-- Fires only on the two events that drive the UI:
--   * a fresh ringing INSERT that fired a pop  -> OPEN the screen-pop
--   * a transition into status='ended'          -> DISMISS the pop
--
-- SAFETY: the realtime.send call is exception-wrapped — a broadcast failure must NEVER roll back the
-- call write (crm_upsert_call / crm_patch_billable insert into this table).
--
-- CUTOVER (separate, coordinated — NOT in this migration):
--   1. Switch InboundCallContext to `.on('broadcast', { event: 'inbound_call' })` on a private
--      channel `inbound:<user.id>` (replacing the postgres_changes subscription).
--   2. THEN drop public.inbound_calls from the supabase_realtime publication
--      (20260617150349_inbound_crm_phase0_schema.sql:161-173).
-- Until the client cutover this trigger is purely additive and harmless (both paths can coexist).
--
-- LOCAL-only until go-live.
BEGIN;

CREATE OR REPLACE FUNCTION public.inbound_call_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only a resolved agent has a pop target.
  IF NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A broadcast failure must NEVER abort the call write — swallow and warn.
  BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'ringing' AND NEW.fired_pop) THEN
      PERFORM realtime.send(
        jsonb_build_object(
          'id',           NEW.id,
          'imo_id',       NEW.imo_id,        -- the modal needs this for useActiveCallTypes
          'status',       NEW.status,
          'client_id',    NEW.client_id,
          'request_tag',  NEW.request_tag,
          'ani',          NEW.ani,
          'state',        NEW.state,
          'call_program', NEW.call_program,
          'offer_id',     NEW.offer_id
        ),
        'inbound_call',                          -- event
        'inbound:' || NEW.agent_id::text,        -- private per-agent topic
        true                                     -- private; gated by the RLS policy below
      );
    ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'ended'
           AND COALESCE(OLD.status, '') <> 'ended') THEN
      PERFORM realtime.send(
        jsonb_build_object('id', NEW.id, 'status', NEW.status),
        'inbound_call',
        'inbound:' || NEW.agent_id::text,
        true
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'inbound_call_broadcast non-fatal: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbound_call_broadcast ON public.inbound_calls;
CREATE TRIGGER trg_inbound_call_broadcast
  AFTER INSERT OR UPDATE ON public.inbound_calls
  FOR EACH ROW EXECUTE FUNCTION public.inbound_call_broadcast();

-- Channel authorization: an authenticated agent may read ONLY their own inbound:<their-uid> topic,
-- so one agent can never subscribe to another agent's screen-pop feed (PII isolation).
DROP POLICY IF EXISTS inbound_broadcast_read_own ON realtime.messages;
CREATE POLICY inbound_broadcast_read_own ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() = 'inbound:' || auth.uid()::text
  );

COMMIT;
