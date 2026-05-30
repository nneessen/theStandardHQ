Insurance Sales KPI & Recruiting & Agency Management System
React 19.1 • TypeScript • Supabase/Postgres

═══════════════════════════════════════════════════════════════════════════════
MANDATORY MIGRATION RULES - READ FIRST - NEVER VIOLATE
═══════════════════════════════════════════════════════════════════════════════

**NEVER run psql directly for migrations or function changes.**
**ALWAYS use the migration runner script.**

```bash
# ✅ CORRECT - Always use this for migrations
./scripts/migrations/run-migration.sh supabase/migrations/YYYYMMDDHHMMSS_name.sql

# ❌ WRONG - NEVER do this
psql $DATABASE_URL -f supabase/migrations/whatever.sql
source .env && psql "${DATABASE_URL}" -f migration.sql
```

| Task             | Command                                                              |
| ---------------- | -------------------------------------------------------------------- |
| Apply migration  | `./scripts/migrations/run-migration.sh supabase/migrations/FILE.sql` |
| Run a query      | `./scripts/migrations/run-sql.sh "SELECT ..."`                       |
| Interactive psql | `./scripts/migrations/run-sql.sh --interactive`                      |
| Create timestamp | `date +%Y%m%d%H%M%S`                                                 |
| Verify tracking  | `./scripts/migrations/verify-tracking.sh`                            |
| Audit functions  | `./scripts/migrations/audit-critical-functions.sh`                   |

WHY: On Feb 3, 2026, direct psql usage caused old migrations to silently overwrite
fixed functions. The runner script blocks downgrades and tracks everything.

═══════════════════════════════════════════════════════════════════════════════

MACHINE RULES (TOP-LEVEL CHECKLIST)

These rules must be followed for every task.

Types Sync Required

If any change touches schema, migrations, enums, policies, or DB logic:
Run
npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
Commit the updated file.

Quick Check Required Before Producing Final Code

Run (mentally or explicitly): type-check, unit tests, and dependency checks.

CI performs full npm run build. Code must compile with zero TypeScript errors.

No Mock Data in Production Code

Dev-only mocks allowed only behind DEV_FEATURE_MODE flag.

CI must fail if mock imports appear in src/\*\*.

Naming Conventions

Components: PascalCase

Files: kebab-case

Functions/vars: camelCase

No exceptions.

Functional UI Required

No placeholders, no fake states, no dead elements.

Every rendered UI must connect to Supabase data or derive from real inputs.

Decision Rules for Asking Questions
Ask clarifying questions only when the task is ambiguous and touches one of:

DB schema

Auth or permissions

Migrations

Contract/commission logic

Reusable component or system-wide pattern
Otherwise: proceed directly.

Continue Previous Work Automatically

If ACTIVE_SESSION_CONTINUATION exists and is <72hrs old: continue without asking.

Otherwise follow normal decision rules above.

No Over-Engineering

Implement what is required, nothing additional.

Keep abstractions minimal and local unless shared patterns already exist.

PROJECT ARCHITECTURE
/src/features/_ Domain features (policies, commissions, recruiting, email, etc.)
/src/components/_ Reusable UI primitives
/src/routes/_ TanStack Router routes & loaders
/src/services/_ Business logic & Supabase access
/src/hooks/_ TanStack Query hooks
/src/lib/_ Utilities (date, currency, calculations)
/src/types/_ TypeScript types (database, entities)
/supabase/migrations/_ SQL migrations only
/docs/_ Docs & architecture notes
/plans/_ Active plans; completed plans in /plans/completed/
/scripts/\* Utility scripts

Rules:

No .md files in project root.

database.types.ts is always source of truth.

NEVER read `src/types/database.types.ts` whole (~162k tokens). A PreToolUse hook
(`scripts/hooks/guard-dbtypes.mjs`) blocks whole-file reads via Read AND bulk Bash
(cat/sed/head/...). Use the slicer instead — works for tables, views, functions, enums:

```bash
node scripts/dbtype.mjs <name>                       # one block, ~hundreds of tokens
node scripts/dbtype.mjs --list [tables|views|functions|enums]   # just the names
```

Targeted `Read` with both `offset` and `limit` (<=500) is still allowed.

All feature code self-contained and testable.

