#!/usr/bin/env bash
# Orchestrates the instagram-oauth-init Epic Life 403 fix smoke:
#   1. serves the function locally with a dummy INSTAGRAM_APP_ID + SLACK_SIGNING_SECRET
#      (the function builds an authorize URL string; it never calls Meta, and
#       SLACK_SIGNING_SECRET only signs the OAuth state AFTER the access check)
#   2. waits for the edge runtime to come up
#   3. runs scripts/smoke-instagram-oauth-init.py
#   4. always tears the server down
#
# Prereq: local supabase running (`supabase status`).
# Usage:  bash scripts/run-smoke-instagram-oauth-init.sh
set -uo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="$(mktemp -t ig-oauth-smoke.XXXXXX.env)"
cat >"$ENV_FILE" <<'EOF'
INSTAGRAM_APP_ID=dummy-smoke-app-id
SLACK_SIGNING_SECRET=dummy-smoke-signing-secret
APP_URL=http://localhost:3000
EOF

cleanup() {
  [[ -n "${SERVE_PID:-}" ]] && kill "$SERVE_PID" 2>/dev/null
  rm -f "$ENV_FILE"
}
trap cleanup EXIT

echo "• serving instagram-oauth-init (logs -> /tmp/ig-oauth-serve.log)…"
supabase functions serve instagram-oauth-init \
  --env-file "$ENV_FILE" >/tmp/ig-oauth-serve.log 2>&1 &
SERVE_PID=$!

# Wait until the edge runtime answers (any HTTP status means it's up).
ENDPOINT="http://127.0.0.1:54321/functions/v1/instagram-oauth-init"
for i in $(seq 1 40); do
  if curl -s -o /dev/null -m 2 -X POST "$ENDPOINT" -d '{}' 2>/dev/null; then
    code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' -X POST "$ENDPOINT" -d '{}')
    [[ "$code" != "000" ]] && { echo "  ✓ edge runtime up (probe HTTP $code)"; break; }
  fi
  if ! kill -0 "$SERVE_PID" 2>/dev/null; then
    echo "FAIL: functions serve exited early — log:"; cat /tmp/ig-oauth-serve.log
    exit 1
  fi
  sleep 1
done

echo "• running smoke…"
python3 scripts/smoke-instagram-oauth-init.py
exit $?
