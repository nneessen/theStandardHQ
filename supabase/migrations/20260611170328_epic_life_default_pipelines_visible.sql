-- Make Epic Life's two onboarding pipelines visible to ordinary Epic Life agents.
--
-- WHY: Epic Life agents (e.g. Blake Davis) open "Add Recruit" and the pipeline
-- picker is EMPTY. Both the RLS agent-visibility branch and the UI picker only
-- surface templates whose name starts with "DEFAULT" AND belong to the user's IMO:
--   * RLS  pipeline_templates_select_consolidated:
--          (name ~~* '%DEFAULT%') AND is_active AND imo_id = get_my_imo_id()
--   * UI   isUserSelectableTemplate(): name.startsWith('default')
--
-- The two environments are in DIFFERENT broken states (verified 2026-06-11):
--   * LOCAL: the two DEFAULT-named templates are stranded on the dead FFG IMO
--            (ffffffff-...); Epic Life (2fd256e9-...) has ZERO templates.
--            -> move them onto Epic Life.
--   * PROD : the content pipelines ("Licensed Agent Pipeline" 5 phases,
--            "Non-Licensed Recruit Pipeline" 6 phases) are ALREADY on Epic Life
--            (89514211-...) but are NOT named "DEFAULT", so both gates hide them.
--            -> add the "DEFAULT " prefix.
--
-- This DO block is env-adaptive and idempotent (keyed on names + the Epic Life
-- IMO, not on environment-specific UUIDs). Phases/checklist FK to template_id
-- (unchanged) so they ride along automatically. FFG is intentionally left as-is
-- (it is the sentinel for the platform revocation kill-switch).

DO $$
DECLARE
  v_epic uuid;
BEGIN
  SELECT id INTO v_epic FROM imos WHERE name = 'Epic Life' LIMIT 1;
  IF v_epic IS NULL THEN
    RAISE NOTICE 'No "Epic Life" IMO found; skipping (no-op on this database).';
    RETURN;
  END IF;

  -- CASE A (LOCAL-shaped): the two canonical DEFAULT-named templates stranded on
  -- FFG -> Epic Life. Scoped to the EXACT canonical names (not any 'DEFAULT%' on
  -- FFG) so we never drag an unrelated FFG row over and trip
  -- ensure_single_default_template, which would steal Epic Life's real default.
  UPDATE pipeline_templates
     SET imo_id = v_epic,
         updated_at = now()
   WHERE imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
     AND name IN ('DEFAULT Licensed Recruit Pipeline',
                  'DEFAULT Non-Licensed Recruit Pipeline');

  -- CASE B (PROD-shaped): Epic Life already owns the content pipelines but they
  -- lack the "DEFAULT" prefix both gates require -> add it. EXACT-name match (not
  -- a '%...%' substring) so a clone/test/v2 template that merely contains the
  -- substring is never silently promoted into the agent-facing picker. Excludes
  -- anything already prefixed, so re-running is a no-op.
  UPDATE pipeline_templates
     SET name = 'DEFAULT ' || name,
         updated_at = now()
   WHERE imo_id = v_epic
     AND is_active = true
     AND name NOT ILIKE 'DEFAULT%'
     AND name IN ('Licensed Agent Pipeline', 'Non-Licensed Recruit Pipeline');

  RAISE NOTICE 'Epic Life now owns % DEFAULT-named active pipeline_templates.',
    (SELECT count(*) FROM pipeline_templates
      WHERE imo_id = v_epic AND is_active = true AND name ILIKE 'DEFAULT%');
END $$;
