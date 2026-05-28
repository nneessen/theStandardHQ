# Platform Sunset / IMO Access Revocation — Backend Security Architecture

Date: 2026-05-27
Owner: Nick / super-admin
Status: Backend mechanism + **the 4 edge functions (STEP 1)** + **Migrations F/G (STEP 2)**
+ **frontend (STEP 3)** + **the public-surface gate (STEP 4)** + **the `export ⊆ wipe` parity
test (STEP 5)** built and **applied to LOCAL only, fully DORMANT**. A full-branch production
code review (2026-05-27, see [`platform-sunset-code-review-2026-05-27.md`](./platform-sunset-code-review-2026-05-27.md))
returned **Request Revisions**; its 1 blocking (B1) + 4 should-fix (M1/M2/M4 + types) findings are
**fixed in code (uncommitted)**, with M1/M2/M4 runtime behavior still pending the STEP-6 staging
rehearsal. A seeded rehearsal and remote deploy remain. Nothing is activated. Last updated
2026-05-27 after the code-review fixes.

This is the **backend security architecture** for the "RED BUTTON" that decommissions
one IMO's access. It **supersedes** the earlier full-platform-shutdown plan
[`../business/application-sunset-plan-2026-05-20.md`](../business/application-sunset-plan-2026-05-20.md)
(now marked SUPERSEDED — the platform stays live for Epic Life; only FFG/Self Made is revoked)
and is an extension of [`../architecture/multi-tenant-data-isolation.md`](../architecture/multi-tenant-data-isolation.md).

## Purpose

A super-admin can revoke platform access for the **FFG / Self Made IMO** (the original
single-tenant org, sentinel id `ffffffff-ffff-ffff-ffff-ffffffffffff`) while **Epic Life
stays fully live**, and revoked users must not be able to tell the platform continues for
anyone else. A revoked user is dropped onto a neutral sunset page where they export all
their data, confirm, and permanently delete their account; stragglers are auto-purged.

## Two switches (never one button)

| Switch | Reversible? | Mechanism |
|---|---|---|
| **A — access revocation** | Yes | `imos.access_revoked_at timestamptz` (NULL = active). Setting it locks the IMO at the RLS layer; clearing it restores access. No data is touched. |
| **B — per-user wipe** | **No** | `wipe_user_business_data(p_user_id, p_reassign_to_user_id)` — permanent deletion, user-triggered (download → confirm) or via the 7-day auto-purge sweep. |

## Backend enforcement

### 1. The chokepoint — sentinel UUID, never NULL

`get_effective_imo_id()` is the RLS chokepoint ~407 policies route through. For a revoked
non-super-admin it returns a **sentinel UUID** `00000000-0000-0000-0000-000000000000` that
matches no real row, so every IMO-scoped predicate fails closed.

> **CRITICAL:** the deny value must be the sentinel, **never NULL**. `get_effective_imo_id()
> IS NULL` is the super-admin "see-everything" escape hatch, and `get_my_imo_id()` does
> `COALESCE(get_effective_imo_id(), real_imo_id)` — so returning NULL for a revoked user
> would both re-enable the see-all hatch AND fall through to their real imo_id (double leak).

Super-admin is evaluated **first**, everywhere (the owner lives on the FFG IMO and must
never be locked out). The companion predicate `is_access_revoked(p_user_id)` is
`SECURITY DEFINER STABLE` and returns `NOT is_super_admin() AND EXISTS (imo revoked for that
user)`. Under service-role (`auth.uid()` NULL) `is_super_admin()` is false, so it reduces to
"is that user's IMO revoked" — which is exactly what the wipe's entry guard needs.

### 2. The revocation gate — DENY-BY-DEFAULT (the key decision)

A RESTRICTIVE policy `revocation_deny` is attached to **every RLS-enabled `public` base table
except a 5-table allowlist** (currently 190 tables):

