#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="$ROOT_DIR/scripts/find-close-user-by-api-key.mjs"
SEARCH_TEXT="Tucker Kino"

if [[ -p /dev/stdin ]]; then
  node "$SCRIPT_PATH" --stdin --match "$SEARCH_TEXT" --show-key
  exit 0
fi

if command -v pbpaste >/dev/null 2>&1; then
  pbpaste | node "$SCRIPT_PATH" --stdin --match "$SEARCH_TEXT" --show-key
  exit 0
fi

echo "No stdin detected and pbpaste is not available." >&2
echo "Pipe the JSON into this script instead." >&2
exit 1
