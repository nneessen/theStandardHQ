# Platform Sunset — Edge Functions & Operational Runbook

Date: 2026-05-27
Owner: Nick / super-admin
Status: All four edge functions + Migrations F/G + the frontend + the public-surface gate (Part 4)
**built and applied to LOCAL only, fully DORMANT**. The `export ⊆ wipe` parity test, a seeded
rehearsal, and remote deploy still pending. Nothing is activated.

This is the **runtime / operational** companion to the backend-security design in
[`platform-sunset-revocation-architecture-2026-05.md`](./platform-sunset-revocation-architecture-2026-05.md).
That doc explains *how the RLS chokepoint, deny-by-default gate, and the `wipe_user_business_data()`
RPC are designed*. **This** doc explains *the edge-function layer that drives them, the export/wipe
data lifecycle, and the runbook for actually pressing (and reversing) the RED BUTTON.* Read the
architecture doc first; this does not restate the gate/chokepoint internals.

---

## 1. The two switches, at runtime

| Switch | Reversible? | Edge function | DB effect |
|---|---|---|---|
| **A — access revocation** | Yes | `activate-imo-revocation` | sets/clears `imos.access_revoked_at` |
| **B — per-user wipe** | **No** | `confirm-and-wipe-account` → `wipe_user_business_data()` | permanent deletion |

Switch A is the lock; Switch B is the shredder. They are never the same button. A flips a flag that
the RLS layer reads; B is triggered per-user (by the user from the sunset page, or by the day-7
auto-purge sweep) and is irreversible.

**Stripe is out of band.** No edge function touches Stripe. Subscription cancellation and refunds are
done **manually by the owner in the Stripe dashboard**, and only **after** Switch A is flipped (see
§7 runbook — cancelling first deprovisions chat bots / downgrades plans, a visible "tell").

---

## 2. The four edge functions

All live in `supabase/functions/`, pin every esm.sh import (`scripts/check-pinned-imports.sh`),
type-check clean under Deno, and were smoke-invoked against the local edge runtime. Two shared
modules back them:

- `_shared/sunset-constants.ts` — `FFG_SENTINEL_IMO_ID` (the only revocable IMO), `RECOVERY_BUCKET`
  + `SNAPSHOT_PREFIX`/`RECOVERY_PREFIX`, `PRIVATE_USER_BUCKETS`, `AUTO_PURGE_AFTER_DAYS=7`,
  `RECOVERY_TTL_DAYS=30`.
- `_shared/storage-recursive.ts` — `listAllPaths()` / `removeAll()` (Supabase `list()` is one level
  at a time; folders come back with `id === null`).

The export and wipe are both driven by the owned-tables registry
`_shared/owned-tables.ts` (`EXPORTED_TABLES`, `ALL_OWNED_TABLES`, actor-ref arrays), preserving the
`export ⊆ wipe` invariant.

### 2.1 `activate-imo-revocation` — Switch A (super-admin)

- **Auth:** verify Bearer JWT → `getUser()` → `user_profiles.is_super_admin` must be true (pattern
  copied from `update-plan-pricing`). 403 otherwise.
- **Body:** `{ imoId, action: "revoke" | "restore", confirmText? }`.
- **Fail-closed allowlist:** refuses any `imoId` except `FFG_SENTINEL_IMO_ID` (`ffffffff-…`). A
  live tenant (Epic Life, whose id differs per env) can never be revoked by a mistyped id. Adding a
  second revocable IMO is a deliberate code change.
- **`revoke`:** requires `confirmText === "REVOKE <imo.name>"` (computed server-side). Idempotent —
  no-ops if already revoked. Sets `access_revoked_at = now()`, then **async-enqueues one
  `data_export_log` row (status `pending`, trigger `activation_prescan`) per non-super-admin user**
  in that IMO. It does NOT generate bundles inline (a large IMO would blow the ~150s fn limit). If
  the enqueue query fails, the revoke still stands (the lock-out is the important part) and the gap
  is logged for the cron/backfill.
- **`restore`:** single-confirm; clears `access_revoked_at`. Fully reverses Switch A; touches no data.

### 2.2 `generate-user-export-bundle` — build the download (service-role OR self-JWT)

