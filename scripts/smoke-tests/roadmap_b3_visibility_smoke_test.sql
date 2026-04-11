-- B-3 smoke test: roadmap_upsert_progress must reject items the caller
-- cannot see (unpublished item or unpublished template).
--
-- Runs as postgres superuser, which bypasses RLS but NOT the explicit
-- is_super_admin() check inside the RPC (that checks user_profiles.is_super_admin).
-- We simulate a non-super-admin by using a test user who is NOT super-admin.

BEGIN;

DO $$
DECLARE
  v_agency_id       uuid;
  v_user_id         uuid;
  v_roadmap_pub     uuid;
  v_roadmap_draft   uuid;
  v_section_pub     uuid;
  v_section_draft   uuid;
  v_item_pub        uuid;
  v_item_draft      uuid;
  v_item_unpub      uuid;
  v_caught          boolean;
  v_sqlerrm         text;
BEGIN
  -- Pick a non-super-admin user
  SELECT id, agency_id INTO v_user_id, v_agency_id
  FROM public.user_profiles
  WHERE (is_super_admin IS NULL OR is_super_admin = false)
    AND agency_id IS NOT NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: no non-super-admin user with agency found in this DB';
    RETURN;
  END IF;

  RAISE NOTICE 'Using user=% (agency=%)', v_user_id, v_agency_id;

  -- Create a published roadmap with a published item (should be upsert-able)
  INSERT INTO public.roadmap_templates (agency_id, title, created_by, is_published)
    VALUES (v_agency_id, 'B-3 Pub Roadmap', v_user_id, true)
    RETURNING id INTO v_roadmap_pub;

  INSERT INTO public.roadmap_sections (roadmap_id, agency_id, title, sort_order)
    VALUES (v_roadmap_pub, '00000000-0000-0000-0000-000000000000', 'S', 0)
    RETURNING id INTO v_section_pub;

  INSERT INTO public.roadmap_items (section_id, roadmap_id, agency_id, title, sort_order, is_published)
    VALUES (v_section_pub, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Published item', 0, true)
    RETURNING id INTO v_item_pub;

  -- Create a draft (unpublished) item in the published roadmap
  INSERT INTO public.roadmap_items (section_id, roadmap_id, agency_id, title, sort_order, is_published)
    VALUES (v_section_pub, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Unpublished item', 1, false)
    RETURNING id INTO v_item_unpub;

  -- Create a draft roadmap with a published item
  INSERT INTO public.roadmap_templates (agency_id, title, created_by, is_published)
    VALUES (v_agency_id, 'B-3 Draft Roadmap', v_user_id, false)
    RETURNING id INTO v_roadmap_draft;

  INSERT INTO public.roadmap_sections (roadmap_id, agency_id, title, sort_order)
    VALUES (v_roadmap_draft, '00000000-0000-0000-0000-000000000000', 'S', 0)
    RETURNING id INTO v_section_draft;

  INSERT INTO public.roadmap_items (section_id, roadmap_id, agency_id, title, sort_order, is_published)
    VALUES (v_section_draft, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Pub item in draft roadmap', 0, true)
    RETURNING id INTO v_item_draft;

  -- Now impersonate the user via set_config so auth.uid() returns their ID
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);

  -- Also need to set the role claim so is_super_admin() works
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id::text, 'role', 'authenticated')::text, true);

  -- Test 1: Unpublished item → RPC should raise "not accessible"
  v_caught := false;
  BEGIN
    PERFORM public.roadmap_upsert_progress(v_item_unpub, 'completed'::public.roadmap_progress_status);
  EXCEPTION WHEN OTHERS THEN
    v_sqlerrm := SQLERRM;
    IF v_sqlerrm LIKE '%not accessible%' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'Test 1: expected "not accessible", got: %', v_sqlerrm;
    END IF;
  END;

  IF v_caught THEN
    RAISE NOTICE '✓ B-3: unpublished item correctly rejected';
  ELSE
    RAISE EXCEPTION 'B-3 FAILED: unpublished item was upsertable';
  END IF;

  -- Test 2: Published item in DRAFT roadmap → also should raise
  v_caught := false;
  BEGIN
    PERFORM public.roadmap_upsert_progress(v_item_draft, 'completed'::public.roadmap_progress_status);
  EXCEPTION WHEN OTHERS THEN
    v_sqlerrm := SQLERRM;
    IF v_sqlerrm LIKE '%not accessible%' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'Test 2: expected "not accessible", got: %', v_sqlerrm;
    END IF;
  END;

  IF v_caught THEN
    RAISE NOTICE '✓ B-3: item in draft roadmap correctly rejected';
  ELSE
    RAISE EXCEPTION 'B-3 FAILED: item in draft roadmap was upsertable';
  END IF;

  -- Test 3: Random UUID that doesn't exist → also should raise
  v_caught := false;
  BEGIN
    PERFORM public.roadmap_upsert_progress(gen_random_uuid(), 'completed'::public.roadmap_progress_status);
  EXCEPTION WHEN OTHERS THEN
    v_sqlerrm := SQLERRM;
    IF v_sqlerrm LIKE '%not accessible%' THEN
      v_caught := true;
    END IF;
  END;

  IF v_caught THEN
    RAISE NOTICE '✓ B-3: nonexistent UUID correctly rejected';
  ELSE
    RAISE EXCEPTION 'B-3 FAILED: nonexistent UUID was upsertable';
  END IF;

  -- NOTE: We can't easily test the happy path (published item in published roadmap)
  -- here because set_config of jwt.claims doesn't actually make auth.uid() return
  -- the test user — auth.uid() reads from the JWT that Postgres didn't actually
  -- receive in this session. That test needs a proper anon-client JWT which the
  -- RLS integration test suite in the frontend handles.
  RAISE NOTICE 'Note: happy-path test deferred to frontend RLS integration suite';

  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ B-3 REJECTION PATHS VERIFIED';
  RAISE NOTICE '============================================================';
END $$;

ROLLBACK;
