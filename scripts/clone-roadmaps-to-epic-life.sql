-- Clone the existing Agent Roadmaps into Epic Life.
--
-- The 9 roadmaps (templates + sections + items) currently live under the
-- FFG "The Standard" agency (aaaaaaaa…). FFG is being retired; the same
-- roadmaps need to exist under Epic Life so Epic agents get the same
-- onboarding. Per-user progress (roadmap_item_progress) is intentionally
-- NOT copied — agents start fresh under Epic.
--
-- Idempotent: guarded so re-running does nothing once Epic Life has roadmaps.
-- The roadmap_sections/items BEFORE-INSERT triggers re-derive agency_id and
-- roadmap_id from the parent, so the new rows are correctly tenanted to Epic.
--
-- Run with:
--   source .env && DATABASE_URL="$REMOTE_DATABASE_URL" \
--     ./scripts/migrations/run-sql.sh -f scripts/clone-roadmaps-to-epic-life.sql

DO $$
DECLARE
  v_src_agency uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; -- FFG "The Standard"
  v_dst_agency uuid := '1df3c15a-f48a-4fbd-b1a8-345793bba2c0'; -- Epic "The Standard"
  v_dst_imo    uuid := '89514211-f2bd-4440-9527-90a472c5e622'; -- Epic Life IMO
  v_creator    uuid := '69559ef2-9350-44d3-81a1-5f59a2e6b42d'; -- epiclife.neessen@gmail.com
  v_tmpl int; v_sec int; v_item int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.roadmap_templates WHERE imo_id = v_dst_imo) THEN
    RAISE NOTICE 'Epic Life already has roadmaps — skipping clone (idempotent).';
    RETURN;
  END IF;

  -- 1) Templates: old id -> fresh id
  CREATE TEMP TABLE _tmpl_map ON COMMIT DROP AS
    SELECT id AS old_id, gen_random_uuid() AS new_id
    FROM public.roadmap_templates
    WHERE agency_id = v_src_agency;

  INSERT INTO public.roadmap_templates
    (id, agency_id, imo_id, title, description, icon,
     is_published, is_default, sort_order, created_by)
  SELECT m.new_id, v_dst_agency, v_dst_imo, t.title, t.description, t.icon,
         t.is_published, t.is_default, t.sort_order, v_creator
  FROM public.roadmap_templates t
  JOIN _tmpl_map m ON m.old_id = t.id;
  GET DIAGNOSTICS v_tmpl = ROW_COUNT;

  -- 2) Sections: old id -> fresh id, pointing at the cloned template
  CREATE TEMP TABLE _sec_map ON COMMIT DROP AS
    SELECT s.id AS old_id, gen_random_uuid() AS new_id, m.new_id AS new_roadmap_id
    FROM public.roadmap_sections s
    JOIN _tmpl_map m ON m.old_id = s.roadmap_id;

  INSERT INTO public.roadmap_sections
    (id, roadmap_id, agency_id, title, description, sort_order)
  SELECT sm.new_id, sm.new_roadmap_id, v_dst_agency, s.title, s.description, s.sort_order
  FROM public.roadmap_sections s
  JOIN _sec_map sm ON sm.old_id = s.id;
  GET DIAGNOSTICS v_sec = ROW_COUNT;

  -- 3) Items: fresh id, pointing at the cloned section (trigger sets roadmap_id+agency_id)
  INSERT INTO public.roadmap_items
    (id, section_id, roadmap_id, agency_id, title, summary, content_blocks,
     is_required, is_published, estimated_minutes, sort_order)
  SELECT gen_random_uuid(), sm.new_id, sm.new_roadmap_id, v_dst_agency,
         i.title, i.summary, i.content_blocks,
         i.is_required, i.is_published, i.estimated_minutes, i.sort_order
  FROM public.roadmap_items i
  JOIN _sec_map sm ON sm.old_id = i.section_id;
  GET DIAGNOSTICS v_item = ROW_COUNT;

  RAISE NOTICE 'Cloned to Epic Life: % templates, % sections, % items', v_tmpl, v_sec, v_item;
END $$;
