#!/usr/bin/env bash
# Smoke check for the YouTube→Reels feature (Social Studio).
# FREE: no Vizard calls. Proves the app type-checks and the ReelsPanel mounts without
# runtime/loading errors. The PAID live-contract check is scripts/validate-vizard-contract.mjs
# (run by hand, costs Vizard credits) — keep it OUT of any automated/CI loop.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "[reels-smoke] TypeScript: tsc --noEmit …"
npx tsc --noEmit

echo "[reels-smoke] Render: ReelsPanel mounts …"
npx vitest run src/features/social-studio/__tests__/reelsPanel.smoke.test.tsx

echo "[reels-smoke] ✓ passed"
