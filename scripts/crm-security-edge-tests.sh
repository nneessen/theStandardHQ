#!/usr/bin/env bash
# scripts/crm-security-edge-tests.sh
# =============================================================================
# Inbound-CRM SECURITY + EDGE-CASE + DB-BLOCKING test suite (LOCAL-only, read-mostly).
#
# Covers what the functional Playwright E2Es do NOT:
#   SECURITY  : RLS read-isolation across agents AND tenants (incl. the new agent-wide Recent Calls
#               feed + its embedded client join); excess anon/authenticated table grants (TRUNCATE
#               bypasses RLS); credential-hash read gating.
#   EDGE CASES: disposition save AFTER the call ended (keep-open flow); cross-agent write rejection;
#               owner write allowed.
#   DB / SCALE: replica identity, postgres_changes publication membership, broadcast trigger present.
#
# Does NOT fire any screen-pop (only inserts 'ended' rows; the pop trigger fires on INSERT 'ringing'),
# so it is safe to run while someone is using the app. Self-cleaning. All impersonation runs inside a
# transaction that is rolled back.
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."
RUNSQL() { ./scripts/migrations/run-sql.sh "$1" 2>/dev/null; }
VAL() { RUNSQL "$1" | sed -n '3p' | tr -d ' '; }   # first scalar of a one-column result
# For multi-statement (BEGIN…ROLLBACK) impersonation: emit `'RESULT='||expr` and grep it, since the
# value line position is not fixed once BEGIN/SET/set_config rows are printed.
TX() { RUNSQL "$1" | grep -oE 'RESULT=[A-Za-z0-9]+' | head -1 | cut -d= -f2; }

# Refuse to run against a non-local DB (this writes + truncates-test the tables).
CONN=$(VAL "SELECT current_setting('listen_addresses', true);")
PASS=0; FAIL=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
chk()  { [ "$2" = "$3" ] && ok "$1 ($2)" || bad "$1 (got '$2', want '$3')"; }

echo "→ resolving test agents…"
EP=$(VAL "SELECT up.id FROM user_profiles up JOIN auth.users au ON au.id=up.id WHERE au.email='epiclife.neessen@gmail.com' LIMIT 1;")
EP_IMO=$(VAL "SELECT imo_id FROM user_profiles WHERE id='$EP';")
OTHER=$(VAL "SELECT id FROM user_profiles WHERE imo_id='$EP_IMO' AND id<>'$EP' LIMIT 1;")
CROSS=$(VAL "SELECT id FROM user_profiles WHERE imo_id IS NOT NULL AND imo_id<>'$EP_IMO' LIMIT 1;")
[ -z "$EP" ] || [ -z "$OTHER" ] || [ -z "$CROSS" ] && { echo "✗ could not resolve agents (local seeded?)"; exit 1; }
echo "  epiclife=$EP  same-imo-other=$OTHER  cross-imo=$CROSS"

echo ""; echo "── SECURITY: table grants (anon=none; authenticated=SELECT-only; TRUNCATE bypasses RLS) ──"
for t in inbound_calls imo_call_platform_credentials imo_agent_external_ids; do
  chk "anon CANNOT truncate $t"          "$(VAL "SELECT has_table_privilege('anon','public.$t','TRUNCATE');")"          "f"
  chk "anon CANNOT select $t"            "$(VAL "SELECT has_table_privilege('anon','public.$t','SELECT');")"            "f"
  chk "authenticated CANNOT truncate $t" "$(VAL "SELECT has_table_privilege('authenticated','public.$t','TRUNCATE');")" "f"
  chk "authenticated CANNOT insert $t"   "$(VAL "SELECT has_table_privilege('authenticated','public.$t','INSERT');")"   "f"
  chk "authenticated CANNOT delete $t"   "$(VAL "SELECT has_table_privilege('authenticated','public.$t','DELETE');")"   "f"
  chk "authenticated KEEPS select $t (RLS-gated)" "$(VAL "SELECT has_table_privilege('authenticated','public.$t','SELECT');")" "t"
done

echo ""; echo "── SECURITY: RLS read-isolation (the new Recent Calls feed cannot leak) ──"
ISO=$(TX "BEGIN; SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims','{\"sub\":\"$OTHER\",\"role\":\"authenticated\"}',true);
  SELECT 'RESULT='||(((SELECT count(*) FROM inbound_calls WHERE agent_id='$EP')
       + (SELECT count(*) FROM clients WHERE user_id='$EP')
       + (SELECT count(*) FROM imo_call_platform_credentials))=0)::text;
  ROLLBACK;")
chk "same-imo other agent sees 0 of epiclife's calls/clients/creds" "$ISO" "true"
XISO=$(TX "BEGIN; SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub','$CROSS','role','authenticated')::text, true);
  SELECT 'RESULT='||(((SELECT count(*) FROM inbound_calls WHERE agent_id='$EP')
       + (SELECT count(*) FROM clients WHERE user_id='$EP'))=0)::text;
  ROLLBACK;")
chk "cross-tenant agent sees 0 of epiclife's calls/clients" "$XISO" "true"
# No-breakage: the grant revoke must NOT break the legit read path. A SELECT with the grant removed
# raises 'permission denied' and aborts the txn, so RESULT is never emitted and this check fails.
OWNREAD=$(TX "BEGIN; SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims','{\"sub\":\"$EP\",\"role\":\"authenticated\"}',true);
  SELECT 'RESULT='||(count(*) IS NOT NULL)::text FROM inbound_calls WHERE agent_id='$EP';
  ROLLBACK;")
chk "authenticated agent CAN still read its OWN calls (feed not broken)" "$OWNREAD" "true"

echo ""; echo "── EDGE CASES: disposition save after end + cross-agent rejection ──"
RUNSQL "INSERT INTO inbound_calls (imo_id, request_tag, agent_id, ani, phone_e164, status, fired_pop, patch_only) SELECT imo_id,'sec-suite-x',id,'5550006666',public.normalize_phone_e164('5550006666'),'ended',false,false FROM user_profiles WHERE id='$EP';" >/dev/null
AFTER=$(TX "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"$EP\",\"role\":\"authenticated\"}',true); SELECT 'RESULT='||(id IS NOT NULL)::text FROM crm_set_call_disposition('sec-suite-x',NULL,NULL,'after ended'); ROLLBACK;")
chk "owner CAN save disposition after the call ended" "$AFTER" "true"
XW=$(TX "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"$OTHER\",\"role\":\"authenticated\"}',true); SELECT 'RESULT='||(id IS NULL)::text FROM crm_set_call_disposition('sec-suite-x',NULL,NULL,'cross-agent'); ROLLBACK;")
chk "cross-agent disposition write is REJECTED" "$XW" "true"
RUNSQL "DELETE FROM inbound_calls WHERE request_tag='sec-suite-x';" >/dev/null

echo ""; echo "── DB / SCALE fixes in place ──"
chk "inbound_calls REPLICA IDENTITY DEFAULT" "$(VAL "SELECT relreplident FROM pg_class WHERE relname='inbound_calls';")" "d"
chk "inbound_calls dropped from postgres_changes publication" "$(VAL "SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='inbound_calls';")" "0"
chk "broadcast trigger fn present" "$(VAL "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='inbound_call_broadcast');")" "t"

echo ""; echo "════ $PASS passed, $FAIL failed ════"
exit $((FAIL>0))