UI & DESIGN STANDARDS

Compact, professional, data-dense layout:

Minimal padding/margins (Tailwind 1/2/3 scale)

Small readable text

Muted palette; subtle borders and shadows

Prefer tables over cards for lists

Inline editing preferred over modals

Desktop-optimized but responsive

No unnecessary animations

High information density without clutter

DEVELOPMENT STANDARDS

1. Schema & Migrations

**MANDATORY: Use the migration runner script for ALL migrations:**

```bash
./scripts/migrations/run-migration.sh supabase/migrations/YYYYMMDDHHMMSS_name.sql
```

DO NOT use `psql` directly for migrations. The runner script:

- Tracks migrations in schema_migrations
- Tracks function versions in function_versions
- BLOCKS downgrades (prevents older migrations from overwriting newer functions)
- Validates filename format

For arbitrary SQL queries (not migrations), use:

```bash
./scripts/migrations/run-sql.sh "SELECT * FROM users;"
./scripts/migrations/run-sql.sh -f /path/to/script.sql
./scripts/migrations/run-sql.sh --interactive
```

Migration file format: YYYYMMDDHHMMSS_description.sql
Generate timestamp: `date +%Y%m%d%H%M%S`

Only one directory: supabase/migrations/

After migration:

1. Regenerate database.types.ts
2. Fix type errors
3. Run npm run build

No CHECK constraints on enums; enforce via TypeScript.

CRITICAL: Function Version Protection

The system tracks function versions in `supabase_migrations.function_versions`.
When a migration contains CREATE FUNCTION, the runner:

1. Checks if function exists with a NEWER version
2. BLOCKS the migration if it would downgrade
3. Updates function_versions after successful apply

This prevents the bug where old migrations silently overwrite newer function code.

To verify function versions:

```bash
./scripts/migrations/verify-tracking.sh
./scripts/migrations/audit-critical-functions.sh
```

See memory: MIGRATION_VERSIONING_PROBLEM for full details.

2. Supabase Data Rules

All business data stored in Supabase.

TanStack Query for cache/state.

LocalStorage only for: theme + sidebar + auth tokens.

Absolutely no business data in browser storage.

3. Testing

100% passing unit tests (Vitest).

No mocked DB responses in production code.

Test financial logic thoroughly (commissions, splits, chargebacks).

4. Reusability

Before writing new code, check existing feature directories for reusable components/services/hooks.

If duplicates exist, refactor into a shared module.

5. Edge Cases

Always consider:

Null/undefined DB values

Missing relations

Time zone boundaries

Commission contract changes mid-year

Negative balances/chargebacks

Persistency calculations over time ranges

Recruiting pipeline incomplete phases

Email sending failures and retry logic

WORKFLOW

1. Before writing code:

Resolve ambiguity only if rule #6 requires it.

Inspect relevant feature directories.

Load database.types.ts to ensure accurate typing.

Audit for reusable patterns.

2. When coding:

No placeholders.

Real data only.

Strict TypeScript.

Follow naming + design standards.

Use TanStack Query for all data operations (load, mutate, cache).

3. When finishing:

Regenerate DB types if needed.

Ensure type errors = zero.

Provide final files changed + exact code blocks.

No stubs or “TODOs”.

DEPLOYMENT & VERIFICATION (STRICT MODE)

Vercel uses strict type checking. Build failures block production.

Required before considering any task “done”:

Types regenerated if schema changed.

Run npm run build with zero errors.

Verify UI renders without runtime errors.

Ensure no imports of mock/test modules in production code.

PR & SESSION OUTPUT FORMAT

Every deliverable (code, plan, updates) must contain:

Summary

Files touched

Changes made

DB impact (if any)

Edge cases addressed

Test coverage notes

Next steps (if applicable)

AUTO-RESUME

When context nears limits, create ACTIVE_SESSION_CONTINUATION with the exact next-step instructions so the next session can continue uninterrupted.

When a new session starts, check continuation state (<72hrs). If present, resume task automatically.

CRITICAL AUTH FLOWS - DO NOT BREAK

Password Reset Flow (FRAGILE - READ BEFORE TOUCHING AUTH)

The password reset flow has strict requirements due to Supabase redirect whitelisting:

