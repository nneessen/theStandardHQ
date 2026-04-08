-- Close AI Builder: Clone to Teammate
--
-- Adds the authorization predicate, eligible-teammates picker, and audit log
-- for the cross-org clone feature in the Library tab. The feature lets a user
-- duplicate an email template, SMS template, or sequence (workflow) from their
-- own Close CRM org into a teammate's Close CRM org with a mandatory
-- confirmation step.
--
-- Authorization rule: caller may clone to a target if
--   1. caller is super admin (clone to anyone with active close_config), OR
--   2. target is a strict descendant in caller's hierarchy_path (downline), OR
--   3. caller and target share the same immediate upline (sibling)
-- AND target is approved, non-archived, and has an active close_config row.
--
-- Why a separate predicate function (vs inline edge-function SQL): the rule
-- lives in one place and is grant-controlled. Both the user-facing picker
-- (get_teammates_with_close_connected) and the server-side enforcement
-- (can_clone_close_item_to) call it / mirror it. If the rule changes, both
-- queries change in lockstep.

BEGIN;

-- ─── 1. Authorization predicate ─────────────────────────────────────
--
-- Used by the close-ai-builder edge function BEFORE fetching the target's
-- Close API key. Returns FALSE if caller is unauthenticated, target is the
-- caller, target doesn't exist, target is archived/unapproved, target is not
-- Close-connected, or hierarchy/sibling check fails.
--
-- The hierarchy_path substring match is the canonical pattern used by
-- get_team_member_ids — safe because UUIDs are globally unique and the
-- path is dot-delimited.

