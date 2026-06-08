#!/bin/bash
# scripts/bench-policy-aggregates.sh
# ============================================================================
# Benchmark PolicyRepository's JS-side aggregation vs an in-DB aggregate.
# READ-ONLY (SELECT / EXPLAIN only) -> safe against prod.
#
#   ./scripts/bench-policy-aggregates.sh          # prod (default)
#   ./scripts/bench-policy-aggregates.sh local    # local supabase
#
# Targets prod via REMOTE_DATABASE_URL and runs everything through the
# sanctioned run-sql.sh wrapper (never psql directly) per CLAUDE.md.
# ============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$SCRIPT_DIR/bench/policy-aggregate-bench.sql"
TARGET="${1:-prod}"

# Only the prod path needs REMOTE_DATABASE_URL from .env; run-sql.sh sources
# .env itself for the local path. Guard the source so a missing .env produces a
# clear message below instead of a bare `set -e` abort here.
if [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
fi

if [ "$TARGET" = "local" ]; then
  echo "Benchmarking LOCAL database..."
  exec "$PROJECT_ROOT/scripts/migrations/run-sql.sh" -f "$SQL_FILE"
else
  if [ -z "$REMOTE_DATABASE_URL" ]; then
    echo "ERROR: REMOTE_DATABASE_URL not set (expected in $PROJECT_ROOT/.env for prod)" >&2
    exit 1
  fi
  echo "Benchmarking PROD database (read-only)..."
  exec env DATABASE_URL="$REMOTE_DATABASE_URL" \
    "$PROJECT_ROOT/scripts/migrations/run-sql.sh" -f "$SQL_FILE"
fi
