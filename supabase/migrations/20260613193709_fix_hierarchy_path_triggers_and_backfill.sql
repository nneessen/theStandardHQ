-- ============================================================================
-- Fix hierarchy_path / hierarchy_depth maintenance: consolidate triggers,
-- repair drift, add a self-verifying integrity check, and index path scans.
-- ============================================================================
--
-- WHY:
--   user_profiles had FOUR overlapping triggers all mutating hierarchy_path /
--   hierarchy_depth:
--     * trigger_set_hierarchy_path_on_insert        (BEFORE INSERT)
--     * update_hierarchy_path_trigger               (BEFORE INSERT/UPDATE)  <- unguarded
--     * trigger_update_hierarchy_path_on_upline_change (BEFORE UPDATE)
--     * trigger_cascade_hierarchy_path              (AFTER UPDATE)
--   On a re-parent (upline_id change) the AFTER cascade rewrites descendant
--   paths via substring math, but the UNGUARDED `update_hierarchy_path` BEFORE
--   trigger fires again on every cascaded row and recomputes path/depth from the
--   immediate upline's *current* value -- order-dependent, so the moved subtree
--   ends up with stale/wrong paths and depths. Observed live: re-parenting one
--   agent left all 10 of their downline with depth stuck at the old value and
--   paths not re-prefixed, which silently broke every hierarchy_path-based
--   rollup (team leaderboard team_size, agency counts, "my team" page).
--
--   The adjacency list (upline_id) is the verified-clean source of truth (no
--   cycles, no dangling FKs, no cross-imo edges). The materialized columns are
--   a cache derived from it.
--
-- WHAT THIS DOES:
--   1. Drops the 4 overlapping triggers + their functions.
--   2. Installs exactly TWO maintainers:
--        - sync_node_hierarchy_path()      BEFORE INSERT OR UPDATE OF upline_id
--          -> sets THIS row's path/depth from its upline.
--        - cascade_subtree_hierarchy_path() AFTER UPDATE OF upline_id
--          -> recomputes the ENTIRE descendant subtree in one recursive pass.
--      The cascade writes only hierarchy_path/hierarchy_depth (never upline_id),
--      so it cannot re-fire either trigger -> no re-entrancy, no clobbering,
--      order-independent and correct.
--   3. One-time backfill: recompute every row's path/depth from the adjacency
--      list (repairs all currently-drifted rows).
--   4. verify_hierarchy_integrity(): returns drifted-row count (0 = healthy) for
--      CI / scheduled assertions; the migration RAISEs if drift != 0 after fix.
--   5. Index for `hierarchy_path LIKE 'prefix%'` rollup scans.
--
--   `check_no_circular_reference` (cycle guard) and `propagate_agency_from_upline`
--   are intentionally left untouched -- different concerns.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Remove the overlapping legacy triggers + functions
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_set_hierarchy_path_on_insert ON user_profiles;
DROP TRIGGER IF EXISTS update_hierarchy_path_trigger ON user_profiles;
DROP TRIGGER IF EXISTS trigger_update_hierarchy_path_on_upline_change ON user_profiles;
DROP TRIGGER IF EXISTS trigger_cascade_hierarchy_path ON user_profiles;

DROP FUNCTION IF EXISTS set_hierarchy_path_on_insert() CASCADE;
DROP FUNCTION IF EXISTS update_hierarchy_path() CASCADE;
DROP FUNCTION IF EXISTS update_hierarchy_path_on_upline_change() CASCADE;
DROP FUNCTION IF EXISTS cascade_hierarchy_path_changes() CASCADE;

-- ----------------------------------------------------------------------------
-- 2a. Single setter: maintain THIS node's own path/depth from its upline.
--     Fires on INSERT and only when upline_id actually appears in an UPDATE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_node_hierarchy_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_path  text;
  v_parent_depth int;
