# RPC Batch 00 Rollout Commands (Staging -> Production)

Date: 2026-02-14

This runbook applies only to:
- `supabase/migrations/20260214113000_drop_rpc_batch00_candidates.sql`
- `supabase/migrations/reverts/20260214_001_restore_rpc_batch00_candidates.sql`

## Important

- Use `scripts/migrations/run-migration.sh` for schema migrations.
- Do not run Batch 01+ until Batch 00 is stable for 24-48 hours.
- The migration runner reads `DATABASE_URL` from `.env`.
  - Before each environment run, confirm `.env` points at that environment.

## 0) Verify Local Repo State

```bash
git status --short
```

Confirm these files are present:

```bash
ls -1 \
  supabase/migrations/20260214113000_drop_rpc_batch00_candidates.sql \
  supabase/migrations/reverts/20260214_001_restore_rpc_batch00_candidates.sql \
  scripts/migrations/rpc-batch00-preflight.sql \
  scripts/migrations/rpc-batch00-postcheck.sql
```

## 1) Staging Preflight

Point `.env` to staging `DATABASE_URL`, then run:

```bash
./scripts/migrations/run-sql.sh -f scripts/migrations/rpc-batch00-preflight.sql
```

Expected:
- dependency query returns 0 rows
- missing function list is acceptable (empty or known missing)

If dependency rows appear, stop and do not apply Batch 00.

## 2) Apply Batch 00 to Staging

```bash
./scripts/migrations/run-migration.sh supabase/migrations/20260214113000_drop_rpc_batch00_candidates.sql
```

## 3) Staging Postcheck

```bash
./scripts/migrations/run-sql.sh -f scripts/migrations/rpc-batch00-postcheck.sql
```

Expected:
- `remaining_function_name` query returns 0 rows
- `backup_function_rows` > 0
- `schema_migrations` includes version `20260214113000`

## 4) Staging Smoke Tests

Validate critical paths:
- Admin user actions (approve/deny/pending/profile)
- Clients hierarchy/IMO client pages
- Gmail sync ingestion path
- Alerts and scheduled jobs (no `42883` missing function errors)

## 5) Production Apply (After Staging Pass)

Point `.env` to production `DATABASE_URL`.

Run preflight:

```bash
./scripts/migrations/run-sql.sh -f scripts/migrations/rpc-batch00-preflight.sql
```

Apply migration:

```bash
./scripts/migrations/run-migration.sh supabase/migrations/20260214113000_drop_rpc_batch00_candidates.sql
```

Postcheck:

```bash
./scripts/migrations/run-sql.sh -f scripts/migrations/rpc-batch00-postcheck.sql
```

## 6) Emergency Rollback (Staging or Production)

If errors spike after Batch 00:

```bash
./scripts/migrations/run-sql.sh -f supabase/migrations/reverts/20260214_001_restore_rpc_batch00_candidates.sql
```

Then re-run postcheck:

```bash
./scripts/migrations/run-sql.sh -f scripts/migrations/rpc-batch00-postcheck.sql
```

## 7) Monitoring Window

Monitor for 24-48h before next batch:
- Postgres error code `42883`
- Edge Function failures invoking RPCs
- API error rate / admin workflow regressions

Proceed to Batch 01 only after this window is clean.
