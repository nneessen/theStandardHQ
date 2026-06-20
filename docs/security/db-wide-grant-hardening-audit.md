# DB-wide Grant Hardening — Audit & Scoping

**Status:** SCOPING ONLY — nothing here is applied. Follow-up to the inbound-CRM grant fix
(`20260620062216`, shipped to prod). **Date:** 2026-06-20.

## Finding

The inbound-CRM tables were not unique: the over-granting is **database-wide**. Measured on the
local schema (mirrors prod structure — *re-verify on prod before any change*):

| Metric | Count (of 211 public tables) |
|---|---|
| Grant `authenticated` **TRUNCATE** | **202** |
| Grant `authenticated` INSERT | 203 |
| Grant `anon` TRUNCATE | 202 |
| Grant `anon` INSERT | 202 |
| Grant `anon` SELECT | 202 |
| RLS enabled | 209 |
| **No RLS at all** | **2** (`rate_limits`, `test_workflows_real`) |

## Key insight — why you CANNOT just "revoke everything"

The app is a Supabase/PostgREST app: the frontend writes directly to **nearly every table** as the
`authenticated` role (203 tables grant INSERT), with **RLS** scoping each user to their own rows.
So a blanket `REVOKE INSERT/UPDATE/DELETE FROM authenticated` would break most of the application.
The inbound-CRM tables were a special case (all writes go through SECURITY DEFINER RPCs), which is
why their fix could revoke CRUD too.

The privileges that are **safe to revoke everywhere** are the ones the app never uses through
PostgREST *and* that bypass or are irrelevant to RLS:

- **`TRUNCATE`** — empties a whole table, **bypasses RLS entirely**, not exposed by PostgREST. This is
  the cross-tenant data-destruction vector. Never legitimately used by `anon`/`authenticated`.
- **`REFERENCES`, `TRIGGER`** — DDL-adjacent; not used by app roles.

## Tiered remediation plan

### Tier 1 — TRUNCATE/REFERENCES/TRIGGER, DB-wide (LOW risk, HIGH value) — recommended first
Revoke `TRUNCATE, REFERENCES, TRIGGER` from `anon` + `authenticated` on **all** public tables, and set
default privileges so new tables don't reintroduce it. Closes the cross-tenant-wipe vector across the
whole DB. The app does not use these privileges, so nothing breaks. **Also drop the world-open leftover
`test_workflows_real`** (no RLS + `anon` can SELECT *and* INSERT — already flagged in the auth audit;
`rate_limits` is fine — no RLS but no role grants either).

Draft (NOT applied — verify on prod, apply via `run-migration.sh` during low traffic, `lock_timeout`):
```sql
SET lock_timeout = '5s';
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
DROP TABLE IF EXISTS public.test_workflows_real;   -- world-open test leftover
```
TEST: confirm no app feature uses TRUNCATE (it can't via PostgREST) — a smoke pass of the app +
`npm run build` is sufficient; nothing functional should change.

### Tier 2 — `anon` grants review (MEDIUM)
`anon` (unauthenticated) holds full CRUD+SELECT on 202 tables. RLS blocks the rows for most, but the
grants are unnecessary surface. A handful of tables legitimately need `anon` (signup path, public
config/read). Action: enumerate the tables that genuinely need `anon` access, then revoke `anon` CRUD
from the rest. Requires per-table review — do NOT blanket-revoke (would break signup/public reads).

### Tier 3 — `authenticated` direct CRUD → RPC-only, per feature (LARGE, LOW priority)
For sensitive tables that *should* be written only through SECURITY DEFINER RPCs (money/auth/contract
logic), revoke direct `authenticated` CRUD and route writes through RPCs — as the inbound-CRM tables
already do. This is a per-feature hardening, not a sweep; RLS already gates these, so it is defense-in-
depth, not an open hole. Lowest priority.

## Process (every tier)
PLAN (this doc) → TEST (apply LOCAL, verify no breakage + a positive smoke) → REVIEW (independent
audit of the migration + side effects) → SHIP (verify prod preconditions, apply via the runner during
low traffic, post-verify). Same cycle used for the inbound-CRM fix.

## Open questions for the owner
1. Approve **Tier 1** (the safe quick win + dropping `test_workflows_real`)?
2. Want Tier 2/3 scoped into concrete per-table lists, or parked?
