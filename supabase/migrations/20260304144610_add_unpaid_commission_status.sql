-- Add 'unpaid' to commission_status enum
-- 'unpaid' = policy approved/active but carrier hasn't paid the agent yet
-- Semantically different from 'pending' (policy still under review)
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- The migration runner uses psql autocommit mode, so this works correctly.
-- Do NOT wrap this in BEGIN/COMMIT.

ALTER TYPE commission_status ADD VALUE IF NOT EXISTS 'unpaid' AFTER 'pending';

-- Update sync_override_commission_status to handle the new 'unpaid' status
-- Maps 'unpaid' -> 'pending' for overrides (upline can't count it until paid)
CREATE OR REPLACE FUNCTION sync_override_commission_status()
RETURNS TRIGGER AS $$
DECLARE
  v_new_override_status TEXT;
  v_updated_count INTEGER;
BEGIN
  -- For INSERT, check if the new commission has a status that should sync
  -- For UPDATE, check if the status actually changed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = NEW.status THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Skip if no policy_id (standalone commission)
  IF NEW.policy_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map commission status to override status
  CASE NEW.status
    WHEN 'paid' THEN
      v_new_override_status := 'earned';
    WHEN 'charged_back' THEN
      v_new_override_status := 'chargedback';
    WHEN 'cancelled' THEN
      v_new_override_status := 'cancelled';
    WHEN 'clawback' THEN
      v_new_override_status := 'chargedback';
    WHEN 'pending' THEN
      v_new_override_status := 'pending';
    WHEN 'unpaid' THEN
      v_new_override_status := 'pending';
    WHEN 'earned' THEN
      -- Commission is earned but not paid yet - override stays pending
      v_new_override_status := 'pending';
    WHEN 'advance' THEN
      -- Advance commissions - override stays pending until paid
      v_new_override_status := 'pending';
    ELSE
      -- Unknown status, don't update overrides
      RETURN NEW;
  END CASE;

  -- Update all override_commissions for this policy where base_agent matches
  UPDATE override_commissions
  SET
    status = v_new_override_status,
    updated_at = NOW()
  WHERE policy_id = NEW.policy_id
    AND base_agent_id = NEW.user_id
    AND status != v_new_override_status;  -- Only update if status is different

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RAISE NOTICE 'Synced % override_commissions for policy % to status % (commission % -> %)',
      v_updated_count, NEW.policy_id, v_new_override_status,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE 'N/A (INSERT)' END,
      NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION sync_override_commission_status() IS
'Syncs override_commissions status when base commission status changes.
Handles both INSERT and UPDATE operations.
Maps commission status to override status:
- paid -> earned (upline can count this income)
- charged_back/clawback -> chargedback
- cancelled -> cancelled
- pending/unpaid/earned/advance -> pending (not yet countable for upline)';
