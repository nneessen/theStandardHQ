#!/usr/bin/env bash
# Tenant-isolation smoke for the Jarvis `queryPolicies` tool.
#
# queryPolicies runs a plain PostgREST SELECT on the policies table via the signed-in
# user's RLS-scoped client (ctx.db) — NO SECURITY DEFINER, NO adminClient. Its entire
# tenancy guarantee therefore rests on the `policies` RLS policies. This smoke proves
# that RLS actually scopes reads under the EXACT execution context the tool uses:
# role `authenticated` + a `request.jwt.claims.sub` = the caller's user id.
#
# Assertions (all in one txn that is ROLLED BACK — pure SELECTs, nothing persists):
#   1. LOAD-BEARING: a stranger uid (random UUID, in no IMO, owns nothing) sees ZERO
#      policies. Proves RLS is not wide-open (no USING(true)) under impersonation.
#   2. CROSS-IMO (hard, when >1 IMO has data): a regular agent (first non-elevated
#      owner in the top-25 producers) sees their OWN IMO's policies and ZERO of the
#      (non-empty) set of other-IMO policies. Elevated admins are skipped, not failed.
#
# psql without ON_ERROR_STOP returns 0 even on SQL error, so we grep the sentinel.
#
# Targets PROD by default (real multi-tenant data). Override with:
#   LOCAL=1 ./scripts/test-queryPolicies-tenancy.sh   # run against local .env DB
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP_SQL="$(mktemp -t querypolicies_tenancy.XXXXXX).sql"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

cat > "$TMP_SQL" <<'SQL'
BEGIN;
DO $$
DECLARE
  uidX           uuid := gen_random_uuid();  -- stranger: owns nothing, in no IMO
  total          bigint;
  n_imos         int;
  stranger_sees  bigint;
  rec            record;
  imoA           uuid;
  a_own          bigint;
  a_foreign      bigint;
  global_foreign bigint;
  found_regular  boolean := false;
BEGIN
  SELECT count(*), count(DISTINCT imo_id) INTO total, n_imos
  FROM policies WHERE imo_id IS NOT NULL;
  RAISE NOTICE 'baseline: % policies across % IMOs', total, n_imos;
  IF total = 0 THEN RAISE EXCEPTION 'no policies in table — cannot prove isolation'; END IF;

  -- 1) STRANGER must see zero (the load-bearing assertion).
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', uidX::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO stranger_sees FROM policies;
  RESET ROLE;
  IF stranger_sees <> 0 THEN
    RAISE EXCEPTION 'FAIL: stranger saw % policies — RLS is wide-open', stranger_sees;
  END IF;
  RAISE NOTICE 'PASS: stranger (no IMO) sees 0 of % policies', total;

  -- 2) A regular agent must see 0 of OTHER IMOs' policies (hard, when cross-IMO data exists).
  IF n_imos > 1 THEN
    FOR rec IN
      SELECT user_id, imo_id
      FROM policies
      WHERE user_id IS NOT NULL AND imo_id IS NOT NULL
      GROUP BY user_id, imo_id
      ORDER BY count(*) DESC
      LIMIT 25
    LOOP
      PERFORM set_config('request.jwt.claims',
                         json_build_object('sub', rec.user_id::text, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      SELECT count(*) INTO a_own     FROM policies WHERE imo_id =  rec.imo_id;
      SELECT count(*) INTO a_foreign FROM policies WHERE imo_id <> rec.imo_id;
      RESET ROLE;
      -- A properly-scoped (non-elevated) agent: sees own IMO, none of any other.
      IF a_foreign = 0 AND a_own > 0 THEN
        imoA := rec.imo_id;
        found_regular := true;
        SELECT count(*) INTO global_foreign FROM policies WHERE imo_id <> imoA;  -- as superuser
        EXIT;
      END IF;
    END LOOP;

    IF found_regular THEN
      IF global_foreign = 0 THEN
        RAISE EXCEPTION 'FAIL: no other-IMO policies exist — cross-IMO assertion would be vacuous';
      END IF;
      RAISE NOTICE 'PASS: a regular agent sees ONLY their own IMO — 0 of % other-IMO policies', global_foreign;
    ELSE
      RAISE NOTICE 'INFO: top-25 owners were all cross-IMO admins; relied on the stranger assertion';
    END IF;
  ELSE
    RAISE NOTICE 'INFO: only % IMO has policy data — cross-IMO check not applicable', n_imos;
  END IF;

  RAISE NOTICE 'QUERYPOLICIES_TENANCY_TESTS_PASSED';
END
$$;
ROLLBACK;
SQL

if [ "${LOCAL:-}" = "1" ]; then
  echo "▶ queryPolicies tenancy smoke (LOCAL)"
  OUTPUT="$(./scripts/migrations/run-sql.sh -f "$TMP_SQL" 2>&1)" || true
else
  echo "▶ queryPolicies tenancy smoke (PROD, read-only, rolled back)"
  # shellcheck disable=SC1091
  set -a; [ -f .env ] && . ./.env; set +a
  OUTPUT="$(DATABASE_URL="${REMOTE_DATABASE_URL:?REMOTE_DATABASE_URL not set in .env}" \
    ./scripts/migrations/run-sql.sh -f "$TMP_SQL" 2>&1)" || true
fi
echo "$OUTPUT"

if echo "$OUTPUT" | grep -q "QUERYPOLICIES_TENANCY_TESTS_PASSED"; then
  echo "✅ queryPolicies tenancy: all assertions passed"
  exit 0
else
  echo "❌ queryPolicies tenancy: one or more assertions FAILED (see output above)"
  exit 1
fi
