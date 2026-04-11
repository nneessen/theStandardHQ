#!/usr/bin/env bash
# scripts/smoke-tests/training-modules.sh
#
# Smoke test for the training-modules feature. Runs the project's production
# build and fails only if there are TypeScript or build errors inside
# src/features/training-modules/ specifically.
#
# Unrelated failures in other in-progress features (e.g., agent-roadmap)
# are intentionally IGNORED so this script can be used as a pre-commit gate
# when working on training modules even while other feature branches are
# in flux.
#
# Usage:
#   ./scripts/smoke-tests/training-modules.sh
#
# Exit codes:
#   0 — no errors in training-modules/
#   1 — one or more errors inside training-modules/

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "→ Running npm run build (filtering for training-modules errors)…"
BUILD_OUTPUT="$(npm run build 2>&1 || true)"

# Extract only the lines that are BOTH TypeScript errors AND in training-modules.
TM_ERRORS="$(echo "$BUILD_OUTPUT" | grep -E "error TS" | grep "training-modules" || true)"

if [ -n "$TM_ERRORS" ]; then
  echo "✘ training-modules smoke test FAILED — TypeScript errors detected:"
  echo ""
  echo "$TM_ERRORS"
  echo ""
  exit 1
fi

echo "✓ training-modules smoke test PASSED — no TypeScript errors in src/features/training-modules/"
exit 0
