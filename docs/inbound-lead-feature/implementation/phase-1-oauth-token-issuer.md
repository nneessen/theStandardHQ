# Phase 1 — OAuth Token Issuer

**Status:** Built + verified on a local Supabase. Committed on `feat/inbound-crm`. **Not** applied
to prod, **not** deployed. **Date:** 2026-06-17.

This phase stands up the authentication half of the integration: the dialer platform authenticates
to us with an OAuth2 **client-credentials** grant and receives a **24-hour bearer token** that it
passes on the (Phase 2) data calls. We are the **resource server / token issuer**; the dialer is the
OAuth client.

> **Why "we issue":** confirmed with the owner. The dialer "handles auth" on its side only in the
> sense that it manages getting, caching, and passing the token. The token itself is **issued and
> verified by us** — there is no pre-shared static token and no dialer-minted token we merely validate.

---

## 1. What was built

| Component                 | Path                                                                        | Role                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Credential + pcId RPCs    | `supabase/migrations/20260617163403_inbound_crm_phase1_credential_rpcs.sql` | Issue/rotate/revoke credentials, authenticate a credential, register a platform pcId — all `SECURITY DEFINER` |
| Token signer/verifier     | `supabase/functions/_shared/crm-token-decoder.ts`                           | Mint + verify the stateless HMAC bearer with full claim checks                                                |
| Token endpoint            | `supabase/functions/crm-oauth-token/{index.ts, config.toml}`                | The `POST /oauth/token` edge function                                                                         |
| Credential RPC smoke test | `scripts/test-crm-credentials-smoke.sql`                                    | Rolled-back issue→auth→rotate→revoke→register + denial checks                                                 |
| Token decoder unit tests  | `supabase/functions/_shared/__tests__/crm-token-decoder.test.ts`            | 9 Deno tests (round-trip + negatives)                                                                         |
| End-to-end mock caller    | `scripts/crm-mock-caller.ts`                                                | Drives the served endpoint: issue → bearer → verify + negatives                                               |

The credential store table itself (`imo_call_platform_credentials`) and the pcId registry
(`imo_agent_external_ids`) were created in **Phase 0**.

---

## 2. Architecture decisions (and why)

