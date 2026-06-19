#!/usr/bin/env bash
# scripts/bench-ratelimit-shard.sh
# ============================================================================
# PROVES inbound-CRM scale fix #1: the GET rate-limit key shard breaks the single-row lock convoy.
#
# The crm-leads GET lookup calls `enforceRateLimit` -> `public.check_rate_limit(p_key, …)`, which does
# `INSERT INTO rate_limits (bucket_key, …) ON CONFLICT (bucket_key, window_start) DO UPDATE count+1`.
# With ONE credential per agency the key was constant, so all ~1000 concurrent AoR lookups serialized
# on ONE row's lock. The fix shards the key (`…:${shard}`, 64 shards), spreading the writes across rows.
#
# This benchmarks the EXACT RPC under concurrency, OLD (constant key) vs NEW (sharded key), and reports
# the throughput delta. A large sharded/unsharded TPS ratio = the convoy is broken.
#
# Usage: scripts/bench-ratelimit-shard.sh [-c CONC] [-T SECONDS] [-s SHARDS]
# Defaults: -c 32 -T 8 -s 64   (cap is set to "disabled" so we measure pure lock contention, no 429s)
# LOCAL-ONLY (hard guard). Cleans its own rate_limits rows.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

CONC=32; DUR=8; SHARDS=64
while [ $# -gt 0 ]; do
  case "$1" in
    -c) CONC="$2"; shift 2;; -T) DUR="$2"; shift 2;; -s) SHARDS="$2"; shift 2;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done

set -a; [ -f .env ] && . ./.env; set +a
CONN="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
echo "$CONN" | grep -qE '(127\.0\.0\.1|localhost)' || { echo "✗ LOCAL-ONLY; DATABASE_URL is not local"; exit 1; }

CAP=2000000000          # "disabled" — never 429s, so we measure lock contention only
KEY="ratelimit:req:crm-leads:BENCHCRED"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
THREADS=$(( CONC < 8 ? CONC : 8 ))

# OLD: constant bucket key -> every txn contends on ONE rate_limits row.
cat > "$TMP/unsharded.sql" <<SQL
SELECT public.check_rate_limit('${KEY}', ${CAP}, 3600);
SQL
# NEW: sharded bucket key -> txns spread across ${SHARDS} rows.
cat > "$TMP/sharded.sql" <<SQL
SELECT public.check_rate_limit('${KEY}:' || (floor(random()*${SHARDS}))::int::text, ${CAP}, 3600);
SQL

tps_of() { pgbench "$CONN" -n -c "$CONC" -j "$THREADS" -T "$DUR" -f "$1" 2>/dev/null \
  | grep -E "^tps" | grep -oE "[0-9]+\.[0-9]+" | head -1; }

echo "############ RATE-LIMIT SHARD PROOF (c=$CONC, T=${DUR}s, shards=$SHARDS) ############"
echo "→ OLD (constant key — the convoy)…"
OLD=$(tps_of "$TMP/unsharded.sql")
echo "   unsharded TPS = $OLD"
echo "→ NEW (sharded key — the fix)…"
NEW=$(tps_of "$TMP/sharded.sql")
echo "   sharded   TPS = $NEW"

./scripts/migrations/run-sql.sh "DELETE FROM public.rate_limits WHERE bucket_key LIKE '${KEY}%';" >/dev/null 2>&1 || true

RATIO=$(awk -v n="$NEW" -v o="$OLD" 'BEGIN{ if(o>0) printf "%.1f", n/o; else print "inf" }')
echo ""
echo "════════════════════════════════════════════════════════"
echo " unsharded (old, single-row convoy): ${OLD} tps"
echo " sharded   (new, ${SHARDS}-row spread):    ${NEW} tps"
echo " speedup: ${RATIO}×"
PASS=$(awk -v r="$RATIO" 'BEGIN{ print (r+0 >= 2.0) ? "PASS" : "INCONCLUSIVE" }')
echo " VERDICT: ${PASS}  (>=2× throughput = convoy broken)"
echo "════════════════════════════════════════════════════════"
[ "$PASS" = "PASS" ]
