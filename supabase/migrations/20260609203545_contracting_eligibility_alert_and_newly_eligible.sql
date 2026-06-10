-- Contracting Hub — eligibility alerts
--
-- When an upline's carrier_contracts row transitions INTO 'approved', their DIRECT
-- reports become eligible to contract with that carrier (this mirrors the existing
-- check_upline_carrier_contract eligibility rule, which gates on status='approved').
-- Notify each direct report once via the existing create_notification RPC.
--
-- Scope = DIRECT reports only (upline_id = NEW.agent_id) — NOT the whole subtree —
-- because only direct reports actually become eligible. Gate on status, NOT on
-- writing_number, so alerts never drift out of sync with real eligibility.
--
-- Also adds get_newly_eligible_carriers() — a self-healing query the UI reads to show
-- the "newly eligible" strip independent of whether a notification was dismissed.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_downline_carrier_eligible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_carrier_name TEXT;
  v_upline_name  TEXT;
  v_report       RECORD;
BEGIN
  -- Only on transition INTO approved.
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;  -- already approved; not a transition
  END IF;

  SELECT c.name::text INTO v_carrier_name FROM carriers c WHERE c.id = NEW.carrier_id;
  SELECT COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email)
    INTO v_upline_name FROM user_profiles up WHERE up.id = NEW.agent_id;

  FOR v_report IN
    SELECT dr.id AS report_id
    FROM user_profiles dr
    WHERE dr.upline_id = NEW.agent_id
      AND dr.archived_at IS NULL
      -- skip reports already contracting (any status) with this carrier
      AND NOT EXISTS (
        SELECT 1 FROM carrier_contracts cc
        WHERE cc.agent_id = dr.id AND cc.carrier_id = NEW.carrier_id
      )
      -- skip if an unexpired carrier_eligible notice already exists for (report, carrier, upline)
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = dr.id
          AND n.type = 'carrier_eligible'
          AND (n.expires_at IS NULL OR n.expires_at > NOW())
          AND n.metadata->>'carrier_id' = NEW.carrier_id::text
          AND n.metadata->>'upline_id'  = NEW.agent_id::text
      )
  LOOP
    PERFORM create_notification(
      v_report.report_id,
      'carrier_eligible',
      'You can now contract with ' || COALESCE(v_carrier_name, 'a carrier'),
      COALESCE(v_upline_name, 'Your upline') || ' was approved — you''re now eligible to contract with '
        || COALESCE(v_carrier_name, 'this carrier') || '.',
      jsonb_build_object(
        'carrier_id',   NEW.carrier_id,
        'carrier_name', v_carrier_name,
        'upline_id',    NEW.agent_id,
        'upline_name',  v_upline_name,
        'contract_id',  NEW.id,
        'link',         '/contracting?tab=mine'
      ),
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_downline_carrier_eligible ON public.carrier_contracts;
CREATE TRIGGER trg_notify_downline_carrier_eligible
  AFTER INSERT OR UPDATE OF status ON public.carrier_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_downline_carrier_eligible();

COMMENT ON FUNCTION public.notify_downline_carrier_eligible IS
  'AFTER INSERT/UPDATE trigger on carrier_contracts: on transition into approved, notifies the agent''s DIRECT reports (carrier_eligible) that they can now contract with the carrier. Gates on status only; idempotent per (report,carrier,upline).';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('notify_downline_carrier_eligible', '20260609203545')
ON CONFLICT (function_name) DO UPDATE SET
  current_version = EXCLUDED.current_version, updated_at = NOW();

-- ────────────────────────────────────────────────────────────────────────────
-- Self-healing "newly eligible carriers" read (drives the AS-AGENT strip).
-- Carriers my DIRECT upline has approved that I have no row for yet.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_newly_eligible_carriers()
RETURNS TABLE (carrier_id UUID, carrier_name TEXT, upline_id UUID, approved_date DATE)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name::text, cc_up.agent_id, cc_up.approved_date
  FROM carrier_contracts cc_up
  JOIN carriers c ON c.id = cc_up.carrier_id AND c.is_active = true
  WHERE cc_up.agent_id = (SELECT upline_id FROM user_profiles WHERE id = auth.uid())
    AND cc_up.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM carrier_contracts mine
      WHERE mine.agent_id = auth.uid() AND mine.carrier_id = cc_up.carrier_id
    )
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_newly_eligible_carriers() TO authenticated;

COMMENT ON FUNCTION public.get_newly_eligible_carriers IS
  'Self-only: carriers the caller''s DIRECT upline has approved that the caller has no carrier_contracts row for. Drives the "newly eligible" strip; self-healing vs dismissed notifications.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_newly_eligible_carriers', '20260609203545')
ON CONFLICT (function_name) DO UPDATE SET
  current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
