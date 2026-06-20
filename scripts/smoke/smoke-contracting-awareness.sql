-- Contracting AWARENESS backend smoke (TRANSACTIONAL — ends in ROLLBACK, nothing persists).
-- Proves the 2026-06-12 awareness migration:
--   A) downline status-change notifications to the DIRECT upline (+ self-notify skip when
--      the upline is the actor; + a super-admin/grandparent action still notifies the upline).
--   B) the bypassed normal upline is notified on an alternate-sponsor request AND can read it
--      under RLS (csr_select normal_upline_id clause).
--   C) get_contracting_activity / get_downline_sponsorships return the upline's downline rows.
-- Run: ./scripts/migrations/run-sql.sh -f scripts/smoke-contracting-awareness.sql
-- Throwaway @smoke-aware.test rows only; impersonates via request.jwt.claims.

BEGIN;
DO $$
DECLARE
  v_su_role text := current_user;          -- restore after the RLS role-switch
  v_imo  uuid := gen_random_uuid();
  v_carA uuid := gen_random_uuid();
  v_carB uuid := gen_random_uuid();
  v_top  uuid := gen_random_uuid();
  v_mid  uuid := gen_random_uuid();
  v_leaf uuid := gen_random_uuid();
  v_sponsor   uuid := gen_random_uuid();
  v_sponsorUp uuid := gen_random_uuid();
  v_imo2  uuid := gen_random_uuid();
  v_car2  uuid := gen_random_uuid();
  v_leaf2 uuid := gen_random_uuid();
  v_sa    uuid := gen_random_uuid();
  v_saChild uuid := gen_random_uuid();
  v_reqid uuid;
  v_cnt int;
  v_cnt2 int;
