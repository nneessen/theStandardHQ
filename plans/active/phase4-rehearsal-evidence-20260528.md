# Phase 4 — Seeded E2E Rehearsal Evidence (2026-05-28)

Target: **remote prod** `https://pcyaqwodnyrpkaiojnpz.supabase.co` (ref `pcyaqwodnyrpkaiojnpz`).
Mechanism: **Option A** (set `imos.access_revoked_at` directly via SQL on a throwaway test IMO;
`activate-imo-revocation` is fail-closed to the FFG sentinel).
Test IMO: **`91d1390d-71fe-48fb-9867-0c0c10004b7d`** (NOT FFG `ffffffff-…`, NOT Epic Life
`89514211-…`).

Safety invariant checked after every destructive step:
`SELECT id FROM imos WHERE access_revoked_at IS NOT NULL` must never contain the FFG sentinel.

---

## Pre-flight gates — ✅ PASSED

- **Storage-DELETE precheck (HARD GATE):** `POST user-documents/__wipe-precheck__/probe.pdf` → **200**;
  `DELETE` → `{"message":"Successfully deleted"}`; verify-gone → 400. Remote storage DELETE works
  (the local-stack limitation does not apply on prod). The wipe's destructive storage half is proven.
  (First attempt with `text/plain` → 415 mime-allowlist reject; retried with `application/pdf`.)
- **Test IMO UUID:** generated `91d1390d-71fe-48fb-9867-0c0c10004b7d` — collision count 0, not FFG,
  not Epic Life.
- **Dormancy:** `revoked_imos_now` = 0 before seeding.
- **Key correctness:** confirmed `SUPABASE_SERVICE_ROLE_KEY` in `.env` is the **local demo** key
  (`iss: supabase-demo`); the remote key is `REMOTE_SUPABASE_SERVICE_ROLE_KEY` (`ref: pcyaqwodnyrpkaiojnpz`).
  All remote calls use the latter.

---

## Step log

### Seed (Step 1) — ✅
- Test IMO row inserted: `91d1390d-…` name "ZZ Phase4 Test IMO" code ZZ_PHASE4_TEST, `access_revoked_at` NULL.
- Seed user 1 `86c1593b-2d5f-466f-a9e8-560b1177c483` (phase4-seed-1@test.invalid) — trigger read
  `imo_id` from `user_metadata` → landed in test IMO, non-super-admin.
- Seed user 2 `f765ea20-120a-4fa6-a608-e0cd770f1d1c` (phase4-seed-2@test.invalid) — same.
- Business data: user1 = 2 clients + 2 commissions; user2 = 1 client + 1 commission.
- Storage: `user-documents/{uid}/phase4-doc.pdf` uploaded for both (200, confirmed present).
- **Side effect noted:** seeding `clients` fired a "Client sync webhook" (request_id 292656-8) — an
  outbound sync of the `@test.invalid` clients to an external target. Benign test data; the synced
  records (if any) live outside this DB and aren't cleaned by teardown. Flagged.
- Benign WARNINGs: audit triggers on clients/commissions reference `imo_id`/`agency_id` fields absent
  on those rows — non-blocking, inserts succeeded.

### Step 2 — Revoke (Option A) — ✅
- `UPDATE imos SET access_revoked_at = now()` on test IMO. Revoked list = test IMO only;
  **FFG NOT in revoked list** (safety invariant holds); `is_access_revoked(seed1)=true`.
- **Deny-by-default gate proven:** under seed1's own JWT (transactional probe), `clients` and
  `commissions` both return **0 rows** despite existing — RESTRICTIVE `revocation_deny` denies the
  revoked user's own data. ✅

### Step 3 — Export + download — ✅ (with a cosmetic bug, see B3)
- `generate-user-export-bundle` (service-role, userId=seed1) → `status: ready`, 58 KB, signed URLs on
  the **hosted host** (`pcyaqwodnyrpkaiojnpz.supabase.co`, not `kong:8000` — local gap absent on remote).
- Downloaded all 3 via signed URL: xlsx (55 KB, valid "Microsoft Excel 2007+"), csv.zip (clients.csv 2
  rows + commissions.csv 2 rows + manifest.json), manifest.json. CSV holds the real seeded values
  (1234.56 advance, 78.9 renewal, correct user_id + imo_id). Export contents complete. ✅

