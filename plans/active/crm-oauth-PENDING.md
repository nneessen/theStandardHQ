# 🚧🚧🚧 INCOMPLETE — CRM OAuth DoS rate-limit: pending review fixes + go-live 🚧🚧🚧

> **STATUS: NOT DONE.** The rate-limit gate is shipped + deployed INERT to prod, but there are
> open code-review fixes below AND the go-live bundle is deliberately deferred. **Do not consider
> this feature finished.** Last touched 2026-06-20.

**Branch:** `sec/crm-oauth-dos-ratelimit` (`e606c462`, pushed, **NOT merged to main** — clean merge available).
**Companion:** `plans/active/crm-oauth-golive-runbook.md` (the detailed go-live commands).

---

## ⛔ PART A — open code-review fixes (`/code-review xhigh`, 2026-06-20)
No exploitable bug found, but these are real and should land before merge. **None are urgent; all are low/med.**

| # | File:line | Fix | Redeploy? |
|---|-----------|-----|-----------|
| 1 | `_shared/rate-limit.ts:129` | `allowed: row?.allowed ?? !opts.failClosed` — failClosed must NOT fail-open on empty/missing RPC data (latent; not reachable with today's RPC, but it's the gate's whole contract). | **YES** (logic) |
| 2 | `crm-oauth-token/handler.ts` ~137 | Correct the per-IP-gate comment: gate 2 limits a single IP's **bcrypt** calls to ~10/min; it does **NOT** protect the global 30/min budget (global gate runs first + increments on every call, so one IP at >30/min can consume it). Per-IP fairness is the **gateway/WAF limit's** job. | no (comment) |
| 3 | `crm-oauth-token/handler.ts:182` | Add `Allow: POST` to the 405 (RFC 7231 §6.5.5). | **YES** (logic) |
| 4 | `crm-oauth-token/handler.ts:33` | Fix stale `FOLLOW-UP` comment — it says the rate_limits GC "cannot be fixed here," but the GC migration now EXISTS in this branch (`20260620135826_rate_limits_gc_cron.sql`). | no (comment) |
| 5 | `migrations/20260620135826_rate_limits_gc_cron.sql:20` | Add a comment asserting 86400s is the max assumed window (the 2-day GC margin only holds while that's true). | no (not yet applied) |

**After fixing #1 + #3 (logic):** re-run `./scripts/smoke/test-crm-oauth-ratelimit.sh` (12 tests) AND
**redeploy** both functions: `supabase functions deploy crm-oauth-token --project-ref pcyaqwodnyrpkaiojnpz --no-verify-jwt`
(the `--no-verify-jwt` flag is REQUIRED — CLI 2.23.4 ignores per-fn config.toml).

**Refuted (do NOT act):** Deno-vs-Vitest (edge fns use Deno repo-wide; Vitest = `src/`); JSON_HEADERS/shard-idiom
duplication (pre-existing pattern, intentionally matched).

## ⛔ PART B — go-live bundle (DEFERRED by owner: hold NetTrio creds until the gateway limit exists)
Full commands in `plans/active/crm-oauth-golive-runbook.md`. Summary of what's left:
1. **Gateway/WAF per-IP limit** (Vercel Firewall on `/oauth/token` + `/api/v1/leads`) — the auditor's residual; the reason creds are held.
2. **Set prod secrets** `CRM_CALL_PLATFORM_SIGNING_KEY` + `CRM_INSTANCE_URL` (values stashed in `.env`; instance URL is still a PLACEHOLDER — edit it first).
3. **Issue NetTrio credential** via `crm_issue_credential` (Epic Life imo `89514211-…`).
4. **Apply** `20260620135826_rate_limits_gc_cron.sql` to prod (safe anytime).
5. **Smoke** the live token→/api/v1/leads path + a real pop.

## ⛔ PART C — merge to main
`sec/crm-oauth-dos-ratelimit` is **NOT merged to main**; prod runs code that's only on this branch, so a
future deploy *from main* would regress the gate. Merge is conflict-free (main advanced 2 commits, none
touching these files). Do this after Part A fixes land. PR: https://github.com/nneessen/theStandardHQ/pull/new/sec/crm-oauth-dos-ratelimit

---
> 🚧 **REMINDER: this file means the CRM OAuth work is INCOMPLETE.** Delete it only when A + B + C are all done.
