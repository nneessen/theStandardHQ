#!/usr/bin/env bash
# Phase 0 gate for the authoritative edge underwriting engine.
#
#   1. `deno test` (HARD GATE) — the "make the engine honest" abstain unit tests.
#   2. `deno check` (INFORMATIONAL) — the edge engine has 5 PRE-EXISTING type
#      errors (loose typing in payload.ts/repositories.ts + the local-vs-imported
#      CoverageRequest mismatch + a ScoreComponents re-export quirk). These exist
#      at HEAD, are unrelated to Phase 0, and Supabase's Deno deployment resolves
#      them at runtime. We surface the count but do NOT fail on it; the Phase 0
#      contract is "introduce no NEW type errors", verified by the count staying
#      at the baseline of 5.
#
# engine.ts uses .ts extensions + npm: specifiers, so it is NOT covered by the
# frontend `npm run build` / tsc compile — this is its only type gate.
#
# Usage: ./scripts/test-underwriting-engine.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENGINE="supabase/functions/_shared/underwriting/engine.ts"
TESTS="supabase/functions/_shared/underwriting/__tests__/"
BASELINE_ERRORS=5

echo "▶ deno test — underwriting engine honesty suite (HARD GATE)"
deno test --no-check "$TESTS"

echo ""
echo "▶ deno check — $ENGINE (informational; baseline = ${BASELINE_ERRORS} pre-existing errors)"
CHECK_OUT="$(deno check --node-modules-dir=auto "$ENGINE" 2>&1 || true)"
FOUND="$(printf '%s\n' "$CHECK_OUT" | grep -oE 'Found [0-9]+ error' | grep -oE '[0-9]+' || echo 0)"
echo "   deno check reports: ${FOUND} error(s)"
if [ "${FOUND}" -gt "${BASELINE_ERRORS}" ]; then
  echo "✗ REGRESSION: ${FOUND} > baseline ${BASELINE_ERRORS} — Phase 0 introduced a new type error"
  printf '%s\n' "$CHECK_OUT"
  exit 1
fi

echo "✓ underwriting engine gate passed (no new type errors; abstain tests green)"
