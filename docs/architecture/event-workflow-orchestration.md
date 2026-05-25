# Event & Workflow Orchestration

> How a domain action (policy created, commission earned, recruit graduated) becomes
> an executed workflow in Standard HQ — the emit → edge-function → table → cron →
> processor pipeline — plus its delivery, tenant-isolation, and durability gaps.
> There is **no event bus and no temporal.io**; this homegrown pipeline plays that role.

Status: architecture reference. Reconstructed from source on 2026-05-25 (no prior doc existed).

---

## TL;DR

- The system has **one event emitter** (`src/services/events/workflowEventEmitter.ts`),
  a client-side singleton that does not match or execute anything itself — it `POST`s to
  the `trigger-workflow-event` edge function.
- That edge function runs under the **admin client (RLS bypassed)**: it logs the event to
  `workflow_events`, finds matching `workflows`, creates `workflow_runs`, and invokes
  `process-workflow` edge-to-edge.
- A separate cron, `process-pending-workflows`, is a **recovery loop** for runs left in
  `status = 'pending'`. A third runtime, `process-automation-reminders`, is a parallel
  daily cron for pipeline reminders (not part of the event path).
- **Delivery is at-most-once and fire-and-forget**: callers `await emit()` inline with the
  write, there is no outbox, no retry/backoff, and an event is lost if the browser tab
  closes or the edge function 502s.
- **temporal.io is not used anywhere** in the repo. This pipeline is the hand-rolled
  durable-execution substitute it would otherwise replace.

---

## Runtime topology

```
service method (server-orchestrated write)
  └─ workflowEventEmitter.emit(eventName, context)        [client singleton, awaited inline]
       └─ supabase.functions.invoke("trigger-workflow-event")
            ├─ adminSupabase.insert workflow_events {event_name, context, fired_at}   ← RLS bypass
            ├─ adminSupabase.select workflows
            │     WHERE status='active' AND trigger_type='event'
            │       AND config @> {trigger:{eventName}}        ← NO imo_id predicate
            └─ for each matching workflow:
                 ├─ cooldown check vs workflow_runs.started_at (cooldown_minutes)
                 ├─ evaluateConditions(workflow.conditions, context)
                 ├─ adminSupabase.insert workflow_runs {status:'running', trigger_source:`event:${eventName}`}
                 └─ fetch POST /functions/v1/process-workflow  (service-role bearer, edge-to-edge)

process-pending-workflows  [cron]   → picks up workflow_runs WHERE status='pending'
                                       AND started_at >= now-1h, LIMIT 10 → process-workflow
process-workflow           [exec]   → runs WorkflowAction[] sequentially, delays,
                                       Resend email via send-automated-email,
                                       templateVariables (initEmptyVariables pre-seeds 47 keys)
process-automation-reminders [cron] → parallel daily runtime: phase_stall / item_deadline
                                       (NOT the event pipeline)
```

### Event catalog (`WORKFLOW_EVENTS`)
Defined once in `workflowEventEmitter.ts`:
`recruit.created`, `recruit.phase_changed`, `recruit.graduated_to_agent`,
`recruit.dropped_out`, `policy.created`, `policy.approved`, `policy.cancelled`,
`policy.renewed`, `policy.over_30_days_not_issued`, `commission.earned`,
`commission.chargeback`, `commission.paid`, `user.login`, `user.logout`,
`user.role_changed`, `email.sent`, `email.failed`, `email.bounced`,
`lead.pack_purchased`, `lead.conversion_threshold`, `custom.trigger`.

### Emitters (all `await emit()` inline with the originating write)
| Service | Events emitted |
|---|---|
| `policies/policyService.ts` | `POLICY_CREATED`, `POLICY_CANCELLED`, `POLICY_RENEWED` |
| `commissions/CommissionCRUDService.ts` | `COMMISSION_EARNED`, `COMMISSION_PAID` |
| `commissions/chargebackService.ts` | `COMMISSION_CHARGEBACK` |
| `recruiting/recruitingService.ts` | `RECRUIT_CREATED`, `RECRUIT_PHASE_CHANGED`, `RECRUIT_GRADUATED_TO_AGENT`, `RECRUIT_DROPPED_OUT` |
| `lead-purchases/LeadPurchaseService.ts` | `LEAD_PACK_PURCHASED` |

### Tables
- `workflow_events` — append-only event log: `event_name`, `context jsonb`, `fired_at`, `workflows_triggered`. No `imo_id` column; no relationships.
- `workflow_runs` — one row per execution: `status` (`pending`/`running`/...), `trigger_source`, `context jsonb`, `started_at`.
- `workflows` — definition: `status`, `trigger_type`, `config.trigger.eventName`, `cooldown_minutes`, `conditions`.
- `workflow_rate_limits` — per-user daily/hourly caps (`daily_workflow_runs_limit`, `per_workflow_hourly_limit`, etc.).

---

## The repository/service layer it sits on

Standard HQ's data access is a two-tier base-class hierarchy under `src/services/base/`:

- **`BaseRepository<T, CreateData, UpdateData>`** — generic CRUD (`create`, `findById`,
  `findAll`, ...) bound to a `tableName`, using the **anon `supabase` client**, so
  **RLS is the enforced boundary** for every repository read/write. Includes
  `transformToDB` / `transformFromDB` hooks and centralized `handleError`/`wrapError`.
- **`TenantScopedRepository<T>`** — extends `BaseRepository` for IMO-owned tables. Adds
  `tenantColumn = 'imo_id'`, `getDefaultTenantId()` (from `getCurrentTenantContext()`),
  and overrides `findAll` to inject the tenant filter. Its own docstring is explicit:
  *"RLS remains the primary security boundary. This class makes the application default
  match that boundary so super-admin or broad RLS visibility does not accidentally leak
  records into normal screens."*

