-- Contracting — fix the carrier_contracts status vocabulary mismatch.
--
-- PRE-EXISTING BUG: the live /contracting hub (STATUS_OPTIONS, statusColor, StatusTag,
-- set_carrier_contract_status RPC) uses 'denied', but carrier_contracts had a stale CHECK
-- constraint allowing only {pending,submitted,approved,'rejected',terminated}. So clicking
-- "Denied" in the hub threw a check_violation against the DB — and that blocks the new
-- "notify the upline when a downline is denied" requirement (a denied write can't persist).
--
-- FIX (per CLAUDE.md "No CHECK constraints on enums; enforce via TypeScript"): drop the
-- stale CHECK. The status enum is already enforced in code by set_carrier_contract_status
-- (p_status IN (...)). Zero 'rejected' rows exist, so nothing to migrate; status is not
-- money-gated (see 20260610083435). A legacy contracting surface still uses 'rejected', so
-- the awareness trigger is also taught to treat 'rejected' as a denial → an upline is
-- notified regardless of which surface recorded the denial.

BEGIN;

-- 1) Drop the stale enum CHECK (enforced at the RPC/TS layer instead).
ALTER TABLE public.carrier_contracts
  DROP CONSTRAINT IF EXISTS carrier_contracts_status_check;

-- 2) Teach the awareness trigger that 'rejected' is also a denial (cross-surface safety).
--    Branched verbatim from 20260612221331 with only the 'rejected' additions.
CREATE OR REPLACE FUNCTION public.notify_upline_contract_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        UUID := auth.uid();
  v_upline_id    UUID;
  v_carrier_name TEXT;
  v_agent_name   TEXT;
  v_title        TEXT;
  v_verb         TEXT;
BEGIN
  -- 'rejected' is the legacy surface's denial value; treat it like 'denied'.
  IF NEW.status NOT IN ('submitted','approved','denied','rejected') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NOT (OLD.status IS DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT upline_id INTO v_upline_id FROM user_profiles WHERE id = NEW.agent_id;
  IF v_upline_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NOT NULL AND v_actor = v_upline_id THEN
    RETURN NEW;
  END IF;

  SELECT c.name::text INTO v_carrier_name FROM carriers c WHERE c.id = NEW.carrier_id;
  SELECT COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email)
    INTO v_agent_name FROM user_profiles up WHERE up.id = NEW.agent_id;

  v_verb := CASE NEW.status
    WHEN 'submitted' THEN 'submitted a contract request for'
    WHEN 'approved'  THEN 'was approved for'
    WHEN 'denied'    THEN 'was denied for'
    WHEN 'rejected'  THEN 'was denied for'
  END;
  v_title := COALESCE(v_agent_name, 'A downline agent') || CASE NEW.status
    WHEN 'submitted' THEN ' submitted a contract request'
    WHEN 'approved'  THEN ' was approved for a carrier'
    WHEN 'denied'    THEN ' was denied a carrier'
    WHEN 'rejected'  THEN ' was denied a carrier'
  END;

  PERFORM create_notification(
    v_upline_id,
    'downline_contract_status',
    v_title,
    COALESCE(v_agent_name, 'A downline agent') || ' ' || v_verb || ' '
      || COALESCE(v_carrier_name, 'a carrier') || '.',
    jsonb_build_object(
      'agent_id',       NEW.agent_id,
      'agent_name',     v_agent_name,
      'carrier_id',     NEW.carrier_id,
      'carrier_name',   v_carrier_name,
      'status',         NEW.status,
      'writing_number', NEW.writing_number,
      'link',           '/contracting?tab=downline'
    ),
    NULL
  );

  RETURN NEW;
END;
$$;

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('notify_upline_contract_status_change', '20260612224156')
ON CONFLICT (function_name) DO UPDATE SET
  current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