### Step 4 — Wipe (confirm-and-wipe-account) — ❌ FOUND BLOCKING BUG **B2**
Invoked service-role `{userId: seed1}` → returned `status: wiped`, `authUserDeleted: true`,
`recoveryArchivePath` set, `recoveryExpiresAt` +30d — **but `manifest: {"status":"noop"}`**.
Post-wipe DB/storage state:
| target | expected | actual |
|---|---|---|
| `user_profiles` (profile) | gone | **STILL PRESENT (1)** |
| `clients` | gone | **STILL PRESENT (2)** |
| `commissions` | gone | **STILL PRESENT (2)** |
| `user-documents/{uid}/` storage | purged | gone (400) ✅ |
| `auth.users` row | deleted | deleted (404) ✅ |
| `account_deletion_log` | written | written, `auth_user_deleted=true`, manifest noop ✅ |
| `recovery/{uid}/` archive | present +30d | present (3 files) ✅ |

**B2 (BLOCKING for the operational flip) — the wipe silently skips the business-data deletion.**
Root cause: `user_profiles` has `first_name`/`last_name`, **NOT `full_name`**. The edge fn's profile
lookup `select("id, email, full_name, imo_id, is_super_admin")` → PostgREST **400 `column
user_profiles.full_name does not exist`** (reproduced directly). The `{ data: profile }` destructure
ignores the error → `profile = null` → `profileExists = false` → `wipeThenPurge` **skips the wipe
RPC** (manifest stays the default noop) while still purging storage, deleting the auth user, and
writing a success deletion-log. Net: a "wiped" revoked user's policies/commissions/clients/PII
**survive in the DB indefinitely**, while their login + documents are destroyed — defeating the wipe's
purpose and any retention/compliance intent. Service-role does NOT bypass this (it's a schema/column
error, not RLS — service-role REST reads of the row succeed; only the `full_name` projection 400s).

**Blast radius — same `full_name` mistake in 3 of 4 fns** (`grep`):
- `confirm-and-wipe-account` L122 (select) + L235 (log) — **B2, critical (data survives wipe)**.
- `generate-user-export-bundle` L164 (select) + L199/L260 (log + manifest) — **B3, cosmetic**: profile
  lookup 400s → manifest `email`/`fullName` + `data_export_log` identity null (observed `email: None`);
  the table data still exports correctly (read by `userId`, not via profile).
- `activate-imo-revocation` L164 (select) + L180 (insert) — **B4**: the affected-users query 400s →
  `usersErr` → **0 export rows enqueued on revoke** (cron pre-build/drain has nothing; self-service
  export from the sunset page still works, and day-7 auto-purge still finds users via the cron's own
  `id,email,imo_id` query — but that purge then hits B2 and fails to delete data).
- `account-lifecycle-cron` — **clean** (selects `id,email,imo_id`, no `full_name`).

Why automated gates missed it: `wipe-orchestration` unit tests mock the DB/storage ports; `deno check`
type-checks but can't know the live column set; the local stack can't run the full chain. **Only the
seeded remote rehearsal (M-C) exposes it** — the exact justification for this phase.

Fix: select `first_name, last_name` and derive `full_name = [first_name,last_name].filter(Boolean)
.join(" ") || null` in all three functions; then redeploy and re-run the wipe to prove deletion.

### Fix applied (working tree — NOT yet deployed)
- `confirm-and-wipe-account/index.ts` — select `first_name,last_name`; compute `fullName`; use in log row.
- `generate-user-export-bundle/index.ts` — same select + `fullName` in `data_export_log` insert + manifest.
- `activate-imo-revocation/index.ts` — same select; per-row `full_name` in the enqueue map.
- `account-lifecycle-cron` — untouched (was already clean).
- All 3 pass `deno check`. Confirmed `full_name` was never a `user_profiles` column — it is computed
  from `first_name + last_name` in app TS (`src/types/user.types.ts:57`); no other broken consumers.
- **Regression guard added:** `wipe-export-parity.test.ts` new DB-gated test asserts every
  `user_profiles` column the edge fns project exists AND that `full_name` is NOT a column. Passes on
  local (11/11) and remote. This test would have failed on the buggy `full_name` projection.

### Seed1 cleanup + RPC validation — ✅
Called `wipe_user_business_data(seed1, <super-admin>)` directly via SQL (the RPC was never the bug).
Manifest: `{status:"wiped", by_table:{clients:2,commissions:2,user_profiles:1}, rows_deleted_total:5,
profile_deleted:true}`. Verified profile/clients/commissions now **0**. Confirms the RPC deletes
correctly when actually invoked — the defect was solely the edge fn skipping it.
- seed1 residual: `auth.users` gone, storage purged, `recovery/{seed1}/` archive present (+30d),
  `account_deletion_log` row remains with the **false** `manifest:noop` / `auth_user_deleted=true`
  (kept as bug evidence; scrub on teardown).

