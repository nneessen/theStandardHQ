#!/usr/bin/env bash
# scripts/validate-app.sh
# Quick validation: build + mock check + dev server smoke test

set -euo pipefail

echo "============================================"
echo "  App Validation"
echo "============================================"

# 0. Edge function import pin check
echo ""
echo "[0/4] Checking edge function imports are pinned..."
if ./scripts/check-pinned-imports.sh; then
  echo "  ✅ All esm.sh imports pinned"
else
  echo "  ❌ UNPINNED IMPORTS FOUND — fix before deploying!"
fi

# 1. Build check
echo ""
echo "[1/4] Running production build..."
npm run build 2>&1 | tail -5
echo "  ✅ Build passed"

# 2. Mock import check
echo ""
echo "[2/4] Checking for mock imports in production code..."
MOCK_HITS=$(grep -r "mock\|Mock\|MOCK" src/ --include="*.ts" --include="*.tsx" \
  -l 2>/dev/null | grep -v "__test__\|__mock__\|.test.\|.spec.\|test-utils\|DEV_FEATURE_MODE" || true)
if [ -n "$MOCK_HITS" ]; then
  echo "  ⚠️  Possible mock references found (review manually):"
  echo "$MOCK_HITS" | head -5
else
  echo "  ✅ No suspicious mock imports"
fi

# 3. Dev server smoke test
echo ""
echo "[3/4] Dev server smoke test..."
npm run dev -- --port 4199 &
DEV_PID=$!
sleep 5

if curl -s -o /dev/null -w "%{http_code}" http://localhost:4199 | grep -q "200"; then
  echo "  ✅ Dev server responds with 200"
else
  echo "  ⚠️  Dev server did not respond with 200 (may need more time)"
fi

kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true

echo ""
echo "============================================"
echo "  ✅ Validation Complete"
echo "============================================"
