#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" guard — only the production branch (main) builds
# and deploys. Every other branch (feature/PR previews) is skipped, so pushing a
# feature branch no longer spins up a Vercel deployment.
#
# WIRE IT UP (one-time, in the Vercel dashboard):
#   Project "commission-tracker" → Settings → Git → Ignored Build Step
#     → "Run my own command":   bash scripts/vercel-ignore-build.sh
#   Also confirm  Settings → Git → Production Branch = main.
#
# Vercel semantics for this command:
#   exit 1  → BUILD proceeds (deploy happens)
#   exit 0  → BUILD is SKIPPED (no deploy)
# VERCEL_GIT_COMMIT_REF is the branch Vercel is evaluating.

set -euo pipefail

REF="${VERCEL_GIT_COMMIT_REF:-unknown}"

if [ "$REF" = "main" ]; then
  echo "✅ '$REF' is the production branch → building"
  exit 1
fi

echo "⏭️  '$REF' is not main → skipping build (no preview deploy)"
exit 0
