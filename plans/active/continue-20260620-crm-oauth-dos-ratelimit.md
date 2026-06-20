# Continuation — CRM OAuth token DoS rate-limit + inbound-CRM go-live deploy

**Created:** 2026-06-20 · **Feature:** inbound-CRM screen-pop (Standard HQ = system-of-record/CRM for external dialer **NetTrio**)
**Prior memory:** `[[project-inbound-crm-pop-ux-and-grant-hardening-20260620]]`, `[[project-inbound-crm-phase0-build-20260617]]`

---

## TL;DR — pick up here

Build the **fail-closed rate-limit (DoS protection)** on the public `crm-oauth-token` edge function,
then **deploy the external CRM API to go live**. This is the last real blocker before the inbound
dialer can authenticate. The owner's standing rule for anything security-related:

> "If there are any security threats, we must **plan, first test, review, and then ship**. That's the most important."

So: **PLAN → TEST (deno unit) → REVIEW (security-auditor agent) → SHIP (deploy).** Do not skip the review.

---

## Where things stand (verified 2026-06-20)

- **Worktree:** `/Users/nickneessen/projects/ct-sec-oauth` on branch `sec/crm-oauth-dos-ratelimit`
  (created off origin/main; HEAD `9611e44b`). **Clean — DoS work NOT started yet.**
  - ⚠️ The MAIN repo `/Users/nickneessen/projects/commissionTracker` is on a *different* branch
    (`feat/add-policy-dialog-redesign`) — a concurrent session uses it. **Do the OAuth work in the
    worktree, not the main checkout.** Don't `git add -A` in the main repo.
- **Already shipped to PROD + merged to main:**
  - PR #24 (`feat/inbound-crm-phase3`) merged → frontend matches the broadcast realtime backend.
  - Inbound REVOKE migration `20260620062216` (anon/authenticated excess grants on the 3 inbound tables).
  - Tier-1 DB-wide grant hardening `20260620074725` (TRUNCATE/REFERENCES/TRIGGER revoked from anon+authenticated; CRUD preserved; `test_workflows_real` dropped). Documented residual: a `supabase_admin`-owned default ACL on prod is not postgres-alterable (governs only future platform-created tables; all existing tables cleaned).
  - All 7 inbound migrations (phase5/disposition/intake/replica-identity/broadcast-trigger+RLS/publication-drop/late-resolve) — realtime backend fully working on prod (broadcast fn ✓, trigger ✓, `realtime.messages` RLS policy ✓, disposition + intake RPCs callable by authenticated ✓).
- **Prod prerequisites for the rate-limit are already present** (verified): `check_rate_limit` fn + `rate_limits` table + `crm_authenticate_credential` (the bcrypt RPC) all exist on prod. deno 2.7.9 available. **No migration needed — this is code-only.**

---

## TASK 1 — Build the fail-closed DoS rate-limit (the real blocker)

### Why
`crm-oauth-token` (public, `verify_jwt=false` at deploy) calls `crm_authenticate_credential`, a
**bcrypt cost-12** verification *inside shared Postgres*. An unauthenticated attacker flooding this
endpoint pins Postgres CPU → **all-tenant denial of service**. The existing rate-limit helper
**fails OPEN** (returns `allowed:true` on RPC error), which is wrong for an unauthenticated DoS gate —
under load/error it would let the flood through. We need a **fail-closed** gate placed BEFORE the bcrypt.

### Files
- `supabase/functions/_shared/rate-limit.ts` — `checkRateLimit(adminClient, opts)` (fails open today),
  `enforceRateLimit(...)` returns a 429 `Response` or null, `RateLimitOptions {key, maxRequests, windowSeconds, tokens?, maxTokens?}`, `rate_limits` table `{bucket_key, request_count, token_count, window_start}`.
- `supabase/functions/crm-oauth-token/index.ts` — `serve` handler: readCredentials (form/Basic) →
  validate grant_type/client_id/secret → `createSupabaseAdminClient()` (~line 107) →
  `supabase.rpc("crm_authenticate_credential", {p_client_id, p_secret})` (~line 115, THE BCRYPT) →
  `mintCrmToken`. Salesforce-shaped success `{access_token, instance_url, id, token_type, scope, expires_in}`.
  Helpers `JSON_HEADERS`, `oauthError(error, description, status)`. **No rate-limit currently.**
- Pattern reference: `supabase/functions/crm-leads/index.ts` already uses `enforceRateLimit` with a
  sharded key `ratelimit:req:crm-leads:<credential_id>:<shard>` (RATELIMIT_SHARDS=64, windowSeconds 3600).

### Finalized design (decided last session, not yet written)
1. **`_shared/rate-limit.ts`** — add `failClosed?: boolean` to `RateLimitOptions`. In `checkRateLimit`,
   on RPC error: if `failClosed` return `{allowed:false, requestsUsed:0, tokensUsed:BigInt(0), retryAfterSeconds:60}`;
   else keep the current fail-open behavior (backward-compatible — `crm-leads` etc. unaffected).
