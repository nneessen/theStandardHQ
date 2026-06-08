-- Re-home "The Standard" onboarding pipeline content from the dead FFG IMO to the
-- active Epic Life IMO, and remove the empty Epic Life shell templates.
--
-- WHY: The real onboarding content (a 5-phase/17-item Non-Licensed pipeline and a
-- 1-phase Licensed pipeline) was built on 2026-04-29 while the super-admin's effective
-- IMO still resolved to FFG (the create-context mis-stamp), so it is stranded on the
-- dead FFG IMO. Meanwhile Epic Life's two templates are EMPTY shells (0 phases/items),
-- and one of them is the default — so a new Epic Life recruit gets a blank onboarding.
-- Owner-approved fix: re-tenant the content to Epic Life, make the Non-Licensed pipeline
-- the Epic Life default, and delete the empty shells. All four templates have 0 assigned
-- recruits (verified), so nothing is stranded. Environment-specific row ids — a no-op on
-- any database that doesn't contain them.
--
-- IDs:
--   Epic Life IMO           89514211-f2bd-4440-9527-90a472c5e622
--   FFG content (Non-Lic)   07fa5391-a85a-46e8-853f-583797db9df2  (5 phases / 17 items)
--   FFG content (Licensed)  796a5de2-87a2-46cc-a8f0-40eae2440a5e  (1 phase  / 1 item)
--   Epic Life empty shells  cd674c56-7d6e-4159-b8d3-d2dd9e1a594b  (current default, 0/0)
--                           e1ad5269-ff1e-45a6-91ba-5d5c37b0a722  (0/0)

DO $$
DECLARE
  v_epic uuid := '89514211-f2bd-4440-9527-90a472c5e622';
BEGIN
  -- 1) Re-tenant the two content-bearing "The Standard" templates to Epic Life.
  --    Reset is_default so the default is set explicitly in step 3.
  UPDATE pipeline_templates
     SET imo_id = v_epic, is_default = false, updated_at = now()
   WHERE id IN ('07fa5391-a85a-46e8-853f-583797db9df2',
                '796a5de2-87a2-46cc-a8f0-40eae2440a5e');

  -- 2) Delete the empty Epic Life shells — but ONLY if they are genuinely empty
  --    (defensive: never delete a template that has phases).
  DELETE FROM pipeline_templates pt
   WHERE pt.id IN ('cd674c56-7d6e-4159-b8d3-d2dd9e1a594b',
                   'e1ad5269-ff1e-45a6-91ba-5d5c37b0a722')
     AND NOT EXISTS (SELECT 1 FROM pipeline_phases ph WHERE ph.template_id = pt.id);

  -- 3) Make the 5-phase Non-Licensed pipeline the single active Epic Life default.
  UPDATE pipeline_templates
     SET is_default = true, is_active = true, updated_at = now()
   WHERE id = '07fa5391-a85a-46e8-853f-583797db9df2';
END $$;
