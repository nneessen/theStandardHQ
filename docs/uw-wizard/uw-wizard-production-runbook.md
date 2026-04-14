# UW Wizard Production Runbook

## Scope

This runbook covers the backend-authoritative UW Wizard path:

- Edge functions:
  - `run-underwriting-session`
  - `save-underwriting-session`
- Core persistence RPC:
  - `public.persist_underwriting_run_v1(uuid, jsonb, jsonb, jsonb)`
- Read-model RPCs:
  - `public.list_my_underwriting_sessions_v1(integer, integer, text)`
  - `public.list_agency_underwriting_sessions_v1(integer, integer, text)`

Authoritative UW runs persist into:

- `public.underwriting_sessions`
- `public.underwriting_session_recommendations`
- `public.underwriting_rule_evaluation_log`

## Source Of Truth

- Browser input is not authoritative.
- The backend run result is authoritative.
- PostgreSQL is the persisted source of truth.
- Authorization is enforced in PostgreSQL with RLS and restricted RPC grants.

## Required Runtime State

The following migrations must be present in production:

- [20260309143000_harden_underwriting_session_persistence.sql](supabase/migrations/20260309143000_harden_underwriting_session_persistence.sql)
- [20260309174500_backend_authoritative_underwriting_run.sql](supabase/migrations/20260309174500_backend_authoritative_underwriting_run.sql)
- [20260309190500_lock_down_authoritative_underwriting_persist.sql](supabase/migrations/20260309190500_lock_down_authoritative_underwriting_persist.sql)
- [20260309201500_disable_direct_underwriting_audit_rpc.sql](supabase/migrations/20260309201500_disable_direct_underwriting_audit_rpc.sql)
- [20260310113000_underwriting_session_history_read_models.sql](supabase/migrations/20260310113000_underwriting_session_history_read_models.sql)
- [20260310152000_harden_underwriting_runtime_access.sql](supabase/migrations/20260310152000_harden_underwriting_runtime_access.sql)

Expected deployed functions:

- [run-underwriting-session/index.ts](supabase/functions/run-underwriting-session/index.ts)
- [save-underwriting-session/index.ts](supabase/functions/save-underwriting-session/index.ts)

## Request Tracing

Both authoritative edge functions emit and return a request id.

- Response header: `X-Request-Id`
- JSON field: `requestId`

Frontend surfaces the request id through:

- [useDecisionEngineRecommendations.ts](src/features/underwriting/hooks/wizard/useDecisionEngineRecommendations.ts)
- [useUnderwritingSessions.ts](src/features/underwriting/hooks/sessions/useUnderwritingSessions.ts)
- [UnderwritingWizard.tsx](src/features/underwriting/components/Wizard/UnderwritingWizard.tsx)

Structured edge-function log markers:

- `[run-underwriting-session] started`
- `[run-underwriting-session] completed`
- `[run-underwriting-session] failed`
- `[save-underwriting-session] started`
- `[save-underwriting-session] completed`
- `[save-underwriting-session] failed`

## First Response Checklist

When a UW run/save incident is reported:

1. Capture the `requestId` from the UI or network response.
2. Capture the affected user id, IMO, and approximate timestamp.
3. Confirm whether the failure occurred during:
   - authoritative run
   - authoritative save
   - session history list
   - session detail open
4. Check edge-function logs for the matching `requestId`.
5. If a session was saved, inspect `underwriting_sessions.evaluation_metadata`.

## Core Validation Queries

### Find the saved authoritative session by request id

```sql
select
  id,
  created_at,
  created_by,
  result_source,
  run_key,
  selected_term_years,
  evaluation_metadata
from public.underwriting_sessions
where evaluation_metadata ->> 'requestId' = '<request-id>';
```

### Validate normalized recommendations exist

```sql
select
  session_id,
  recommendation_rank,
  carrier_name,
  product_name,
  eligibility_status,
  monthly_premium,
  annual_premium,
  score
from public.underwriting_session_recommendations
where session_id = '<session-id>'
order by recommendation_rank asc;
```

### Validate evaluation logs exist

```sql
select
  session_id,
  condition_code,
  predicate_result,
  matched_conditions,
  missing_fields,
  outcome_applied,
  input_hash,
  evaluated_at
from public.underwriting_rule_evaluation_log
where session_id = '<session-id>'
order by evaluated_at asc;
```

## Expected Security Surface

After [20260310152000_harden_underwriting_runtime_access.sql](supabase/migrations/20260310152000_harden_underwriting_runtime_access.sql):

- `persist_underwriting_run_v1`:
  - `service_role` execute only
- `save_underwriting_session_v2`:
  - no public runtime execute grants
- `log_underwriting_rule_evaluation`:
  - no public runtime execute grants
- `list_my_underwriting_sessions_v1`:
  - `authenticated` execute only
- `list_agency_underwriting_sessions_v1`:
  - `authenticated` execute only

Expected `underwriting_sessions` policies:

- `sessions_select` only

Expected `underwriting_rule_evaluation_log` policies:

- `eval_log_select` restricted to rows whose `session_id` resolves to a session the caller can access

## Hosted Smoke Checklist

Run these after deploys affecting UW persistence, RPCs, or session history:

1. Sign in as a standard UW-enabled user.
2. Run a full underwriting flow.
3. Save the authoritative result.
4. Open `My Sessions`.
5. Verify:
   - the saved session appears
   - pagination works
   - search works
   - detail open works
6. Reopen the saved session and confirm:
   - `result_source = backend_authoritative`
   - exact face amounts are preserved
   - recommendations match the saved run
7. Sign in as an IMO admin or qualified upline.
8. Open agency session history.
9. Verify:
   - accessible subordinate sessions are visible
   - unrelated peer/other-agency/other-tenant sessions are not visible

## Common Failure Modes

### `invalid_payload`

Likely causes:

- stale or tampered authoritative envelope
- client payload drift
- missing required raw wizard fields

Check:

- edge-function log for the request id
- whether the saved input matches the signed envelope

### `evaluation_failed`

Likely causes:

- rule/rate/product data issue
- unexpected null or missing underwriting input
- backend evaluation exception

Check:

- `run-underwriting-session` logs
- recommendation/rule context loading for the actor's IMO

### `save_failed`

Likely causes:

- persistence RPC failure
- grant/policy drift
- session/recommendation/audit row contract mismatch

Check:

- `save-underwriting-session` logs
- `persist_underwriting_run_v1` grants
- whether a partial session row was written

## Rollback Guidance

If a deploy introduces UW regression:

1. Stop new traffic to the broken app version if possible.
2. Check whether the failure is:
   - UI-only
   - edge-function-only
   - migration/grant-related
3. If the issue is UI-only:
   - roll back the frontend build first
4. If the issue is edge-function-only:
   - redeploy the last known good function bundle
5. If the issue is grant/policy-related:
   - do not hot-edit in the dashboard
   - ship a corrective migration

Do not re-open direct client write paths as a rollback shortcut.

## Local Validation Commands

DB integration coverage:

```bash
npm run test:uw:db
```

Current DB-backed underwriting coverage includes:

- replayability of authoritative runs
- session-history read-model behavior
- underwriting runtime grant/session-access hardening

## Known Gap

Local schema bootstrap is still not fully reproducible from an empty Supabase database. That is a separate platform issue and does not change the hosted runtime security model verified above.
