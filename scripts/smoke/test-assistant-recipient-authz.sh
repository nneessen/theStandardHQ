#!/usr/bin/env bash
# Tests migration 20260528112134_assistant_recipient_authz.sql:
#   Part A — the content-freeze added to assistant_action_requests_status_guard():
#            recipient/draft_payload/channel are immutable once a row leaves
#            draft/pending_approval (the "redirect an approved send" gap, paired
#            with M2). Runs via run-sql.sh (superuser => RLS bypassed) so it
#            exercises the TRIGGER, which also fires under service role.
#   Part B — assistant_recipient_is_allowed(channel, recipient): the M2 allowed-set
#            check. SECURITY INVOKER, so RLS defines the set. Part B impersonates an
#            authenticated user (set role + request.jwt.claims) inside a txn that is
#            ROLLED BACK, so nothing persists. The load-bearing assertion is the
#            cross-user negative: the SAME function + SAME recipient under a
#            different auth.uid() must return false — proving RLS does the scoping.
#
# Pass criteria: each part prints its sentinel only if every assertion held.
# psql without ON_ERROR_STOP returns 0 even on SQL error, so we grep the sentinels.
#
# Usage: ./scripts/test-assistant-recipient-authz.sh   (targets local .env DB)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SENTINEL_TOOL="__recipient_authz_test__"
TEST_EMAIL="jarvis-authz-test@example.com"
TMP_SQL="$(mktemp -t recipient_authz_test.XXXXXX).sql"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

cat > "$TMP_SQL" <<SQL
-- ============================ Part A: content freeze ========================
DO \$\$
DECLARE
  uid uuid;
  rid uuid;
  ok  boolean;
BEGIN
  SELECT id INTO uid FROM user_profiles LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'no user_profiles row to test with'; END IF;

  -- Drive a row to approved (editing recipient/payload during the approve step,
  -- where OLD.status='pending_approval', is the legitimate path and must succeed).
  INSERT INTO assistant_action_requests (user_id, channel, tool_name, status, recipient, draft_payload)
  VALUES (uid, 'email', '${SENTINEL_TOOL}', 'pending_approval', 'first@example.com', '{"subject":"s","body":"b"}'::jsonb)
  RETURNING id INTO rid;
  UPDATE assistant_action_requests
     SET status='approved', recipient='approved@example.com', draft_payload='{"subject":"s2","body":"b2"}'::jsonb
   WHERE id=rid;
  RAISE NOTICE 'PASS: edit recipient/payload during pending_approval->approved allowed';

  -- Freeze: changing recipient on an approved row is rejected.
  ok := false;
  BEGIN
    UPDATE assistant_action_requests SET recipient='redirect@example.com' WHERE id=rid;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: recipient change on approved row was allowed'; END IF;
  RAISE NOTICE 'PASS: recipient change on approved row rejected';

  -- Freeze: changing draft_payload on an approved row is rejected.
  ok := false;
  BEGIN
    UPDATE assistant_action_requests SET draft_payload='{"subject":"x","body":"evil"}'::jsonb WHERE id=rid;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: draft_payload change on approved row was allowed'; END IF;
  RAISE NOTICE 'PASS: draft_payload change on approved row rejected';

  -- The legitimate execute claim (approved->executing, content unchanged) still works.
  UPDATE assistant_action_requests SET status='executing' WHERE id=rid;
  RAISE NOTICE 'PASS: approved->executing claim (content unchanged) allowed';

  DELETE FROM assistant_action_requests WHERE tool_name='${SENTINEL_TOOL}';
  RAISE NOTICE 'CONTENT_FREEZE_TESTS_PASSED';
END
\$\$;

-- ===================== Part B: allowed-set under RLS ========================
BEGIN;
DO \$\$
DECLARE
  uidA   uuid;
  uidX   uuid := gen_random_uuid();  -- a user that owns nothing / is in no IMO
  claims text;