2. **`crm-oauth-token/index.ts`** — move `createSupabaseAdminClient()` up to right after the method check.
   Extract client IP from `x-forwarded-for` (first IP). Add **TWO fail-closed gates BEFORE** the
   `crm_authenticate_credential` (bcrypt) call:
   - **Per-IP cap** ~10/min, key `ratelimit:oauth-token:ip:<ip>`, windowSeconds 60, `failClosed:true`.
   - **Global sharded cap** ~30/min across ~6 shards, key `ratelimit:oauth-token:global:<shard>`,
     windowSeconds 60, `failClosed:true` — because `x-forwarded-for` is **spoofable**, so the per-IP
     cap alone is bypassable; the global cap is the spoof-proof backstop. (Pick the shard by hashing
     something stable, e.g. the IP, so a single source stays on one shard.)
   - If either trips, return an **OAuth-shaped 429** (`oauthError(...)`) with a `Retry-After` header.
3. **Deno unit test** (e.g. `supabase/functions/crm-oauth-token/index.test.ts` or a `_shared` test) —
   mock `adminClient.rpc` to prove: (a) under-limit passes through to bcrypt; (b) over-limit returns 429
   before bcrypt; (c) **RPC error ⇒ 429 (fail-closed)**, NOT pass-through.

### Discipline
- **TEST:** `cd /Users/nickneessen/projects/ct-sec-oauth && deno test --allow-all supabase/functions/...` — green.
- **REVIEW:** launch a `security-auditor` agent (opus) on the diff — confirm the gate is truly before the
  bcrypt, fail-closed is correct, no bypass via header spoofing, no new info leak in the 429, sharding sound.
  Reconcile any findings before shipping.
- **SHIP:** commit + push the worktree branch; then deploy (Task 2).

---

## TASK 2 — Deploy the external CRM API (go-live)

After the rate-limit is reviewed + merged:

1. **config.toml** — add `verify_jwt = false` blocks for the public M2M functions. **Verified they are
   NOT present yet** (only `[functions.instagram-oauth-callback]` has it, line 293–294). Add:
   ```toml
   [functions.crm-oauth-token]
   verify_jwt = false
   [functions.crm-leads]
   verify_jwt = false
   ```
   (NetTrio is M2M with no Supabase JWT — these must be reachable without one. The rate-limit + the
   token's own HMAC/credential auth are what protect them.)
2. **Deploy edge functions:** `crm-oauth-token`, `crm-leads` (needs Supabase CLI linked/authed — owner
   may need to run an interactive `supabase login`; suggest the `! <command>` prompt prefix).
3. **Set secret:** `CRM_CALL_PLATFORM_SIGNING_KEY` (the HMAC bearer signing key) on prod.
4. **Issue the first dialer credential** for NetTrio (client_id + secret; secret stored bcrypt-hashed via
   the existing credential path — never plaintext).
5. **Smoke the live endpoint:** token mint → `/api/v1/leads` happy path with the real credential;
   confirm the rate-limit 429s on a burst; confirm a real pop fires to a test agent.

---

## Gotchas / lessons (don't relearn these)
- **Don't revert / touch** `src/contexts/InboundCallContext.tsx` in the main checkout — its working-tree
  copy is intentionally an older postgres_changes version locally; **prod/main already have the broadcast
  version** (committed `79be5a51`, merged via PR #24). The deployed behavior is correct.
- The Playwright pop E2Es (`scripts/verify-two-intake-queue.py`, `scripts/verify-call-ended-keeps-open.py`)
  are **fragile** — the shared `inbound:<agent>` realtime topic gets confounded by any concurrent live
  call-firing at that agent. Only run them when nobody else is firing pops. Prefer the DB-level suite.
- **`scripts/crm-security-edge-tests.sh`** is the reliable security suite (26/26 green): impersonation
  (`SET LOCAL ROLE authenticated` + `request.jwt.claims`) RLS isolation + grant exposure + DB-blocking,
  LOCAL-only, fires no pops (inserts only `'ended'` rows). Boolean `::text` is `"true"` not `"t"`; uses a
  `TX()` helper grepping `RESULT=` markers (don't parse with `sed -n` — it grabs the `(1 row)` footer).
- **TRUNCATE bypasses RLS** — that's why the grant hardening matters even with RLS on.
- Migration discipline: **never** `psql` directly. Use `./scripts/migrations/run-migration.sh` /
  `run-sql.sh`. To hit PROD: `set -a; source .env; set +a; DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh <file>` (bare run-sql.sh targets LOCAL).
- Don't regen `database.types.ts` for this work — no schema change (code-only rate-limit + config).

## Still open / lower priority
- **Owner visual sign-off** of the pop UX (still pending — not blocking deploy).
- **DB-wide Tier 2/3 grant hardening** — 202/211 public tables still grant authenticated TRUNCATE
  (defense-in-depth; Tier-1 already removed it; a fuller sweep was recommended, not started).
- **Vault sync** of `docs/inbound-lead-feature/PERFORMANCE_AND_SECURITY_BRIEF.md` +
  `docs/security/db-wide-grant-hardening-audit.md` (the `/ingest` skill — Step 5 lint must exit 0).

## Verify-state commands
```bash
git worktree list
cd /Users/nickneessen/projects/ct-sec-oauth && git status && git log --oneline -3
grep -n "verify_jwt" supabase/config.toml          # only instagram-oauth-callback today
deno --version                                      # 2.7.9 ok
```
