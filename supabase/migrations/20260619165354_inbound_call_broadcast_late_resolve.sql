-- Inbound-CRM Phase-3 reliability fix (review finding #1): pop on a LATE agent-resolve.
--
-- The pop trigger fired the OPEN-pop only on the INSERT branch. But crm_upsert_call's ON CONFLICT
-- deliberately fills agent_id on a later UPDATE (NULL -> real) while leaving status='ringing' — the
-- documented at-least-once / out-of-order delivery path where the first POST can't resolve the agent
-- yet. That UPDATE produced NO broadcast, so a correctly-assigned, still-ringing call never popped.
--
-- Fix: open the pop on EITHER a fresh ringing INSERT that fired a pop, OR an UPDATE that first
-- resolves the agent (OLD.agent_id IS NULL -> NEW.agent_id NOT NULL) while still ringing. A re-POST
-- whose agent was already set (OLD.agent_id NOT NULL) does NOT re-pop, and a disposition save
-- (agent_id unchanged, status stays 'ringing') does NOT re-pop. Dismiss is unchanged.
-- realtime.send stays exception-wrapped so a broadcast failure never rolls back the call write.
-- LOCAL-only until go-live.
BEGIN;

CREATE OR REPLACE FUNCTION public.inbound_call_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- OPEN the pop: a fresh ringing INSERT that fired a pop, OR an agent first resolved on a
    -- still-ringing re-POST (the late-resolve case).
    IF (TG_OP = 'INSERT' AND NEW.status = 'ringing' AND NEW.fired_pop)
       OR (TG_OP = 'UPDATE' AND NEW.status = 'ringing'
           AND OLD.agent_id IS NULL AND NEW.agent_id IS NOT NULL) THEN
      PERFORM realtime.send(
        jsonb_build_object(
          'id',           NEW.id,
          'imo_id',       NEW.imo_id,
          'status',       NEW.status,
          'client_id',    NEW.client_id,
          'request_tag',  NEW.request_tag,
          'ani',          NEW.ani,
          'state',        NEW.state,
          'call_program', NEW.call_program,
          'offer_id',     NEW.offer_id
        ),
        'inbound_call',
        'inbound:' || NEW.agent_id::text,
        true
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

-- (Trigger trg_inbound_call_broadcast from 20260619134244 already points at this function.)

COMMIT;
