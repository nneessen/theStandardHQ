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
# Most of the suite runs offline AND type-checked (core/ + tools/ have no esm.sh
# imports). The one exception is the underwriting tool test: getUnderwritingRecommendation
# imports the authoritative edge engine, which transitively pulls in src/ underwriting
# modules carrying 5 PRE-EXISTING type errors (see scripts/test-underwriting-engine.sh —
# loose payload/repositories typing + a ScoreComponents re-export quirk). Those resolve
# at runtime under Supabase's bundler and are baseline-accepted. So we type-check the
# whole suite EXCEPT that file, then run it with --no-check (mirroring the engine gate).
# This keeps the guard/state-machine safety coverage fully type-checked.
#
# Usage: ./scripts/test-assistant-edge.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

UW_TOOL_TEST="supabase/functions/assistant-orchestrator/tools/__tests__/underwriting-tool.test.ts"

echo "▶ deno test — assistant-orchestrator safety suite (type-checked, excl. engine-coupled UW tool test)"
deno test --ignore="$UW_TOOL_TEST" supabase/functions/assistant-orchestrator/

echo ""
echo "▶ deno test --no-check — underwriting tool test (engine-coupled; baseline 5 engine type errors)"
deno test --no-check "$UW_TOOL_TEST"
