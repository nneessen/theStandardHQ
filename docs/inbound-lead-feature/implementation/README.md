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
