-- Inbound-CRM Phase 0 RPC smoke test (rolled-back transaction; the proven pattern).
-- Exercises crm_lookup_aor / crm_upsert_call / crm_patch_billable against real
-- Postgres using EXISTING local data (no auth.users/imos creation). Every effect
-- is discarded by the final ROLLBACK. Any failed assertion RAISEs and (with
-- ON_ERROR_STOP) aborts non-zero.
--
--   ./scripts/migrations/run-sql.sh -f scripts/test-crm-rpcs-smoke.sql
--
-- Covers §9 edge-case matrix: AoR hit/miss, fresh POST + pop, idempotent dup POST,
-- new-caller client creation under AoR, unknown pcId -> unassigned/no pop,
-- PATCH-after-POST, PATCH-before-POST (patch_only/no pop), and out-of-order
-- POST-after-PATCH (fills agent, must NOT resurrect 'ended' -> 'ringing').
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  v_agent uuid;
  v_imo   uuid;
  v_phone text;
  v_e164  text;
  v_pc    text := 'agent-smoke-001';
  r       record;
  v_n     int;
BEGIN
  -- Anchor on an existing agent that owns a client with a normalizable phone.
  -- MUST exclude access-revoked agents (e.g. the sunset FFG tenant on prod): crm_lookup_aor
  -- deliberately returns no row for a revoked agent, so anchoring on one makes check #1 fail
  -- spuriously. Also require the phone be uniquely owned by ONE non-revoked client in the imo
  -- so the household tiebreak (covered separately by #10) can't redirect the lookup off-anchor.
  SELECT c.user_id, up.imo_id, c.phone, c.phone_e164
    INTO v_agent, v_imo, v_phone, v_e164
  FROM clients c
  JOIN user_profiles up ON up.id = c.user_id
  WHERE c.phone_e164 IS NOT NULL AND up.imo_id IS NOT NULL
    AND NOT public.is_access_revoked(c.user_id)
    -- The agent must not already own a pcId mapping in this imo: the test INSERTs one and
    -- imo_agent_external_ids is UNIQUE(imo_id, user_id). Committed fixtures (e.g. from
    -- scripts/crm-e2e-local.sh on a dev DB) would otherwise collide here.
    AND NOT EXISTS (SELECT 1 FROM imo_agent_external_ids m
                    WHERE m.imo_id = up.imo_id AND m.user_id = c.user_id)
    AND (SELECT count(*) FROM clients c2 JOIN user_profiles u2 ON u2.id = c2.user_id
         WHERE u2.imo_id = up.imo_id AND c2.phone_e164 = c.phone_e164
           AND NOT public.is_access_revoked(c2.user_id)) = 1
  LIMIT 1;
  IF v_agent IS NULL THEN RAISE EXCEPTION 'No usable agent/client found in local data'; END IF;
  RAISE NOTICE 'anchor agent=% imo=% phone=% e164=%', v_agent, v_imo, v_phone, v_e164;

  INSERT INTO imo_agent_external_ids (imo_id, user_id, pc_id) VALUES (v_imo, v_agent, v_pc);

  -- 1) AoR lookup resolves the existing caller -> (pc_id, agent_id).
  SELECT * INTO r FROM crm_lookup_aor(v_imo, v_phone);
  IF r.pc_id IS DISTINCT FROM v_pc OR r.agent_id IS DISTINCT FROM v_agent THEN
    RAISE EXCEPTION '1 FAIL lookup: got pc=% agent=%', r.pc_id, r.agent_id;
  END IF;
  RAISE NOTICE '1 OK  lookup resolves existing caller';

  -- 2) AoR lookup of an unknown number -> no rows.
  SELECT count(*) INTO v_n FROM crm_lookup_aor(v_imo, '+19990001111');
  IF v_n <> 0 THEN RAISE EXCEPTION '2 FAIL unknown lookup returned % rows', v_n; END IF;
  RAISE NOTICE '2 OK  unknown caller -> no rows';

  -- 3) Fresh POST (existing caller): resolves agent, fires pop, ringing, not patch_only.
  SELECT * INTO r FROM crm_upsert_call(v_imo, 'smoke-tag-A', v_pc, v_phone, 'CA');
  IF r.agent_id IS DISTINCT FROM v_agent OR r.fired_pop IS NOT TRUE THEN
    RAISE EXCEPTION '3 FAIL post: agent=% fired_pop=%', r.agent_id, r.fired_pop;
  END IF;
  PERFORM 1 FROM inbound_calls WHERE id = r.id AND status='ringing' AND patch_only=false AND imo_id=v_imo;
  IF NOT FOUND THEN RAISE EXCEPTION '3 FAIL post: row not ringing/non-patch'; END IF;
  RAISE NOTICE '3 OK  fresh POST fires pop, ringing';

  -- 4) Duplicate POST (same request_tag) is idempotent -> one row.
  PERFORM crm_upsert_call(v_imo, 'smoke-tag-A', v_pc, v_phone, 'CA');
  SELECT count(*) INTO v_n FROM inbound_calls WHERE imo_id=v_imo AND request_tag='smoke-tag-A';
  IF v_n <> 1 THEN RAISE EXCEPTION '4 FAIL dup POST created % rows', v_n; END IF;
  RAISE NOTICE '4 OK  duplicate POST idempotent (1 row)';

  -- 5) Brand-new caller POST creates a client UNDER the AoR agent (visible on Clients page).
  SELECT count(*) INTO v_n FROM clients WHERE user_id=v_agent AND phone_e164='+15557770001';
  IF v_n <> 0 THEN RAISE EXCEPTION '5 PRECOND: test number already a client'; END IF;
  SELECT * INTO r FROM crm_upsert_call(v_imo, 'smoke-tag-B', v_pc, '555-777-0001');
  IF r.agent_id IS DISTINCT FROM v_agent OR r.fired_pop IS NOT TRUE THEN
    RAISE EXCEPTION '5 FAIL new-caller post';
  END IF;
  SELECT count(*) INTO v_n FROM clients WHERE user_id=v_agent AND phone_e164='+15557770001';
  IF v_n <> 1 THEN RAISE EXCEPTION '5 FAIL new client not created (%).', v_n; END IF;
  PERFORM 1 FROM inbound_calls ic JOIN clients c ON c.id=ic.client_id
    WHERE ic.imo_id=v_imo AND ic.request_tag='smoke-tag-B'
      AND c.phone_e164='+15557770001' AND c.name='+15557770001';
  IF NOT FOUND THEN RAISE EXCEPTION '5 FAIL call not linked to new client / name not phone'; END IF;
  RAISE NOTICE '5 OK  new caller -> client created under AoR + linked';

  -- 6) Unknown pcId -> unassigned, no pop, still recorded.
  SELECT * INTO r FROM crm_upsert_call(v_imo, 'smoke-tag-C', 'agent-DOES-NOT-EXIST', '+15558880002');
  IF r.agent_id IS NOT NULL OR r.fired_pop IS NOT FALSE THEN
    RAISE EXCEPTION '6 FAIL unknown pcId: agent=% fired_pop=%', r.agent_id, r.fired_pop;
  END IF;
  PERFORM 1 FROM inbound_calls WHERE id=r.id AND agent_id IS NULL AND client_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '6 FAIL unknown pcId row not recorded-as-unassigned'; END IF;
  RAISE NOTICE '6 OK  unknown pcId -> unassigned/no pop/recorded';

  -- 7) PATCH after POST -> ended + billable, patch_only false.
  SELECT * INTO r FROM crm_patch_billable(v_imo, 'smoke-tag-A', 1::smallint, 120);
  IF r.patch_only IS NOT FALSE THEN RAISE EXCEPTION '7 FAIL patch-after-post patch_only=%', r.patch_only; END IF;
  PERFORM 1 FROM inbound_calls WHERE imo_id=v_imo AND request_tag='smoke-tag-A'
    AND status='ended' AND billable=1 AND duration=120 AND patch_only=false;
  IF NOT FOUND THEN RAISE EXCEPTION '7 FAIL patch-after-post state'; END IF;
  RAISE NOTICE '7 OK  PATCH after POST -> ended/billable';

  -- 8) PATCH before POST -> minimal patch_only row, ended, no pop.
  SELECT * INTO r FROM crm_patch_billable(v_imo, 'smoke-tag-D', 1::smallint, 60, '+15559990003');
  IF r.patch_only IS NOT TRUE THEN RAISE EXCEPTION '8 FAIL patch-before-post patch_only=%', r.patch_only; END IF;
  PERFORM 1 FROM inbound_calls WHERE imo_id=v_imo AND request_tag='smoke-tag-D'
    AND status='ended' AND patch_only=true AND agent_id IS NULL AND fired_pop=false
    AND phone_e164='+15559990003';
  IF NOT FOUND THEN RAISE EXCEPTION '8 FAIL patch-before-post state'; END IF;
  RAISE NOTICE '8 OK  PATCH before POST -> patch_only/ended/no pop';

  -- 9) Out-of-order POST after PATCH: fills agent, clears patch_only, must NOT
  --    resurrect 'ended' -> 'ringing' (else phantom pop on reconnect).
  SELECT * INTO r FROM crm_upsert_call(v_imo, 'smoke-tag-D', v_pc, '+15559990003');
  PERFORM 1 FROM inbound_calls WHERE imo_id=v_imo AND request_tag='smoke-tag-D'
    AND status='ended' AND patch_only=false AND agent_id=v_agent AND billable=1;
  IF NOT FOUND THEN RAISE EXCEPTION '9 FAIL post-after-patch did not fill/keep ended'; END IF;
  RAISE NOTICE '9 OK  POST after PATCH fills agent, stays ended (no resurrection)';

  -- 10) Household tiebreak (locks the status->lifecycle_status fix): two clients share
  --     a phone under DIFFERENT mapped agents. The client with an in-force
  --     (lifecycle_status='active') policy must win the AoR even though the OTHER client
  --     was updated more recently. A revert to `status='active'` makes the LATERAL dead,
  --     the tiebreak falls to updated_at, agent2 would win, and this assertion fails.
  DECLARE
    v_agent2  uuid;
    v_carrier uuid;
    v_c1      uuid;
    v_c2      uuid;
    v_pc2     text := 'agent-smoke-002';
    v_hh      text := '555-321-7654';
  BEGIN
    SELECT id INTO v_agent2 FROM user_profiles WHERE imo_id = v_imo AND id <> v_agent LIMIT 1;
    -- A carrier already valid for this IMO (a policies trigger enforces carrier-in-IMO).
    SELECT carrier_id INTO v_carrier FROM policies WHERE imo_id = v_imo LIMIT 1;
    IF v_agent2 IS NULL OR v_carrier IS NULL THEN
      RAISE NOTICE '10 SKIP household tiebreak (needs a 2nd agent in imo + a carrier; absent locally)';
    ELSE
      INSERT INTO imo_agent_external_ids (imo_id, user_id, pc_id) VALUES (v_imo, v_agent2, v_pc2);
      -- client1 (agent1) older updated_at + the only in-force policy; client2 (agent2) newer.
      INSERT INTO clients (user_id, name, phone, status, updated_at)
        VALUES (v_agent,  'HH One', v_hh, 'active', now() - interval '10 days') RETURNING id INTO v_c1;
      INSERT INTO clients (user_id, name, phone, status, updated_at)
        VALUES (v_agent2, 'HH Two', v_hh, 'active', now())                      RETURNING id INTO v_c2;
      INSERT INTO policies (client_id, user_id, imo_id, carrier_id, product, effective_date,
                            submit_date, monthly_premium, status, lifecycle_status)
        VALUES (v_c1, v_agent, v_imo, v_carrier, 'term_life', now()::date, now()::date, 100, 'approved', 'active');

      SELECT * INTO r FROM crm_lookup_aor(v_imo, v_hh);
      IF r.agent_id IS DISTINCT FROM v_agent OR r.pc_id IS DISTINCT FROM v_pc THEN
        RAISE EXCEPTION '10 FAIL household tiebreak: got agent=% pc=% (expected active-policy agent1=% pc=%)',
          r.agent_id, r.pc_id, v_agent, v_pc;
      END IF;
      RAISE NOTICE '10 OK  household tiebreak picks active-policy client (lifecycle_status)';
    END IF;
  END;

  -- 11) Re-POST that omits ani must NOT clobber a previously-good ani/phone_e164 (guard #4).
  PERFORM crm_upsert_call(v_imo, 'smoke-tag-ANI', v_pc, '+15557778888');
  PERFORM crm_upsert_call(v_imo, 'smoke-tag-ANI', v_pc, '');  -- re-POST omitting ani
  PERFORM 1 FROM inbound_calls WHERE imo_id=v_imo AND request_tag='smoke-tag-ANI'
    AND ani='+15557778888' AND phone_e164='+15557778888';
  IF NOT FOUND THEN RAISE EXCEPTION '11 FAIL: re-POST without ani clobbered ani/phone_e164'; END IF;
  RAISE NOTICE '11 OK  re-POST without ani preserves ani/phone_e164';

  -- 12) PATCH that omits billable must NOT wipe a previously-set billable (guard #3).
  PERFORM crm_upsert_call(v_imo, 'smoke-tag-BILL', v_pc, '+15557779999');
  PERFORM crm_patch_billable(v_imo, 'smoke-tag-BILL', 1::smallint, 60);   -- billable=1
  PERFORM crm_patch_billable(v_imo, 'smoke-tag-BILL', NULL::smallint, 90); -- omit billable, set duration
  PERFORM 1 FROM inbound_calls WHERE imo_id=v_imo AND request_tag='smoke-tag-BILL'
    AND billable=1 AND duration=90;
  IF NOT FOUND THEN RAISE EXCEPTION '12 FAIL: PATCH without billable wiped the prior billable'; END IF;
  RAISE NOTICE '12 OK  PATCH without billable preserves prior billable';

  RAISE NOTICE 'ALL_SMOKE_CHECKS_PASSED';
END$$;
ROLLBACK;
