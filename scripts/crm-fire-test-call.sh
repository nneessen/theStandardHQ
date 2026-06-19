#!/usr/bin/env bash
# scripts/crm-fire-test-call.sh
# ============================================================================
# Fire a single LIVE inbound call at a specific logged-in agent so you can watch
# the Phase-3 screen-pop appear in the browser (LOCAL only).
# ============================================================================
# How to use:
#   1. npm run dev           (the app points at local Supabase per .env)
#   2. Log in as the agent whose email you pass below (default: epiclife.neessen@gmail.com)
#   3. ./scripts/crm-fire-test-call.sh [agent_email]
#      -> a 'ringing' inbound_calls row is created for that agent; the pop fires top-right.
#   4. Copy/run the printed "end" command to flip it to 'ended' and watch the pop auto-dismiss.
#
# This writes a real (committed) row to the LOCAL DB — it is the same path the dialer's POST
# takes (crm_upsert_call). Idempotent fixtures: a per-agent demo pcId + one demo client.
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${1:-epiclife.neessen@gmail.com}"
TAG="demo-$(date +%s)"
DEMO_PHONE="555-867-5309"

cat > /tmp/crm_fire.sql <<SQL
\set ON_ERROR_STOP on
DO \$\$
DECLARE
  v_agent uuid; v_imo uuid; v_pc text; r record;
  v_client uuid; v_carrier uuid;
BEGIN
  SELECT up.id, up.imo_id INTO v_agent, v_imo
  FROM user_profiles up JOIN auth.users au ON au.id = up.id
  WHERE au.email = '${EMAIL}' AND up.imo_id IS NOT NULL
  LIMIT 1;
  IF v_agent IS NULL THEN RAISE EXCEPTION 'No agent (with an imo) found for email ${EMAIL}'; END IF;

  v_pc := 'demo-pc-' || left(replace(v_agent::text, '-', ''), 8);

  INSERT INTO imo_agent_external_ids (imo_id, user_id, pc_id)
    VALUES (v_imo, v_agent, v_pc)
    ON CONFLICT (imo_id, user_id) DO UPDATE SET pc_id = EXCLUDED.pc_id;

  -- Demo client: realistic, named record so the intake binds visibly (name/DOB/email/address).
  SELECT id INTO v_client FROM clients
   WHERE user_id = v_agent AND phone_e164 = public.normalize_phone_e164('${DEMO_PHONE}') LIMIT 1;
  IF v_client IS NULL THEN
    INSERT INTO clients (user_id, name, phone, state, status, email, date_of_birth, address)
      VALUES (v_agent, 'Maria Sanchez', '${DEMO_PHONE}', 'CA', 'active',
              'maria.sanchez@example.com', '1958-04-12',
              '{"street":"482 Alameda Blvd","city":"Sacramento","state":"CA","zipCode":"95814"}')
      RETURNING id INTO v_client;
  ELSE
    UPDATE clients SET name = 'Maria Sanchez', email = 'maria.sanchez@example.com',
           date_of_birth = '1958-04-12',
           address = '{"street":"482 Alameda Blvd","city":"Sacramento","state":"CA","zipCode":"95814"}'
     WHERE id = v_client;
  END IF;

  -- Best-effort fixtures (policies + a prior call) so the context rail shows real data.
  -- Wrapped so any schema/FK drift can't abort the actual call fire.
  BEGIN
    SELECT id INTO v_carrier FROM carriers ORDER BY name LIMIT 1;
    IF v_carrier IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM policies WHERE client_id = v_client) THEN
      INSERT INTO policies (imo_id, user_id, client_id, carrier_id, product,
                            monthly_premium, annual_premium, effective_date, status, lifecycle_status, policy_number)
      VALUES
        (v_imo, v_agent, v_client, v_carrier, 'whole_life', 68.40, 820.80, '2022-06-15', 'active', 'active', 'WL-DEMO-1001'),
        (v_imo, v_agent, v_client, v_carrier, 'term_life',  42.10, 505.20, '2020-02-01', 'lapsed', 'lapsed', 'TL-DEMO-2002');
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'policy fixture skipped: %', SQLERRM; END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM inbound_calls WHERE client_id = v_client AND request_tag = 'demo-hist-1') THEN
      INSERT INTO inbound_calls (imo_id, request_tag, agent_id, client_id, ani, state, pc_id,
                                 call_program, call_start, duration, billable, status, fired_pop, patch_only)
      VALUES (v_imo, 'demo-hist-1', v_agent, v_client, '${DEMO_PHONE}', 'CA', v_pc,
              'Final Expense', now() - interval '9 days', 372, 1, 'ended', true, false);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'history fixture skipped: %', SQLERRM; END;

  SELECT * INTO r FROM crm_upsert_call(v_imo, '${TAG}', v_pc, '${DEMO_PHONE}', 'CA', NULL, NULL, 'Final Expense');
  RAISE NOTICE 'Fired ringing call id=% agent=% fired_pop=% (tag ${TAG}) for ${EMAIL}', r.id, r.agent_id, r.fired_pop;
END\$\$;
SQL

./scripts/migrations/run-sql.sh -f /tmp/crm_fire.sql
rm -f /tmp/crm_fire.sql

echo ""
echo "Pop should now be showing top-right for ${EMAIL}."
echo "End the call (watch it auto-dismiss):"
echo "  ./scripts/migrations/run-sql.sh \"SELECT crm_patch_billable((SELECT up.imo_id FROM user_profiles up JOIN auth.users au ON au.id=up.id WHERE au.email='${EMAIL}' LIMIT 1), '${TAG}', 1::smallint, 90);\""
