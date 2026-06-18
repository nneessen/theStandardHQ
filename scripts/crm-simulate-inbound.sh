#!/usr/bin/env bash
# scripts/crm-simulate-inbound.sh
# ============================================================================
# 10-USER INBOUND-CALL SIMULATION for the inbound-CRM endpoints (LOCAL).
# ============================================================================
# Seeds 10 Epic Life agents (each: a pcId + a known-caller client), serves
# crm-oauth-token + crm-leads against local Supabase, then runs
# scripts/crm-simulate-inbound.ts to stream a batch of inbound calls across
# those agents (GET AoR -> POST create+event -> PATCH billable + edge cases),
# and finally prints what actually landed in `inbound_calls`.
#
# Prereqs: local Supabase running with the 4 inbound-CRM migrations applied; deno installed.
# Usage:   ./scripts/crm-simulate-inbound.sh [N_CALLS]   (default 24)
set -euo pipefail
cd "$(dirname "$0")/.."

N_CALLS="${1:-24}"
EPIC="2fd256e9-9abb-445e-b405-62436555648a"
BASE="http://127.0.0.1:54321/functions/v1"
TOKEN_URL="$BASE/crm-oauth-token"
SIGNING_KEY="sim-$(openssl rand -hex 24)"
RUN_TAG="sim-$(date +%s)"

command -v deno >/dev/null 2>&1 || { echo "FAIL: deno not installed."; exit 1; }
supabase status >/dev/null 2>&1 || { echo "FAIL: local Supabase not running (supabase start)."; exit 1; }

# ── 1) Seed 10 agents + capture credential + the (pcId, phone, agent) fixtures ──────
SEED_FILE="$(mktemp -t crm-sim-seed.XXXXXX).sql"
cat > "$SEED_FILE" <<SQL
\set ON_ERROR_STOP on
SELECT id AS admin_id FROM user_profiles
 WHERE is_super_admin AND imo_id = '${EPIC}'::uuid ORDER BY id LIMIT 1 \gset
