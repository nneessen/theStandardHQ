# MASTER Implementation Plan — Inbound-Call CRM + Auth Hardening

> **Purpose:** the single entry point that accounts for *every* plan so nothing is missed when implementation starts. The whole org runs on this — read this first, then the detailed plan for the stage you're building.
> **Status:** planning only. Nothing implemented except where noted ✅. Owner decides go/no-go per stage.
> **Date:** 2026-06-17 · verified against the live codebase + prod DB by two multi-agent sweeps.

---

## 1. The plans (inventory + status)

| | Plan | File | Status |
|---|---|---|---|
| **A** | **Inbound-Call CRM Integration** (org-facing feature) | `~/.claude/plans/we-already-have-a-serialized-lark.md` (build-ready) · owner doc `docs/inbound-lead-feature/INTEGRATION_RESPONSE.md`+`.docx` | Doc done; **build not started** |
| **B** | **Auth & Security Hardening** | `plans/active/auth-security-hardening-plan-20260617.md` | Self-promote fix ✅ shipped to prod; signup toggle ✅ off; rest planned |

Both have been corrected and gap-closed. Plan A was rewritten for the **NetTrio / one-agency / no-availability-gating** model. Plan B's prod claims were re-verified live.

---

## 2. Unified build sequence (DO IT IN THIS ORDER — it's a constraint, not a suggestion)

Rationale: avoid interleaving migrations + `database.types` regens, and land the inbound→`user_profiles` FK before any `user_profiles` grant change.

1. **Auth quick-wins (low blast radius, independent):**
   - **B-P3** Drop world-writable `test_workflows_real` (confirmed on prod). *Ship anytime.*
   - **B-P2** Password-reset: generic response + `check_rate_limit`.
   - **B-P4** `ApprovalGuard` hardcoded email → `is('super_admin')`.
   - **B-P0** Signup metadata-injection backstop (edge-fns stamp `app_metadata` → then trigger migration). **Gate on the GoTrue `raw_app_meta_data`-visibility test first** (see Blockers).
2. **Inbound-Call feature (Plan A, its own Phases 0–5)** — schema/RPCs → OAuth issuer → data endpoints → screen-pop → Clients page → routing/observability. **Single `npm run generate:types` at the end of Phase 0.**
3. **Auth column-lockdown LAST (highest blast radius):**
   - **B-P1** `REVOKE UPDATE ON TABLE user_profiles FROM authenticated, anon` + explicit safe-column `GRANT` + new `set_user_roles`/`set_user_imo` RPCs. Only after every client writer is audited + fixed. Final `generate:types`.
4. **Later, separate initiative:** **B-P5** MFA for admins.

---

## 3. Shared surfaces & coordination rules (both plans touch these)

