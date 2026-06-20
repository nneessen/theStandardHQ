#!/usr/bin/env bash
# crm-oauth-token DoS rate-limit tests (Deno).
#
# Proves the fail-closed rate-limit gates that protect the public OAuth token endpoint's
# bcrypt RPC from an unauthenticated flood (all-tenant Postgres-CPU DoS):
#
#   _shared/rate-limit.test.ts   — the failClosed contract on checkRateLimit:
#       failClosed:true  ⇒ a limiter fault (RPC resolves-with-error OR rejects/throws) blocks
#       failClosed unset ⇒ same faults fail OPEN (backward-compat for crm-leads + AI fns)
#     Dependency-free, so it runs TYPE-CHECKED.
#
#   crm-oauth-token/handler.test.ts — the handler wiring:
#       under-limit passes through to the bcrypt RPC; over-limit / fault ⇒ 429 BEFORE bcrypt
#       (proven by observing the credential RPC is never reached); malformed ⇒ cheap 400
#       without spending budget; non-POST ⇒ 405 before any client is built.
#     Imports supabase-client.ts → @supabase/supabase-js (esm.sh), which pulls an
#     @types/node type-reference Deno can't resolve offline — so, like the repo's other
#     supabase-js-coupled suites, it runs with --no-check (logic is what we assert).
#
# Usage: ./scripts/smoke/test-crm-oauth-ratelimit.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel)"
cd "$ROOT"

echo "▶ deno test — _shared/rate-limit failClosed contract (type-checked)"
deno test --allow-all supabase/functions/_shared/rate-limit.test.ts

echo ""
echo "▶ deno test --no-check — crm-oauth-token handler gates (supabase-js-coupled)"
deno test --no-check --allow-all supabase/functions/crm-oauth-token/handler.test.ts

echo ""
echo "✅ crm-oauth-token rate-limit suite green"
