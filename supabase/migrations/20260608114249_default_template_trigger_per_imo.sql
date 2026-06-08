-- Make the "single default pipeline template" rule PER-IMO instead of GLOBAL.
--
-- WHY: ensure_single_default_template() ran
--   UPDATE pipeline_templates SET is_default = false WHERE id != NEW.id AND is_default = true;
-- with NO imo_id filter, so marking any template default cleared EVERY other IMO's
-- default too. Platform-wide only one IMO could have a default at a time, and the
-- 2026-06-08 re-tenant (which set Epic Life's Non-Licensed pipeline as default)
-- silently unset FFG's default. This also overrode the app-layer setDefault() scoping.
--
-- FIX: scope the unset to the same IMO (NULL imo_id forms its own shared scope via
-- IS NOT DISTINCT FROM), then restore FFG's default that the global rule had cleared.

CREATE OR REPLACE FUNCTION public.ensure_single_default_template()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_default = true THEN
    -- Set other templates in the SAME IMO to non-default. NULL imo_id (shared/global
    -- templates) forms its own scope, matched via IS NOT DISTINCT FROM.
    UPDATE pipeline_templates
    SET is_default = false
    WHERE id != NEW.id
      AND is_default = true
      AND imo_id IS NOT DISTINCT FROM NEW.imo_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Restore FFG's Non-Licensed default that the previously-global trigger cleared.
-- With the trigger now per-IMO, this leaves Epic Life's default (07fa5391) intact.
UPDATE pipeline_templates SET is_default = true, updated_at = now()
 WHERE id = 'c24402ae-18a2-41fd-b2d3-06414e4d9f20'
   AND imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
