#!/usr/bin/env bash
# scripts/crm-e2e-local.sh
# ============================================================================
# Inbound-CRM full local END-TO-END test (Phase 1 OAuth token + Phase 2 leads).
# ============================================================================
# Drives the SAME loop the external dialer ("Integration Platform") will:
#   POST client_id/secret -> bearer  ->  GET ?ani (AoR lookup)
#   -> POST (find/create lead + call event)  ->  PATCH (billable / end call)  + negatives.
#
# It is self-contained and re-runnable:
#   1. Seeds a COMMITTED fixture against the LOCAL DB: issues a real OAuth credential
#      (the RPC mints a random client_id/secret -> we capture it), registers a pcId to a
#      super-admin/agent, and gives that agent a "known caller" client. HTTP hits the
#      served functions over separate connections, so the fixture must be committed
#      (the rolled-back smoke tests in test-crm-*.sql can't be reused for this).
#   2. Serves crm-oauth-token + crm-leads against local Supabase with a throwaway signing
#      key (the SAME key is given to the driver so it can verify minted tokens).
#   3. Runs scripts/crm-mock-caller.ts and exits non-zero unless ALL checks pass.
#
# Prereqs: local Supabase running (`supabase start`) with the 4 inbound-CRM migrations
#          applied locally; `deno` installed.
# Usage:   ./scripts/crm-e2e-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="http://127.0.0.1:54321/functions/v1"
TOKEN_URL="$BASE/crm-oauth-token"
PCID="mock-pc-001"
SIGNING_KEY="local-e2e-$(openssl rand -hex 24)"

command -v deno >/dev/null 2>&1 || { echo "FAIL: deno is not installed."; exit 1; }
supabase status >/dev/null 2>&1 || { echo "FAIL: local Supabase is not running. Run: supabase start"; exit 1; }

# ── 1) Seed a committed fixture; capture credential + the known/unknown ANIs ────────
SEED_FILE="$(mktemp -t crm-seed.XXXXXX).sql"
cat > "$SEED_FILE" <<'SQL'
\set ON_ERROR_STOP on
\set known_phone '201-555-0123'
\set known_e164 '+12015550123'
\set unknown_ani '+19995550000'
\set pcid 'mock-pc-001'
\set cname 'CRM E2E Known Caller'

-- A super-admin (can issue credentials) + their imo; we use that user as the AoR agent.
SELECT id AS admin_id, imo_id AS imo_id
FROM user_profiles
WHERE is_super_admin AND imo_id IS NOT NULL
ORDER BY id LIMIT 1 \gset