- **`user_profiles` / `imo_id`:** Inbound adds `imo_agent_external_ids.user_id → user_profiles.id` FK; Auth-P1 changes `user_profiles` grants. → FK lands in step 2, grants in step 3 (ordered).
- **Migrations:** always `./scripts/migrations/run-migration.sh` (never psql); it tracks `function_versions` + blocks downgrades. One coherent `generate:types` per stage (don't interleave).
- **Edge-fn own-auth pattern:** reuse `recruit-templates` + `sms-inbound-webhook`/`close-webhook-handler` (verify_jwt=false **per-function** config.toml; constant-time secret compare; service-role + explicit WHERE). **Do NOT import `_shared/cors.ts`** in M2M fns.
- **`_shared` libs:** reuse `phone.ts` (Deno; needs a SQL twin + a `src/lib/phone.ts` frontend twin + parity test), `rate-limit.ts` (fails open — secondary control). **Do NOT** reuse `hmac.ts parseSignedState` (skips claim checks) or `encryption.ts` for secrets (reversible).
- **SECURITY DEFINER RPC pattern:** mirror `admin_set_admin_role` + `assert_in_acting_scope` (`20260523074917`) for Auth-P1; `GRANT EXECUTE … TO service_role` for the inbound `crm_*` RPCs.
- **Realtime:** one multiplexed socket; mirror `NotificationContext`; add tables to `supabase_realtime` publication + `REPLICA IDENTITY FULL`.

---

## 4. BLOCKERS to resolve before coding the affected stage

| Blocker | Stage | Resolve by |
|---|---|---|
| **GoTrue `app_metadata` visibility in the AFTER-INSERT trigger** — if NULL, B-P0 silently neuters *all* admin creates | B-P0 | `RAISE LOG` test on local/staging; pivot to sub-SELECT/BEFORE-trigger if NULL |
| **`user_profiles` has a TABLE-level UPDATE grant** (authenticated+anon) → column REVOKE is a no-op | B-P1 | Migration must `REVOKE … ON TABLE … FROM authenticated, anon` then `GRANT (safe cols)`; audit every client `.update()` writer first |
| **`clients` has NO `imo_id`** (scoped via `user_id→user_profiles.imo_id`); inbound create must set `clients.user_id = AoR` | A-P0/P2 | Encode in `crm_upsert_call`; never `INSERT clients(imo_id)` |
| **`phone_e164` normalizer** — Deno `_shared/phone.ts` can't back a SQL GENERATED column/backfill | A-P0 | Write IMMUTABLE SQL `normalize_phone_e164()` + parity test vs TS |
| **Vercel can't route by HTTP method + SPA catch-all swallows `/oauth/token`** | A-P2/P5 | One `crm-leads` fn (method switch); rewrites **before** the catch-all; `/oauth/token` listed explicitly |
| **`crm_upsert_call` isolation/idempotency** — the load-bearing `INSERT … ON CONFLICT` + resolve-and-validate-agent line | A-P0/P2 | Ship the RPC stub in the plan; mandatory `WHERE imo_id=` everywhere |

---

## 5. Consolidated open questions (for the owner / platform onboarding)

**Inbound (platform/onboarding):** pcId source-of-truth (they issue vs we issue)? · GET timeout budget (binds p99) + concurrent-call volume? · explicit call-ended signal or is billing-PATCH the only one (drives pop dismiss)? · ANI in query vs header/body (Vercel logs)? · billing PATCH authoritative? · Clients page scope (own book vs IMO-admin)? · staging Supabase before prod?
**Auth (owner):** keep permanently invite-only (makes B-P0 lower-urgency)? · appetite for B-P1 column-lockdown vs trusting the shipped guard trigger? · MFA scope/timing?

---

## 6. "To the T" completeness checklist (gate each stage on this)

- [ ] Migration via runner; `function_versions` updated; **no psql**.
- [ ] `npm run generate:types` after any schema/RPC change; `npm run build` zero TS errors.
- [ ] RLS enabled + policy on every new table; realtime tables in publication + `REPLICA IDENTITY FULL`.
- [ ] Secrets in Supabase project secrets (`Deno.env`); never logged; redaction helper + CI grep on `crm-*`.
- [ ] Per-function `config.toml verify_jwt=false` for M2M fns; no `_shared/cors.ts`.
- [ ] Idempotency (`ON CONFLICT`) + the edge-case matrix (Plan A §9) covered; PATCH-before-POST never 4xx.
- [ ] Phone normalizer parity test (SQL vs TS) green.
- [ ] Observability: per-touchpoint redacted logging + metrics + alert thresholds (inbound).
- [ ] PII/retention cron for `inbound_calls`; raw ANI RLS-restricted.
- [ ] Verified on **prod** with rolled-back-txn tests (the proven pattern) before "done".
- [ ] Vault-sync new `docs/` artifacts (`/ingest`) if any land under `docs/`.

---

## 7. Verification discipline (applies to all stages)
Run the real app (CLAUDE.md). Inbound: the `scripts/crm-mock-caller.ts` Deno lifecycle + negatives; **no Playwright dependency** (the `board-shots` harness does not exist). Auth: rolled-back-txn attack tests on local then prod (the pattern already used for the self-promote fix). Each prod migration is irreversible → confirm before applying with `DATABASE_URL=$REMOTE_DATABASE_URL`.