```sql
CREATE POLICY revocation_deny ON public.<table> AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_access_revoked(auth.uid()))
  WITH CHECK (NOT public.is_access_revoked(auth.uid()));
```

A RESTRICTIVE policy is **AND-ed** with the permissive policies, so a revoked user is denied
regardless of how any permissive policy would have passed — including a bare
`<owner> = auth.uid()` policy that never touches the chokepoint, and the `imo_id IS NULL`
disjunct that leaks shared/global rows. The migration builds the list from the catalog (a
`DO` loop over `pg_class` where `relkind='r' AND relrowsecurity`), not a hardcoded array.

#### Why deny-by-default (decision record)

The gate was **originally a blocklist**: enumerate the "owned" tables to deny. A
gate-completeness review (2026-05-27) proved that approach is **structurally unreliable** — it
had already missed 8+ tables with a direct `auth.uid()` read policy that bypasses the
chokepoint (`user_targets`, `chargebacks`, `messages`, `carrier_contracts`,
`roadmap_item_progress`, `team_seat_packs`, `team_uw_wizard_seats`, …). A kill switch must
**fail closed**, so the gate was flipped to a whitelist: deny everything, allow only the
handful of tables a revoked session legitimately needs.

> **Principle — reads and destruction want opposite defaults:**
> - **Reads (the gate) → deny-by-default.** You should never have to *remember to deny*; a
>   forgotten table fails *safe* (revoked user sees nothing), not *open* (leak).
> - **Destruction (the wipe/export) → explicit allowlist.** You should always have to
>   *remember to delete*; the owned-tables registry is the reviewed list of what gets
>   destroyed and exported. It is **not** the source of the gate.

#### The allowlist (intentionally NOT gated)

The tables a revoked session reads **before the sunset page renders**, traced from
`AuthContext` + `ImoProvider`:

| Table | Why it must stay readable |
|---|---|
| `user_profiles` | auth loads the caller's profile (who am I) |
| `imos` | `ImoProvider` loads the caller's IMO (name, branding); audit `useRevocationAdminStatus` reads FFG status (super-admin only) |
| `agencies` | embedded in `ImoRepository.findWithAgencies()`'s imo load |
| `data_export_log`, `account_deletion_log` | service-role-only audit (no authenticated access anyway) |

RLS-deny returns **empty sets, not errors**, so a provider that incidentally reads a gated
table degrades gracefully (empty data) rather than crashing; only tables whose *result is
required* for auth/revocation-detection need allowlisting.

