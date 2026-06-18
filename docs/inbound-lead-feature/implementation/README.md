# Inbound-Call CRM Integration — Implementation

Engineering/build documentation for the inbound-call lead-capture feature. (Owner-facing
material — the requirements and our vendor response — lives one level up in
`docs/inbound-lead-feature/`.)

Our app is the **CRM / system of record**. An external **dialer platform** originates every
call; we receive, authenticate, store, and react (agent screen-pop + billing). The contract is
a Salesforce-style **OAuth2 client-credentials** token exchange followed by three REST
touchpoints on `/api/v1/leads` (GET = Agent-of-Record lookup, POST = find/create lead +
screen-pop, PATCH = billable).

- **Tenancy:** operationally single-tenant (**Epic Life**), but built multi-tenant by `imo_id`.
- **Plans:** `plans/active/MASTER-implementation-plan-20260617.md` (sequencing) and
  `~/.claude/plans/we-already-have-a-serialized-lark.md` (build-ready Plan A).
- **Branch:** `feat/inbound-crm` (off `main`). Verified on a **local** Supabase; **not** applied
  to prod and not yet deployed.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| **0** | Schema, phone normalizer, data RPCs (`crm_lookup_aor`/`crm_upsert_call`/`crm_patch_billable`), RLS, realtime | ✅ Built + verified (local) |
| **1** | OAuth token issuer: credential store + RPCs, token signer/verifier, `crm-oauth-token` edge fn | ✅ Built + verified (local) — see [phase-1-oauth-token-issuer.md](./phase-1-oauth-token-issuer.md) |
| 2 | Data endpoints — one `crm-leads` edge fn (GET/POST/PATCH) that verifies the bearer and calls the Phase 0 RPCs; `vercel.json` rewrites | ⬜ Not started |
| 3 | Realtime agent screen-pop (`InboundCallProvider` + dialog) | ⬜ Not started |
| 4 | Clients page (own-book per agent) + per-client inbound-call history | ⬜ Not started |
| 5 | Paths, observability, PII/retention, hardening | ⬜ Not started |
| 1b | Credential + pcId **admin UI** (super-admin: issue/rotate/revoke, register pcIds) | ⬜ Backend RPCs ready; UI not built |

## Onboarding decisions (confirmed with owner, 2026-06-17)

- **pcId** is issued by the **dialer platform**, which also does the call round-robin. We only
  **register/resolve** their pcId against our agent — we do not mint `agent-<seq>` ids.
- **Token model:** **we issue** the bearer via the OAuth handshake; the dialer caches and passes it.
- **GET timeout budget:** ~10s buffer (trivially met by the indexed lookup).
- **Volume:** ~100 calls/hour now, growing — `postgres_changes` realtime is sufficient for v1.
- **Call-end signal:** the billing **PATCH** is the end-of-call event (dismisses the pop).
- **Billing:** the closing PATCH is authoritative for `billable` (POST value is provisional).
- **Clients page:** each agent sees their **own** book/intake.
- Still to confirm at onboarding: exact `CRM_INSTANCE_URL` base, whether ANI rides in the query
  string vs a header (Vercel PII-logging nuance).

## Operational notes & known by-design caveats

Surfaced by an xhigh code review; kept by design but worth knowing:

- **Normalizer changes require a recompute.** `clients.phone_e164` is a STORED generated column;
  it is NOT recomputed when `normalize_phone_e164` is later replaced. After ANY change to the
  normalizer, run `UPDATE public.clients SET phone = phone;` (a full rewrite) or existing callers'
  AoR lookups silently miss. (Commented in the Phase-0 schema migration.)
- **The generated-column add rewrites `clients`** under `ACCESS EXCLUSIVE` once at apply time —
  negligible at Epic Life scale; schedule a quiet window if ever applied to a large table.
- **Token revocation lags up to 24h.** Bearers are stateless (no DB hit on the hot path), so a
  revoked credential's already-minted tokens stay valid until they expire. If instant revocation is
  ever required, shorten the TTL or add a credential-version claim checked on the data path.
- **Scopes are non-authoritative.** They are carried/echoed but not enforced (only `crm:leads`
  exists and only super-admins issue). Add enforcement before relying on a restricted scope.
- **Duplicate-client edge cases are absorbed, not prevented.** A concurrent first-call race, or a
  caller already on file under a non-normalizable phone, can create a second client row. A unique
  index is deliberately NOT used (households legitimately share a number under one agent); every
  consumer dedups via `ORDER BY … LIMIT 1`.
- **`database.types.ts` regen is deferred to prod-apply.** The new tables/RPCs are local-only until
  the migrations are applied to prod, so a prod-targeted regen now wouldn't include them and nothing
  consumes them yet. Regenerate + commit as part of the prod-apply step.
- **`inbound_calls` RLS is own-book only** (matches the confirmed agent-sees-own-book scope). An
  admin/oversight read (e.g. unassigned calls) would need an added OR-branch in Phase 4.
