# Platform Sunset / FFG Revocation — Production Code Review (2026-05-27)

Date: 2026-05-27
Reviewer: senior full-stack / security audit pass (multi-agent + human synthesis)
Scope: the **entire `feat/platform-sunset-revocation` branch vs `main`** — 66 files, ~5,947
insertions. Two workstreams bundled (the sunset feature stacked on the billing self-serve-disable
branch). Feature ships **dormant**; applied to **LOCAL only**; remote deploy is a later step.

Companion docs (read first for design internals — not restated here):
- [`platform-sunset-revocation-architecture-2026-05.md`](./platform-sunset-revocation-architecture-2026-05.md) (backend security design)
- [`platform-sunset-edge-functions-and-runbook-2026-05.md`](./platform-sunset-edge-functions-and-runbook-2026-05.md) (edge fns + runbook)

---

## Verdict: **Request Revisions** → blocking + should-fix items now **fixed in code (uncommitted)**

The architecture is sound — **no cross-tenant data leak found**, correct sentinel-not-NULL chokepoint,
correct edge-function auth boundaries, atomic guarded wipe, pinned imports, preserved billing
invariants. But the review surfaced **1 blocking** defect (the feature was inert) and several
**should-fix** data-integrity / fail-open gaps. B1 + M1/M2/M4 + the types leak (M3) have since been
**fixed in code**; runtime confirmation of the edge-function fixes is deferred to the STEP-6 staging
rehearsal (the local stack cannot exercise storage delete/copy or signed-URL download).

## Method

Four parallel specialist agents (2 opus on the security-critical SQL + edge slices, 2 sonnet on
frontend + billing); every blocking/should-fix finding was then **personally re-verified against
source** before the verdict (agent summaries describe intent, not ground truth). Verification
honored "typecheck ≠ verified": `npm run build` (green), the parity Vitest (green), `pg`-backed
column-existence check (green), `check-pinned-imports.sh` (clean). Edge-function *runtime* behavior
is explicitly NOT claimed verified — it needs invocation + log inspection on a hosted stack.

---

## Findings

### B1 — BLOCKING (FIXED) — kill switch hides the signal the frontend uses to detect it

The frontend detected revocation by reading `imos.access_revoked_at` via `ImoContext`
(`useRevocationStatus`). But the revocation gate makes `get_my_imo_id()` return the **sentinel**
uuid for a revoked user, so the user's own `imos` row reads as 0 rows (`imo === null`) →
`isRevoked === false` → `SunsetGate` renders the normal app, **never the sunset page**. Fail-*safe*
(no leak — the gate holds), but the entire user-facing flow was unreachable. Root cause was also
documented as fact in the architecture doc's allowlist table (now corrected).

**Fix:** `useRevocationStatus` now calls the `is_access_revoked(p_user_id)` SECURITY DEFINER RPC
(GRANTed to `authenticated`, bypasses the gate). `src/hooks/imo/useRevocation.ts`.
**Verified:** build green, RPC typed. **Not yet verified:** routing against a rendered revoked
session (STEP 6).

### M1 — SHOULD-FIX (FIXED) — storage purged before the wipe's revocation guard

`confirm-and-wipe-account` purged the user's private buckets **before** the guarded atomic wipe RPC.
If the IMO is restored between the cron batching stragglers and the per-user invocation, the wipe
RPC throws (`not in a revoked IMO`) and returns 500 — but the documents are already destroyed while
DB rows + auth login persist, and it can never re-heal once restored.
**Fix:** reordered — guarded wipe RPC runs first; storage purge only after it succeeds (or the
profile was already gone from a prior run). `confirm-and-wipe-account/index.ts`.

### M2 — SHOULD-FIX (FIXED) — recruit gate fails open on a null/wiped inviter

The `access_revoked_at` check was wrapped in `if (inviterImoId)`. A null `inviter_id`, or an inviter
whose profile was already wiped during sunset, made `inviterImoId` null → gate skipped → `createUser`
proceeds, and `handle_new_user` falls back to the **Founders IMO, which IS the FFG sentinel**
(`ffffffff-…`, confirmed in `20260522080218`) — a live auth account created under the revoked org.
**Fix:** gate now checks the **effective** target IMO (`inviterImoId ?? FFG_SENTINEL_IMO_ID`) and
always runs. `complete-recruit-registration/index.ts`.

### M3 — SHOULD-FIX (FIXED) — `database.types.ts` hand-edit not minimal (leaked schema)

Alongside the legitimate sunset additions (`imos.access_revoked_at`, `is_access_revoked`), the
hand-edit carried 4 callerless symbols from earlier `20260524*` migrations
(`get_team_analytics_data_impl`, `getuser_commission_profile_impl`, `is_book_duplication_mode`,
`is_epic_life_imo`) — the "regen leaks undeployed schema → green typecheck, runtime 500" pattern.
**Fix:** removed the 4 (zero callers, confirmed); kept the 2 sunset symbols + `constants.imo_id`
(matches `main` tip) + `current_user_imo_grants_all_features` (reformat-only). Build green.