- **Auth (dual caller, like `send-email`):** `service_role` (cron drain; any `userId`) OR an
  authenticated user (self only — `userId` is forced to the caller's id; a mismatched body `userId`
  is 403'd).
- **Reads always use the service-role admin client** — a revoked user's own JWT is denied at the RLS
  gate, so even a self-service call reads their rows with service-role.
- **Output:** iterate `EXPORTED_TABLES`, `SELECT * WHERE <ownerColumn> = userId`, and emit:
  - `account-export.xlsx` — one sheet per table (SheetJS `xlsx@0.18.5`; sheet names sanitized to
    Excel's 31-char/charset limits; empty tables become a `(no records)` sheet),
  - `account-export-csv.zip` — one CSV per non-empty table + `manifest.json` (`fflate@0.8.2`),
  - `manifest.json` — `{ userId, email, fullName, imoId, generatedAt, tables: {name: rowCount} }`.
  - jsonb/object cells are `JSON.stringify`-ed; nulls blank.
- **Storage:** writes to `account-recovery-archives/snapshots/{userId}/` (stable names → re-runs
  overwrite). Updates the `data_export_log` row → `ready` with `bundle_storage_path`,
  `bundle_bytes`, `generated_at`; on error → `failed` + `error`.
- **Returns:** 1-hour signed URLs for the three files (the RLS-denied user downloads directly).

### 2.3 `confirm-and-wipe-account` — Switch B (self / super-admin / service-role)

Wraps `wipe_user_business_data()` with the side effects the RPC deliberately omits (storage,
`auth.users`, audit log). **Idempotent across partial failures.**

- **Auth / target resolution:**
  - `service_role` → wipes `body.userId`, reason defaults `auto_purge_7d` (the cron).
  - authenticated **super-admin** → may wipe a named `body.userId`.
  - authenticated user → self only; reason `self_confirmed`.
- **Refuses** a super-admin target (the RPC also refuses; this fails early).
- **Flow:**
  1. Look up profile + the most-recent `account_deletion_log` row (idempotency basis). If a prior
     row already has `auth_user_deleted = true` → return `noop`.
  2. **Snapshot → recovery, all-or-nothing:** copy every `snapshots/{user}/…` object to
     `recovery/{user}/…`. If *all* succeed → set `recovery_archive_path` + `recovery_expires_at =
     now()+30d` and remove the staging snapshot. If *any* copy fails → roll back the half-built
     recovery folder and **keep the snapshot** (never claim an incomplete archive).
  3. Purge the user's objects from the three `PRIVATE_USER_BUCKETS`.
  4. If the profile still exists, call `wipe_user_business_data(p_user_id, p_reassign_to_user_id =
     oldest distinct super-admin)`; capture the jsonb manifest. If the profile is already gone, skip
     (manifest `noop`).
  5. `auth.admin.deleteUser(userId)` — "not found" counts as success.
  6. Write `account_deletion_log`: **UPDATE** the prior row on a retry (no unique constraint → a
     re-INSERT would 23505), else INSERT. `recovery_expires_at` is only written when this run
     actually created the archive (so a later successful copy can't leave the timestamp null and
     orphan the files from the day-30 GC).
- **No Stripe.**

### 2.4 `account-lifecycle-cron` — daily sweep (service-role)

Invoked by pg_cron via pg_net (Migration G). Service-role only. Four bounded, batched
(`Promise.all` in groups of 5), **failure-isolated** tasks — one task's error is logged and the
sweep continues:

1. **Drain pending exports** — up to 25 `data_export_log` rows with status `pending` →
   `functions.invoke('generate-user-export-bundle', { userId, exportLogId })`.
2. **Reminder emails** — for revoked, still-existing, non-super-admin users whose IMO was revoked
   exactly **3 or 6 days** ago, send a neutral templated email via `send-email`. (Daily cadence
   naturally dedupes — each user crosses day-3/day-6 on one run.)
3. **Day-7 auto-purge** — up to 25 users whose IMO was revoked **≥ 7 days** ago → invoke
   `confirm-and-wipe-account` with `reason: 'auto_purge_7d'`.
4. **30-day recovery GC** — `account_deletion_log` rows with `recovery_archive_path` set and
   `recovery_expires_at < now()` → delete the `recovery/{user}/` objects, null the path.

Email copy is intentionally **opaque** — "We're winding down access to your account… export by
<deadline>… permanently removed" — zero mention of Epic Life or that the platform continues for
anyone else.

---

## 3. The export / wipe data lifecycle

```
                       activate-imo-revocation (Switch A)
                                   │  sets imos.access_revoked_at = now()
                                   ▼
   data_export_log row per user  ─── status: pending
                                   │
            ┌──────────────────────┴───────────────────────┐
            ▼ (cron drain)                                   ▼ (user opens sunset page)
   generate-user-export-bundle                      generate-user-export-bundle
            │  status: generating → ready                    │
            ▼                                                 ▼
   snapshots/{user}/account-export.{xlsx, csv.zip}, manifest.json
                                   │
                                   ▼
      user downloads + confirms      OR      day-7 auto-purge (cron)
                                   │
                                   ▼
                       confirm-and-wipe-account (Switch B)
        snapshots/{user}/ ──copy──▶ recovery/{user}/  (recovery_expires_at = +30d)
        private buckets purged · wipe_user_business_data() · auth.admin.deleteUser()
                                   │
                                   ▼
                  account_deletion_log row (FK-less; survives the wipe)
                                   │
                                   ▼ (30 days later)
                       account-lifecycle-cron GC deletes recovery/{user}/
```

### Audit-table state (`data_export_log`)
`pending → generating → ready` (or `failed`). Columns: `user_id` (no FK), `email`/`full_name`
(identity snapshot), `imo_id`, `status`, `format`, `bundle_storage_path`, `bundle_bytes`, `trigger`
(`activation_prescan` | `self_service`), `error`, `generated_at`.

### Audit-table state (`account_deletion_log`)
One row per user, written/updated by `confirm-and-wipe-account`. Columns: `user_id` (no FK),
`email`/`full_name`, `imo_id`, `deletion_reason` (`self_confirmed` | `auto_purge_7d`),
`auth_user_deleted`, `recovery_archive_path`, `recovery_expires_at`, `manifest` (jsonb row counts).
Both audit tables are RLS-on with **zero policies** (service-role only) and FK-less so the rows
survive the deletion they record.

---

## 4. Migrations F + G

- **F** (`20260527094314_account_recovery_archives_bucket.sql`) — private `account-recovery-archives`
  bucket: 1GB limit, mime allowlist (xlsx/zip/json), **zero authenticated policies = service-role
  only**. Holds `snapshots/{user}/` (pre-wipe staging) + `recovery/{user}/` (30-day post-wipe).
- **G** (`20260527094315_account_lifecycle_daily_cron.sql`) — `invoke_account_lifecycle_daily()`
  SECURITY DEFINER wrapper (looks up `app_config.supabase_project_url` +
  `supabase_service_role_key`, `net.http_post` to the cron edge fn — same pattern as
  `invoke_lead_heat_scoring`), scheduled `cron.schedule('account-lifecycle-daily', '15 9 * * *', …)`.
  Off-peak, offset from the lead-heat (Mon 11:00) and smart-view crons. **No-op while dormant.**

---

## Public-surface gate (Part 4 — built, LOCAL, dormant)

The four edge functions above and the `authenticated`-only deny-by-default gate cover signed-in
users; they do **not** reach the **public / unauthenticated** funnels (`/join/*`, `/join-*`,
`/register/*`, the custom-domain landing, public discovery). Those resolve their IMO through
`anon`-callable **SECURITY DEFINER** RPCs that bypass RLS — and `anon` can't read `imos` directly —
so the closure must live **inside** each function.

**Migration `20260527114910_revocation_public_surface_gate.sql`** (applied LOCAL only; 7 functions
version-tracked) does a faithful `CREATE OR REPLACE` of each live body, injects
`access_revoked_at IS NULL`, and re-asserts `GRANT … TO anon` idempotently:

- **Real closure** (specific-IMO inputs): `get_public_recruiter_info`, `get_public_recruiting_theme`
  (the `/join/$recruiterId` + `/join-*` routes *and* the custom-domain funnel), `submit_recruiting_lead`,
  `get_public_invitation_by_token` (`/register/*` — a plpgsql guard after the inviter fetch; a NULL
  `imo_id` super-admin inviter passes through unaffected).
- **Defense-in-depth** (FFG is `is_listed=true` locally, so these matter): `get_available_imos_for_join`,
  `get_agencies_for_join`, `get_public_landing_page_settings`.

A revoked IMO then reads as unlisted/unknown — the existing "Link Not Found" / generic-landing
renders, with no new copy and no tell.

**Edge-function change:** `complete-recruit-registration` now checks the inviter's IMO
`access_revoked_at` **before** `auth.admin.createUser` (no orphan auth account under a revoked org)
and returns the neutral `invitation_not_found`. **`resolve-custom-domain` was not touched** — it
404s when `get_public_recruiting_theme` returns null, which the migration now does for a revoked IMO
(covered transitively). **`/slack/name-leaderboard` is auth-gated** (`RouteGuard`), not public, so
`SunsetGate` + the Migration B gate already cover it. No transactional email references the IMO, so
Part 4 needed no email-copy change.

**Verification technique (LOCAL):** the active path was proven *without committing* via a
transactional probe — `BEGIN; UPDATE imos SET access_revoked_at = now() WHERE id = 'ffffffff-…';`
then call each RPC (`get_public_recruiter_info` → 0 rows, `get_public_recruiting_theme` → null,
discovery 2 → 1) `; ROLLBACK;` — so the local DB is never left in a revoked state. Dormant behavior
is unchanged (the FFG funnel still returns "Founders Financial Group"). 3 pre-existing `deno check`
errors in `complete-recruit-registration` are unrelated and don't block Deno deploy.

---

## 5. Known local-stack limitation (environmental — remote unaffected)

On the local Supabase CLI (`storage-api v1.22.17`), **every Storage object DELETE fails** with
`new row violates row-level security policy` — for service-role AND authenticated callers, even via
raw REST. Root-caused into the storage-api's own delete handling, **not** the `storage.prefixes` RLS
(its `delete_prefix` trigger is SECURITY DEFINER; disabling that RLS had no effect). The production
app's 10+ `.remove()` call sites work for real users, so **hosted/remote is fine**.

**Consequence:** the wipe's `removeAll` (private-bucket purge + snapshot cleanup) and the cron's
recovery GC **cannot be rehearsed on the local stack**. Verified locally: the full export build +
upload + signed URLs, and the **copy** half of snapshot→recovery (all files land in `recovery/`).
Un-rehearsable locally: the **delete** half. To delete local test objects, connect as
`supabase_admin` and `SET LOCAL storage.allow_delete_query = 'true'` in the same transaction.

**Second local-stack gap — signed-URL hostname.** The signed URLs `generate-user-export-bundle`
returns embed the Docker-internal host the edge runtime sees (`http://kong:8000/storage/v1/…`),
which a browser at `localhost:3000` cannot resolve — so on the local stack the sunset page's
download buttons render and flip to "ready" but the actual `fetch(signedUrl)` fails. On the hosted
project the URLs are `https://<project>.supabase.co/…` and download normally. Same class as the
DELETE gap: environmental, not a code bug. The sunset-page **download flow is therefore only fully
observable on remote / in the STEP 6 rehearsal against a hosted-style stack**, not on the local CLI.

---

## 6. Verification status (observed vs. inferred)

| Behavior | Status |
|---|---|
| All four fns: 401 no-auth, 405 wrong method, super-admin/service-role gates | Smoke-invoked on local edge runtime |
| Export: full read→xlsx→csv.zip→upload→signed URLs against the real bucket | Verified end-to-end (local) |
| Snapshot→recovery **copy** (all-or-nothing happy path) | Verified (all 3 files land in recovery) |
| Snapshot→recovery partial-copy **rollback** branch | Code-reviewed only (defensive) |
| Wipe RPC + `deleteUser` + audit-log (no-profile / idempotent path) | Verified (local) |
| `removeAll` (bucket purge + snapshot delete) + recovery GC **delete** | **Code-reviewed only — gated on the remote prereq (§7)** |
| Public-surface gate (anon SECURITY DEFINER RPCs) — dormant + active | Verified LOCAL (active path via transactional `BEGIN…ROLLBACK`) |
| Frontend revocation detection (B1 fix — `is_access_revoked` RPC, not gated `imos`) | **Code-fixed; build green — needs a rendered revoked session (STEP 6) to confirm routing** |
| Wipe-before-purge ordering (M1) + orphaned-recovery adoption (M4) | **Code-fixed — runtime behavior needs STEP 6 (local can't delete/copy storage)** |
| Recruit gate on null/wiped inviter (M2 — effective-IMO check) | **Code-fixed — needs invocation against a revoked seed (STEP 6)** |

> **2026-05-27 code review** ([`platform-sunset-code-review-2026-05-27.md`](./platform-sunset-code-review-2026-05-27.md)) —
> verdict **Request Revisions**. B1 (blocking: revocation undetectable by the frontend) + M1/M2/M4 +
> the `database.types.ts` leak are **fixed in code (uncommitted)**. M1/M2/M4 are reorder/guard
> changes whose runtime correctness can only be proven in the STEP-6 staging rehearsal — the local
> stack's storage-DELETE / signed-URL limitations (§5) block them locally. No cross-tenant leak was found.

---

## 7. Operational runbook

### To revoke (press the RED BUTTON)
1. **First**, flip Switch A: super-admin calls `activate-imo-revocation` with
   `{ imoId: "ffffffff-…", action: "revoke", confirmText: "REVOKE <imo.name>" }` (the UI control
   computes the confirm string). This locks every non-super-admin FFG user at the RLS layer and
   enqueues their export bundles.
2. **Then** (and only then) cancel the IMO's subscriptions + issue any refunds **manually in the
   Stripe dashboard**. Doing this before step 1 deprovisions chat bots / downgrades plans — a
   visible change that would tip off a still-active FFG user.
3. The daily cron pre-builds bundles, sends day-3/day-6 reminders, and auto-purges stragglers at
   day 7. Users who act sooner export → confirm → wipe themselves from the sunset page.

### To reverse (before any wipe)
- Super-admin calls `activate-imo-revocation` with `{ action: "restore" }`. Access is restored
  immediately; no data was touched. (Per-user wipes that already ran are NOT reversible — only the
  30-day recovery archive can restore an individual.)

### REMOTE-DEPLOY PREREQUISITE (do before applying any migration to remote)
Prove the wipe's storage purge works on the hosted project (the local stack can't). With the
**remote** service-role key, against an existing bucket (e.g. `user-documents`):
```bash
curl -X POST  "$REMOTE_URL/storage/v1/object/user-documents/__wipe-precheck__/probe.txt" \
  -H "Authorization: Bearer $REMOTE_SERVICE_ROLE_KEY" -H "Content-Type: text/plain" --data "x"
curl -X DELETE "$REMOTE_URL/storage/v1/object/user-documents/__wipe-precheck__/probe.txt" \
  -H "Authorization: Bearer $REMOTE_SERVICE_ROLE_KEY"
```
Both must return 200. A 403 with `new row violates row-level security policy` **blocks the deploy** —
do not apply migrations or activate revocation until hosted storage delete is resolved.

### Monitoring
- `data_export_log` — `status` distribution (stuck `generating`/`failed` rows), `error`.
- `account_deletion_log` — deletion counts by `deletion_reason`, `auth_user_deleted = false`
  (retry candidates), upcoming `recovery_expires_at`.
- `cron.job_run_details` for `account-lifecycle-daily`.

---

## 8. Key files

| Concern | File |
|---|---|
| Shared constants | `supabase/functions/_shared/sunset-constants.ts` |
| Recursive Storage helpers | `supabase/functions/_shared/storage-recursive.ts` |
| Owned-tables registry | `supabase/functions/_shared/owned-tables.ts` |
| Switch A | `supabase/functions/activate-imo-revocation/index.ts` |
| Export bundle | `supabase/functions/generate-user-export-bundle/index.ts` |
| Switch B wrapper | `supabase/functions/confirm-and-wipe-account/index.ts` |
| Daily sweep | `supabase/functions/account-lifecycle-cron/index.ts` |
| Recovery bucket (F) | `supabase/migrations/20260527094314_account_recovery_archives_bucket.sql` |
| Daily cron (G) | `supabase/migrations/20260527094315_account_lifecycle_daily_cron.sql` |
| Public-surface gate (Part 4) | `supabase/migrations/20260527114910_revocation_public_surface_gate.sql` |
| Public-surface registration check (Part 4) | `supabase/functions/complete-recruit-registration/index.ts` |
| Wipe RPC (E) | `supabase/migrations/20260527060621_wipe_user_business_data_fn.sql` |
| Audit tables (D) | `supabase/migrations/20260526193252_account_lifecycle_audit_tables.sql` |

---

## 9. Remaining work

The `export ⊆ wipe` parity Vitest is **done** (STEP 5). A full-branch code review (2026-05-27)
landed B1 + M1/M2/M4 + a types-leak fix in code (uncommitted; see
[`platform-sunset-code-review-2026-05-27.md`](./platform-sunset-code-review-2026-05-27.md)).
Remaining: a seeded full rehearsal on a **staging Supabase project** (STEP 6) — which is also the
runtime verification gate for M1/M2/M4 and B1 routing — then batch-deploy A–G + the public-surface
gate migration (`20260527114910`) + the edge functions to REMOTE (honoring the §7 prerequisite AND
the M5 remote-body diff of the 7 public RPCs). Resume handoff:
`plans/active/continue-20260527-sunset-codereview-fixes.md`.
