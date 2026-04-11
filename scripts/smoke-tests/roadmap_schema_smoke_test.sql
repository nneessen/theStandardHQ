-- Agent Roadmap smoke test: verify schema, triggers, RPCs.
-- Bypasses RLS with session_replication_role=replica so we don't need auth.uid().
-- Rolls back at the end so it leaves no footprint.

BEGIN;

-- Pick any real agency and user to satisfy FK constraints
-- (runs as postgres superuser so RLS doesn't apply; we just need triggers to fire)
DO $$
DECLARE
  v_agency_id    uuid;
  v_user_id      uuid;
  v_rm_id        uuid;
  v_rm2_id       uuid;
  v_sec1_id      uuid;
  v_sec2_id      uuid;
  v_item1_id     uuid;
  v_item2_id     uuid;
  v_item3_id     uuid;
  v_orders       text;
BEGIN
  SELECT id INTO v_agency_id FROM public.agencies LIMIT 1;
  SELECT id INTO v_user_id   FROM public.user_profiles LIMIT 1;

  IF v_agency_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Need at least one agency and one user_profile in DB';
  END IF;

  RAISE NOTICE 'Using agency=%, user=%', v_agency_id, v_user_id;

  -- Create two templates
  INSERT INTO public.roadmap_templates (agency_id, title, created_by, is_published)
    VALUES (v_agency_id, 'Smoke Template A', v_user_id, true)
    RETURNING id INTO v_rm_id;

  INSERT INTO public.roadmap_templates (agency_id, title, created_by, is_published)
    VALUES (v_agency_id, 'Smoke Template B', v_user_id, true)
    RETURNING id INTO v_rm2_id;

  RAISE NOTICE 'Created templates rm=% rm2=%', v_rm_id, v_rm2_id;

  -- Section 1 with sort_order=0 (agency_id should auto-populate via trigger)
  INSERT INTO public.roadmap_sections (roadmap_id, title, sort_order)
    VALUES (v_rm_id, 'Week 1: Setup', 0)
    RETURNING id INTO v_sec1_id;

  -- Section 2
  INSERT INTO public.roadmap_sections (roadmap_id, title, sort_order)
    VALUES (v_rm_id, 'Week 2: CRM', 1)
    RETURNING id INTO v_sec2_id;

  -- Check the trigger populated agency_id
  IF (SELECT agency_id FROM public.roadmap_sections WHERE id = v_sec1_id) <> v_agency_id THEN
    RAISE EXCEPTION 'Section agency_id trigger FAILED';
  END IF;
  RAISE NOTICE '✓ Section inheritance trigger OK';

  -- 3 items in section 1
  INSERT INTO public.roadmap_items (section_id, title, sort_order)
    VALUES (v_sec1_id, 'Item A', 0) RETURNING id INTO v_item1_id;
  INSERT INTO public.roadmap_items (section_id, title, sort_order)
    VALUES (v_sec1_id, 'Item B', 1) RETURNING id INTO v_item2_id;
  INSERT INTO public.roadmap_items (section_id, title, sort_order)
    VALUES (v_sec1_id, 'Item C', 2) RETURNING id INTO v_item3_id;

  IF (SELECT roadmap_id FROM public.roadmap_items WHERE id = v_item1_id) <> v_rm_id THEN
    RAISE EXCEPTION 'Item roadmap_id trigger FAILED';
  END IF;
  RAISE NOTICE '✓ Item inheritance trigger OK';

  -- Test: reorder items C, A, B
  PERFORM public.roadmap_reorder_items(v_sec1_id, ARRAY[v_item3_id, v_item1_id, v_item2_id]);

  SELECT string_agg(title || '=' || sort_order::text, ', ' ORDER BY sort_order)
    INTO v_orders
    FROM public.roadmap_items WHERE section_id = v_sec1_id;
  RAISE NOTICE 'After reorder: %', v_orders;

  IF (SELECT sort_order FROM public.roadmap_items WHERE id = v_item3_id) <> 0
  OR (SELECT sort_order FROM public.roadmap_items WHERE id = v_item1_id) <> 1
  OR (SELECT sort_order FROM public.roadmap_items WHERE id = v_item2_id) <> 2 THEN
    RAISE EXCEPTION 'roadmap_reorder_items FAILED';
  END IF;
  RAISE NOTICE '✓ roadmap_reorder_items OK';

  -- Test: move item A to section 2 at index 0
  PERFORM public.roadmap_move_item(v_item1_id, v_sec2_id, 0);

  IF (SELECT section_id FROM public.roadmap_items WHERE id = v_item1_id) <> v_sec2_id THEN
    RAISE EXCEPTION 'Item did not move sections';
  END IF;
  IF (SELECT sort_order FROM public.roadmap_items WHERE id = v_item1_id) <> 0 THEN
    RAISE EXCEPTION 'Moved item sort_order wrong';
  END IF;

  -- Source section should now have C=0, B=1 (compacted)
  IF (SELECT count(*) FROM public.roadmap_items WHERE section_id = v_sec1_id) <> 2 THEN
    RAISE EXCEPTION 'Source section did not compact';
  END IF;
  RAISE NOTICE '✓ roadmap_move_item (cross-section) OK';

  -- Test: cannot move across different roadmaps
  INSERT INTO public.roadmap_sections (roadmap_id, title, sort_order)
    VALUES (v_rm2_id, 'Other section', 0);

  BEGIN
    PERFORM public.roadmap_move_item(
      v_item1_id,
      (SELECT id FROM public.roadmap_sections WHERE roadmap_id = v_rm2_id LIMIT 1),
      0
    );
    RAISE EXCEPTION 'Should have rejected cross-roadmap move';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%cannot move item across roadmaps%' THEN
      RAISE NOTICE '✓ Cross-roadmap move correctly blocked';
    ELSE
      RAISE;
    END IF;
  END;

  -- Test: set_default atomically
  PERFORM public.roadmap_set_default(v_rm_id);
  IF NOT (SELECT is_default FROM public.roadmap_templates WHERE id = v_rm_id) THEN
    RAISE EXCEPTION 'set_default did not set target';
  END IF;

  PERFORM public.roadmap_set_default(v_rm2_id);
  IF (SELECT is_default FROM public.roadmap_templates WHERE id = v_rm_id) THEN
    RAISE EXCEPTION 'set_default did not clear previous default';
  END IF;
  IF NOT (SELECT is_default FROM public.roadmap_templates WHERE id = v_rm2_id) THEN
    RAISE EXCEPTION 'set_default did not set new target';
  END IF;
  RAISE NOTICE '✓ roadmap_set_default atomic swap OK';

  -- Test: partial unique index — direct double INSERT of is_default=true should fail
  UPDATE public.roadmap_templates SET is_default = false;
  UPDATE public.roadmap_templates SET is_default = true WHERE id = v_rm_id;
  BEGIN
    UPDATE public.roadmap_templates SET is_default = true WHERE id = v_rm2_id;
    RAISE EXCEPTION 'Partial unique index did not enforce single default';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✓ Partial unique index blocks double default';
  END;

  -- Test: content_blocks must be an array
  BEGIN
    UPDATE public.roadmap_items
    SET content_blocks = '{"not":"array"}'::jsonb
    WHERE id = v_item2_id;
    RAISE EXCEPTION 'content_blocks_is_array check did not fire';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ content_blocks array check OK';
  END;

  -- Test: progress insertion, trigger inheritance, unique constraint
  INSERT INTO public.roadmap_item_progress (user_id, item_id, status)
    VALUES (v_user_id, v_item2_id, 'in_progress');

  IF (SELECT agency_id FROM public.roadmap_item_progress
       WHERE user_id = v_user_id AND item_id = v_item2_id) <> v_agency_id THEN
    RAISE EXCEPTION 'Progress trigger FAILED';
  END IF;
  RAISE NOTICE '✓ Progress inheritance trigger OK';

  BEGIN
    INSERT INTO public.roadmap_item_progress (user_id, item_id, status)
      VALUES (v_user_id, v_item2_id, 'completed');
    RAISE EXCEPTION 'Unique (user_id,item_id) constraint did not fire';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✓ Unique (user_id, item_id) OK';
  END;

  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ ALL SMOKE TESTS PASSED';
  RAISE NOTICE '============================================================';
END $$;

ROLLBACK;