### M4 — SHOULD-FIX (FIXED) — orphaned, unrecoverable recovery archive on retry

On the happy path the staging snapshot is removed after the recovery copy. If a later step fails
before the audit row is written, a retry sees no snapshot and no prior log → the audit row is
written with `recovery_archive_path = null` while the files sit in `recovery/{user}/`, which the
day-30 GC (filters on the path) never reclaims.
**Fix:** when the snapshot is gone but `recovery/{user}/` has objects, adopt the path + a fresh
30-day expiry so the GC can reclaim it. `confirm-and-wipe-account/index.ts`.
> Note: M1 + M4 compose into a self-healing retry loop — a post-wipe purge failure → retry finds
> `profile=null`, M4 adopts the orphan, purge re-runs idempotently, `deleteUser` noop-succeeds,
> audit INSERTs.

### M5 — SHOULD-FIX (NOT a code change — Step-7 pre-flight)

The 7 anon SECURITY DEFINER public-surface RPCs in `20260527114910` were captured from the LOCAL
DB and are **not version-tracked** in `function_versions`. On remote deploy, `CREATE OR REPLACE`
could revert a newer out-of-band remote body. **Required:** diff `pg_get_functiondef` on REMOTE
against all 7 bodies before applying.

### M6 — SHOULD-FIX (OPEN) — billing `/billing` silent redirect

`RouteGuard` bounces non-subscribers to `/dashboard` with a bare `<Navigate>`; several un-gated
"Upgrade" links now dead-end there with no feedback. Access decision is correct; only the UX is
wrong. Fix: toast before redirect, or gate the links on `NEW_SUBSCRIPTIONS_ENABLED`.

### Low (OPEN)

- **L1** `account-lifecycle-cron` always returns HTTP 200 even when every task errored → a failing
  sweep is invisible to pg_cron. Return non-200 / `degraded` when `errors.length > 0`.
- **L2** staging snapshot never cleaned up after a completed wipe (GC only handles `recovery/`).
- **L3** `SunsetPage` has no poll on `status:"generating"` (one-shot mutation) — delete is correctly
  blocked, but the user gets no spinner/retry; convert to a `useQuery` with `refetchInterval`.
- **L4** pre-existing `get_imos_with_system_automations(text)` is anon-executable and exposes a
  revoked/unlisted IMO's id+name (no business data) — Part 4 missed it.
- **L5** `invoke_account_lifecycle_daily()` lacks `REVOKE … FROM PUBLIC` (matches the loose existing
  cron pattern; no secret exposure).
- **L6** test gap: no "paid plan, status=cancelled (pre-revert)" case in `subscriptionService.test.ts`.

---

## Security & tenancy result (no finding)

- Chokepoint returns the **sentinel, never NULL** for revoked non-super-admins; super-admin first;
  `is_super_admin()` session-based so the wipe guard reduces correctly under service-role.
- Deny-by-default gate covers **190/195** RLS tables (5 intentional allowlist, 0 ungated); the
  completeness tripwire empirically fires when a policy is dropped; allowlisted tables evaluate
  false under the sentinel → a revoked user reads only their own profile row.
- The 7 public RPCs faithfully reproduce live bodies + inject `access_revoked_at IS NULL`.
- Edge auth boundaries all correct: activate (super-admin JWT), export (service-role OR self, 403
  on userId mismatch), wipe (service-role/super-admin/self, refuses super-admin target), cron
  (service-role). No `atob()` JWT trust, no anon-key-as-trust. FFG-sentinel allowlist holds.
  Server-side confirm text. No Stripe in the wipe path. Imports pinned.

## Test coverage gaps

- **No test that renders or simulates a revoked session** — this is why B1 slipped through. Add a
  regression guard (assert `is_access_revoked` true → `useRevocationStatus.isRevoked` true).
- **No idempotency/retry test** for `confirm-and-wipe-account` (M1/M4 interleavings) — needs STEP 6.
- 4 **pre-existing failing tests** in `subscriptionService.test.ts` (`findByUserIdWithPlan` ×2 mock
  "DB error"; `getUsageStatus` ×2 overage math) — present on the branch independent of these fixes;
  violate the "100% passing" rule; owner to triage.

## Files changed by the fixes (uncommitted, branch `feat/platform-sunset-revocation`)

- `src/hooks/imo/useRevocation.ts` (B1)
- `supabase/functions/confirm-and-wipe-account/index.ts` (M1, M4)
- `supabase/functions/complete-recruit-registration/index.ts` (M2)
- `src/types/database.types.ts` (M3)
- `src/features/sunset/__tests__/wipe-export-parity.test.ts` (STEP 5 parity test, added earlier this session)
