# Phase 2 — Inbound-Call Data Endpoints (`crm-leads`)

**Status:** Built + verified on a local Supabase. **Not** applied to prod, **not** deployed. **Date:** 2026-06-18.

The three per-call touchpoints the dialer platform actually calls during a live call, behind **one**
edge function that switches on HTTP method, verifies the OAuth bearer, and calls the Phase 0 RPCs.
This is "the server correctly receives and reacts to calls." It writes the row Phase 3 will turn into
a screen-pop, but builds **no UI** here.

---

## 1. What was built

| Component | Path | Role |
|---|---|---|
| Data API | `supabase/functions/crm-leads/index.ts` | GET/POST/PATCH handler (method switch) |
| Config | `supabase/functions/crm-leads/config.toml` | `verify_jwt = false` (own bearer auth) |
| Routing | `vercel.json` | rewrites for `/oauth/token` + `/api/v1/leads` (before the SPA catch-all) |
| E2E | `scripts/crm-mock-caller.ts` | extended to drive the full token→GET→POST→PATCH lifecycle |

It calls the already-merged Phase 0 RPCs and reuses the Phase 1 token decoder, the shared admin
client, the phone normalizer, and the rate-limiter — **no new database objects**.

---

## 2. The three branches (request → behavior)

Common to all: `Authorization: Bearer <token>` → `verifyCrmToken` (`401` if invalid/expired). **The
tenant (`imo_id`) is taken from the verified token, never the request body.** A per-credential
rate-limit is applied (secondary, fails open). The token is never logged.

| Method | Input | RPC | Responses |
|---|---|---|---|
| **GET** | `?ani=…` | `crm_lookup_aor` | `200 {"pcId": …}` (on file) · `204` (not on file) · `400` (un-normalizable ANI) |
| **POST** | JSON `requestTag, pcId, ani, state, recordType, offerId, callProgram, subId, callStart, duration, billable` | `crm_upsert_call` | `200 {ok, id}` always · `400` only if `requestTag` is missing |
| **PATCH** | JSON `requestTag, billable, duration, ani?` | `crm_patch_billable` | `200 {ok, id, queued}` always · `400` only if `requestTag` is missing |
| other | — | — | `405`; `OPTIONS` → `204` |

**Lifecycle resilience (POST/PATCH):** these never `4xx` on a valid-but-edge request, so the
platform's retry-once model is never tripped:
- Unknown / cross-tenant `pcId` → the call is recorded unassigned (`agent_id NULL`, no pop), still `200`.
- Malformed `ani` → stored raw, still `200`.
- Duplicate POST (same `requestTag`) → one row (idempotent), same `id`.
- PATCH before POST → a `patch_only` row keeps the billing, fires no phantom pop; response `queued: true`.
- The only POST/PATCH `4xx` is a missing `requestTag` (the idempotency key). A genuine DB fault is `500`.

---

## 3. Reuse (no reinvention)

- `verifyCrmToken` — `supabase/functions/_shared/crm-token-decoder.ts` (Phase 1).
- `createSupabaseAdminClient()` + `.rpc(...)` — `_shared/supabase-client.ts`.
- `normalizePhoneNumber` — `_shared/phone.ts` (validates the GET `ani`).
- `enforceRateLimit` — `_shared/rate-limit.ts` (per-credential bucket; fails open).
- Method-switch / 405 shape modeled on `stripe-webhook`. **No `_shared/cors.ts`** (M2M; the bearer
  is the auth, not a browser origin), mirroring `crm-oauth-token`.

---

## 4. Routing (`vercel.json`)

Two rewrites added **before** the SPA catch-all `/((?!api/).*)`:
- `/oauth/token` → `crm-oauth-token` — **must precede the catch-all** (it is not under `/api/`, so the
  catch-all would otherwise rewrite it to `index.html`; Phase 1 never added this).
- `/api/v1/leads` → `crm-leads` — already excluded by the `(?!api/)` lookahead, but needs an explicit
  destination to reach the function.

These only matter if the platform targets the **app domain**; if it targets the direct
`…supabase.co/functions/v1/…` URLs, they are optional (an onboarding detail).

---

## 5. Verification (local, all green)

`scripts/crm-mock-caller.ts` against both functions served locally (`supabase functions serve … --no-verify-jwt`)
with a seeded fixture (a credential, a `pcId` registered to an agent via `crm_register_agent_pcid`, and
that agent owning the known caller). **28 checks pass** — 12 token + 16 leads: AoR `200 {pcId}` / `204` /
`400`, POST `200 + id`, idempotent duplicate POST (same `id`), unknown-pcId `200`, missing-`requestTag`
`400`, PATCH-after-POST (`queued:false`), PATCH-before-POST (`queued:true`), no-bearer `401`, `DELETE` `405`.
A DB spot-check confirmed the written `inbound_calls` rows (`with_agent`, `ended`, `billable`, `patch_only`,
`unassigned`) matched the calls exactly. The Phase 0 RPC layer is independently covered by
`scripts/test-crm-rpcs-smoke.sql`. No `src/` runtime code changed, so `npm run build` is unaffected.

---

## 6. Deploy (separate, gated)

1. `crm-leads` reads `CRM_CALL_PLATFORM_SIGNING_KEY` (already required by `crm-oauth-token`) — no new secret.
2. `supabase functions deploy crm-leads`.
3. The `vercel.json` rewrites ship with the next Vercel deploy (only needed if the platform uses app-domain paths).

---

## 7. Out of scope

Phase 3 (realtime screen-pop provider + dialog — consumes the `inbound_calls` INSERT this writes),
Phase 4 (Clients page), Phase 5 (observability/retention/PII), Phase 1b (credential/pcId admin UI).
