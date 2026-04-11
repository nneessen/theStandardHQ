#!/usr/bin/env bash
# Generate src/types/database.types.ts from the LOCAL Supabase instance,
# stripping the progress/update-check noise that the CLI writes to stdout.
#
# Use this instead of `npm run generate:types` when developing locally against
# migrations that haven't been applied to remote yet.
set -euo pipefail

OUT="src/types/database.types.ts"

supabase gen types typescript --local 2>/dev/null \
  | grep -v '^Connecting to db' \
  | grep -v '^A new version of Supabase CLI' \
  | grep -v '^We recommend updating' \
  > "$OUT"

lines=$(wc -l < "$OUT" | tr -d ' ')
echo "✓ $OUT regenerated ($lines lines)"
