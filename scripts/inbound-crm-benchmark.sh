#!/usr/bin/env bash
# scripts/inbound-crm-benchmark.sh
# ============================================================================
# Load-benchmark the inbound-CRM DATABASE hot path against LOCAL Supabase Postgres,
# to model behavior under the "~1,000 simultaneous inbound calls" scenario.
#
# It drives, with pgbench (concurrent connections), the three service-role RPCs that
# fire on every inbound call, plus the per-pop intake read:
#   1. crm_lookup_aor    — GET  /api/v1/leads  (pre-call AoR lookup; READ)
#   2. crm_upsert_call    — POST /api/v1/leads  (on-answer; the INSERT that drives the
#                           realtime screen-pop; WRITE)
#   3. intake_read        — the client+policies+intake fetch the agent screen runs on pop (READ)
#
# It reports TPS + average latency per workload at a given concurrency. From TPS you can
# extrapolate the 1,000-call burst: drain_time ≈ 1000 / sustained_TPS.
#
# NOT covered here: Realtime websocket FAN-OUT (delivering the pop to 1,000 browsers) — that is
# a Realtime-server concern, not Postgres, and needs a separate WS load test (k6/artillery vs the
# Realtime endpoint). See the inbound-CRM scale review. pgbench measures the DB layer only.
#
# Usage:
#   scripts/inbound-crm-benchmark.sh [-c CONC] [-T SECONDS] [-n SEED_CLIENTS] [--clean]
# Defaults: -c 50 -T 15 -n 2000   (50 ≈ a realistic PgBouncer transaction-pool ceiling)
#   --clean   remove benchmark fixtures (bench inbound_calls rows + BENCH_CLIENT clients) and exit
#
# SAFETY: refuses to run against anything that is not 127.0.0.1/localhost. LOCAL ONLY — it writes
# thousands of inbound_calls rows. Seed/cleanup go through run-sql.sh; pgbench connects directly
# for load generation only (it calls RPCs / SELECTs — no DDL, no function changes).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

CONC=50; DUR=15; NSEED=2000; CLEAN=0
while [ $# -gt 0 ]; do
  case "$1" in
    -c) CONC="$2"; shift 2;;
    -T) DUR="$2"; shift 2;;
    -n) NSEED="$2"; shift 2;;
    --clean) CLEAN=1; shift;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done

# Resolve the LOCAL connection string (same source as run-sql.sh).
set -a; [ -f .env ] && . ./.env; set +a
CONN="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
if ! echo "$CONN" | grep -qE '(127\.0\.0\.1|localhost)'; then
  echo "✗ REFUSING: benchmark is LOCAL-ONLY but DATABASE_URL is not local: ${CONN%%@*}@…"
  exit 1
fi

RUNSQL() { ./scripts/migrations/run-sql.sh "$1" 2>/dev/null | tail -n +1; }

if [ "$CLEAN" = "1" ]; then
  echo "→ cleaning benchmark fixtures…"
  RUNSQL "DELETE FROM inbound_calls WHERE request_tag LIKE 'bench-%';" | tail -1
  RUNSQL "DELETE FROM clients WHERE name = 'BENCH_CLIENT';" | tail -1
  echo "✓ cleaned"
  exit 0
fi

echo "→ resolving Epic Life imo + a benchmark agent…"
IMO=$(RUNSQL "SELECT id FROM imos WHERE name='Epic Life' LIMIT 1;" | sed -n '3p' | tr -d ' ')
AGENT=$(RUNSQL "SELECT up.id FROM user_profiles up JOIN auth.users au ON au.id=up.id WHERE au.email='epiclife.neessen@gmail.com' AND up.imo_id IS NOT NULL LIMIT 1;" | sed -n '3p' | tr -d ' ')
if [ -z "$IMO" ] || [ -z "$AGENT" ]; then echo "✗ could not resolve imo/agent (is local Supabase up + seeded?)"; exit 1; fi
PC="bench-pc-$(echo "$AGENT" | tr -d '-' | cut -c1-8)"
echo "   imo=$IMO agent=$AGENT pc=$PC"

echo "→ seeding $NSEED benchmark clients (idempotent) + the agent pc mapping…"
RUNSQL "INSERT INTO imo_agent_external_ids (imo_id, user_id, pc_id) VALUES ('$IMO','$AGENT','$PC')
        ON CONFLICT (imo_id, user_id) DO UPDATE SET pc_id=EXCLUDED.pc_id;" >/dev/null
RUNSQL "INSERT INTO clients (user_id, name, phone, state, status)
        SELECT '$AGENT', 'BENCH_CLIENT', '555'||lpad(g::text,7,'0'), 'CA', 'active'
        FROM generate_series(1,$NSEED) g
        WHERE NOT EXISTS (SELECT 1 FROM clients c WHERE c.user_id='$AGENT'
                          AND c.phone_e164 = public.normalize_phone_e164('555'||lpad(g::text,7,'0')));" >/dev/null
echo "   seeded."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/lookup.sql" <<SQL
\set n random(1, $NSEED)
SELECT crm_lookup_aor('$IMO'::uuid, '555' || lpad((:n)::text, 7, '0'));
SQL

cat > "$TMP/upsert.sql" <<SQL
\set n random(1, $NSEED)
SELECT crm_upsert_call('$IMO'::uuid,
  'bench-' || :client_id || '-' || :n || '-' || (extract(epoch from clock_timestamp())*1000)::bigint,
  '$PC', '555' || lpad((:n)::text, 7, '0'), 'CA');
SQL

cat > "$TMP/read.sql" <<SQL
\set n random(1, $NSEED)
SELECT c.id, c.name, c.intake,
       (SELECT json_agg(json_build_object('id',p.id,'product',p.product,'carrier',cr.name))
          FROM policies p LEFT JOIN carriers cr ON cr.id=p.carrier_id
         WHERE p.client_id = c.id) AS policies
  FROM clients c
 WHERE c.user_id = '$AGENT'::uuid
   AND c.phone_e164 = public.normalize_phone_e164('555' || lpad((:n)::text, 7, '0'));
SQL

THREADS=$(( CONC < 8 ? CONC : 8 ))
run() {
  local name="$1" file="$2"
  echo ""
  echo "━━━ $name  (c=$CONC, j=$THREADS, T=${DUR}s) ━━━"
  pgbench "$CONN" -n -c "$CONC" -j "$THREADS" -T "$DUR" -f "$file" 2>&1 \
    | grep -E "tps|latency average|number of transactions actually processed|initial connection" || true
}

echo ""
echo "############ INBOUND-CRM DB BENCHMARK ############"
echo "Each call to the platform = 1 lookup (GET) + 1 upsert (POST, fires the pop) + the agent's intake read."
run "1) crm_lookup_aor   (pre-call AoR lookup — READ)"   "$TMP/lookup.sql"
run "2) crm_upsert_call  (on-answer insert — WRITE, drives realtime pop)" "$TMP/upsert.sql"
run "3) intake_read      (client+policies+intake on pop — READ)" "$TMP/read.sql"

echo ""
echo "Interpretation: a 1,000-call burst drains in ≈ 1000 / (sustained upsert TPS) seconds at this"
echo "concurrency. Raise -c toward your PgBouncer pool size to find the saturation point; if TPS"
echo "plateaus while latency climbs, you've hit the pool/CPU ceiling. Realtime fan-out is separate."
echo "Cleanup fixtures when done:  scripts/inbound-crm-benchmark.sh --clean"