> **CORRECTION (2026-05-27 code review, finding B1).** An earlier draft of this table claimed
> the frontend *detects* revocation by reading `imos.access_revoked_at`. That is **false** and was
> a blocking defect: allowlisting `imos` only removes the RESTRICTIVE `revocation_deny` policy, but
> the table's *permissive* SELECT policy is `id = get_my_imo_id()`, and for a revoked user
> `get_my_imo_id()` returns the **sentinel** (via the chokepoint's COALESCE), which matches no real
> row → `imo === null` → the flag is never visible → the sunset page never renders (fail-safe, but
> the feature is inert). **Detection now goes through the `is_access_revoked(auth.uid())`
> SECURITY DEFINER RPC** (`GRANT`ed to `authenticated`, bypasses the gate and the permissive-policy
> mismatch) in `useRevocationStatus` — NOT the gated `imos` read. The `imos` allowlist entry is
> still required for the IMO *name/branding* load and the super-admin admin-status read, just not
> for revocation detection.

### 3. Storage gate

A RESTRICTIVE policy on `storage.objects` scoped to the private buckets `user-documents`,
`contract-documents`, `presentation-recordings` denies a revoked user their own objects.
Shared buckets and service-role/super-admin policies are untouched.

### 4. Service-role bypasses RLS

The export and wipe edge functions use the service-role client, which bypasses RLS entirely,
so they keep working while the user's own JWT is denied everywhere.

## The wipe function — registry-driven, FK-safe

`wipe_user_business_data(p_user_id, p_reassign_to_user_id) RETURNS jsonb`
(`SECURITY DEFINER`, `search_path = public, pg_temp`, `service_role`-only). plpgsql is atomic,
so a mid-wipe error rolls the whole thing back — no half-wiped user.

**Entry guards:** refuse NULL target; idempotent no-op if the profile is already gone; refuse
a **super-admin** target (column check on `p_user_id` — not `is_access_revoked`, which reads
the session under service-role); refuse a **non-revoked** IMO (can't wipe a live Epic Life
user); require a **distinct super-admin** reassign target.

**Order (driven by `supabase/functions/_shared/owned-tables.ts`):**
1. NULL the nullable NO-ACTION actor refs (`ACTOR_REFS_TO_NULL`) — who-created/verified pointers.
2. Reassign the NOT-NULL actor refs (`ACTOR_REFS_TO_REASSIGN`) to the super-admin so shared
   content (training modules/challenges/assignments, roadmap templates) survives.
3. **Defuse the `commissions.related_advance_id` self-FK** (plain NO ACTION): null any inbound
   reference to this user's commissions so a *surviving* user's commission can't FK-violate and
   roll back the entire wipe.
4. DELETE the explicit (non-cascading) owned tables.
5. DELETE `user_profiles` — CASCADE clears every `wipe:"cascade"` table. `upline_id` /
   `recruiter_id` are SET NULL, so downline pointers null harmlessly.

It returns a jsonb manifest of row counts. It does **NOT** touch storage,
`auth.users`, or the `account_deletion_log` — those are owned by the `confirm-and-wipe-account`
edge function that wraps this call. It does **not** modify the existing `hard_delete_user`
(distinct signature, other callers depend on it).

**Stripe is out of scope entirely (decision 2026-05-27).** Subscription cancellation and any
refunds are handled **manually by the owner in the Stripe dashboard** — neither the wipe function
nor the `confirm-and-wipe-account` edge function calls Stripe. Operational ordering: **activate
revocation (RED BUTTON) before cancelling in Stripe** — `customer.subscription.deleted` downgrades
the user to the free plan and deprovisions their chat bot (`stripe-webhook/index.ts:1550-1566`,
`:1642`), a visible change that would tip off a still-active FFG user if done before lock-out.

### Catalog facts validated for the wipe (LOCAL)
- All registry tables + owner columns exist; every `wipe:"cascade"` table genuinely CASCADEs
  to `user_profiles`.
- All 17 NO-ACTION FKs referencing `user_profiles` are exactly the 11 NULL + 6 reassign actor
  refs; nullability matches the split. The only intra-owned NO-ACTION FK is the commissions
  self-reference (defused in step 3).

## Owned-tables registry

`supabase/functions/_shared/owned-tables.ts` is the single source of truth for the **wipe and
export** (not the gate). `EXPORTED_TABLES` (user-downloadable) + `WIPE_ONLY_TABLES`
(internal/sensitive) = `ALL_OWNED_TABLES`; plus `ACTOR_REFS_TO_NULL` / `ACTOR_REFS_TO_REASSIGN`.
Invariant: **export ⊆ wipe** (a wipe must never destroy a table the export omitted). A planned
Vitest parity test enforces this.

## Audit tables

`data_export_log` and `account_deletion_log` store `user_id`/`imo_id` as **plain columns with
no FK**, so the rows survive the user's deletion. RLS on, **zero policies** = service-role-only.

## Completeness tripwire + RLS blind spots

`scripts/check-revocation-gate-completeness.sql` lists any RLS-enabled `public` base table that
is not on the allowlist and lacks a `revocation_deny` policy whose qual references
`is_access_revoked` (so a neutered policy doesn't count). Expected result: **0 rows**. Run it on
LOCAL and (after deploy) REMOTE; re-run the gate migration if it finds a new table.

> **RLS blind spots — the gate covers `relkind='r'` ordinary tables only:**
> - **Materialized views** (`relkind='m'`) cannot enforce RLS. The 8 `mv_*` views are
>   user-scoped (one holds client PII) but are granted to **neither `authenticated` nor `anon`**
>   (verified via `has_table_privilege`), so a revoked JWT cannot reach them via PostgREST.
>   **Invariant: never grant these to `authenticated`/`anon`** — front them with `SECURITY
>   DEFINER` RPCs that call `is_access_revoked()`. If that changes, the kill switch leaks.
> - **Partitioned tables** (`relkind='p'`): none exist today; if one is added, extend the loop
>   and the tripwire to `relkind IN ('r','p')`.

## Dormancy guarantee

`access_revoked_at` defaults NULL and nothing sets it → `is_access_revoked()` never matches →
`get_effective_imo_id()` returns exactly what it did before, and every `revocation_deny` policy
passes (`NOT false = true`). For non-revoked users and all super-admins there is **zero behavior
change**; over-gating 190 tables costs one cheap cached `EXISTS` per query, only when evaluated.
**Activation is a separate, deliberate action** — the mechanism ships dormant.

## Key files

| Concern | File |
|---|---|
| Chokepoint + `is_access_revoked` (Migration A) | `supabase/migrations/20260526193029_imo_access_revocation_mechanism.sql` |
| Deny-by-default gate (Migration B) | `supabase/migrations/20260526200139_revocation_gate_owned_tables.sql` |
| Storage gate (Migration C) | `supabase/migrations/20260526200510_revocation_gate_storage.sql` |
| Audit tables (Migration D) | `supabase/migrations/20260526193252_account_lifecycle_audit_tables.sql` |
| Wipe function (Migration E) | `supabase/migrations/20260527060621_wipe_user_business_data_fn.sql` |
| Owned-tables registry | `supabase/functions/_shared/owned-tables.ts` |
| Gate completeness tripwire | `scripts/check-revocation-gate-completeness.sql` |
| Wipe empirical test | `scripts/test-wipe-user-business-data.sql` |
| Shared sunset constants (STEP 1) | `supabase/functions/_shared/sunset-constants.ts` |
| Recursive Storage helpers (STEP 1) | `supabase/functions/_shared/storage-recursive.ts` |
| RED BUTTON Switch A (STEP 1) | `supabase/functions/activate-imo-revocation/index.ts` |
| Export bundle builder (STEP 1) | `supabase/functions/generate-user-export-bundle/index.ts` |
| Wipe wrapper / Switch B (STEP 1) | `supabase/functions/confirm-and-wipe-account/index.ts` |
| Daily lifecycle sweep (STEP 1) | `supabase/functions/account-lifecycle-cron/index.ts` |
| Recovery bucket (Migration F) | `supabase/migrations/20260527094314_account_recovery_archives_bucket.sql` |
| Daily lifecycle cron (Migration G) | `supabase/migrations/20260527094315_account_lifecycle_daily_cron.sql` |
| Public-surface gate (STEP 4) | `supabase/migrations/20260527114910_revocation_public_surface_gate.sql` |
| Public-surface registration check (STEP 4) | `supabase/functions/complete-recruit-registration/index.ts` |

## The 4 edge functions (STEP 1 — built, LOCAL, dormant)

All four pin their esm.sh imports, type-check clean under Deno, and were smoke-invoked against the
local edge runtime (auth branches + service-role happy paths). **No Stripe calls in any of them.**

1. **`activate-imo-revocation`** (super-admin JWT) — RED BUTTON Switch A. Sets/clears
   `imos.access_revoked_at`. **Fail-closed allowlist: refuses any IMO except the FFG sentinel
   `ffffffff-…`** (a mistyped Epic Life id can never be revoked), plus a typed `REVOKE <imo.name>`
   confirm. On revoke it async-enqueues one `data_export_log` row (status `pending`) per affected
   non-super-admin user — never generates bundles inline (≈150s fn limit).
2. **`generate-user-export-bundle`** (service-role OR self-JWT, self-only) — builds the bundle from
   `EXPORTED_TABLES`: multi-sheet **xlsx (SheetJS `xlsx@0.18.5`)** + **csv `.zip` (`fflate@0.8.2`)** +
   json manifest, written to `account-recovery-archives/snapshots/{user}/`. Reads ALWAYS use the
   service-role admin client (a revoked user's own JWT is denied at the gate), and returns short-lived
   signed URLs so the RLS-denied user can download.
3. **`confirm-and-wipe-account`** (self-JWT / super-admin / service-role) — Switch B wrapper: copies
   the snapshot → `recovery/{user}/` (**all-or-nothing**: a partial copy is rolled back and the
   snapshot kept, so it never claims an incomplete archive), purges the three private buckets, calls
   `wipe_user_business_data` (reassign target = oldest distinct super-admin), `auth.admin.deleteUser`,
   then writes `account_deletion_log`. **Idempotent** across partial failures (profile-gone → skip
   wipe RPC, still retry deleteUser, UPDATE not re-INSERT the log).
4. **`account-lifecycle-cron`** (service-role, pg_cron) — daily, bounded + batched, failure-isolated:
   drain pending exports, day-3/day-6 reminder emails (neutral, opaque copy via `send-email`), day-7
   auto-purge (same wipe wrapper, reason `auto_purge_7d`), 30-day recovery-archive GC.

## Migrations F + G (STEP 2 — built, LOCAL, dormant)

- **F** — private `account-recovery-archives` bucket (1GB; xlsx/zip/json), **service-role only (zero
  authenticated policies)**, holding `snapshots/{user}/` (pre-wipe) + `recovery/{user}/` (30-day post-wipe).
- **G** — `invoke_account_lifecycle_daily()` SECURITY DEFINER wrapper (app_config + pg_net, mirroring
  `invoke_lead_heat_scoring`) scheduled daily at 09:15 UTC. No-op while no IMO is revoked.

> **Known local-stack limitation (environmental, not a code bug — remote unaffected):** the local
> Supabase CLI's storage-api v1.22.17 rejects **every** Storage object DELETE (`new row violates
> row-level security policy`, for service-role and authenticated callers alike, even via raw REST).
> Root-caused into the storage-api's own delete handling — not the `prefixes` RLS (its trigger is
> SECURITY DEFINER; disabling that RLS had no effect). The production app's 10+ `.remove()` call
> sites work for real users, so hosted/remote is fine. Consequence: the wipe's `removeAll` and the
> cron's recovery GC delete half **cannot be rehearsed on the local stack** — they are code-reviewed,
> and the copy half is verified; the delete half is gated on the remote prereq below.

## Part 4 — public-surface gate (STEP 4 — built, LOCAL, dormant)

The deny-by-default gate (§2) is `authenticated`-only, so it never covered the **public /
unauthenticated** surfaces: `anon` can't read `imos` directly, and every public funnel resolves its
IMO through an `anon`-callable **SECURITY DEFINER** RPC that bypasses RLS. The fix injects the
`access_revoked_at IS NULL` predicate **inside each definer function**, so a revoked IMO behaves
exactly like an unlisted/unknown one (the existing "Link Not Found" / generic-landing renders) —
no new copy, no tell.

**Migration `20260527114910_revocation_public_surface_gate.sql`** (applied LOCAL only; 7 functions
version-tracked) is a faithful `CREATE OR REPLACE` of each live body + the predicate + an idempotent
`GRANT … TO anon`:

- **Real closure** — the functions a specific-IMO public input flows through:
  `get_public_recruiter_info`, `get_public_recruiting_theme` (covers `/join/$recruiterId`, the
  `/join-*` routes, and the custom-domain funnel), `submit_recruiting_lead`, and
  `get_public_invitation_by_token` (`/register/*`; a plpgsql guard after the inviter fetch — a NULL
  `imo_id` super-admin inviter passes through unaffected).
- **Defense-in-depth** — meaningful because FFG is `is_listed=true` locally:
  `get_available_imos_for_join`, `get_agencies_for_join`, `get_public_landing_page_settings`.

`complete-recruit-registration` checks the inviter's IMO `access_revoked_at` **before**
`auth.admin.createUser`, so a revoked org can never spawn an orphan auth account; it returns the
neutral `invitation_not_found`. **`resolve-custom-domain` needs no edit** — it 404s when
`get_public_recruiting_theme` returns null, which the migration now does for a revoked IMO (covered
transitively). **`/slack/name-leaderboard` is NOT public** (auth-gated via `RouteGuard`), so it is
already covered by `SunsetGate` + the Migration B gate. No transactional email references the IMO,
so Part 4 needed no email-copy changes.

**Verification (LOCAL):** dormant unchanged (the FFG funnel still returns "Founders Financial
Group", active); the active path was proven with a `BEGIN; UPDATE imos SET access_revoked_at =
now() …; <call the RPCs>; ROLLBACK;` test that never commits — `get_public_recruiter_info` → 0 rows,
`get_public_recruiting_theme` → null, discovery 2 → 1. (3 pre-existing `deno check` errors in
`complete-recruit-registration`, `rollbackCreatedUser` generic mismatch at lines 326/336, are
unrelated to this change and don't block Deno deploy.)

## Remaining work (not yet built)

The `export ⊆ wipe` parity test is **done** (STEP 5, `src/features/sunset/__tests__/wipe-export-parity.test.ts`).
Remaining: a seeded full rehearsal (STEP 6, on a **staging Supabase project** — the local stack
can't exercise the storage delete/copy or signed-URL download); then batch-deploy all migrations
A–G + the public-surface gate migration (`20260527114910`) + the edge functions to REMOTE (re-run
Migration B + the completeness check there, regen `database.types.ts`).

**Post-code-review (2026-05-27) — fixed in code, runtime verification pending STEP 6:**
- **B1** (was blocking) — frontend detects revocation via the `is_access_revoked` RPC, not the
  gated `imos` read (see the allowlist CORRECTION above).
- **M1** — `confirm-and-wipe-account` runs the guarded wipe RPC **before** the storage purge (a
  mid-flight restore now aborts with storage intact, not an unhealable half-wipe).
- **M2** — `complete-recruit-registration` checks the **effective** target IMO
  (`inviterImoId ?? FFG sentinel`), closing the fail-open when a null/wiped inviter falls back to FFG.
- **M4** — `confirm-and-wipe-account` adopts an orphaned `recovery/{user}/` archive on retry so the
  day-30 GC can reclaim it.
- **M5** (Step-7 pre-flight, NOT a code change) — diff `pg_get_functiondef` on REMOTE for the 7
  public-surface RPCs before `CREATE OR REPLACE` (they're not version-tracked; could revert a newer
  remote body).
- Open: **M6** (billing `/billing` silent-redirect UX), the 4 pre-existing `subscriptionService.test.ts`
  failures, and assorted LOW items — see the code-review doc.

> **REMOTE-DEPLOY PREREQUISITE — Storage DELETE must work on the hosted project** (the irreversible
> wipe depends on it; the local stack couldn't verify it). Before applying ANY of A–G to remote,
> with the **remote** service-role key: `curl -X POST` a throwaway object into an existing bucket
> (e.g. `user-documents`), then `curl -X DELETE` it — **both must 200**. If the DELETE 403s with the
> same `new row violates row-level security policy`, STOP; do not apply migrations or activate
> revocation until the hosted storage delete is resolved.
