-- supabase/migrations/20260528090704_assistant_action_status_guard.sql
-- H1 hardening: DB-enforce the assistant_action_requests lifecycle so the
-- "one human approval = one send" invariant cannot be bypassed with the raw
-- user-scoped supabase client the frontend already imports.
--
-- Two bypasses existed because the state machine lived ONLY in TypeScript
-- (assistant-orchestrator/core/state-machine.ts):
--   1. UPDATE reset: an owner could update({status:'approved'}) on an already
--      `executed` row and re-invoke assistant-action-execute -> re-send within
--      the 24h expiry window.
--   2. INSERT fabrication: an owner could insert a row already at
--      status='approved' (skipping the draft -> pending_approval -> approved
--      path entirely) and invoke execute -> send with ZERO human approval.
--
-- Defense in depth (this migration):
--   * A BEFORE INSERT/UPDATE trigger is the authoritative guard. It mirrors
--     TRANSITIONS in core/state-machine.ts, forbids non-initial INSERT statuses,
--     rejects illegal status transitions, and makes terminal rows immutable.
--     It fires even under a service-role connection (where RLS is bypassed).
--   * Tightened RLS (silent backstop under the user JWT): INSERT may only create
--     rows in an initial status; UPDATE may not target a terminal row.
--
-- This is plpgsql transition logic, NOT a CHECK constraint on an enum column, so
-- it respects the project convention (no CHECK constraints on enum-like columns).
-- KEEP THE TRANSITION TABLE BELOW IN SYNC WITH core/state-machine.ts TRANSITIONS.

-- =============================================================================
-- Trigger function: validate INSERT initial status + UPDATE transitions
-- =============================================================================
CREATE OR REPLACE FUNCTION assistant_action_requests_status_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  allowed TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New rows must start in an initial (non-approved, non-terminal) status.
    -- Mirrors the lifecycle entry points in core/state-machine.ts.
    IF NEW.status NOT IN ('draft', 'pending_approval') THEN
      RAISE EXCEPTION
        'assistant_action_requests may only be created with status draft or pending_approval (got %)',
        NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' below.

  -- Status unchanged: allow updates to other columns ONLY while the row is not
  -- terminal. A terminal row (executed|failed|cancelled|expired) is immutable so
  -- an approved/executed action cannot be quietly rewritten and re-sent.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('executed', 'failed', 'cancelled', 'expired') THEN
      RAISE EXCEPTION
        'assistant_action_requests row % is terminal (%) and cannot be modified',
        OLD.id, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Status is changing: it must be a legal transition.
  -- Mirror of TRANSITIONS in assistant-orchestrator/core/state-machine.ts.
  allowed := CASE OLD.status
    WHEN 'draft'            THEN ARRAY['pending_approval', 'cancelled']
    WHEN 'pending_approval' THEN ARRAY['approved', 'cancelled', 'expired']
    WHEN 'approved'         THEN ARRAY['executing', 'cancelled']
    WHEN 'executing'        THEN ARRAY['executed', 'failed']
    ELSE ARRAY[]::TEXT[]  -- executed|failed|cancelled|expired are terminal
  END;

  IF NOT (NEW.status = ANY (allowed)) THEN
    RAISE EXCEPTION
      'illegal assistant_action_requests status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assistant_action_requests_status_guard
  ON assistant_action_requests;
CREATE TRIGGER trg_assistant_action_requests_status_guard
  BEFORE INSERT OR UPDATE ON assistant_action_requests
  FOR EACH ROW EXECUTE FUNCTION assistant_action_requests_status_guard();

-- =============================================================================
-- RLS backstop (silent, under the user JWT). The trigger is the loud authority;
-- these make the same guarantees expressible at the policy layer.
-- =============================================================================

-- INSERT: owner may only create a row in an initial status (no fabricated approvals).
DROP POLICY IF EXISTS "assistant_action_requests_insert_policy" ON assistant_action_requests;
CREATE POLICY "assistant_action_requests_insert_policy" ON assistant_action_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'pending_approval')
  );

-- UPDATE: owner may not target a terminal row (cannot reset executed -> approved).
DROP POLICY IF EXISTS "assistant_action_requests_update_policy" ON assistant_action_requests;
CREATE POLICY "assistant_action_requests_update_policy" ON assistant_action_requests
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status NOT IN ('executed', 'failed', 'cancelled', 'expired')
  )
  WITH CHECK (user_id = auth.uid());

COMMENT ON FUNCTION assistant_action_requests_status_guard() IS
  'BEFORE INSERT/UPDATE guard enforcing the assistant_action_requests lifecycle (mirror of core/state-machine.ts TRANSITIONS). Rejects non-initial INSERT statuses, illegal status transitions, and any mutation of a terminal row.';