BEGIN;
  SELECT set_config('request.jwt.claims',
                    json_build_object('sub', :'admin_id', 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT client_id AS cred_client, client_secret AS cred_secret
    FROM crm_issue_credential('${EPIC}'::uuid, 'sim-local', ARRAY['crm:leads']) \gset
  RESET ROLE;
  -- Reset prior sim pcId mappings (nothing FK-references mapping rows) so the agent pick is deterministic.
  DELETE FROM imo_agent_external_ids WHERE imo_id = '${EPIC}'::uuid AND pc_id LIKE 'sim-pc-%';
  CREATE TEMP TABLE sim_picked ON COMMIT DROP AS
    SELECT up.id AS agent_id, row_number() OVER (ORDER BY up.id) AS n
    FROM user_profiles up
    WHERE up.imo_id = '${EPIC}'::uuid AND NOT public.is_access_revoked(up.id)
      AND NOT EXISTS (SELECT 1 FROM imo_agent_external_ids m
                      WHERE m.imo_id = '${EPIC}'::uuid AND m.user_id = up.id)
    ORDER BY up.id LIMIT 10;
  INSERT INTO imo_agent_external_ids (imo_id, user_id, pc_id)
    SELECT '${EPIC}'::uuid, agent_id, 'sim-pc-' || lpad(n::text, 2, '0') FROM sim_picked;
  INSERT INTO clients (user_id, name, phone, status)
    SELECT sp.agent_id, 'SIM Caller ' || lpad(sp.n::text,2,'0'),
           '999-100-' || lpad(sp.n::text,4,'0'), 'active'
    FROM sim_picked sp
    WHERE NOT EXISTS (SELECT 1 FROM clients c WHERE c.user_id = sp.agent_id
                      AND c.phone_e164 = public.normalize_phone_e164('999-100-' || lpad(sp.n::text,4,'0')));
  \pset format unaligned
  \pset tuples_only on
  \pset pager off
  SELECT 'SIMCRED|' || :'cred_client' || '|' || :'cred_secret';
  SELECT 'SIMAGENT|sim-pc-' || lpad(n::text,2,'0') || '|'
         || public.normalize_phone_e164('999-100-' || lpad(n::text,4,'0')) || '|'
         || agent_id || '|Agent-' || lpad(n::text,2,'0')
    FROM sim_picked ORDER BY n;
COMMIT;
SQL
SEED_OUT="$(./scripts/migrations/run-sql.sh -f "$SEED_FILE" 2>&1 || true)"
rm -f "$SEED_FILE"

CRED_LINE="$(printf '%s\n' "$SEED_OUT" | grep -E '^SIMCRED\|' | head -1 || true)"
if [ -z "$CRED_LINE" ]; then echo "FAIL: seed did not issue a credential."; printf '%s\n' "$SEED_OUT" | tail -30; exit 1; fi
IFS='|' read -r _ CRED_CLIENT CRED_SECRET <<< "$CRED_LINE"
N_FIX="$(printf '%s\n' "$SEED_OUT" | grep -cE '^SIMAGENT\|' || true)"
if [ "${N_FIX:-0}" -lt 1 ]; then echo "FAIL: no agent fixtures seeded."; exit 1; fi

FIX_FILE="$(mktemp -t crm-sim-fix.XXXXXX).json"
{
  echo "["
  printf '%s\n' "$SEED_OUT" | grep -E '^SIMAGENT\|' | awk -F'|' '{
    if (n++) printf ",\n";
    printf "  {\"pcId\":\"%s\",\"phone\":\"%s\",\"agentId\":\"%s\",\"agentName\":\"%s\"}",$2,$3,$4,$5
  }'
  printf '\n]\n'
} > "$FIX_FILE"
echo "Seeded $N_FIX agents (pcIds sim-pc-01..$(printf '%02d' "$N_FIX")); credential=$CRED_CLIENT; run_tag=$RUN_TAG"

# ── 2) Serve the functions in the background ────────────────────────────────────────
TMP_ENV="$(mktemp -t crm-sim-env.XXXXXX)"
printf 'CRM_CALL_PLATFORM_SIGNING_KEY=%s\nCRM_INSTANCE_URL=%s\n' "$SIGNING_KEY" "http://127.0.0.1:54321" > "$TMP_ENV"
SERVE_PID=""
cleanup() { [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null || true; rm -f "$TMP_ENV" "$FIX_FILE"; }
trap cleanup EXIT
supabase functions serve crm-oauth-token crm-leads --no-verify-jwt --env-file "$TMP_ENV" > /tmp/crm-sim-serve.log 2>&1 &
SERVE_PID=$!
mint() { curl -s -o /dev/null -w '%{http_code}' -X POST "$TOKEN_URL" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$CRED_CLIENT" --data-urlencode "client_secret=$CRED_SECRET" 2>/dev/null || echo 000; }
ready=0
for _ in $(seq 1 90); do
  [ "$(mint)" = "200" ] && { ready=1; break; }
  kill -0 "$SERVE_PID" 2>/dev/null || { echo "FAIL: serve exited."; tail -40 /tmp/crm-sim-serve.log; exit 1; }
  sleep 1
done
[ "$ready" = "1" ] || { echo "FAIL: functions not ready."; tail -40 /tmp/crm-sim-serve.log; exit 1; }

# ── 3) Run the simulation ───────────────────────────────────────────────────────────
set +e
CRM_BASE_URL="$BASE" CRM_CLIENT_ID="$CRED_CLIENT" CRM_CLIENT_SECRET="$CRED_SECRET" \
CRM_SIM_FIXTURES="$FIX_FILE" CRM_SIM_CALLS="$N_CALLS" CRM_SIM_RUN_TAG="$RUN_TAG" \
deno run --allow-net --allow-env --allow-read scripts/crm-simulate-inbound.ts
RC=$?
set -e

# ── 4) What actually landed in inbound_calls (the system-of-record view) ────────────
echo ""
echo "=== inbound_calls written by this run (DB view) ==="
./scripts/migrations/run-sql.sh "
SELECT COALESCE(m.pc_id,'(unassigned)') AS pc_id,
       count(*) AS calls,
       count(*) FILTER (WHERE ic.status='ringing') AS ringing,
       count(*) FILTER (WHERE ic.status='ended')   AS ended,
       count(*) FILTER (WHERE ic.fired_pop)         AS pops,
       count(*) FILTER (WHERE ic.client_id IS NOT NULL) AS linked_client,
       COALESCE(sum(ic.billable),0) AS billable
FROM inbound_calls ic
LEFT JOIN imo_agent_external_ids m ON m.user_id=ic.agent_id AND m.imo_id=ic.imo_id
WHERE ic.request_tag LIKE '${RUN_TAG}-%'
GROUP BY 1 ORDER BY 1;"
echo ""
echo "(Sim left ${N_CALLS} inbound_calls + any new SIM clients committed on LOCAL for inspection."
echo " Clean up later with:  ./scripts/migrations/run-sql.sh \"DELETE FROM inbound_calls WHERE request_tag LIKE '${RUN_TAG}-%';\")"
exit $RC
