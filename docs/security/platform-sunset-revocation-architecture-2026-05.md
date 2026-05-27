# Platform Sunset / IMO Access Revocation — Backend Security Architecture

Date: 2026-05-27
Owner: Nick / super-admin
Status: Backend mechanism built and **applied to LOCAL only, fully DORMANT**; remote
deploy + edge functions + frontend still pending. Nothing is activated.

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
| `imos` | `ImoProvider` reads `imos.access_revoked_at` to *detect* revocation |
| `agencies` | embedded in `ImoRepository.findWithAgencies()`'s imo load |
| `data_export_log`, `account_deletion_log` | service-role-only audit (no authenticated access anyway) |

RLS-deny returns **empty sets, not errors**, so a provider that incidentally reads a gated
table degrades gracefully (empty data) rather than crashing; only tables whose *result is
required* for auth/revocation-detection need allowlisting.

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

## Remaining work (not yet built)

Migrations F (recovery archive bucket) + G (daily lifecycle cron); 4 edge functions
(`activate-imo-revocation`, `generate-user-export-bundle`, `confirm-and-wipe-account`,
`account-lifecycle-cron`); the frontend `SunsetGate` + sunset page + RED BUTTON control; the
public/unauthenticated leak-surface closures (custom-domain funnel, public join/register, Slack
leaderboard); the `export ⊆ wipe` parity unit test; a seeded full rehearsal; then batch-deploy
all migrations to REMOTE (and re-run Migration B + the completeness check there).
