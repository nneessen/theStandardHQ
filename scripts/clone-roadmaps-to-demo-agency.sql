-- Clone the 9 Agent Roadmaps (templates + sections + items) onto the LOCAL demo
-- agency so the seeded Epic-Life owner sees a populated Agent Roadmap page.
--
-- They currently live under the FFG "The Standard" agency (aaaaaaaa…); the demo
-- runs under the Epic-Life "The Standard" agency (ca43b42a…). Roadmaps are
-- agency-scoped, so without this the page is empty for the demo owner.
--
-- Per-user progress (roadmap_item_progress) is intentionally NOT copied.
-- Idempotent: wipes any prior clone under the demo agency first, then re-clones.
--
-- LOCAL ONLY. Run with:
--   ./scripts/migrations/run-sql.sh -f scripts/clone-roadmaps-to-demo-agency.sql

DO $$
DECLARE
  v_src     uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; -- FFG "The Standard" (source)
  v_dst     uuid := 'ca43b42a-e4e4-49cf-be1b-efd19fb21db9'; -- Epic demo "The Standard"
  v_imo     uuid := '2fd256e9-9abb-445e-b405-62436555648a'; -- Epic Life IMO (local)
  v_creator uuid := 'd0d3edea-af6d-4990-80b8-1765ba829896'; -- demo owner (epiclife.neessen@gmail.com)
  v_tmpl int; v_sec int; v_item int;
BEGIN
  -- Idempotent reset: remove any prior clone under the demo agency (child-first).
  DELETE FROM public.roadmap_items    WHERE agency_id = v_dst;
  DELETE FROM public.roadmap_sections WHERE agency_id = v_dst;
  DELETE FROM public.roadmap_templates WHERE agency_id = v_dst;

  -- 1) Templates: old id -> fresh id
  CREATE TEMP TABLE _tmpl_map ON COMMIT DROP AS
    SELECT id AS old_id, gen_random_uuid() AS new_id
    FROM public.roadmap_templates WHERE agency_id = v_src;

  INSERT INTO public.roadmap_templates
    (id, agency_id, imo_id, title, description, icon,
     is_published, is_default, sort_order, created_by)
  SELECT m.new_id, v_dst, v_imo, t.title, t.description, t.icon,
         t.is_published, t.is_default, t.sort_order, v_creator
  FROM public.roadmap_templates t JOIN _tmpl_map m ON m.old_id = t.id;
  GET DIAGNOSTICS v_tmpl = ROW_COUNT;

  -- 2) Sections: old id -> fresh id (re-pointed to the cloned template)
  CREATE TEMP TABLE _sec_map ON COMMIT DROP AS
    SELECT id AS old_id, gen_random_uuid() AS new_id
    FROM public.roadmap_sections WHERE agency_id = v_src;

  INSERT INTO public.roadmap_sections
    (id, roadmap_id, agency_id, title, description, sort_order)
  SELECT sm.new_id, tm.new_id, v_dst, s.title, s.description, s.sort_order
  FROM public.roadmap_sections s
  JOIN _sec_map  sm ON sm.old_id = s.id
  JOIN _tmpl_map tm ON tm.old_id = s.roadmap_id;
  GET DIAGNOSTICS v_sec = ROW_COUNT;

  -- 3) Items: re-pointed to cloned section + template
  INSERT INTO public.roadmap_items
    (id, section_id, roadmap_id, agency_id, title, summary, content_blocks,
     is_required, is_published, estimated_minutes, sort_order)
  SELECT gen_random_uuid(), sm.new_id, tm.new_id, v_dst, i.title, i.summary,
         i.content_blocks, i.is_required, i.is_published, i.estimated_minutes, i.sort_order
  FROM public.roadmap_items i
  JOIN _sec_map  sm ON sm.old_id = i.section_id
  JOIN _tmpl_map tm ON tm.old_id = i.roadmap_id;
  GET DIAGNOSTICS v_item = ROW_COUNT;

  RAISE NOTICE 'Cloned % templates, % sections, % items to demo agency %', v_tmpl, v_sec, v_item, v_dst;
END $$;

SELECT count(*) AS demo_agency_roadmaps
FROM public.roadmap_templates
WHERE agency_id = 'ca43b42a-e4e4-49cf-be1b-efd19fb21db9';
