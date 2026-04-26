#!/usr/bin/env bash
# Validates the recruiting pipeline redesign end-to-end.
# - npm run build (catches all type + bundler errors; mirrors Vercel)
# - vitest scoped to recruiting + auth (presentation refactor must not regress behavior)
# Exits non-zero on the first failure with a clear banner.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

banner() {
  printf '\n\033[1;36m── %s ──\033[0m\n' "$1"
}

fail() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}

ok() {
  printf '\033[1;32m✓ %s\033[0m\n' "$1"
}

banner "1/2  npm run build"
if ! npm run build >/tmp/recruiting-build.log 2>&1; then
  tail -40 /tmp/recruiting-build.log >&2
  fail "build failed — see /tmp/recruiting-build.log"
fi
ok "build clean"

banner "2/2  vitest — recruiting + auth"
if ! npx vitest run --reporter=basic src/features/recruiting src/features/auth >/tmp/recruiting-tests.log 2>&1; then
  tail -40 /tmp/recruiting-tests.log >&2
  fail "tests failed — see /tmp/recruiting-tests.log"
fi
ok "all recruiting + auth tests pass"

banner "DONE"
ok "Recruiting pipeline redesign verified."
