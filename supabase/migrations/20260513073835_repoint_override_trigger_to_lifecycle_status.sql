-- supabase/migrations/20260513073835_repoint_override_trigger_to_lifecycle_status.sql
--
-- Fix: the override-creation trigger has been dead since Feb 4, 2026.
--
-- Background: On 2026-02-04 (migration 20260204141628_decouple_policy_status.sql)
-- policy state was split:
--   policies.status            : pending | approved | denied | withdrawn  (application)
--   policies.lifecycle_status  : active  | lapsed   | cancelled | expired (issued)
--
-- That migration rewrote create_override_commissions() to gate on
-- NEW.lifecycle_status = 'active', but missed the trigger definition itself.
-- The trigger watched policies.status and had WHEN (NEW.status = 'active'),
-- which is permanently false after the decoupling — policies.status never
-- takes the value 'active' anymore.
--
-- Symptom: when an upline updates a downline's policy from pending → approved
-- with lifecycle_status='active' (e.g. AgentDetailPage Application Status
-- dropdown), no override_commissions row is created for the upline. The
-- INSERT-time trigger (create_override_commissions_trigger) doesn't help
-- because at insert time the policy was still pending (lifecycle null).
--
-- Fix: repoint the trigger to watch lifecycle_status with WHEN
-- (NEW.lifecycle_status = 'active'). The function body already gates the same
-- way, so this is a pure WHEN/column-attribute correction.

DROP TRIGGER IF EXISTS trigger_create_override_commissions_on_active ON policies;

CREATE TRIGGER trigger_create_override_commissions_on_active
  AFTER INSERT OR UPDATE OF lifecycle_status ON policies
  FOR EACH ROW
  WHEN (NEW.lifecycle_status = 'active')
  EXECUTE FUNCTION create_override_commissions();

COMMENT ON TRIGGER trigger_create_override_commissions_on_active ON policies IS
  'Fires when a policy becomes active (lifecycle_status=active) on INSERT or
   UPDATE OF lifecycle_status. Replaces the pre-decoupling form that watched
   policies.status, which never takes the value ''active'' after the 2026-02-04
   status/lifecycle decoupling. Function uses ON CONFLICT DO NOTHING so
   duplicate firings (with the INSERT trigger) are harmless.';

-- ----------------------------------------------------------------------------
-- Backfill: re-evaluate every currently-active policy whose override rows
-- never got created during the broken window (2026-02-04 → today). Firing the
-- trigger via a no-op UPDATE is the safest path — the function's
-- ON CONFLICT DO NOTHING guard makes it idempotent against any policies that
-- did get overrides through the INSERT-time path.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_touched INTEGER;
BEGIN
  WITH missing AS (
    SELECT p.id
    FROM policies p
    WHERE p.lifecycle_status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM override_commissions oc WHERE oc.policy_id = p.id
      )
  ),
  fired AS (
    UPDATE policies p
       SET lifecycle_status = 'active'
      FROM missing
     WHERE p.id = missing.id
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_touched FROM fired;

  RAISE NOTICE 'Override backfill: % active policies re-evaluated (function ON CONFLICT DO NOTHING dedups any already-overridden rows).', v_touched;
END $$;
