#!/usr/bin/env bash
# Assistant edge-function safety tests (Deno).
#
# Covers the canonical, server-enforced rules for the Jarvis command center:
#   - permission guard (denies unknown / unimplemented / unapproved / unpermitted tools)
#   - action-request lifecycle state machine (only approved+unexpired can execute)
#   - redaction of tool I/O before logging
#   - agent routing
#   - tool behavior: read tools never write; draft tools create pending approvals;
#     the daily briefing marks sections unavailable instead of fabricating data
#
# These run offline (core/ + tools/ have no esm.sh imports). Usage:
#   ./scripts/test-assistant-edge.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "▶ deno test — assistant-orchestrator safety suite"
deno test supabase/functions/assistant-orchestrator/
