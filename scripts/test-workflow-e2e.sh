#!/usr/bin/env bash
# ============================================================================
# System Workflows — async engine end-to-end smoke test (LOCAL Supabase only).
#
# Exercises the full async cutover chain against a real local stack:
#   trigger-workflow-event (enqueue)  →  fire-and-forget worker kick
#     →  process-pending-workflows (SKIP-LOCKED dequeue)
#       →  process-workflow (executes the snapshotted actions)
#         →  workflow_runs.status = 'completed' + a real side effect row.
#
# Asserts: happy-path completion + side effect, dedupe idempotency, and the
# service-role auth gates. Creates its own marker-named workflow and cleans up
# everything it created on exit.
#
# Prereqs: `npx supabase start` (full stack) AND the 3 fns served:
#   npx supabase functions serve --no-verify-jwt
# Usage:  ./scripts/test-workflow-e2e.sh
# ============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SQL="$SCRIPT_DIR/migrations/run-sql.sh"
MARKER="E2E-AUTOTEST"
FAILS=0

# --- local stack credentials (deterministic for the supabase CLI demo project) ---
STATUS_ENV="$(npx supabase status -o env 2>/dev/null)"
API_URL="$(printf '%s\n' "$STATUS_ENV" | grep '^API_URL=' | cut -d'"' -f2)"
SERVICE_ROLE_KEY="$(printf '%s\n' "$STATUS_ENV" | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)"
FUNCTIONS_URL="${API_URL}/functions/v1"

if [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "ERROR: could not read SERVICE_ROLE_KEY from 'supabase status'. Is the local stack up?" >&2
  exit 1
fi

sql() { "$RUN_SQL" "$1" 2>/dev/null | sed -n '3p' | tr -d ' '; }
pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAILS=$((FAILS+1)); }

cleanup() {
  echo "--- cleanup ---"
  "$RUN_SQL" "
    DELETE FROM notifications WHERE title='$MARKER';
    DELETE FROM workflow_runs WHERE workflow_id IN (SELECT id FROM workflows WHERE name LIKE '$MARKER%');
    DELETE FROM workflow_events WHERE event_name='policy.created' AND context->>'marker'='$MARKER';
    DELETE FROM workflows WHERE name LIKE '$MARKER%';
  " >/dev/null 2>&1
  echo "  removed $MARKER workflow + runs + notifications"
}
trap cleanup EXIT

# --- pick a real owner/recipient (any profile with an imo + email) ---
OWNER="$(sql "SELECT id FROM user_profiles WHERE imo_id IS NOT NULL AND email IS NOT NULL ORDER BY created_at LIMIT 1;")"
IMO="$(sql "SELECT imo_id FROM user_profiles WHERE id='$OWNER';")"
if [ -z "$OWNER" ] || [ -z "$IMO" ]; then fail "no seed user with imo+email found"; exit 1; fi
echo "owner=$OWNER imo=$IMO"

# --- seed a marker-named active event-workflow (create_notification action) ---
cleanup  # start clean
WF="$("$RUN_SQL" "
  INSERT INTO workflows (name, trigger_type, status, imo_id, created_by, config, actions)
  VALUES ('$MARKER policy.created', 'event', 'active', '$IMO', '$OWNER',
    '{\"trigger\":{\"eventName\":\"policy.created\"}}'::jsonb,
    '[{\"type\":\"create_notification\",\"order\":1,\"config\":{\"title\":\"$MARKER\",\"message\":\"e2e\"}}]'::jsonb)
  RETURNING id;" 2>/dev/null | sed -n '3p' | tr -d ' ')"
[ -n "$WF" ] && pass "seeded workflow $WF" || { fail "seed workflow"; exit 1; }

fire() { # $1=policyId $2=timestamp -> echoes workflowsTriggered
  curl -s -X POST "$FUNCTIONS_URL/trigger-workflow-event" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
    -d "{\"eventName\":\"policy.created\",\"context\":{\"marker\":\"$MARKER\",\"recipientId\":\"$OWNER\",\"triggeredBy\":\"$OWNER\",\"policyId\":\"$1\",\"timestamp\":\"$2\"}}" \
    | grep -oE '"workflowsTriggered":[0-9]+' | grep -oE '[0-9]+'
}

# --- Test 1: happy path completes + creates the notification ---
echo "--- Test 1: happy-path chain ---"
# NB: a service-role fire matches active policy.created workflows across all IMOs,
# so assert >=1 (our workflow is in the set), not an absolute count.
T1="$(fire e2e-1 2026-01-01T00:00:00Z)"
[ "${T1:-0}" -ge 1 ] 2>/dev/null && pass "enqueue returned workflowsTriggered=$T1 (>=1)" || fail "enqueue (got '$T1')"
ST=""
for _ in $(seq 1 15); do
  ST="$(sql "SELECT status FROM workflow_runs WHERE workflow_id='$WF' AND dedupe_key LIKE '%e2e-1%';")"
  { [ "$ST" = "completed" ] || [ "$ST" = "failed" ]; } && break
  sleep 1
done
[ "$ST" = "completed" ] && pass "run reached 'completed'" || fail "run status='$ST' (expected completed)"
N="$(sql "SELECT count(*) FROM notifications WHERE title='$MARKER' AND user_id='$OWNER';")"
[ "$N" -ge 1 ] 2>/dev/null && pass "notification side-effect created ($N)" || fail "no notification created"

# --- Test 2: dedupe idempotency ---
echo "--- Test 2: dedupe idempotency ---"
D1="$(fire e2e-dup 2026-02-02T00:00:00Z)"; sleep 1
D2="$(fire e2e-dup 2026-02-02T00:00:00Z)"   # identical key  -> all matches deduped
D3="$(fire e2e-dup 2026-02-02T09:09:09Z)"   # varied timestamp -> re-fires the same set
[ "${D1:-0}" -ge 1 ] 2>/dev/null && pass "first fire enqueued ($D1)" || fail "first dup fire (got '$D1')"
[ "$D2" = "0" ] && pass "identical dedupe key suppressed (0)" || fail "identical key not suppressed (got '$D2')"
[ "$D3" = "$D1" ] && pass "varied timestamp re-fires same set ($D3)" || fail "varied ts mismatch (D1='$D1' D3='$D3')"

# --- Test 3: service-role auth gates ---
echo "--- Test 3: auth gates ---"
C1="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$FUNCTIONS_URL/process-pending-workflows" -H "Authorization: Bearer bogus" -d '{}')"
[ "$C1" = "401" ] && pass "worker rejects non-service-role bearer (401)" || fail "worker auth (got $C1)"
C2="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$FUNCTIONS_URL/trigger-workflow-event" -H "Content-Type: application/json" -d '{"eventName":"policy.created","context":{}}')"
[ "$C2" = "401" ] && pass "trigger rejects missing auth (401)" || fail "trigger auth (got $C2)"

echo "============================================================"
[ "$FAILS" -eq 0 ] && { echo "ALL WORKFLOW E2E CHECKS PASSED"; exit 0; } || { echo "$FAILS CHECK(S) FAILED"; exit 1; }