BEGIN
  -- ── fixtures ──────────────────────────────────────────────────────────────
  INSERT INTO imos(id,name,code) VALUES (v_imo,'SMOKE AWARE IMO','SMA'||substr(v_imo::text,1,8));
  INSERT INTO carriers(id,name,imo_id,is_active)
    VALUES (v_carA,'Aware Carrier A',v_imo,true),(v_carB,'Aware Carrier B',v_imo,true);
  INSERT INTO user_profiles(id,email,imo_id,contract_level,upline_id,approval_status,first_name,last_name,roles) VALUES
    (v_top,      'aw-top@smoke-aware.test',    v_imo,130,NULL,       'approved','AwTop','Agent', ARRAY['agent']),
    (v_mid,      'aw-mid@smoke-aware.test',    v_imo,110,v_top,      'approved','AwMid','Agent', ARRAY['agent']),
    (v_leaf,     'aw-leaf@smoke-aware.test',   v_imo,100,v_mid,      'approved','AwLeaf','Agent',ARRAY['agent']),
    (v_sponsorUp,'aw-sup@smoke-aware.test',    v_imo,130,NULL,       'approved','AwSpn','Up',    ARRAY['agent']),
    (v_sponsor,  'aw-sponsor@smoke-aware.test',v_imo,120,v_sponsorUp,'approved','AwSpn','Sor',   ARRAY['agent']);

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST A — downline status-change → DIRECT upline notification
  -- ════════════════════════════════════════════════════════════════════════════
  -- A1: leaf self-submits carA → leaf's direct upline (mid) is notified; top/leaf are not.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_leaf)::text, true);
  PERFORM set_carrier_contract_status(v_leaf, v_carA, 'submitted', NULL);

  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_mid AND type='downline_contract_status'
      AND metadata->>'agent_id'=v_leaf::text AND metadata->>'carrier_id'=v_carA::text;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TESTA1 FAIL: direct upline not notified on submit (got %)', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM notifications WHERE user_id=v_top AND type='downline_contract_status';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'TESTA1 FAIL: non-direct upline (top) wrongly notified (%)', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM notifications WHERE user_id=v_leaf AND type='downline_contract_status';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'TESTA1 FAIL: agent wrongly notified about own change (%)', v_cnt; END IF;
  RAISE NOTICE 'TESTA1 PASS: submit notifies DIRECT upline only';

  -- A2: mid (the direct upline) approves leaf → SELF-SKIP, no new notification to mid.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_mid)::text, true);
  PERFORM set_carrier_contract_status(v_leaf, v_carA, 'approved', 'WN-A');
  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_mid AND type='downline_contract_status'
      AND metadata->>'agent_id'=v_leaf::text AND metadata->>'carrier_id'=v_carA::text;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TESTA2 FAIL: upline self-notified for own action (got %, want 1)', v_cnt; END IF;
  RAISE NOTICE 'TESTA2 PASS: upline NOT self-notified when it makes the change';

  -- A3: top (grandparent / not the direct upline) denies leaf → mid IS notified.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_top)::text, true);
  PERFORM set_carrier_contract_status(v_leaf, v_carA, 'denied', NULL);
  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_mid AND type='downline_contract_status'
      AND metadata->>'agent_id'=v_leaf::text AND metadata->>'carrier_id'=v_carA::text;
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'TESTA3 FAIL: direct upline not notified on denial by grandparent (got %, want 2)', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM notifications WHERE user_id=v_top AND type='downline_contract_status';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'TESTA3 FAIL: actor (top) wrongly notified (%)', v_cnt; END IF;
  RAISE NOTICE 'TESTA3 PASS: super-admin/grandparent action still notifies the DIRECT upline (not the actor)';

  -- A4: multi-level — mid self-submits carB → mid's direct upline (top) is notified.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_mid)::text, true);
  PERFORM set_carrier_contract_status(v_mid, v_carB, 'submitted', NULL);
  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_top AND type='downline_contract_status' AND metadata->>'agent_id'=v_mid::text;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TESTA4 FAIL: top not notified of mid submit (got %)', v_cnt; END IF;
  RAISE NOTICE 'TESTA4 PASS: each direct upline notified up the chain';

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST B — alternate-sponsor request: bypassed normal upline notified + can read it
  -- ════════════════════════════════════════════════════════════════════════════
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_sponsorUp)::text, true);
  PERFORM set_carrier_contract_status(v_sponsor, v_carB, 'approved', 'WN-SP');  -- sponsor approved carB

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_leaf)::text, true);
  SELECT id INTO v_reqid FROM create_sponsorship_request(v_carB, v_sponsor, 'Mid is blocked');

  -- bypass notification to leaf's normal (direct) upline = mid
  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_mid AND type='sponsorship_bypass' AND metadata->>'sponsorship_id'=v_reqid::text;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TESTB FAIL: bypassed normal upline not notified (got %)', v_cnt; END IF;
  -- sponsor still gets the existing approval-request notification (unchanged behavior)
  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_sponsor AND type='sponsorship_request' AND metadata->>'sponsorship_id'=v_reqid::text;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TESTB FAIL: alternate sponsor lost its approval-request notification (got %)', v_cnt; END IF;
  RAISE NOTICE 'TESTB PASS: bypass notifies normal upline + sponsor still notified';

  -- RLS: as mid (authenticated), the normal upline can now SELECT the request row.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_mid)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_cnt FROM carrier_sponsorship_requests WHERE id=v_reqid;
  EXECUTE format('SET LOCAL ROLE %I', v_su_role);
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TESTB-RLS FAIL: normal upline cannot read bypass request under RLS (got %)', v_cnt; END IF;
  RAISE NOTICE 'TESTB-RLS PASS: normal upline can read the request (csr_select normal_upline_id)';

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST C — read RPCs surface the upline's downline activity & arrangements
  -- ════════════════════════════════════════════════════════════════════════════
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_mid)::text, true);

  SELECT count(*) INTO v_cnt FROM get_contracting_activity(50) WHERE agent_id=v_leaf AND carrier_id=v_carA;
  IF v_cnt < 1 THEN RAISE EXCEPTION 'TESTC FAIL: get_contracting_activity missing downline row (got %)', v_cnt; END IF;

  SELECT count(*) INTO v_cnt2 FROM get_downline_sponsorships() WHERE id=v_reqid AND requesting_agent_id=v_leaf;
  IF v_cnt2 <> 1 THEN RAISE EXCEPTION 'TESTC FAIL: get_downline_sponsorships missing arrangement (got %)', v_cnt2; END IF;
  RAISE NOTICE 'TESTC PASS: activity feed + downline arrangements scoped to the upline';

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST D — Activity feed is DOWNLINE-ONLY, even for a super-admin.
  --   As of 20260619135313, get_contracting_activity() has NO whole-org / whole-IMO admin
  --   branch — only is_upline_of(agent). A super-admin sees their OWN downline subtree and
  --   nothing else: no other-team bleed within the IMO, no cross-IMO bleed. (The "Recent
  --   activity" panel is titled "Downline Activity" — it must show team activity only.)
  -- ════════════════════════════════════════════════════════════════════════════
  -- second IMO (IMO2) with its own carrier + a contract there
  INSERT INTO imos(id,name,code) VALUES (v_imo2,'SMOKE AWARE IMO2','SMB'||substr(v_imo2::text,1,8));
  INSERT INTO carriers(id,name,imo_id,is_active) VALUES (v_car2,'Aware Carrier 2',v_imo2,true);
  INSERT INTO user_profiles(id,email,imo_id,contract_level,upline_id,approval_status,first_name,last_name,roles)
    VALUES (v_leaf2,'aw-leaf2@smoke-aware.test',v_imo2,100,NULL,'approved','Aw2','Leaf',ARRAY['agent']);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_leaf2)::text, true);
  PERFORM set_carrier_contract_status(v_leaf2, v_car2, 'submitted', NULL);

  -- super-admin in IMO1, standalone (NOT in v_top/v_mid/v_leaf's upline chain). The
  -- handle_new_user trigger creates the profile, then we force the super-admin state in a
  -- SERVICE context (empty claims) — a guard trigger blocks non-super-admins from elevating.
  INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (v_sa, 'aw-sa@smoke-aware.test',
            jsonb_build_object('roles', jsonb_build_array('agent'),
                               'imo_id', v_imo::text, 'acting_imo_id', v_imo::text));
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE user_profiles SET is_super_admin=true, imo_id=v_imo, approval_status='approved', contract_level=200
    WHERE id=v_sa;

  -- a child DIRECTLY under the super-admin so v_sa has a real downline of its own
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO user_profiles(id,email,imo_id,contract_level,upline_id,approval_status,first_name,last_name,roles)
    VALUES (v_saChild,'aw-sachild@smoke-aware.test',v_imo,100,v_sa,'approved','AwSa','Child',ARRAY['agent']);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_saChild)::text, true);
  PERFORM set_carrier_contract_status(v_saChild, v_carA, 'submitted', NULL);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_sa)::text, true);
  -- POSITIVE: super-admin sees their OWN downline child (is_upline_of branch still works)
  SELECT count(*) INTO v_cnt FROM get_contracting_activity(200) WHERE agent_id=v_saChild AND carrier_id=v_carA;
  IF v_cnt < 1 THEN RAISE EXCEPTION 'TESTD FAIL: super-admin cannot see own downline child (got %)', v_cnt; END IF;
  -- NEGATIVE: super-admin does NOT see a same-IMO agent outside their downline (no whole-IMO view)
  SELECT count(*) INTO v_cnt FROM get_contracting_activity(200) WHERE agent_id=v_leaf AND carrier_id=v_carA;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'TESTD FAIL: super-admin sees non-downline same-IMO agent — whole-IMO bleed (got %)', v_cnt; END IF;
  -- NEGATIVE: super-admin does NOT see another IMO's agent (no cross-IMO bleed)
  SELECT count(*) INTO v_cnt2 FROM get_contracting_activity(200) WHERE agent_id=v_leaf2 AND carrier_id=v_car2;
  IF v_cnt2 <> 0 THEN RAISE EXCEPTION 'TESTD FAIL: super-admin sees another IMO agent — cross-IMO bleed (got %)', v_cnt2; END IF;
  RAISE NOTICE 'TESTD PASS: Activity feed is downline-only even for super-admin (own downline visible; no whole-IMO / cross-IMO bleed)';

  RAISE NOTICE '✅ ALL CONTRACTING AWARENESS SMOKE TESTS PASSED';
END $$;
ROLLBACK;
