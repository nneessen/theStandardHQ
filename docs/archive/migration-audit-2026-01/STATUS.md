# Migration Audit (2026-01-17) — STATUS: RESOLVED

The Jan 17 audit identified a migration-naming/downgrade bug where older migrations could silently overwrite newer function code.

## Resolution

The migration workflow is now enforced via `scripts/migrations/run-migration.sh`, which:
- Tracks migrations in `supabase_migrations.schema_migrations`
- Tracks function versions in `supabase_migrations.function_versions`
- **Blocks downgrades** — refuses to apply migrations that would overwrite newer function versions
- Validates `YYYYMMDDHHMMSS_description.sql` filename format

See: root `CLAUDE.md` → "MANDATORY MIGRATION RULES" section for the enforced workflow.

## Verification

```bash
./scripts/migrations/verify-tracking.sh
./scripts/migrations/audit-critical-functions.sh
```