BEGIN;
  -- Impersonate the super-admin for the two super-admin-gated RPCs (they read auth.uid()).
  SELECT set_config('request.jwt.claims',
                    json_build_object('sub', :'admin_id', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT client_id AS cred_client, client_secret AS cred_secret
    FROM crm_issue_credential(:'imo_id'::uuid, 'e2e-local', ARRAY['crm:leads']) \gset
  SELECT crm_register_agent_pcid(:'imo_id'::uuid, :'admin_id'::uuid, :'pcid') AS reg \gset
  RESET ROLE;
  -- Known-caller client owned by the agent (idempotent; phone_e164 is a generated column).
  INSERT INTO clients (user_id, name, phone, status)
    SELECT :'admin_id'::uuid, :'cname', :'known_phone', 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM clients WHERE user_id = :'admin_id'::uuid AND phone_e164 = :'known_e164'
    );
COMMIT;

-- Emit the fixture for the harness ONLY IF it is unambiguous: exactly one client in the imo
-- owns the known number (tiebreak safety) AND nobody owns the "unknown" number.
\pset format unaligned
\pset tuples_only on
\pset pager off
SELECT 'SEED|' || :'cred_client' || '|' || :'cred_secret' || '|' || c.phone_e164 || '|' || :'unknown_ani'
FROM clients c
WHERE c.user_id = :'admin_id'::uuid
  AND c.phone_e164 = :'known_e164'
  AND (SELECT count(*) FROM clients ck JOIN user_profiles uk ON uk.id = ck.user_id
       WHERE uk.imo_id = :'imo_id'::uuid AND ck.phone_e164 = :'known_e164') = 1
  AND (SELECT count(*) FROM clients cu JOIN user_profiles uu ON uu.id = cu.user_id
       WHERE uu.imo_id = :'imo_id'::uuid AND cu.phone_e164 = :'unknown_ani') = 0
LIMIT 1;
SQL

SEED_OUT="$(./scripts/migrations/run-sql.sh -f "$SEED_FILE" 2>&1 || true)"
rm -f "$SEED_FILE"
SEED_LINE="$(printf '%s\n' "$SEED_OUT" | grep -E '^SEED\|' | head -1 || true)"
if [ -z "$SEED_LINE" ]; then
  echo "FAIL: seed did not emit a SEED line (RPC error, or the uniqueness assertion failed)."
  printf '%s\n' "$SEED_OUT" | tail -40
  exit 1
fi
IFS='|' read -r _tag CRED_CLIENT CRED_SECRET KNOWN_ANI UNKNOWN_ANI <<< "$SEED_LINE"
echo "Seed OK  client_id=$CRED_CLIENT  pcId=$PCID  known=$KNOWN_ANI  unknown=$UNKNOWN_ANI"

# ── 2) Serve the two functions in the background with our throwaway signing key ─────
TMP_ENV="$(mktemp -t crm-env.XXXXXX)"
printf 'CRM_CALL_PLATFORM_SIGNING_KEY=%s\nCRM_INSTANCE_URL=%s\n' "$SIGNING_KEY" "http://127.0.0.1:54321" > "$TMP_ENV"

SERVE_PID=""
cleanup() { [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null || true; rm -f "$TMP_ENV"; }
trap cleanup EXIT

echo "Starting: supabase functions serve crm-oauth-token crm-leads (background)..."
supabase functions serve crm-oauth-token crm-leads --no-verify-jwt --env-file "$TMP_ENV" \
  > /tmp/crm-serve.log 2>&1 &
SERVE_PID=$!

# Readiness = a REAL token mint with the seeded credential returns 200. This proves the
# whole chain is live (serve + our env/signing key + DB + the committed credential).
mint_code() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$TOKEN_URL" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "grant_type=client_credentials" \
    --data-urlencode "client_id=$CRED_CLIENT" \
    --data-urlencode "client_secret=$CRED_SECRET" 2>/dev/null || echo 000
}
ready=0
for _ in $(seq 1 90); do
  if [ "$(mint_code)" = "200" ]; then ready=1; break; fi
  if ! kill -0 "$SERVE_PID" 2>/dev/null; then
    echo "FAIL: 'supabase functions serve' exited early. Log:"; tail -40 /tmp/crm-serve.log; exit 1
  fi
  sleep 1
done
if [ "$ready" != "1" ]; then
  echo "FAIL: functions did not become ready (token mint never returned 200). Log:"
  tail -40 /tmp/crm-serve.log
  echo "(If something else is already serving, stop it: pkill -f 'supabase functions serve')"
  exit 1
fi
echo "Functions ready (token mint OK). Running the mock caller..."
echo ""

# ── 3) Run the driver with the captured fixture + the shared signing key ────────────
set +e
CRM_BASE_URL="$BASE" \
CRM_CLIENT_ID="$CRED_CLIENT" \
CRM_CLIENT_SECRET="$CRED_SECRET" \
CRM_TEST_PC_ID="$PCID" \
CRM_TEST_KNOWN_ANI="$KNOWN_ANI" \
CRM_TEST_UNKNOWN_ANI="$UNKNOWN_ANI" \
CRM_CALL_PLATFORM_SIGNING_KEY="$SIGNING_KEY" \
deno run --allow-net --allow-env scripts/crm-mock-caller.ts
RC=$?
set -e
exit $RC
