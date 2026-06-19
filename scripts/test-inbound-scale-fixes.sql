-- scripts/test-inbound-scale-fixes.sql
-- Verifies the inbound-CRM scale fixes (REPLICA IDENTITY DEFAULT + Broadcast-from-trigger pop).
-- Asserts via RAISE EXCEPTION so a failure aborts non-zero; the whole DO block is ONE transaction,
-- so a failure rolls back all test rows and a success cleans them up — never leaves a stray pop.
-- Run: ./scripts/migrations/run-sql.sh -f scripts/test-inbound-scale-fixes.sql
\set ON_ERROR_STOP on
DO $$
DECLARE
  v_imo uuid; v_agent uuid; v_client uuid; v_call uuid;
  v_relident "char"; v_cnt int; v_payload jsonb;
  v_topic text;
  v_tag text := 'scaletest-' || (extract(epoch from clock_timestamp())*1000)::bigint;
BEGIN
  SELECT up.id, up.imo_id INTO v_agent, v_imo
  FROM user_profiles up JOIN auth.users au ON au.id=up.id
  WHERE au.email='epiclife.neessen@gmail.com' AND up.imo_id IS NOT NULL LIMIT 1;
  IF v_agent IS NULL THEN RAISE EXCEPTION 'no test agent (epiclife) with an imo'; END IF;
  v_topic := 'inbound:' || v_agent::text;
  SELECT id INTO v_client FROM clients WHERE user_id=v_agent LIMIT 1;

  -- T1: REPLICA IDENTITY DEFAULT (fix #2)
  SELECT relreplident INTO v_relident FROM pg_class WHERE relname='inbound_calls';
  IF v_relident <> 'd' THEN RAISE EXCEPTION 'FAIL T1: inbound_calls replica identity=% (want d/DEFAULT)', v_relident; END IF;
  RAISE NOTICE 'PASS T1: inbound_calls REPLICA IDENTITY = DEFAULT';

  -- T2: broadcast trigger present (fix #4)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_inbound_call_broadcast') THEN
    RAISE EXCEPTION 'FAIL T2: trg_inbound_call_broadcast missing'; END IF;
  RAISE NOTICE 'PASS T2: trg_inbound_call_broadcast exists';

  -- T3: a fresh ringing INSERT that fired a pop -> 1 broadcast to the agent's private topic
  INSERT INTO inbound_calls (imo_id, request_tag, agent_id, client_id, ani, phone_e164, status, fired_pop, patch_only)
  VALUES (v_imo, v_tag, v_agent, v_client, '5550001234', public.normalize_phone_e164('5550001234'), 'ringing', true, false)
  RETURNING id INTO v_call;
  SELECT count(*) INTO v_cnt FROM realtime.messages
   WHERE topic=v_topic AND event='inbound_call' AND (payload->>'request_tag')=v_tag;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL T3: expected 1 pop broadcast, got %', v_cnt; END IF;
  RAISE NOTICE 'PASS T3: ringing INSERT broadcast exactly 1 pop to %', v_topic;

  -- T4: pop payload carries the right id + status
  SELECT payload INTO v_payload FROM realtime.messages
   WHERE topic=v_topic AND (payload->>'request_tag')=v_tag ORDER BY inserted_at DESC LIMIT 1;
  IF (v_payload->>'id') <> v_call::text OR (v_payload->>'status') <> 'ringing' THEN
    RAISE EXCEPTION 'FAIL T4: bad pop payload %', v_payload; END IF;
  RAISE NOTICE 'PASS T4: pop payload id+status correct';

  -- T5: status -> 'ended' UPDATE broadcasts a dismiss
  UPDATE inbound_calls SET status='ended' WHERE id=v_call;
  SELECT count(*) INTO v_cnt FROM realtime.messages
   WHERE topic=v_topic AND event='inbound_call' AND (payload->>'id')=v_call::text AND (payload->>'status')='ended';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL T5: expected 1 dismiss broadcast, got %', v_cnt; END IF;
  RAISE NOTICE 'PASS T5: ended UPDATE broadcast dismiss';

  -- T6: agent_id NULL (unassigned/degraded call) -> NO broadcast (no pop target)
  INSERT INTO inbound_calls (imo_id, request_tag, agent_id, ani, phone_e164, status, fired_pop, patch_only)
  VALUES (v_imo, v_tag||'-noagent', NULL, '5550009999', public.normalize_phone_e164('5550009999'), 'ringing', false, false);
  SELECT count(*) INTO v_cnt FROM realtime.messages WHERE (payload->>'request_tag')=v_tag||'-noagent';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL T6: NULL-agent call broadcast (got %)', v_cnt; END IF;
  RAISE NOTICE 'PASS T6: NULL agent_id produced NO broadcast';

  -- T7: a non-pop status change does NOT re-broadcast (only INSERT-pop + ->ended fire)
  INSERT INTO inbound_calls (imo_id, request_tag, agent_id, client_id, ani, phone_e164, status, fired_pop, patch_only)
  VALUES (v_imo, v_tag||'-nopop', v_agent, v_client, '5550005678', public.normalize_phone_e164('5550005678'), 'ringing', false, false);
  SELECT count(*) INTO v_cnt FROM realtime.messages WHERE (payload->>'request_tag')=v_tag||'-nopop';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL T7: ringing INSERT without fired_pop broadcast (got %)', v_cnt; END IF;
  RAISE NOTICE 'PASS T7: ringing INSERT with fired_pop=false produced NO broadcast';

  -- roll back all test rows (DELETE here; on any failure above the whole txn rolls back anyway)
  DELETE FROM inbound_calls WHERE request_tag LIKE v_tag || '%';

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'ALL 7 INBOUND-CRM SCALE-FIX TESTS PASSED';
  RAISE NOTICE '==================================================';
END$$;
