-- supabase/migrations/20260528112134_assistant_recipient_authz.sql
-- M2: server-side recipient authorization for assistant sends, plus closing the
-- approved-content "redirect" gap that makes M2 meaningful. Both are defense in
-- depth around assistant-action-execute (the only place a draft is actually sent).
--
-- 1) Content freeze (completes H1). The H1 guard
--    (20260528090704_assistant_action_status_guard.sql) froze STATUS transitions
--    and made terminal rows immutable, but it still allowed editing other columns
--    while a row was non-terminal. So an owner could, via the raw user-scoped
--    client the frontend already imports, update({recipient, draft_payload}) on an
--    ALREADY-APPROVED row, then invoke execute -> the send goes to a recipient/body
--    the human never approved. The M2 check below would still pass (the swapped-in
--    recipient is in the caller's allowed set), so M2 alone does not close this.
--    Fix: once a row leaves draft/pending_approval, recipient/draft_payload/channel
--    are frozen, so what executes is exactly what the human approved. The legitimate
--    approve path edits those fields in the SAME pending_approval->approved UPDATE
--    (OLD.status='pending_approval'), so it is unaffected.
--
-- 2) assistant_recipient_is_allowed(channel, recipient): the M2 allowed-set check.
--    Before sending, the edge function confirms the recipient is someone the caller
--    legitimately works with. The function is SECURITY INVOKER, so the SAME RLS that
--    scopes the command center's read tools defines the allowed set:
--      * clients          -> own + downline + policy-linked + IMO-admin/super-admin
--      * recruiting_leads -> own (recruiter_id = auth.uid()) + super-admin
--      * user_profiles    -> own + hierarchy/agency + IMO-admin/super-admin
--    No re-implemented scoping. Even super-admins are constrained to in-system
--    recipients during the Epic-Life-gated MVP -- this is intentional, NOT an
--    oversight; revisit only if sending to external addresses ever becomes a real
--    requirement. The check runs once per human-approved send (rare), so the
--    unindexed phone normalization is not a hot path.

-- =============================================================================
-- 1) Lifecycle guard: status rules (unchanged from H1) + content freeze (new).
--    KEEP THE TRANSITION TABLE BELOW IN SYNC WITH core/state-machine.ts TRANSITIONS.
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
    IF NEW.status NOT IN ('draft', 'pending_approval') THEN
      RAISE EXCEPTION
        'assistant_action_requests may only be created with status draft or pending_approval (got %)',
        NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' below.

  -- Content freeze: once a row leaves the editable (draft/pending_approval) phase,
  -- the human-approved recipient/draft_payload/channel are immutable. Prevents
  -- redirecting or rewriting an approved send via the raw client (pairs with the
  -- M2 recipient check; see assistant_recipient_is_allowed). Checked for every
  -- UPDATE, whether or not status changes -- the executing claim and the
  -- executed/failed result updates do not touch these columns, so they pass.
  IF OLD.status NOT IN ('draft', 'pending_approval') THEN
    IF NEW.recipient IS DISTINCT FROM OLD.recipient
       OR NEW.draft_payload IS DISTINCT FROM OLD.draft_payload
       OR NEW.channel IS DISTINCT FROM OLD.channel THEN
      RAISE EXCEPTION
        'assistant_action_requests row % is % -- recipient/draft_payload/channel are frozen after approval',
        OLD.id, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Status unchanged: allow other-column updates ONLY while the row is not
  -- terminal (terminal rows are fully immutable).
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

COMMENT ON FUNCTION assistant_action_requests_status_guard() IS
  'BEFORE INSERT/UPDATE guard for assistant_action_requests: enforces the lifecycle (mirror of core/state-machine.ts TRANSITIONS), forbids non-initial INSERT statuses and any mutation of a terminal row, and freezes recipient/draft_payload/channel once the row leaves draft/pending_approval.';

-- (The trigger object itself is unchanged; replacing the guard body suffices.)

-- =============================================================================
-- 2) M2 allowed-set check. SECURITY INVOKER => RLS defines the allowed set.
-- =============================================================================
CREATE OR REPLACE FUNCTION assistant_recipient_is_allowed(
  p_channel   TEXT,
  p_recipient TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;  -- last 10 digits, for format-insensitive matching
BEGIN
  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RETURN false;
  END IF;

  IF p_channel = 'email' THEN
    v_email := lower(trim(p_recipient));
    RETURN
         EXISTS (SELECT 1 FROM clients          WHERE lower(email) = v_email)
      OR EXISTS (SELECT 1 FROM recruiting_leads WHERE lower(email) = v_email)
      OR EXISTS (SELECT 1 FROM user_profiles    WHERE lower(email) = v_email);

  ELSIF p_channel = 'sms' THEN
    v_phone := right(regexp_replace(p_recipient, '\D', '', 'g'), 10);
    IF length(v_phone) < 10 THEN
      RETURN false;  -- too few digits to identify a person safely
    END IF;
    RETURN
         EXISTS (SELECT 1 FROM clients          WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_phone)
      OR EXISTS (SELECT 1 FROM recruiting_leads WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_phone)
      OR EXISTS (SELECT 1 FROM user_profiles    WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_phone);
  END IF;

  RETURN false;  -- unknown channel
END;
$$;

REVOKE ALL ON FUNCTION assistant_recipient_is_allowed(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assistant_recipient_is_allowed(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION assistant_recipient_is_allowed(TEXT, TEXT) IS
  'M2: true if p_recipient (email, or phone matched on its last 10 digits) belongs to someone the CALLER may contact -- a client, recruiting lead, or team member. SECURITY INVOKER so RLS defines the allowed set (mirrors the command center read scope). Email = case-insensitive exact.';
