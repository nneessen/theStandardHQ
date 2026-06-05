#!/usr/bin/env bash
# Run the local Vite dev server pointed at the PROD Supabase backend, so realtime VOICE works
# end-to-end against the deployed Fly worker (localhost:3000 is in the edge-function CORS
# allow-list; the prod token endpoint has the LiveKit secrets; the prod orchestrator verifies
# your prod login). Nothing is shipped to prod — this is purely your local frontend talking to
# the live backend. The anon key is read from the worker env at runtime; nothing secret is
# hardcoded here. Delete-free: run normal `npm run dev` for the usual local-Supabase mode.
#
# Usage:  bash scripts/dev-voice-prod.sh
# Then:   open http://localhost:3000 and sign in with your PROD email/password.
set -euo pipefail
cd "$(dirname "$0")/.."

ANON="$(grep -E '^SUPABASE_ANON_KEY=' services/jarvis-voice-worker/.env.local \
  | sed 's/^SUPABASE_ANON_KEY=//' | tr -d "\"'")"
if [ -z "$ANON" ]; then
  echo "✗ Could not read SUPABASE_ANON_KEY from services/jarvis-voice-worker/.env.local" >&2
  exit 1
fi

# Free port 3000 (must be 3000 — it's the CORS-allowed origin; a fallback port would be blocked).
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

export VITE_USE_LOCAL=false
export VITE_ALLOW_REMOTE_SUPABASE_DEV=true
export VITE_SUPABASE_URL="https://pcyaqwodnyrpkaiojnpz.supabase.co"
export VITE_SUPABASE_ANON_KEY="$ANON"

echo "▶ dev server → PROD backend. Open http://localhost:3000 and sign in with your PROD login."
echo "  (Ctrl-C to stop. Realtime voice will reach the deployed Fly worker.)"
# Run vite DIRECTLY (not via scripts/dev.mjs, which would re-inject the local Supabase URL).
exec npm run dev:web
