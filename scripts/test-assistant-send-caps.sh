#!/usr/bin/env bash
# Tests 20260603170136_assistant_send_caps.sql: assistant_send_caps(channel, recipient)
# is SECURITY DEFINER and resolves identity SERVER-SIDE — auth.uid() for the per-user
# distinct-recipient count + repeat flag, get_my_imo_id() for the IMO-wide ceiling count.
# The load-bearing security properties:
#   * a STRANGER (different/absent auth.uid()) sees 0 — never another user's sends;
#   * another IMO's executed sends do NOT inflate my imo_sends_24h (tenant isolation);
#   * recipients are normalized (last-10 phone) so format variants collapse to one
#     distinct recipient, and a repeat to an already-sent recipient sets the flag;
#   * internal Close note/task writes are EXCLUDED from the IMO ceiling (sms+email only).
# Impersonates users via set_config(role + request.jwt.claims) inside a ROLLED-BACK txn.
#
# Run against the DB that has the function (prod):
#   DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/test-assistant-send-caps.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
TMP_SQL="$(mktemp -t send_caps_test.XXXXXX).sql"; trap 'rm -f "$TMP_SQL"' EXIT

cat > "$TMP_SQL" <<'SQL'
BEGIN;
DO $$
DECLARE
  uidA   uuid;  -- the acting user (real, non-super-admin, has an IMO)
  uidB   uuid;  -- a second real user, used to park other-IMO rows under a real FK
  imoA   uuid;
  imoOther uuid := gen_random_uuid();           -- a DIFFERENT tenant
  uidX   uuid := gen_random_uuid();             -- a stranger: no rows, no IMO
  r record;
BEGIN
  SELECT id, imo_id INTO uidA, imoA
    FROM user_profiles
   WHERE imo_id IS NOT NULL AND coalesce(is_super_admin, false) = false
   LIMIT 1;
  IF uidA IS NULL THEN RAISE EXCEPTION 'no eligible user_profiles row (imo_id set, not super-admin)'; END IF;
  SELECT id INTO uidB FROM user_profiles WHERE id <> uidA LIMIT 1;
  IF uidB IS NULL THEN uidB := uidA; END IF;

  -- Seed committed sends (executed_at within the window — the only thing the count
  -- filters on). status stays 'pending_approval' to satisfy the INSERT lifecycle
  -- guard; the count ignores status. RLS is bypassed here (owner connection).
  -- A's own sends, tenant imoA:
  INSERT INTO assistant_action_requests (user_id, imo_id, channel, tool_name, recipient, status, executed_at) VALUES
    (uidA, imoA, 'sms',   'draftSmsMessage',   '+1 (720) 555-0001', 'pending_approval', now()),
    (uidA, imoA, 'sms',   'draftSmsMessage',   '+1 (720) 555-0002', 'pending_approval', now()),
    (uidA, imoA, 'sms',   'draftSmsMessage',   '7205550001',        'pending_approval', now()), -- dup of 0001 by last-10
    (uidA, imoA, 'email', 'draftEmailMessage', 'a@example.com',     'pending_approval', now()),
    (uidA, imoA, 'close_note', 'draftCloseNote', NULL,              'pending_approval', now()); -- excluded from IMO ceiling
  -- Other tenant's sends (parked under a real user FK, imo_id = imoOther):
  INSERT INTO assistant_action_requests (user_id, imo_id, channel, tool_name, recipient, status, executed_at) VALUES
    (uidB, imoOther, 'sms', 'draftSmsMessage', '+1 (303) 555-1111', 'pending_approval', now()),
    (uidB, imoOther, 'sms', 'draftSmsMessage', '+1 (303) 555-2222', 'pending_approval', now()),
    (uidB, imoOther, 'email', 'draftEmailMessage', 'other@example.com', 'pending_approval', now());

  -- Impersonate A (no acting claim => get_my_imo_id() = user_profiles.imo_id = imoA).
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uidA::text, 'role', 'authenticated')::text, true);

  -- (1) distinct sms recipients = 2 (0001 + 0002; the 0001-reformatted dup collapses).
  SELECT * INTO r FROM assistant_send_caps('sms', '+1 720 555 0001');
  IF r.distinct_recipients_24h <> 2 THEN
    RAISE EXCEPTION 'FAIL: distinct sms expected 2, got %', r.distinct_recipients_24h;
  END IF;
  RAISE NOTICE 'PASS: distinct sms = 2 (dup phone collapsed)';

  -- (2) recipient_already flag true for a known recipient (any format).
  IF r.recipient_already_24h IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: recipient_already expected true for an existing recipient';
  END IF;
  -- ...and false for a brand-new number.
  SELECT * INTO r FROM assistant_send_caps('sms', '+1 (999) 999-9999');
  IF r.recipient_already_24h IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: recipient_already expected false for a new recipient';
  END IF;
  RAISE NOTICE 'PASS: recipient_already flag true for known, false for new';

  -- (3) IMO ceiling counts A''s sms+email only (4), EXCLUDING the close_note AND the
  --     other tenant''s 3 rows. If close leaked it would be 5; if imoOther leaked, 7+.
  IF r.imo_sends_24h <> 4 THEN
    RAISE EXCEPTION 'FAIL: imo_sends expected 4 (sms+email, own tenant), got % (close or other-tenant leaked?)', r.imo_sends_24h;
  END IF;
  RAISE NOTICE 'PASS: imo_sends = 4 (close excluded, other tenant isolated)';

  -- (4) email distinct axis is independent (= 1).
  SELECT * INTO r FROM assistant_send_caps('email', 'a@example.com');
  IF r.distinct_recipients_24h <> 1 THEN
    RAISE EXCEPTION 'FAIL: distinct email expected 1, got %', r.distinct_recipients_24h;
  END IF;
  RAISE NOTICE 'PASS: distinct email = 1';

  -- (5) LOAD-BEARING: a STRANGER sees nothing — no per-user count, no IMO count.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uidX::text, 'role', 'authenticated')::text, true);
  SELECT * INTO r FROM assistant_send_caps('sms', '+1 (720) 555-0001');
  IF r.distinct_recipients_24h <> 0 OR r.imo_sends_24h <> 0 OR r.recipient_already_24h IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: stranger saw data (distinct=%, imo=%, already=%) — SECDEF identity not server-derived',
      r.distinct_recipients_24h, r.imo_sends_24h, r.recipient_already_24h;
  END IF;
  RAISE NOTICE 'PASS: stranger sees 0/0/false — identity resolved server-side';

  RAISE NOTICE 'SEND_CAPS_TESTS_PASSED';
END
$$;
ROLLBACK;
SQL

echo "▶ assistant_send_caps tests (SECDEF tenant isolation + normalization + ceiling scope)"
OUTPUT="$(./scripts/migrations/run-sql.sh -f "$TMP_SQL" 2>&1)" || true
echo "$OUTPUT"
if echo "$OUTPUT" | grep -q "SEND_CAPS_TESTS_PASSED"; then
  echo "✅ send-caps: all assertions passed"; exit 0
else
  echo "❌ send-caps: one or more assertions FAILED"; exit 1
fi
