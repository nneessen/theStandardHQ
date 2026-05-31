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
# imports). The ONE exception is underwriting-runner.test.ts: it imports the concrete
# UnderwritingRunner, which imports the authoritative edge engine + src/ underwriting
# modules carrying the documented baseline type errors (see scripts/test-underwriting-engine.sh).
# Those resolve at runtime under Supabase's bundler and are baseline-accepted. So we
# type-check the whole suite EXCEPT that one file, then run it with --no-check.
#
# Note: getUnderwritingRecommendation.ts (the TOOL) is now engine-free — it depends on
# the injected UnderwritingRunner — so its test (underwriting-tool.test.ts) is fully
# TYPE-CHECKED with everything else; only the engine-coupled runner seam is --no-check.
#
# Usage: ./scripts/test-assistant-edge.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

UW_RUNNER_TEST="supabase/functions/assistant-orchestrator/tools/__tests__/underwriting-runner.test.ts"

echo "▶ deno test — assistant-orchestrator safety suite (type-checked, excl. engine-coupled runner seam test)"
deno test --ignore="$UW_RUNNER_TEST" supabase/functions/assistant-orchestrator/

echo ""
echo "▶ deno test --no-check — underwriting runner seam test (engine-coupled; baseline engine type errors)"
deno test --no-check "$UW_RUNNER_TEST"