BEGIN
  SELECT id INTO uidA FROM user_profiles LIMIT 1;
  IF uidA IS NULL THEN RAISE EXCEPTION 'no user_profiles row to test with'; END IF;

  -- Seed an owner-scoped client for uidA (as superuser; RLS bypassed here).
  INSERT INTO clients (user_id, name, email, phone)
  VALUES (uidA, 'Jarvis AuthZ Test', '${TEST_EMAIL}', '+1 (720) 555-0143');

  -- Impersonate uidA as the authenticated role so RLS engages.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', uidA::text, 'role', 'authenticated')::text, true);

  -- Positive: own client, case-insensitive + whitespace-tolerant.
  IF NOT assistant_recipient_is_allowed('email', 'JARVIS-AUTHZ-TEST@EXAMPLE.COM')
     THEN RAISE EXCEPTION 'FAIL: A should match own client email (case-insensitive)'; END IF;
  IF NOT assistant_recipient_is_allowed('email', '  ${TEST_EMAIL}  ')
     THEN RAISE EXCEPTION 'FAIL: A should match own client email (trimmed)'; END IF;
  RAISE NOTICE 'PASS: email match for owner (case/space-insensitive)';

  -- Positive: phone, format-insensitive (last 10 digits).
  IF NOT assistant_recipient_is_allowed('sms', '7205550143')
     THEN RAISE EXCEPTION 'FAIL: bare 10-digit phone should match'; END IF;
  IF NOT assistant_recipient_is_allowed('sms', '(720) 555-0143')
     THEN RAISE EXCEPTION 'FAIL: formatted phone should match'; END IF;
  IF NOT assistant_recipient_is_allowed('sms', '+1 720-555-0143')
     THEN RAISE EXCEPTION 'FAIL: +1 phone should match'; END IF;
  RAISE NOTICE 'PASS: phone match for owner (format-insensitive)';

  -- Negatives: unknown recipient, too-few-digit phone, unknown channel.
  IF assistant_recipient_is_allowed('email', 'nobody-unique-xyz@example.com')
     THEN RAISE EXCEPTION 'FAIL: unknown email matched'; END IF;
  IF assistant_recipient_is_allowed('sms', '9990001234')
     THEN RAISE EXCEPTION 'FAIL: unknown phone matched'; END IF;
  IF assistant_recipient_is_allowed('sms', '12345')
     THEN RAISE EXCEPTION 'FAIL: <10-digit phone matched'; END IF;
  IF assistant_recipient_is_allowed('carrier_pigeon', '${TEST_EMAIL}')
     THEN RAISE EXCEPTION 'FAIL: unknown channel matched'; END IF;
  RAISE NOTICE 'PASS: unknown recipient / short phone / bad channel all rejected';

  -- Load-bearing: a DIFFERENT auth.uid() must NOT match A's client. Same function,
  -- same recipient -> false, because RLS scopes clients to the owner. This proves
  -- the function is not ignoring auth.uid().
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', uidX::text, 'role', 'authenticated')::text, true);
  IF assistant_recipient_is_allowed('email', '${TEST_EMAIL}')
     THEN RAISE EXCEPTION 'FAIL: a different user matched A''s client (RLS not scoping)'; END IF;
  IF assistant_recipient_is_allowed('sms', '7205550143')
     THEN RAISE EXCEPTION 'FAIL: a different user matched A''s client phone (RLS not scoping)'; END IF;
  RAISE NOTICE 'PASS: cross-user isolation — other user does not match A''s client';

  RAISE NOTICE 'RECIPIENT_AUTHZ_TESTS_PASSED';
END
\$\$;
ROLLBACK;
SQL

echo "▶ assistant recipient-authorization tests (content freeze + allowed-set RLS)"
OUTPUT="$(./scripts/migrations/run-sql.sh -f "$TMP_SQL" 2>&1)" || true
echo "$OUTPUT"

# Best-effort cleanup of Part A's row even if its DO block aborted before DELETE.
./scripts/migrations/run-sql.sh \
  "DELETE FROM assistant_action_requests WHERE tool_name='${SENTINEL_TOOL}';" \
  >/dev/null 2>&1 || true

if echo "$OUTPUT" | grep -q "CONTENT_FREEZE_TESTS_PASSED" \
   && echo "$OUTPUT" | grep -q "RECIPIENT_AUTHZ_TESTS_PASSED"; then
  echo "✅ recipient-authz: all assertions passed"
  exit 0
else
  echo "❌ recipient-authz: one or more assertions FAILED (see output above)"
  exit 1
fi