1. ALL password reset redirectTo URLs MUST use `/auth/callback`, NEVER `/auth/reset-password`
2. The flow is: Email Link → Supabase → /auth/callback → /auth/reset-password
3. Files involved:
   - src/index.tsx (early hash capture - DO NOT REMOVE)
   - src/features/auth/AuthCallback.tsx (recovery type handler)
   - src/features/auth/ResetPassword.tsx (form with fallbacks)
   - src/contexts/AuthContext.tsx (resetPassword function)
   - src/features/admin/components/EditUserDialog.tsx (send confirmation)
   - supabase/functions/send-password-reset/index.ts
   - supabase/functions/create-auth-user/index.ts

AFTER ANY AUTH CHANGES, TEST:

- Login → Forgot Password → Click email link → Must see reset form (NOT dashboard)
- Admin → Edit User → Actions → Send Confirmation → Click link → Must see reset form

See memory file: CRITICAL_password_reset_flow.md for full documentation.

FINAL PRINCIPLES

Minimalism

Consistency

Complete tasks

No half-steps

No speculative abstractions

Always functional, testable, type-safe code

- add to memory: place active session files in plans/active/... not the root dir.

═══════════════════════════════════════════════════════════════════════════════
PROJECT KNOWLEDGE BASE (OBSIDIAN WIKI) - READ BEFORE UNFAMILIAR WORK
═══════════════════════════════════════════════════════════════════════════════

A synthesized knowledge base for this codebase lives in a shared, multi-project
Obsidian vault at `../_knowledge-vault/`, under the `commission-tracker` namespace.
It is the fastest way to get oriented on history, prior decisions, and known gaps
that are not obvious from the code alone. (Read ONLY the `commission-tracker`
namespace unless you are deliberately looking for cross-project patterns.)

- Wiki (`../_knowledge-vault/wiki/commission-tracker/`): LLM-maintained synthesis.
  Start at `index.md`, then open the relevant topic page (security-multi-tenancy,
  data-layer-rpc-migration, carrier-rules-contracts, hierarchy-architecture,
  underwriting-wizard, billing-stripe, ...).
- Raw sources (`../_knowledge-vault/raw-sources/commission-tracker/`): an immutable
  snapshot of THIS repo's `docs/` that the wiki summarizes.

DIRECTION (do not reverse): `docs/` here is the single source of truth. The vault
is strictly DOWNSTREAM — it only consumes and summarizes `docs/`. Never copy wiki
pages back into this repo as canonical, and never edit `raw-sources/` files.

READ trigger: before non-trivial work in an unfamiliar feature area, check the
matching wiki page first.

UPDATE trigger: when a task produces a durable new doc/handoff/audit under `docs/`,
sync the vault afterward (all scripts take `-p commission-tracker`):

1. Copy the new doc into `../_knowledge-vault/raw-sources/commission-tracker/` (flat, exact basename).
2. Fold it into the right `wiki/commission-tracker/` topic page + append a `log.md` entry + bump `index.md` `updated:`.
3. Run `../_knowledge-vault/scripts/wiki-lint.sh -p commission-tracker` (must exit 0).
   Run `../_knowledge-vault/scripts/wiki-sync-check.sh -p commission-tracker` anytime to list docs not yet synced.

═══════════════════════════════════════════════════════════════════════════════
REMINDER: MANDATORY MIGRATION RULES - NEVER VIOLATE
═══════════════════════════════════════════════════════════════════════════════

**NEVER run psql directly for migrations or function changes.**

```bash
# ✅ CORRECT
./scripts/migrations/run-migration.sh supabase/migrations/YYYYMMDDHHMMSS_name.sql

# ❌ WRONG
psql $DATABASE_URL -f migration.sql
```

| Task             | Command                                                              |
| ---------------- | -------------------------------------------------------------------- |
| Apply migration  | `./scripts/migrations/run-migration.sh supabase/migrations/FILE.sql` |
| Run a query      | `./scripts/migrations/run-sql.sh "SELECT ..."`                       |
| Interactive psql | `./scripts/migrations/run-sql.sh --interactive`                      |
| Verify tracking  | `./scripts/migrations/verify-tracking.sh`                            |

═══════════════════════════════════════════════════════════════════════════════
