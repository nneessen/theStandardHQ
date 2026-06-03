#!/usr/bin/env bash
# Tests migrations 20260603100930_assistant_audit_log.sql + 20260603114600_harden_*:
#   Part A — APPEND-ONLY RLS: an authenticated user can NEVER write/alter/delete a row
#            directly (no INSERT/UPDATE/DELETE policy), can read ONLY their own, and a
#            different user cannot read theirs. The only write path is log_assistant_audit().
#   Part B — IMO DERIVATION (code-review M1): log_assistant_audit() stamps imo_id from
#            get_my_imo_id() (server-side), NOT a caller param — and matches the row owner's
#            real user_profiles.imo_id. actor_user_id is stamped from auth.uid().
#
# Impersonates authenticated users via set_config(role + request.jwt.claims) inside a txn
# that is ROLLED BACK, so nothing persists. Run against the DB that has the table (prod):
#   DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/test-assistant-audit-log.sh
# Pass criteria: both sentinels print (psql w/o ON_ERROR_STOP returns 0 even on error).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP_SQL="$(mktemp -t audit_log_test.XXXXXX).sql"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

cat > "$TMP_SQL" <<'SQL'
BEGIN;
DO $$
DECLARE
  uidA  uuid;
  uidX  uuid := gen_random_uuid(); -- a user that owns nothing / is in no IMO / no admin role
  rid   uuid;
  ok    boolean;
  n     integer;
  expected_imo uuid;
  got_imo uuid;
BEGIN
  SELECT id INTO uidA FROM user_profiles LIMIT 1;
  IF uidA IS NULL THEN RAISE EXCEPTION 'no user_profiles row to test with'; END IF;
  SELECT imo_id INTO expected_imo FROM user_profiles WHERE id = uidA;

  -- Impersonate A as the authenticated role so RLS engages.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', uidA::text, 'role', 'authenticated')::text, true);

  -- A1: a DIRECT insert by an authenticated user is denied (no INSERT policy).
  ok := false;
  BEGIN
    INSERT INTO assistant_audit_log (actor_user_id, surface, event)
    VALUES (uidA, 'text', 'direct_insert_attempt');
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: direct INSERT by authenticated was allowed'; END IF;
  RAISE NOTICE 'PASS: direct INSERT denied (append-only)';

  -- The ONLY write path: the SECURITY DEFINER writer. Returns the new id.
  rid := log_assistant_audit('text', 'tool_call', 'getWeather', 'read', 'success');
  IF rid IS NULL THEN RAISE EXCEPTION 'FAIL: log_assistant_audit returned null'; END IF;
  RAISE NOTICE 'PASS: log_assistant_audit() wrote a row';

  -- A2: a DIRECT update by the owner affects 0 rows (no UPDATE policy => RLS hides it).
  UPDATE assistant_audit_log SET event = 'tampered' WHERE id = rid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: direct UPDATE affected % row(s)', n; END IF;
  RAISE NOTICE 'PASS: direct UPDATE affects 0 rows (immutable)';

  -- A3: a DIRECT delete by the owner affects 0 rows (no DELETE policy).
  DELETE FROM assistant_audit_log WHERE id = rid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: direct DELETE affected % row(s)', n; END IF;
  RAISE NOTICE 'PASS: direct DELETE affects 0 rows (no purge)';

  -- A4: the owner can READ their own row.
  SELECT count(*) INTO n FROM assistant_audit_log WHERE id = rid;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot read own audit row (got %)', n; END IF;
  RAISE NOTICE 'PASS: owner reads own row';

  -- B: imo_id was derived server-side and matches A's real imo (M1). actor is auth.uid().
  SELECT imo_id INTO got_imo FROM assistant_audit_log WHERE id = rid;
  IF got_imo IS DISTINCT FROM expected_imo THEN
    RAISE EXCEPTION 'FAIL: imo_id not derived (got %, expected %)', got_imo, expected_imo;
  END IF;
  PERFORM 1 FROM assistant_audit_log WHERE id = rid AND actor_user_id = uidA;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: actor_user_id not stamped to auth.uid()'; END IF;
  RAISE NOTICE 'PASS: imo_id derived (get_my_imo_id) + actor stamped (auth.uid)';

  -- A5: a DIFFERENT user cannot read A's row (cross-user isolation via RLS).
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', uidX::text, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM assistant_audit_log WHERE id = rid;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: a different user read A''s audit row (got %)', n; END IF;
  RAISE NOTICE 'PASS: cross-user isolation — other user cannot read the row';

  RAISE NOTICE 'APPEND_ONLY_TESTS_PASSED';
  RAISE NOTICE 'IMO_DERIVATION_TEST_PASSED';
END
$$;
ROLLBACK;
SQL

echo "▶ assistant_audit_log tests (append-only RLS + imo derivation)"
OUTPUT="$(./scripts/migrations/run-sql.sh -f "$TMP_SQL" 2>&1)" || true
echo "$OUTPUT"

if echo "$OUTPUT" | grep -q "APPEND_ONLY_TESTS_PASSED" \
   && echo "$OUTPUT" | grep -q "IMO_DERIVATION_TEST_PASSED"; then
  echo "✅ assistant_audit_log: all assertions passed"
  exit 0
else
  echo "❌ assistant_audit_log: one or more assertions FAILED (see output above)"
  exit 1
fi
