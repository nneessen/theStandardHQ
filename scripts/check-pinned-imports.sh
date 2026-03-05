#!/usr/bin/env bash
# check-pinned-imports.sh — Prevents unpinned esm.sh imports in Supabase edge functions.
# Catches patterns like stripe@17, @supabase/supabase-js@2 (no patch version).
# Run in CI or as a pre-commit check.
#
# EXIT 0 = all imports pinned, EXIT 1 = unpinned imports found.

set -euo pipefail

EDGE_DIR="supabase/functions"
ERRORS=0

if [ ! -d "$EDGE_DIR" ]; then
  echo "No edge functions directory found at $EDGE_DIR — skipping."
  exit 0
fi

echo "Checking esm.sh imports in $EDGE_DIR for unpinned versions..."

# Match esm.sh imports where the version is just a major (e.g. @17) or major.minor (e.g. @2.47)
# but NOT major.minor.patch (e.g. @17.7.0 or @2.47.10)
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  content=$(echo "$line" | cut -d: -f3-)
  echo "  UNPINNED: $file:$lineno →$content"
  ERRORS=$((ERRORS + 1))
done < <(grep -rnE 'esm\.sh/[^"]+@[0-9]+(\.[0-9]+)?[?"&]' "$EDGE_DIR" --include='*.ts' | grep -vE '@[0-9]+\.[0-9]+\.[0-9]+' || true)

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "ERROR: Found $ERRORS unpinned esm.sh import(s)."
  echo "All esm.sh imports MUST use exact versions (e.g. stripe@17.7.0, not stripe@17)."
  echo "Unpinned imports resolve to latest at deploy time, causing silent regressions."
  exit 1
fi

echo "All esm.sh imports are pinned to exact versions."
exit 0
