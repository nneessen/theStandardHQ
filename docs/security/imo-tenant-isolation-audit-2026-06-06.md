# IMO Tenant-Isolation Audit & Unification — 2026-06-06

## Why

Owner reported FFG carriers / products / commission rates appearing under the
Epic Life IMO and required **zero cross-IMO bleed-over**: "logging in under an
email should show that email's IMO — nothing from Founders should be visible
under Epic Life."

## Root cause (not data corruption)

Verified on prod, data-at-rest was already clean (Epic Life: 1 carrier, 1
product, 0 rates; 0 NULL-`imo_id` rows anywhere). The bleed was a **super-admin
session artifact** with two mechanisms:

1. **App layer disagreed with RLS about "current IMO."** `getCurrentTenantContext()`
   read `user_profiles.imo_id` directly and ignored the super-admin `acting_imo_id`,
   so every default-tenant read/write was hardwired to the home IMO (FFG), while
   RLS scoped by `get_effective_imo_id()`.
2. **"See-all" was the silent default.** With `acting_imo_id = NULL`, the sidebar
   "Own IMO" option wrote NULL to auth metadata → RLS `super_admin_in_scope()`
   returned every IMO's rows for policies/commissions/clients/expenses/overrides/
   leads; carriers/products/comp_guide were pinned to home FFG.

For any **normal (non-super-admin) user, RLS was already airtight** — an Epic
Life agent sees only Epic Life. Epic Life simply has 0 users, so the whole
experience was the FFG super-admin's see-all session.

## Fix (one selector, honored at every layer)

- **`getCurrentTenantContext()`** now mirrors `get_effective_imo_id()`:
  super-admin → `acting_imo_id` (from `user_metadata`), everyone else → home imo.
  App layer and RLS can no longer drift.
- **`ImoContext`** kills the silent see-all default: "Own IMO" resolves to the
  home IMO (RLS scopes to one tenant); a new explicit **"All IMOs"** sentinel is
  the only path to cross-tenant view.
- **One global switcher** (sidebar). The per-page IMO dropdowns in
  Carriers/Products/Commission-Rates management were removed (incl. the
  commission-rates default-to-FFG); all three scope to `effectiveImoId`. The
  in-form IMO pickers were removed (RLS `WITH CHECK` already pins inserts to the
  acting IMO).
- **Root hooks** `useCarriers` / `useActiveCarriers` / `useSearchCarriers` key on
  `effectiveImoId` and call `getAllForImo`, so policy/KPI/analytics surfaces show
  the selected IMO only.

## Full service-layer audit (file-by-file)

`scripts/check-tenant-isolation.sql` asserts every RLS-enabled `public` base
table is read-scoped to a tenant predicate. First run flagged 18 tables; triage:

- **16 legitimately global** → allowlisted with rationale (service-role-only,
  super-admin-only, global RBAC/reference catalogs, global singleton config).
- **2 real latent gaps** → `communication_consent` and `communication_suppression`
  carried `imo_id` but were `SELECT USING (true)` (any authenticated user could
  read every IMO's consent/suppression PII; 0 rows, no live exposure). Fixed in
  migration `20260606171027` with the carriers SELECT predicate. Safe: no
  authenticated-client read path exists (all access via SECURITY DEFINER /
  service-role functions that bypass RLS).

Tripwire now returns **0 rows** on prod.

## Guarantee scope (precise)

- **Normal (non-super-admin) users: airtight, zero cross-tenant bleed.** They
  never reach the `super_admin_in_scope` branch; RLS pins every tenant table to
  their own IMO. This is the hard security guarantee.
- **Super-admin "scope to one IMO": best-effort, client-side.** It depends on
  `ImoContext` writing `acting_imo_id = home` on login (and on switch). That
  write is hardened (re-syncs on `user.imo_id`) but tolerates a failed metadata
  write; if it ever fails, the super-admin's OWN view falls back to see-all on
  the `super_admin_in_scope` tables (policies/commissions/clients/expenses/
  overrides/leads). This is a UX/accuracy fallback for the operator, NOT a
  cross-tenant leak to another tenant.

## Verification

- `scripts/check-tenant-isolation.sql` → 0 ungated tables (prod). The 6
  `SELECT true` allowlisted tables were column-checked: none carry
  `imo_id`/`user_id`/`agency_id` (genuinely global).
- `npm run typecheck` + `eslint` clean; `npm run build` green; 1647 unit tests
  pass (incl. new `TenantContext.test.ts`).
- Empirical, rolled-back RLS probes on prod (as the super-admin, per acting state):
  - carriers: `acting=EpicLife` → 1 (Aflac); `acting=FFG` → 14.
  - policies (`super_admin_in_scope`): `acting=NULL` (old default) → 15 across 2
    IMOs (the bleed); `acting=FFG` → 5 (1 IMO); `acting=EpicLife` → 0.
- Owner-run E2E: log in, switch the sidebar selector to Epic Life, confirm every
  surface shows Epic Life only; "All IMOs" shows the cross-tenant banner.

## Out of scope (intentionally)

- No blanket app-layer `imo_id` filters on RLS-protected repos (would hide
  legitimate `imo_id IS NULL` rows; redundant with RLS).
- No RLS rewrite — `get_effective_imo_id()` semantics are correct; the app was
  aligned to them.
