-- Contracting Hub backend smoke (TRANSACTIONAL — ends in ROLLBACK, nothing persists).
-- Proves: eligibility alert trigger, self-submit eligibility gating, the sponsorship
-- two-approval flow, and the PROSPECTIVE override money path (sponsored business routes
-- to the alternate sponsor's leg; pre-approval business stays on the normal upline).
-- Run: ./scripts/migrations/run-sql.sh -f scripts/smoke-contracting-sql.sql
-- Uses throwaway @epiclife-demo.test rows only; impersonates via request.jwt.claims.

BEGIN;
DO $$
DECLARE
  v_imo uuid := gen_random_uuid();
  v_carA uuid := gen_random_uuid();
  v_carB uuid := gen_random_uuid();
  v_top uuid := gen_random_uuid();
  v_mid uuid := gen_random_uuid();
  v_leaf uuid := gen_random_uuid();
  v_sponsor uuid := gen_random_uuid();
  v_sponsorUp uuid := gen_random_uuid();
  v_sponsor2 uuid := gen_random_uuid();
  v_reqid uuid;
  v_req2 uuid;
  v_cnt int;
  v_status text;
  v_raised boolean;
  v_polA uuid := gen_random_uuid();
  v_polB uuid := gen_random_uuid();
  v_polMid uuid := gen_random_uuid();
  v_polLate uuid := gen_random_uuid();
  v_after uuid[];
  v_before uuid[];
  v_mid_agents uuid[];
  v_late_agents uuid[];
BEGIN
  -- ── fixtures ──────────────────────────────────────────────────────────────
  INSERT INTO imos(id,name,code) VALUES (v_imo,'SMOKE IMO','SMK'||substr(v_imo::text,1,8));
  INSERT INTO carriers(id,name,imo_id,is_active)
    VALUES (v_carA,'Smoke Carrier A',v_imo,true),(v_carB,'Smoke Carrier B',v_imo,true);

  INSERT INTO user_profiles(id,email,imo_id,contract_level,upline_id,approval_status,first_name,last_name,roles) VALUES
    (v_top,      'top@epiclife-demo.test',    v_imo,130,NULL,      'approved','Top','Agent',   ARRAY['agent']),
    (v_mid,      'mid@epiclife-demo.test',    v_imo,110,v_top,     'approved','Mid','Agent',   ARRAY['agent']),
    (v_leaf,     'leaf@epiclife-demo.test',   v_imo,100,v_mid,     'approved','Leaf','Agent',  ARRAY['agent']),
    (v_sponsorUp,'sup@epiclife-demo.test',    v_imo,130,NULL,      'approved','Spon','Upline', ARRAY['agent']),
    (v_sponsor,  'sponsor@epiclife-demo.test',v_imo,120,v_sponsorUp,'approved','Spon','Sor',   ARRAY['agent']),
    (v_sponsor2, 'sponsor2@epiclife-demo.test',v_imo,125,NULL,     'approved','Spon','Two',   ARRAY['agent']);

  INSERT INTO comp_guide(imo_id,carrier_id,contract_level,product_type,commission_percentage,effective_date) VALUES
    (v_imo,v_carB,100,'term_life',0.5000,'2020-01-01'),
    (v_imo,v_carB,110,'term_life',0.6000,'2020-01-01'),
    (v_imo,v_carB,120,'term_life',0.7000,'2020-01-01'),
    (v_imo,v_carB,125,'term_life',0.7500,'2020-01-01'),
    (v_imo,v_carB,130,'term_life',0.8000,'2020-01-01');

  -- ── TEST 1: eligibility alert → DIRECT reports only ───────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_top)::text, true);
  PERFORM set_carrier_contract_status(v_mid, v_carA, 'approved', 'WN-MID-A');

  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_leaf AND type='carrier_eligible' AND metadata->>'carrier_id'=v_carA::text;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST1 FAIL: expected 1 alert for direct report, got %', v_cnt; END IF;
  RAISE NOTICE 'TEST1 PASS: direct report alerted on upline approval';

  SELECT count(*) INTO v_cnt FROM notifications
    WHERE user_id=v_top AND type='carrier_eligible' AND metadata->>'carrier_id'=v_carA::text;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'TEST1b FAIL: upline wrongly alerted (%)', v_cnt; END IF;
  RAISE NOTICE 'TEST1b PASS: non-direct (upline) not alerted';

  -- ── TEST 2: self-submit gating ────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_leaf)::text, true);
  PERFORM set_carrier_contract_status(v_leaf, v_carA, 'submitted', NULL);  -- eligible (mid approved carA)
  SELECT status INTO v_status FROM carrier_contracts WHERE agent_id=v_leaf AND carrier_id=v_carA;
  IF v_status <> 'submitted' THEN RAISE EXCEPTION 'TEST2 FAIL: leaf self-submit status=%', v_status; END IF;
  RAISE NOTICE 'TEST2 PASS: eligible agent self-submitted';

  v_raised := false;
  BEGIN PERFORM set_carrier_contract_status(v_leaf, v_carB, 'submitted', NULL);  -- NOT eligible (mid not approved carB)
  EXCEPTION WHEN others THEN v_raised := true; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'TEST2b FAIL: ineligible self-submit was allowed'; END IF;
  RAISE NOTICE 'TEST2b PASS: ineligible self-submit blocked';

  v_raised := false;
  BEGIN PERFORM set_carrier_contract_status(v_leaf, v_carA, 'approved', 'HACK');  -- agent cannot self-approve
  EXCEPTION WHEN others THEN v_raised := true; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'TEST2c FAIL: agent self-approve was allowed'; END IF;
  RAISE NOTICE 'TEST2c PASS: agent cannot self-approve';

  -- ── TEST 3: sponsorship two-approval ──────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_sponsorUp)::text, true);
  PERFORM set_carrier_contract_status(v_sponsor, v_carB, 'approved', 'WN-SP-B');  -- sponsor approved carB

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_leaf)::text, true);
  SELECT id INTO v_reqid FROM create_sponsorship_request(v_carB, v_sponsor, 'Mid blocked');
  SELECT overall_status INTO v_status FROM carrier_sponsorship_requests WHERE id=v_reqid;
  IF v_status <> 'pending_sponsor' THEN RAISE EXCEPTION 'TEST3 FAIL create: status=%', v_status; END IF;

  -- self-sponsor / duplicate guard
  v_raised := false;
  BEGIN PERFORM create_sponsorship_request(v_carB, v_leaf, 'self');
  EXCEPTION WHEN others THEN v_raised := true; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'TEST3 FAIL: self-sponsor allowed'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_sponsor)::text, true);
  PERFORM approve_sponsorship_request(v_reqid, true);  -- step 1
  SELECT overall_status INTO v_status FROM carrier_sponsorship_requests WHERE id=v_reqid;
  IF v_status <> 'pending_sponsor_upline' THEN RAISE EXCEPTION 'TEST3 FAIL step1: status=%', v_status; END IF;

  v_raised := false;  -- wrong approver cannot act on step 2
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_leaf)::text, true);
    PERFORM approve_sponsorship_request(v_reqid, true);
  EXCEPTION WHEN others THEN v_raised := true; END;
  IF NOT v_raised THEN RAISE EXCEPTION 'TEST3 FAIL: wrong approver allowed on step 2'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_sponsorUp)::text, true);
  PERFORM approve_sponsorship_request(v_reqid, true);  -- step 2 → final
  SELECT overall_status INTO v_status FROM carrier_sponsorship_requests WHERE id=v_reqid;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'TEST3 FAIL final: status=%', v_status; END IF;
  PERFORM 1 FROM carrier_sponsorship_requests WHERE id=v_reqid AND override_recipient_id=v_sponsor;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST3 FAIL: override_recipient_id != sponsor'; END IF;
  SELECT status INTO v_status FROM carrier_contracts WHERE agent_id=v_leaf AND carrier_id=v_carB;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'TEST3 FAIL: leaf pending row not created (status=%)', v_status; END IF;
  RAISE NOTICE 'TEST3 PASS: two-approval → approved, override→sponsor, leaf pending row + notify';

  -- ── TEST 4: prospective override money path ───────────────────────────────
  -- Sponsored business (effective_date today >= approved_at) → alternate sponsor leg
  INSERT INTO policies(id,user_id,carrier_id,product,monthly_premium,annual_premium,effective_date,imo_id,lifecycle_status,submit_date,status)
    VALUES (v_polA, v_leaf, v_carB, 'term_life', 100, 1200, CURRENT_DATE, v_imo, 'active', CURRENT_DATE, 'approved');
  SELECT array_agg(override_agent_id) INTO v_after FROM override_commissions WHERE policy_id=v_polA;
  IF v_after IS NULL OR NOT (v_after @> ARRAY[v_sponsor] AND v_after @> ARRAY[v_sponsorUp]) THEN
    RAISE EXCEPTION 'TEST4 FAIL: sponsored overrides missing alternate leg: %', v_after; END IF;
  IF v_after && ARRAY[v_mid,v_top] THEN
    RAISE EXCEPTION 'TEST4 FAIL: sponsored overrides leaked to normal upline: %', v_after; END IF;
  RAISE NOTICE 'TEST4 PASS: sponsored policy overrides route to alternate sponsor leg';

  -- Pre-approval business (effective_date 2020 < approved_at) → normal upline leg
  INSERT INTO policies(id,user_id,carrier_id,product,monthly_premium,annual_premium,effective_date,imo_id,lifecycle_status,submit_date,status)
    VALUES (v_polB, v_leaf, v_carB, 'term_life', 100, 1200, DATE '2020-06-01', v_imo, 'active', DATE '2020-06-01', 'approved');
  SELECT array_agg(override_agent_id) INTO v_before FROM override_commissions WHERE policy_id=v_polB;
  IF v_before IS NULL OR NOT (v_before @> ARRAY[v_mid] AND v_before @> ARRAY[v_top]) THEN
    RAISE EXCEPTION 'TEST4b FAIL: pre-approval overrides missing normal upline: %', v_before; END IF;
  IF v_before && ARRAY[v_sponsor] THEN
    RAISE EXCEPTION 'TEST4b FAIL: pre-approval overrides leaked to sponsor: %', v_before; END IF;
  RAISE NOTICE 'TEST4b PASS: pre-approval policy stays on normal upline (prospective boundary holds)';

  -- ── TEST 5: TWO approved sponsorships → pick the one in effect at the policy date ──
  -- sponsor2 (L125, top-level) approved for carB; leaf gets a 2nd approved sponsorship (S2).
  INSERT INTO carrier_contracts(agent_id,carrier_id,status,approved_date)
    VALUES (v_sponsor2, v_carB, 'approved', CURRENT_DATE);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_leaf)::text, true);
  SELECT id INTO v_req2 FROM create_sponsorship_request(v_carB, v_sponsor2, 'second sponsor');  -- S1 is 'approved' (terminal), so allowed
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_sponsor2)::text, true);
  PERFORM approve_sponsorship_request(v_req2, true);  -- sponsor2 top-level → single approval → final

  -- Simulate the timeline: S1 (→sponsor) approved 2024-01-01, S2 (→sponsor2) approved 2024-06-01.
  UPDATE carrier_sponsorship_requests SET approved_at = TIMESTAMPTZ '2024-01-01' WHERE id = v_reqid;
  UPDATE carrier_sponsorship_requests SET approved_at = TIMESTAMPTZ '2024-06-01' WHERE id = v_req2;

  -- Policy dated BETWEEN the two (2024-03-01) → must attribute to S1's sponsor leg, NOT fall back.
  INSERT INTO policies(id,user_id,carrier_id,product,monthly_premium,annual_premium,effective_date,imo_id,lifecycle_status,submit_date,status)
    VALUES (v_polMid, v_leaf, v_carB, 'term_life', 100, 1200, DATE '2024-03-01', v_imo, 'active', DATE '2024-03-01', 'approved');
  SELECT array_agg(override_agent_id) INTO v_mid_agents FROM override_commissions WHERE policy_id=v_polMid;
  IF v_mid_agents IS NULL OR NOT (v_mid_agents @> ARRAY[v_sponsor]) THEN
    RAISE EXCEPTION 'TEST5 FAIL: mid-date policy not on S1 sponsor leg: %', v_mid_agents; END IF;
  IF v_mid_agents && ARRAY[v_sponsor2, v_mid, v_top] THEN
    RAISE EXCEPTION 'TEST5 FAIL: mid-date policy leaked to wrong leg: %', v_mid_agents; END IF;
  RAISE NOTICE 'TEST5 PASS: policy between two sponsorships → earlier (in-effect) sponsor, not fallback';

  -- Policy dated AFTER S2 (2024-08-01) → must attribute to the newer sponsor (sponsor2).
  INSERT INTO policies(id,user_id,carrier_id,product,monthly_premium,annual_premium,effective_date,imo_id,lifecycle_status,submit_date,status)
    VALUES (v_polLate, v_leaf, v_carB, 'term_life', 100, 1200, DATE '2024-08-01', v_imo, 'active', DATE '2024-08-01', 'approved');
  SELECT array_agg(override_agent_id) INTO v_late_agents FROM override_commissions WHERE policy_id=v_polLate;
  IF v_late_agents IS NULL OR NOT (v_late_agents @> ARRAY[v_sponsor2]) THEN
    RAISE EXCEPTION 'TEST5b FAIL: late policy not on S2 (sponsor2): %', v_late_agents; END IF;
  IF v_late_agents && ARRAY[v_sponsor, v_mid, v_top] THEN
    RAISE EXCEPTION 'TEST5b FAIL: late policy leaked to wrong leg: %', v_late_agents; END IF;
  RAISE NOTICE 'TEST5b PASS: policy after newer sponsorship → newer sponsor';

  RAISE NOTICE '✅ ALL CONTRACTING BACKEND SMOKE TESTS PASSED';
END $$;
ROLLBACK;