BEGIN
  IF NEW.upline_id IS NULL THEN
    -- Root: path is just the node's own id.
    NEW.hierarchy_path  := NEW.id::text;
    NEW.hierarchy_depth := 0;
    RETURN NEW;
  END IF;

  SELECT hierarchy_path, COALESCE(hierarchy_depth, 0)
    INTO v_parent_path, v_parent_depth
  FROM user_profiles
  WHERE id = NEW.upline_id;

  IF v_parent_path IS NULL THEN
    -- Upline exists (FK) but somehow has no path yet -> derive from its id.
    v_parent_path  := NEW.upline_id::text;
    v_parent_depth := 0;
  END IF;

  NEW.hierarchy_path  := v_parent_path || '.' || NEW.id::text;
  NEW.hierarchy_depth := v_parent_depth + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_hierarchy_path
  BEFORE INSERT OR UPDATE OF upline_id ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_node_hierarchy_path();

-- ----------------------------------------------------------------------------
-- 2b. Single cascade: on a re-parent, recompute the WHOLE descendant subtree
--     in one recursive pass. Writes only path/depth (not upline_id), so it
--     never re-fires the setter or itself. Order-independent and terminating.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cascade_subtree_hierarchy_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- NEW.hierarchy_path / NEW.hierarchy_depth were already set correctly by the
  -- BEFORE setter. Recompute every descendant from NEW downward.
  WITH RECURSIVE subtree AS (
    SELECT c.id,
           NEW.hierarchy_path || '.' || c.id::text AS path,
           NEW.hierarchy_depth + 1                 AS depth
    FROM user_profiles c
    WHERE c.upline_id = NEW.id
    UNION ALL
    SELECT c.id,
           s.path || '.' || c.id::text,
           s.depth + 1
    FROM user_profiles c
    JOIN subtree s ON c.upline_id = s.id
    WHERE s.depth < 100  -- defensive guard; cycles are blocked elsewhere
  )
  UPDATE user_profiles u
  SET hierarchy_path  = s.path,
      hierarchy_depth = s.depth,
      updated_at      = now()
  FROM subtree s
  WHERE u.id = s.id;

  RETURN NULL;  -- AFTER trigger
END;
$$;

CREATE TRIGGER trg_cascade_hierarchy_path
  AFTER UPDATE OF upline_id ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION cascade_subtree_hierarchy_path();

-- ----------------------------------------------------------------------------
-- 3. One-time backfill: recompute all path/depth from the adjacency list.
--    Touches only hierarchy_path/hierarchy_depth -> does not fire the new
--    upline_id triggers.
-- ----------------------------------------------------------------------------
WITH RECURSIVE tree AS (
  SELECT id, id::text AS path, 0 AS depth
  FROM user_profiles
  WHERE upline_id IS NULL
  UNION ALL
  SELECT c.id, t.path || '.' || c.id::text, t.depth + 1
  FROM user_profiles c
  JOIN tree t ON c.upline_id = t.id
  WHERE t.depth < 100
)
UPDATE user_profiles u
SET hierarchy_path  = t.path,
    hierarchy_depth = t.depth
FROM tree t
WHERE u.id = t.id
  AND (u.hierarchy_path IS DISTINCT FROM t.path
       OR u.hierarchy_depth IS DISTINCT FROM t.depth);

-- ----------------------------------------------------------------------------
-- 4. Integrity verifier: drifted-row count (0 = healthy). For CI / cron.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_hierarchy_integrity()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH RECURSIVE tree AS (
    SELECT id, id::text AS path, 0 AS depth
    FROM user_profiles
    WHERE upline_id IS NULL
    UNION ALL
    SELECT c.id, t.path || '.' || c.id::text, t.depth + 1
    FROM user_profiles c
    JOIN tree t ON c.upline_id = t.id
    WHERE t.depth < 100
  )
  SELECT count(*)
  FROM user_profiles u
  JOIN tree t ON t.id = u.id
  WHERE u.hierarchy_path IS DISTINCT FROM t.path
     OR u.hierarchy_depth IS DISTINCT FROM t.depth;
$$;

-- ----------------------------------------------------------------------------
-- 5. Index for hierarchy_path prefix scans (LIKE 'prefix%') used by rollups.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_profiles_hierarchy_path_pattern
  ON user_profiles (hierarchy_path text_pattern_ops);

-- ----------------------------------------------------------------------------
-- 6. Self-check: fail the migration if any drift remains.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_drift bigint;
BEGIN
  v_drift := verify_hierarchy_integrity();
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'hierarchy integrity check FAILED: % drifted row(s) remain', v_drift;
  END IF;
  RAISE NOTICE 'hierarchy integrity OK: 0 drifted rows';
END;
$$;

COMMIT;