CREATE OR REPLACE FUNCTION can_clone_close_item_to(p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller          UUID := auth.uid();
  v_caller_upline   UUID;
  v_target_upline   UUID;
  v_target_path     TEXT;
  v_target_active   BOOLEAN;
  v_target_archived TIMESTAMPTZ;
  v_target_status   TEXT;
BEGIN
  IF v_caller IS NULL OR p_target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF v_caller = p_target_user_id THEN
    RETURN FALSE;
  END IF;

  -- Target gating: must exist, be approved, non-archived, and Close-connected.
  SELECT up.upline_id, up.hierarchy_path, up.archived_at, up.approval_status,
         cc.is_active
    INTO v_target_upline, v_target_path, v_target_archived, v_target_status,
         v_target_active
    FROM user_profiles up
    LEFT JOIN close_config cc ON cc.user_id = up.id
   WHERE up.id = p_target_user_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_target_archived IS NOT NULL THEN RETURN FALSE; END IF;
  IF v_target_status IS DISTINCT FROM 'approved' THEN RETURN FALSE; END IF;
  IF v_target_active IS NOT TRUE THEN RETURN FALSE; END IF;

  -- Tier 1: super-admin bypass.
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- Tier 2: downline (strict descendant via hierarchy_path).
  -- Substring match on UUID is safe (UUIDs are globally unique). Same pattern
  -- as get_team_member_ids in 20260406183110_get_team_member_ids_rpc.sql.
  IF v_target_path IS NOT NULL
     AND v_target_path LIKE '%' || v_caller::text || '%' THEN
    RETURN TRUE;
  END IF;

  -- Tier 3: sibling (same immediate upline).
  SELECT upline_id INTO v_caller_upline FROM user_profiles WHERE id = v_caller;
  IF v_caller_upline IS NOT NULL
     AND v_target_upline IS NOT NULL
     AND v_caller_upline = v_target_upline THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION can_clone_close_item_to(UUID) FROM public;
GRANT EXECUTE ON FUNCTION can_clone_close_item_to(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_clone_close_item_to(UUID) TO service_role;

COMMENT ON FUNCTION can_clone_close_item_to(UUID) IS
  'Authorization predicate for cross-org clone in Close AI Builder. Returns TRUE iff caller may clone an item into the target''s Close org. Allowed: downlines, immediate siblings, super-admin to anyone. Used by close-ai-builder edge function.';


-- ─── 2. Eligible teammate picker ────────────────────────────────────
--
-- Returns the set of users the caller may clone TO. Mirrors the same predicate
-- as can_clone_close_item_to but inverted into a list. Used by the dialog's
-- teammate picker. SECURITY DEFINER so the user client can read minimal
-- non-sensitive fields about other users without needing broad RLS grants.

CREATE OR REPLACE FUNCTION get_teammates_with_close_connected()
RETURNS TABLE(
  user_id           UUID,
  first_name        TEXT,
  last_name         TEXT,
  email             TEXT,
  organization_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_caller_upline UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF is_super_admin() THEN
    RETURN QUERY
      SELECT up.id, up.first_name, up.last_name, up.email, cc.organization_name
        FROM user_profiles up
        JOIN close_config cc ON cc.user_id = up.id
       WHERE cc.is_active = TRUE
         AND up.archived_at IS NULL
         AND up.approval_status = 'approved'
         AND up.id <> v_caller
       ORDER BY up.first_name, up.last_name;
    RETURN;
  END IF;

  SELECT upline_id INTO v_caller_upline FROM user_profiles WHERE id = v_caller;

  RETURN QUERY
    SELECT up.id, up.first_name, up.last_name, up.email, cc.organization_name
      FROM user_profiles up
      JOIN close_config cc ON cc.user_id = up.id
     WHERE cc.is_active = TRUE
       AND up.archived_at IS NULL
       AND up.approval_status = 'approved'
       AND up.id <> v_caller
       AND (
         -- Downline match (strict descendant via hierarchy_path)
         (up.hierarchy_path IS NOT NULL
          AND up.hierarchy_path LIKE '%' || v_caller::text || '%')
         -- Sibling match (same immediate upline)
         OR (v_caller_upline IS NOT NULL AND up.upline_id = v_caller_upline)
       )
     ORDER BY up.first_name, up.last_name;
END;
$$;

REVOKE ALL ON FUNCTION get_teammates_with_close_connected() FROM public;
GRANT EXECUTE ON FUNCTION get_teammates_with_close_connected() TO authenticated;

COMMENT ON FUNCTION get_teammates_with_close_connected() IS
  'Returns the list of teammates the caller may clone Close library items to. Used by Close AI Builder library dialog. Mirrors can_clone_close_item_to predicate.';


-- ─── 3. Audit log ───────────────────────────────────────────────────
--
-- Every cross-org clone attempt is logged here, including denials and
-- failures. Recipients can SELECT their own rows so they can see exactly
-- what was pushed into their Close org and from whom. Senders can SELECT
-- their own rows to audit their own activity. INSERT is restricted to the
-- service_role used by the edge function. No UPDATE or DELETE.

CREATE TABLE IF NOT EXISTS cross_org_clone_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  item_type        TEXT NOT NULL CHECK (item_type IN ('email_template','sms_template','sequence')),
  source_item_id   TEXT NOT NULL,             -- Close id in caller's org
  target_item_id   TEXT,                      -- Close id in target's org (null on failure/denied)
  target_child_ids TEXT[],                    -- Sequence: new child template ids in target's org
  status           TEXT NOT NULL CHECK (status IN ('success','denied','failed','partial_rollback')),
  error_code       TEXT,
  error_message    TEXT,
  warnings         JSONB,                     -- soft sanitization warnings (merge fields, hardcoded names/phones/emails)
  cloned_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cross_org_clone_log_caller_idx
  ON cross_org_clone_log(caller_id, cloned_at DESC);
CREATE INDEX IF NOT EXISTS cross_org_clone_log_target_idx
  ON cross_org_clone_log(target_id, cloned_at DESC);

ALTER TABLE cross_org_clone_log ENABLE ROW LEVEL SECURITY;

-- Caller and target can both SELECT their own rows.
DROP POLICY IF EXISTS "users_see_own_clone_log" ON cross_org_clone_log;
CREATE POLICY "users_see_own_clone_log" ON cross_org_clone_log
  FOR SELECT TO authenticated
  USING (caller_id = (SELECT auth.uid()) OR target_id = (SELECT auth.uid()));

-- Inserts only via service_role (the edge function).
DROP POLICY IF EXISTS "service_only_insert_clone_log" ON cross_org_clone_log;
CREATE POLICY "service_only_insert_clone_log" ON cross_org_clone_log
  FOR INSERT TO service_role WITH CHECK (true);

COMMENT ON TABLE cross_org_clone_log IS
  'Immutable audit log of every cross-org clone attempt in the Close AI Builder. Status tracks success/denied/failed/partial_rollback. Both caller and target can read their own rows.';

COMMIT;