1. **Credential secrets are hashed with bcrypt in Postgres (`pgcrypto`), not encrypted and not
   hashed in Deno.** `pgcrypto` bcrypt is self-salting (no global salt secret to manage), battle-tested,
   and its deliberate slowness lands only on the ~once-per-24h token mint. The frequent bearer checks
   on the data endpoints use fast HMAC instead, so bcrypt's cost is never on the hot path.
   - The secret is **generated server-side** (`gen_random_bytes(32)` → **base64url**, well under
     bcrypt's 72-byte limit) inside `crm_issue_credential` and returned to the caller exactly **once**.
     The plaintext never originates client-side and is never stored. base64url (not standard base64)
     so it survives form-urlencoded transport intact (a literal `+` would otherwise decode to a space).
   - `pgcrypto` lives in the `extensions` schema, so every call is schema-qualified
     (`extensions.crypt`, `extensions.gen_salt`, `extensions.gen_random_bytes`).

2. **The bearer is a stateless, signed HMAC token** — `base64url(JSON payload) + "." + HMAC-SHA256(payload)` —
   so verifying it on a data call needs **no database round-trip** (only a signature check), which is
   what keeps the latency-critical GET lookup fast.
   - Payload: `{ imo_id, credential_id, scopes, typ:"crm_m2m", iat, exp }`, 24h lifetime.
   - A **dedicated signing key** (`CRM_CALL_PLATFORM_SIGNING_KEY`) — not the existing
     `SLACK_SIGNING_SECRET`, which is a different rotation domain.
   - A **new** decoder rather than `_shared/hmac.ts`: that module's `parseSignedState` verifies only
     the signature and checks **no** `exp`/`iat`/`typ` claims. M2M bearers must be expiry-checked and
     type-scoped.

3. **Fail closed.** A missing `CRM_CALL_PLATFORM_SIGNING_KEY` throws — we never sign or verify with an
   empty key (an empty key would make every token forgeable). The edge function turns that into a `500`
   rather than ever issuing an unsigned token.

4. **Salesforce-shaped response.** The token endpoint returns
   `{ access_token, instance_url, id, token_type:"Bearer", scope, expires_in }` exactly as the platform's
   spec expects. `instance_url` is **configurable** (`CRM_INSTANCE_URL`) because the platform may prepend
   it to the `/api/v1/leads` paths — a wrong value would silently break Phase 2, so it is an env var on
   the onboarding-confirm list, never a guessed constant. The endpoint **fails closed** (`500`) if it is
   unset rather than issuing a token with an unusable `instance_url`.

5. **Own-auth edge function.** `crm-oauth-token` authenticates with the client_id/secret, not a Supabase
   JWT, so its `config.toml` sets `verify_jwt = false` (per-function). It does **not** import
   `_shared/cors.ts` (machine-to-machine; no browser origin).

---

## 3. The RPCs

All are `SECURITY DEFINER` with `SET search_path = public`.

| RPC                                                                                               | AuthZ                                          | Behavior                                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm_issue_credential(p_imo_id, p_label, p_scopes)` → `(credential_id, client_id, client_secret)` | super-admin in scope                           | Generates `client_id` (`crm_<hex>`) + a random secret; stores the **bcrypt hash**; returns the plaintext **once**.                                  |
| `crm_authenticate_credential(p_client_id, p_secret)` → `(credential_id, imo_id, scopes)`          | **service_role only**                          | Verifies bcrypt against an active, non-revoked credential; bumps `last_used_at`; returns the identity or **no rows**. Never logs/raises the secret. |
| `crm_rotate_credential(p_credential_id)` → `(client_secret)`                                      | super-admin in scope                           | New secret + hash; returns plaintext once.                                                                                                          |
| `crm_revoke_credential(p_credential_id)` → `boolean`                                              | super-admin in scope                           | Sets `is_active=false`, `revoked_at=now()`.                                                                                                         |
| `crm_register_agent_pcid(p_imo_id, p_user_id, p_pc_id)` → `boolean`                               | super-admin in scope; agent must be in the IMO | Upserts the **platform-issued** pcId for the agent (`ON CONFLICT (imo_id, user_id)`).                                                               |

Super-admin gating uses `super_admin_in_scope(imo_id)`, which reads `auth.uid()` — so even though the
RPC runs as the definer, the gate evaluates the **calling** user. For `rotate`/`revoke` (which take a
`credential_id`) the IMO is resolved from the credential first, then scope-checked — a super-admin of
IMO A cannot rotate/revoke IMO B's credential.

---

## 4. The token endpoint — request/response contract

**`POST /oauth/token`** (served as `crm-oauth-token`).

Request — `application/x-www-form-urlencoded` (or HTTP Basic for the credential pair):

```
grant_type=client_credentials&client_id=<id>&client_secret=<secret>
```

Success — `200`:

```json
{
  "access_token": "<base64url-payload>.<hmac-hex>",
  "instance_url": "<CRM_INSTANCE_URL>",
  "id": "<CRM_INSTANCE_URL>/id/<imo_id>/<credential_id>",
  "token_type": "Bearer",
  "scope": "crm:leads",
  "expires_in": 86400
}
```

Errors (OAuth2 `{error, error_description}` shape):

| Status | `error`                  | When                                                                                                                                                                         |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `invalid_request`        | missing/malformed body, or no client_id/secret                                                                                                                               |
| `400`  | `unsupported_grant_type` | `grant_type` present but not `client_credentials`                                                                                                                            |
| `401`  | `invalid_client`         | unknown client_id, wrong secret, or inactive/revoked credential — **generic on purpose** (triggers the platform's refresh-and-retry-once; does not reveal which part failed) |
| `405`  | `invalid_request`        | non-POST method                                                                                                                                                              |
| `500`  | `server_error`           | RPC error, or token minting failed (e.g. signing key unset — fail closed)                                                                                                    |

Secrets and the minted token are **never logged**; error logs carry only the (non-secret) `client_id`
and error codes.

---

## 5. Security model

- **Grants — the recurring Supabase CRITICAL.** Supabase's `ALTER DEFAULT PRIVILEGES` grants `EXECUTE`
  on every new public function **directly** to `anon` and `authenticated` (not via `PUBLIC`), so
  `REVOKE … FROM PUBLIC` alone is a silent no-op. Every Phase 1 RPC therefore carries an explicit
  `REVOKE … FROM anon` (and `crm_authenticate_credential` also `FROM authenticated` — it is
  service_role-only). Verified live with `has_function_privilege`:
  - `crm_issue_credential` / `crm_register_agent_pcid` (+ rotate/revoke): `anon=false`, `authenticated=true`, `service_role=true` — callable by authenticated super-admins (gated internally), never anon.
  - `crm_authenticate_credential`: `anon=false`, `authenticated=false`, `service_role=true`.
- **Secret at rest:** bcrypt (cost 12), self-salted, one-way. A database snapshot alone never yields a
  usable secret. Constant-time-ish comparison via `crypt(secret, stored_hash) = stored_hash`.
- **Token integrity:** HMAC-SHA256 over the payload with a dedicated key; verification recomputes the
  expected signature and compares **constant-time**; then enforces `typ === "crm_m2m"`, `iat` not in the
  future (60s skew), `exp > now`, and the presence of `imo_id`/`credential_id`/`scopes`. `imo_id` is
  taken from the **authenticated credential**, never from client input.
- **Known, intentional tradeoff:** tokens are stateless, so a **revoked** credential's already-issued
  tokens remain valid until they expire (≤24h). This is the cost of not hitting the DB on every bearer
  check; acceptable for a trusted partner. Revocation stops **new** tokens immediately.

---

## 6. Testing & verification (local)

All green:

- **Credential RPC smoke** (`scripts/test-crm-credentials-smoke.sql`, rolled-back): issue → **secret is
  base64url** ✓ → authenticate (correct secret ✓, wrong ✗, unknown client ✗, resolves the right `imo_id`
  ✓) → rotate (old secret denied, new works) → revoke (then auth denied) → **rotating a revoked
  credential is refused (`42501`)** → register pcId (mapping present) → **a non-super-admin is denied
  (`42501`)**. Admin RPCs are exercised by simulating a super-admin via `request.jwt.claims` + `SET ROLE
authenticated`; `crm_authenticate_credential` is exercised in the service-role context.
- **Token decoder** (`crm-token-decoder.test.ts`, `deno test`): **10/10** — valid round-trip, UTF-8-safe
  non-ASCII-scope round-trip, tampered payload, tampered signature, expired, wrong `typ`, future `iat`,
  forgery with a different key, fail-closed when the key is unset, and malformed tokens.
- **End-to-end mock caller** (`scripts/crm-mock-caller.ts`) against the **served** function (`supabase
functions serve`): **12/12** — token mint returns `200`; `access_token` present; `token_type=Bearer`;
  `expires_in=86400`; **the minted token verifies with the shared signing key** and carries
  `typ=crm_m2m` + `imo_id` + `credential_id`; wrong secret → `401 invalid_client`; unknown client →
  `401`; `GET` → `405`.
- **Grant gate** re-verified with `has_function_privilege` (see §5).
- Phase 1 touched **no `src/` files**, so the frontend build is unaffected.

An adversarial multi-agent review of the Phase 1 auth surface (the same discipline that caught a
CRITICAL grant gap in Phase 0) was run and its findings were fixed before this writeup was finalized:

- **base64url secret (was the main finding).** The server-generated secret was standard base64, which
  contains `+`/`/`. Because the token endpoint parses the form body via `URLSearchParams` (where a
  literal `+` decodes to a space), ~half-to-most issued secrets would have intermittently failed
  form-body auth (fail-closed `401`, but near-undebuggable) while Basic auth worked. Fixed at the source:
  the secret is now **base64url** (`+/`→`-_`, padding stripped) in both `crm_issue_credential` and
  `crm_rotate_credential`. Regression: the smoke test asserts the issued secret matches `^[A-Za-z0-9_-]+$`.
- **Rotate no longer un-revokes.** `crm_rotate_credential` previously re-activated a revoked credential
  silently; it now refuses (`42501`) — re-issue instead. Regression added to the smoke test.
- **UTF-8-safe token encoding.** The decoder's base64url now encodes bytes (not the raw string), so a
  non-ASCII scope can't throw at `btoa()` and 500 the mint. Regression: a non-ASCII-scope round-trip test.
- **`CRM_INSTANCE_URL` fails closed.** A missing value now returns `500` instead of issuing a token with
  an empty/relative `instance_url` the platform can't use (consistent with the signing key).

Deliberately **not** changed (documented as low-risk): `crm_authenticate_credential` has a bcrypt
timing oracle that can distinguish a known vs unknown `client_id`. For a trusted single-partner M2M
integration this is negligible, and equalizing it adds complexity; revisit if the threat model changes.

---

## 7. Deployment requirements

Phase 1 is **not** yet on prod. To deploy:

1. Set Supabase project secrets: `CRM_CALL_PLATFORM_SIGNING_KEY` (32+ random bytes) and `CRM_INSTANCE_URL`
   (the base URL the platform targets for `/api/v1/leads`, confirmed at onboarding). For local
   development these go in an env file passed to `supabase functions serve --env-file`.
2. Apply the migration via the runner: `./scripts/migrations/run-migration.sh supabase/migrations/20260617163403_inbound_crm_phase1_credential_rpcs.sql`.
3. Deploy the edge function: `supabase functions deploy crm-oauth-token`.
4. Issue the first credential for Epic Life (via `crm_issue_credential`, or the Phase 1b admin UI once
   built) and hand the `client_id` + one-time `client_secret` to the platform's integration team.

> Prod migrations are irreversible — confirm authority first. There is currently **no staging Supabase**
> (only local + prod), so a staging dry-run isn't available unless one is provisioned.

---

## 8. Open items / next

- **Phase 1b — credential & pcId admin UI** (super-admin): issue/rotate/revoke credentials with a
  show-secret-once dialog, and register platform pcIds against agents. The backend RPCs are ready.
- **Phase 2 — data endpoints:** one `crm-leads` edge function (method switch GET/POST/PATCH) that
  verifies the bearer via `crm-token-decoder` and calls the Phase 0 RPCs; `vercel.json` rewrites.
- Confirm `CRM_INSTANCE_URL` and the ANI transport (query vs header) at onboarding.