### STOPPED — awaiting user authorization to redeploy
Per protocol, deploying fixed edge functions to **prod** is a separate, consciously-authorized action.
seed2 left **untouched** as the post-fix validation subject: after redeploy, run
`confirm-and-wipe-account {userId: seed2}` and confirm the manifest shows real `by_table` counts +
seed2's rows gone, proving the fix end-to-end. Then teardown.

### Post-fix validation (after redeploy of all 3 fns to prod) — ✅ ALL GREEN
Redeployed `confirm-and-wipe-account`, `generate-user-export-bundle`, `activate-imo-revocation` to
prod via `supabase functions deploy --project-ref pcyaqwodnyrpkaiojnpz` (default JWT settings; they
self-authenticate). Then:

- **Export fix (seed2):** manifest now `email='phase4-seed-2@test.invalid'`,
  `fullName='phase4-seed-2 SeedTwo'`, `imoId` set (was all null pre-fix). ✅
- **Wipe fix (seed2):** manifest `by_table:{clients:1,commissions:1,user_profiles:1}`,
  `rows_deleted_total:3`, `profile_deleted:true`; DB profile/clients/commissions = **0**; storage 400;
  auth 404; deletion-log `full_name` populated. **B2 fixed — business data now actually deleted.** ✅
- **Idempotency:** re-wipe seed2 → `noop / already_deleted`; still exactly **1** deletion-log row
  (no re-INSERT). ✅
- **M1 restore-mid-flight (seed3):** restored IMO, attempted wipe → RPC refuses
  ("user … is not in a revoked IMO; refusing"); seed3 profile/clients/commissions all **intact**,
  storage 200, auth 200 — nothing destroyed (wipe-before-purge ordering holds live). ✅
- **Cron drain + day-7 auto-purge (seed3):** backdated revoke to −8d, enqueued a pending export, invoked
  `account-lifecycle-cron` → `{exportsDrained:1, autoPurged:1, remindersSent:0, recoveryArchivesGced:0,
  errors:[]}`. seed3 data = 0, auth 404, deletion-log `auto_purge_7d` + `rows_deleted=3` (real wipe via
  the cron path). ✅
- **Recovery GC:** backdated `recovery_expires_at` to past for all 3 seed logs, invoked cron →
  `recoveryArchivesGced:3`; recovery folders now 0 files; `recovery_archive_path` nulled (0 still set).
  Proves the cron's destructive GC works on prod storage. ✅

**Deferred (not exercised; rationale):**
- **Day-3/6 reminder send** — selection logic (`daysSince ∈ {3,6}`) empirically confirmed (daysSince=8
  computed correctly); cron orchestration proven; the actual `send-email` invoke not fired to avoid
  Mailgun bounces to `@test.invalid`. Low risk (neutral copy, pre-existing send fn).
- **Live browser-rendered revoked session (Step 7)** — the app's `VITE_SUPABASE_URL` points at local,
  not remote, and there's no headless browser driving remote auth here. `SunsetGate` routing is
  unit-tested (`SunsetGate.test.tsx`) + code-reviewed; recommend a manual browser spot-check by the
  owner against a revoked seed before the real flip, OR accept the unit-test coverage.

### Teardown — ✅ prod left clean
- Switch A restore proven (`access_revoked_at=NULL` on test IMO before deletion).
- 0 profiles remaining in test IMO; snapshots/ and recovery/ both 0 files for all 3 seed users;
  user-documents purged (0 files each); `__wipe-precheck__` probe gone.
- Deleted the test IMO row; scrubbed all phase4 `data_export_log` + `account_deletion_log` rows
  (chose to SCRUB rather than keep — these are prod audit tables; this doc is the durable record).
- **Final state: `revoked_imos_total = 0` (prod fully dormant, FFG never touched).** Local temp files removed.

## Verdict — M-C PRIMARY GATE: ✅ PASSED (after fixing B2)
The full activate→export→download→wipe→audit→storage-purge→recovery→GC chain observed working on
remote against a seeded tenant, including idempotency, the M1 restore-refusal, and the cron
orchestration (drain + day-7 auto-purge + GC). The rehearsal caught a **blocking** wipe defect (B2,
`full_name` non-column → wipe RPC silently skipped) that all automated gates missed; fixed across 3
edge fns + a regression guard test, redeployed to prod, and re-validated end-to-end. Remaining
deferred: a live browser-rendered revoked session (unit-tested) and the day-3/6 reminder send (logic
confirmed). **The deployed fix is NOT yet committed to git — commit before merge so prod matches `main`.**