~40 feature repositories under `src/services/**/repositories/` extend these
(e.g. `WorkflowRepository`, `PolicyRepository`, `CommissionRepository`,
`RecruitRepository`). **The event emitter does not go through this layer** — it is the one
write path that deliberately leaves the RLS-enforced repository world and dispatches to an
admin-client edge function. That asymmetry is the source of the gaps below.

---

## The three gaps (open questions)

### Gap 1 — The dispatch path bypasses RLS, and matching has no tenant predicate
`trigger-workflow-event` uses `createSupabaseAdminClient()` for every operation, and its
workflow-matching query filters only on `status='active'`, `trigger_type='event'`, and
`config @> {trigger:{eventName}}` — **there is no `imo_id` / tenant predicate**, even though
the `workflows` table *has* an `imo_id` column. The match drops the tenant key that the
schema provides. Tenant isolation could only be enforced incidentally, inside each
workflow's generic `conditions` array (`{field, operator, value}` checks against the event
context) — there is no structural guarantee. The source carries the unresolved comment
`// TODO: is bypassing RLS going to be a security issue?`. `workflow_events` has no `imo_id`
column at all, so the event log is not tenant-scoped by schema. Same class as the
"service-layer-only isolation" risk flagged for `commissions`/`chargebacks` in
`multi-tenant-data-isolation.md`, but for the dispatch surface it was undocumented.

**Empirical status (verified 2026-05-25, production):** the cross-tenant *matching* risk is
**latent, not a live leak.** Production has 2 distinct IMOs but the `workflows` table is
**empty (0 rows)** and `workflow_runs` is **empty (0 rows)**, so every emitted event matches
nothing and executes nothing cross-tenant. The trap is armed for the moment two IMOs each
create an active event workflow on the same `eventName` (e.g. both subscribe to
`policy.created`) — the missing `imo_id` predicate would then cross-match. What *is* already
true today: `workflow_events` holds **2,982 rows** (events fire continuously — `policy.created`,
`lead.pack_purchased`, `lead.conversion_threshold`, all with `workflows_triggered = 0`) in a
table with no `imo_id` column, so the event **log** already commingles both tenants' event
contexts. Fix before any multi-tenant workflow authoring ships: add `.eq("imo_id", …)` to the
match query (deriving the tenant from the event context) and add an `imo_id` column to
`workflow_events`.

### Gap 2 — Delivery is at-most-once, fire-and-forget, with no durability
Every emitter `await`s `workflowEventEmitter.emit()` inline with its originating write.
There is **no transactional outbox**, **no retry/backoff**, and `emitBatch()` is a plain
serial `for` loop. Consequences: an event is lost if the browser tab closes between the DB
write and the `invoke` resolving; an edge-function 502/timeout surfaces as a thrown error to
the caller rather than a queued retry; and a successful DB write with a failed emit leaves
the system in a silently inconsistent state (the policy exists, the "policy.created"
workflow never ran). The two-path run model adds ambiguity: `trigger-workflow-event` creates
runs as `status='running'` and invokes `process-workflow` synchronously, while
`process-pending-workflows` only ever picks up `status='pending'` runs younger than one hour
— so which creator produces `pending` runs, and what happens to a run abandoned mid-flight
(left `running`, never retried) is unspecified.

### Gap 3 — Two parallel automation runtimes, no unified model
Workflow execution is split across `process-workflow` (event-triggered, sequential actions
with delays, Resend email) and `process-automation-reminders` (a separate daily cron for
pipeline `phase_stall` / `item_deadline_approaching`), with the pipeline service as a third
template-variable consumer. Only the `process-workflow` runtime pre-seeds all 47 template
variables via `initEmptyVariables()`; the pipeline and reminder runtimes do not, so
unreferenced `{{variables}}` bleed through as raw tags (already noted in
`template-variables.md`). There is no single document or interface defining what an
"automation" is, which runtime owns which triggers, or how rate limits
(`workflow_rate_limits`) apply across them.

---

## Where temporal.io fits — it doesn't (yet)

A repo-wide search (`@temporalio`, `temporal.io`, `temporalio`) returns **zero** results in
`src/`, `supabase/`, `services/`, and `package.json`/`package-lock.json`. The only
`temporal` matches are **temporal-decay scoring** in lead-heat
(`close-lead-heat-score/scoring-engine.ts`, `close-kpi/lib/scoring-math.ts`) — unrelated to
orchestration. temporal.io is therefore **not adopted**, and its absence from the wiki is
correct, not a documentation gap.

The relevance is forward-looking: the `workflow_events` + `process-pending-workflows`
cron-poll loop is a **hand-rolled durable-execution substitute** for exactly the problem
Temporal solves — durable workflows, automatic retries, timers/delays, and
at-least-once/exactly-once semantics. Gaps 1–2 above (no outbox, no retry, abandoned
`running` runs) are the failure modes a durable-execution engine would remove. Adopting
Temporal (or hardening the existing table-poll loop) is an **open architectural decision**,
and the precondition for evaluating it is this document: the current pipeline had to be
written down before the trade-off could be assessed.

---

## Related
- `multi-tenant-data-isolation.md` — RLS boundary, `TenantContext`, service-layer-only isolation risk on `commissions`/`chargebacks` (same class as Gap 1).
- `template-variables.md` — the 47-variable system; only the `process-workflow` runtime pre-seeds keys (Gap 3).
- Source files: `src/services/events/workflowEventEmitter.ts`, `src/services/base/BaseRepository.ts`, `src/services/base/TenantScopedRepository.ts`, `supabase/functions/{trigger-workflow-event,process-pending-workflows,process-workflow,process-automation-reminders}/index.ts`.
