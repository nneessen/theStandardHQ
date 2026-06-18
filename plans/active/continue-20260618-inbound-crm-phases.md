# CONTINUATION — Inbound-Call CRM Integration (resume here)

**Updated:** 2026-06-18 (session 2). **Branch:** `feat/inbound-crm-phase2`.
The four tasks from the prior handoff are **ALL DONE** (see "Completed this session"). What remains is the
**GO-LIVE** sequence — do NOT re-run the completed work below.

Deep record: `memory/project_inbound_crm_phase0_build_20260617.md` (updated with the prod-apply milestone).

---

## STATE NOW
- **Phases 0–2 are CODE-COMPLETE on `main` AND all 4 migrations are APPLIED TO PROD** (`20260617150349`,
  `20260617150350`, `20260617163403`, `20260618060715`). Verified on prod: RPC smoke 12/12, RLS isolation,
  grant gate, realtime publication + `REPLICA IDENTITY FULL`, and a live happy-path lookup→upsert→pop.
- **The feature is INERT in prod**: no edge functions deployed, no credentials issued, the platform is not
  pointed at us. Nothing fires. Applying the schema changed no behavior.
- **Uncommitted on `feat/inbound-crm-phase2`** (this session): `scripts/crm-e2e-local.sh` (new E2E harness),
  `scripts/test-crm-rpcs-smoke.sql` (anchor hardened vs revoked/pre-mapped agents),
  `docs/inbound-lead-feature/implementation/phase-3-screen-pop.md` (new) + its README row.

## Completed this session (do NOT redo)
1. **Mock E2E live** — `scripts/crm-e2e-local.sh` seeds a committed fixture (issues a real OAuth credential —
   the RPC mints a RANDOM client_id/secret, so capture it; the mock defaults `crm_mocktest`/`mock-secret-123`
   do NOT exist), serves both fns, runs `crm-mock-caller.ts` → all 28 checks green. `CRM_INSTANCE_URL` need only
   be NON-EMPTY locally (token issuer fails closed on empty); its value is irrelevant for local E2E.
2. **Phase 3 screen-pop doc** — written, build-ready, DOC ONLY (not built).
3. **Prod apply** — done + verified (above).
4. **Vault re-sync** — inbound docs folded into wiki `external-api-integrations.md`; 42 orphaned raw-sources
   mirrors from doc-cleanup `bd1a1fb7` pruned (collision-guarded); `wiki-lint` exit 0.

---

## NEXT — GO-LIVE (only when the owner says go; needs owner authority — no staging exists)
1. **Deploy the edge functions:** `supabase functions deploy crm-oauth-token crm-leads`.
   - These have NO `[functions.*]` block in `supabase/config.toml` → confirm `verify_jwt` is handled. The CRM
     fns must run with `verify_jwt=false` (they carry their own OAuth bearer, not a Supabase JWT). Add per-fn
     `config.toml` entries OR deploy with `--no-verify-jwt`, and TEST that the platform's bearer reaches them.
2. **Set secrets (prod):** `CRM_CALL_PLATFORM_SIGNING_KEY` (HMAC key; fail-closed if unset) and
   `CRM_INSTANCE_URL` (the REAL onboarding base URL the platform prepends to `/api/v1/leads`; fail-closed if empty).
3. **Issue the first Epic Life credential** via the credential RPCs (super-admin context) and hand the platform
   `client_id` + one-time `client_secret` + the `/oauth/token` and `/api/v1/leads` URLs.
4. **`database.types.ts`** — now that the inbound tables ARE on prod, a `generate:types` regen WILL include them
   (fixes nothing today since no frontend consumes them yet; do it when Phase 3/4 frontend lands). Needs
   `SUPABASE_ACCESS_TOKEN` (not in `.env`). Keep it a separate chore commit.
5. **`vercel.json` rewrites** (`/oauth/token`, `/api/v1/leads`) only matter if the platform targets the app
   domain rather than the direct `…supabase.co/functions/v1/…` URLs.

## Then — remaining BUILD phases (frontend)
- **Phase 3** (screen-pop) — spec in `docs/inbound-lead-feature/implementation/phase-3-screen-pop.md`.
- **Phase 4** Clients page (own-book per agent + per-client inbound-call history).
- **Phase 5** observability / PII-retention / hardening.
- **Phase 1b** credential + pcId admin UI (super-admin).

## Carry-forward gotchas
- `REMOTE_DATABASE_URL` is in `.env` but UNEXPORTED — `source .env` to read it, then prefix
  `DATABASE_URL="$REMOTE" ./scripts/migrations/run-*.sh`; confirm `Target DB: REMOTE` before trusting any prod op.
- Supabase grant rule: `REVOKE FROM PUBLIC` is insufficient — must `REVOKE FROM anon, authenticated`.
- `crm_lookup_aor` correctly returns NO row for a revoked agent (`AND NOT is_access_revoked`). The smoke test's
  anchor now excludes revoked-FFG (`ffffffff-…`) agents and agents that already own a pcId mapping.
- Rolled-back prod smoke is side-effect-free: the `clients`/`policies` sync webhooks use `net.http_post` (pg_net),
  whose queue insert is transactional → rolls back with the test (verified; no dblink/autonomous path exists).
- CI red on `main` is pre-existing/non-blocking (`generate:types` drift; `Supabase Preview` not from-scratch-applicable).
