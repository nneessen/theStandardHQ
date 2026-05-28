#!/usr/bin/env bash
# Tests the DB-layer guard added in migration
# 20260528090704_assistant_action_status_guard.sql: the BEFORE INSERT/UPDATE
# trigger on assistant_action_requests that enforces the action lifecycle so an
# approved/executed send cannot be fabricated or reset+re-sent (review finding H1).
#
# Runs through the project's run-sql.sh (superuser conn => RLS bypassed, so this
# exercises the TRIGGER, the authoritative layer that also fires under service
# role). All work is cleaned up afterward; nothing persists.
#
# Pass criteria: the SQL prints the sentinel STATUS_GUARD_TESTS_PASSED only if
# every assertion held. psql without ON_ERROR_STOP returns 0 even on SQL error,
# so we grep for the sentinel rather than trust the exit code.
#
# Usage: ./scripts/test-assistant-action-status-guard.sh   (targets local .env DB)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SENTINEL_TOOL="__status_guard_test__"
TMP_SQL="$(mktemp -t status_guard_test.XXXXXX).sql"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

cat > "$TMP_SQL" <<SQL
DO \$\$
DECLARE
  uid uuid;
  rid uuid;
  ok boolean;
BEGIN
  SELECT id INTO uid FROM user_profiles LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'no user_profiles row available to test with';
  END IF;

  -- 1. INSERT fabrication: a row may not be created already-approved.
  ok := false;
  BEGIN
    INSERT INTO assistant_action_requests (user_id, channel, tool_name, status)
    VALUES (uid, 'email', '${SENTINEL_TOOL}', 'approved');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: INSERT with status=approved was allowed'; END IF;
  RAISE NOTICE 'PASS: INSERT status=approved rejected';

  -- 2. The full legal lifecycle is permitted.
  INSERT INTO assistant_action_requests (user_id, channel, tool_name, status)
  VALUES (uid, 'email', '${SENTINEL_TOOL}', 'pending_approval')
  RETURNING id INTO rid;
  UPDATE assistant_action_requests SET status='approved'  WHERE id=rid;
  UPDATE assistant_action_requests SET status='executing' WHERE id=rid;
  UPDATE assistant_action_requests SET status='executed', executed_at=now() WHERE id=rid;
  RAISE NOTICE 'PASS: legal lifecycle pending_approval->approved->executing->executed';

  -- 3. Terminal immutability: executed -> approved (the re-send vector) is rejected.
  ok := false;
  BEGIN
    UPDATE assistant_action_requests SET status='approved' WHERE id=rid;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: executed->approved was allowed'; END IF;
  RAISE NOTICE 'PASS: executed->approved rejected';

  -- 4. Illegal skip: pending_approval -> executed is rejected.
  INSERT INTO assistant_action_requests (user_id, channel, tool_name, status)
  VALUES (uid, 'sms', '${SENTINEL_TOOL}', 'pending_approval')
  RETURNING id INTO rid;
  ok := false;
  BEGIN
    UPDATE assistant_action_requests SET status='executed' WHERE id=rid;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: pending_approval->executed was allowed'; END IF;
  RAISE NOTICE 'PASS: pending_approval->executed rejected';

  DELETE FROM assistant_action_requests WHERE tool_name='${SENTINEL_TOOL}';
  RAISE NOTICE 'STATUS_GUARD_TESTS_PASSED';
END
\$\$;
SQL

echo "▶ assistant_action_requests status-guard trigger tests"
OUTPUT="$(./scripts/migrations/run-sql.sh -f "$TMP_SQL" 2>&1)" || true
echo "$OUTPUT"

# Best-effort cleanup even if the DO block aborted before its own DELETE.
./scripts/migrations/run-sql.sh \
  "DELETE FROM assistant_action_requests WHERE tool_name='${SENTINEL_TOOL}';" \
  >/dev/null 2>&1 || true

if echo "$OUTPUT" | grep -q "STATUS_GUARD_TESTS_PASSED"; then
  echo "✅ status-guard trigger: all assertions passed"
  exit 0
else
  echo "❌ status-guard trigger: one or more assertions FAILED (see output above)"
  exit 1
fi
