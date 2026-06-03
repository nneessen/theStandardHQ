#!/usr/bin/env bash
# Tests 20260603121430_assistant_resolve_contact.sql: assistant_resolve_contact(name, channel)
# is SECURITY INVOKER, so RLS scopes results to the caller's own clients. Load-bearing check:
# the SAME name under a DIFFERENT auth.uid() returns nothing (RLS does the scoping), and the
# returned value is MASKED (never the raw phone). Impersonates users via set_config(role +
# request.jwt.claims) inside a ROLLED-BACK txn, so nothing persists.
#
# Run against the DB that has the function (prod):
#   DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/test-assistant-resolve-contact.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
TMP_SQL="$(mktemp -t resolve_contact_test.XXXXXX).sql"; trap 'rm -f "$TMP_SQL"' EXIT

cat > "$TMP_SQL" <<'SQL'
BEGIN;
DO $$
DECLARE
  uidA uuid;
  uidX uuid := gen_random_uuid(); -- owns nothing / no hierarchy
  n int;
  v text;
BEGIN
  SELECT id INTO uidA FROM user_profiles LIMIT 1;
  IF uidA IS NULL THEN RAISE EXCEPTION 'no user_profiles row to test with'; END IF;

  -- Seed an owner-scoped client for A (superuser here; RLS bypassed for setup).
  INSERT INTO clients (user_id, name, phone, email)
  VALUES (uidA, 'Jarvis Resolve Test', '+1 (720) 555-0199', 'jarvis-resolve-test@example.com');

  -- Impersonate A.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uidA::text, 'role', 'authenticated')::text, true);

  -- A finds their own client by partial name, masked.
  SELECT count(*) INTO n FROM assistant_resolve_contact('Jarvis Resolve', 'sms');
  IF n < 1 THEN RAISE EXCEPTION 'FAIL: owner did not resolve own client (got %)', n; END IF;
  SELECT masked_value INTO v FROM assistant_resolve_contact('Jarvis Resolve', 'sms') LIMIT 1;
  IF v IS NULL OR v !~ '^\*\*\*-[0-9]{4}$' THEN
    RAISE EXCEPTION 'FAIL: phone not masked as ***-NNNN (got %)', v;
  END IF;
  IF v LIKE '%0199%' AND v <> '***-0199' THEN RAISE EXCEPTION 'FAIL: raw phone leaked'; END IF;
  IF v <> '***-0199' THEN RAISE EXCEPTION 'FAIL: unexpected mask (got %)', v; END IF;
  RAISE NOTICE 'PASS: owner resolves own client, value masked to %', v;

  -- email channel masks too.
  SELECT masked_value INTO v FROM assistant_resolve_contact('Jarvis Resolve', 'email') LIMIT 1;
  IF v IS NULL OR v !~ '@' OR v LIKE '%jarvis-resolve-test@%' THEN
    RAISE EXCEPTION 'FAIL: email not masked (got %)', v;
  END IF;
  RAISE NOTICE 'PASS: email masked to %', v;

  -- Load-bearing: a DIFFERENT user resolves NOTHING for the same name (RLS scoping).
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uidX::text, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM assistant_resolve_contact('Jarvis Resolve', 'sms');
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: a different user resolved A''s client (got %, RLS not scoping)', n; END IF;
  RAISE NOTICE 'PASS: cross-user isolation — other user resolves nothing';

  RAISE NOTICE 'RESOLVE_CONTACT_TESTS_PASSED';
END
$$;
ROLLBACK;
SQL

echo "▶ assistant_resolve_contact tests (RLS scoping + masking)"
OUTPUT="$(./scripts/migrations/run-sql.sh -f "$TMP_SQL" 2>&1)" || true
echo "$OUTPUT"
if echo "$OUTPUT" | grep -q "RESOLVE_CONTACT_TESTS_PASSED"; then
  echo "✅ resolve-contact: all assertions passed"; exit 0
else
  echo "❌ resolve-contact: one or more assertions FAILED"; exit 1
fi
