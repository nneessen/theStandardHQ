# Phase 3 — Realtime Agent Screen-Pop + Live Intake (`InboundCallProvider`)

**Status:** Not started. **Planned date:** TBD (after Phase 2 is deployed to prod).

The frontend half of the inbound-call flow, plus the **working intake form** the agent uses while
on the call — modeled on the Salesforce CRM Epic Life agents use today. Phase 2 writes an
`inbound_calls` row on every incoming call; Phase 3 is the React layer that (a) listens to those
writes over Supabase realtime and pops a dialog to the assigned agent, and (b) lets the agent work
the caller: confirm identity, pick the **carrier they're calling in from**, set the **call type**
(cash surrender, consolidation, …), take **notes**, and **submit a new application** that lands on
the Policies page as a `pending` policy.

> ⚠️ Scope change from the first draft: this phase is **no longer "frontend only / no DB objects."**
> The intake needs **one small additive migration** on `inbound_calls` (3 nullable columns) + a
> SECURITY DEFINER disposition RPC. Everything else **composes existing tables, repositories, and
> TanStack hooks** — almost nothing here is net-new data plumbing.

---

## 1. What to build

| Component | Path (proposed) | Role |
|---|---|---|
| `InboundCallProvider` | `src/contexts/InboundCallContext.tsx` | App-wide provider; one realtime channel per authenticated agent; holds active-call state |
| `InboundCallDialog` | `src/features/inbound-crm/components/InboundCallDialog.tsx` | The pop shell (caller header + dismiss); hosts the intake form |
| `InboundIntakeForm` | `src/features/inbound-crm/components/InboundIntakeForm.tsx` | Identity • carrier • call type • notes • "Submit application" → pending policy |
| `useInboundCallDisposition` | `src/features/inbound-crm/hooks/useInboundCallDisposition.ts` | TanStack mutation → `crm_set_call_disposition` RPC (call_type / notes / inquiry carrier) |
| Migration | `supabase/migrations/<ts>_inbound_crm_phase3_intake.sql` | 3 nullable cols on `inbound_calls` + disposition RPC + agent UPDATE path (see §4) |
| Mount point | `src/index.tsx` | Wrap inside `AuthProvider`, alongside `NotificationProvider` |

No new routes. **Reuses** `useCreateOrFindClient`, `useCarriers`, `useCreatePolicy`, and the call-type
settings repository (`kpi_call_types`).

---

## 2. Realtime mechanics

### Subscription
Follow the `NotificationContext` pattern exactly:
1. In a `useEffect` keyed on `user?.id`, create a named channel: `supabase.channel(`inbound-call:${user.id}`)`.
2. One `.on("postgres_changes", { event: "INSERT", schema: "public", table: "inbound_calls", filter: `agent_id=eq.${user.id}` }, …)`.
3. `.subscribe()`; track `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`.
4. Cleanup: `supabase.removeChannel(channel)` on unmount / `user.id` change.

No client-side tenant filter is needed: the `inbound_calls_select_own` RLS policy
(`USING (agent_id = (select auth.uid()) AND imo_id = get_my_imo_id())`) means realtime only delivers
rows this agent may read — so every INSERT that arrives is already this agent, this tenant.

### INSERT handler
On each payload (`payload.new` typed as the Phase-0 `inbound_calls` row):
- If `patch_only === true` → a billing record arrived with no resolved call; **skip the pop**.
- Otherwise set `activeCall`. Provider exposes `{ activeCall, dismiss }`.

### Dismiss on call end
A second `.on("postgres_changes", { event: "UPDATE", … })`: when `payload.new.status === 'ended'`,
clear `activeCall` automatically (the billing PATCH is the end-of-call signal). `dismiss()` also lets
the agent close it manually — it only clears local state, never writes the DB.

### Singleton
One pop per agent at a time (owner decision). A second INSERT while one is open **replaces** the
active call (simpler than a queue; concurrent calls to one agent shouldn't occur in normal operation,
and the newest is the actionable one).

### Offline / not-logged-in agents
No fallback — live-session-only. If the agent isn't logged in, the `inbound_calls` row still exists
(Phase 2 wrote it) but no pop fires; they see it later in call history (Phase 4). No push/email/badge.

---

## 3. Intake form — data model & flows

Every field below maps to an **existing** table unless marked **NET-NEW**. The form composes the
existing repositories/hooks (see §5); components never call `supabase` directly.

### a) Caller identity — `clients` (reuse)
`name`, `phone`, `email`, `address`, `date_of_birth`, `state`, `status`, `notes`.
The pop's `client_id` (set by Phase 2's POST — matched or newly created under the AoR agent) links
the call to the agent's own-book client. Edit via `ClientRepository`/`ClientService`; the find-or-create
on a brand-new caller already happened server-side, surfaced here via the client record.

### b) Carrier "calling in from" — `carriers` (reuse) + **NET-NEW** call column
Dropdown source = `carriers` (`id, name, code, is_active, imo_id`) via `useCarriers`, filtered to the
agent's imo + `is_active`. The selection (the carrier the client currently has / is calling about) is
**context on the call**, distinct from a *new application's* carrier → store as
**NET-NEW `inbound_calls.inquiry_carrier_id` (nullable FK → carriers)**.

### c) Call type — `kpi_call_types` (reuse) + **NET-NEW** call column
"Cash surrender / consolidation / …" already exists as the settings-managed **`kpi_call_types`** table
(`CallTypeRepository`/`CallTypeService`, admin UI `CallTypesManagement.tsx`). Reuse it as the dropdown;
add any missing inbound dispositions through that existing settings screen. Store the choice as
**NET-NEW `inbound_calls.call_type_id` (nullable FK → kpi_call_types)**.

### d) Notes — **NET-NEW** call column (+ show client notes for context)
Per-call notes belong to the call → **NET-NEW `inbound_calls.notes` (text, nullable)**. Render the
existing `clients.notes` read-only alongside for history; an explicit "save to client" action can copy
into `clients.notes` via `ClientRepository` if the agent wants it persisted on the client.

### e) New application → **pending policy** — `policies` + `useCreatePolicy` (reuse)
"Agent submitted a new application" → create a `policies` row with **`status: 'pending'`** through the
standard `useCreatePolicy` → `policyService.create`. The hook already invalidates
`policyKeys.lists()/count()/metrics()`, so **the application appears on the Policies page live** — no
extra wiring. Product dropdown = `products` (filtered by chosen carrier).

`CreatePolicyData` essentials to capture in the pop: `clientId`, `carrierId`, `product`, `productId?`,
`submitDate`, `effectiveDate`, `annualPremium`, `monthlyPremium`, `paymentFrequency`,
`commissionPercentage`, optional `policyNumber`/`termLength`/`notes`, `status: 'pending'`.

> 💰 **Financial behavior (verified in `policyService.create`).** Creating a policy **always** seeds a
> commission record (`status: 'pending'`, `type: 'advance'`, 9-month) — by design, because a policy
> with no commission "breaks all metrics," and `create` *rethrows* on commission failure. comp_guide
> auto-calc is paused (manual entry): it uses the agent's entered `commissionPercentage` as the rate
> override, and a **blank comp yields a $0 advance row, not an error.** So a mid-call "pending
> application" creates a **pending, $0-if-blank advance placeholder — not a premature payout**; it
> resolves on status transitions (approve/deny/withdraw in `updatePolicy`).
> **Do NOT bypass `policyService.create`** to "skip" the commission (that breaks the every-policy-has-a-
> commission invariant + metrics). **To verify before shipping:** confirm `pending`-status policies and
> their `pending` advance commissions are **excluded from earned/paid production metrics** (so working a
> call can't inflate earnings). This is a metrics-display check, not a create-path change.

### f) Disposition write path (RLS) — see §4
`inbound_calls` today only has a SELECT RLS policy (writes go through the M2M service-role RPCs). The
agent setting call_type / notes / inquiry carrier needs a controlled write path.

---

## 4. Migration (small, additive)

`supabase/migrations/<ts>_inbound_crm_phase3_intake.sql` (atomic `BEGIN…COMMIT`, follows the
`REVOKE FROM PUBLIC, anon, authenticated` + grant-to-`authenticated`/`service_role` convention):

- `ALTER TABLE public.inbound_calls`
  - `ADD COLUMN call_type_id uuid REFERENCES public.kpi_call_types(id) ON DELETE SET NULL` (nullable)
  - `ADD COLUMN inquiry_carrier_id uuid REFERENCES public.carriers(id) ON DELETE SET NULL` (nullable)
  - `ADD COLUMN notes text` (nullable)
  - All three nullable-without-default → **metadata-only, no table rewrite**.
- **`crm_set_call_disposition(p_request_tag text, p_call_type_id uuid, p_inquiry_carrier_id uuid, p_notes text)`**
  — SECURITY DEFINER, `search_path=public`. Updates ONLY those 3 columns on the caller's OWN call
  (`WHERE request_tag=p_request_tag AND agent_id = auth.uid() AND imo_id = get_my_imo_id()`). Grant
  EXECUTE to `authenticated` (and revoke from public/anon). Preferred over a broad
  `inbound_calls UPDATE` RLS policy because Postgres RLS can't column-restrict — the RPC stops an
  authenticated client from rewriting `status`/`billable`/`agent_id`.
- Regenerate `database.types.ts` after applying (now the inbound tables ARE on prod, the new columns
  belong in types).

---

## 5. Architecture — repository layer + TanStack (reuse map)

Follow the established pattern: **repositories** (extend `BaseRepository`/`TenantScopedRepository`) →
**TanStack Query hooks** → components. The pop composes existing pieces; no raw `supabase` in the UI.

| Need | Repository (exists) | Hook (exists / thin-new) |
|---|---|---|
| Caller identity / find-or-create | `clients/client/ClientRepository` | `useCreateOrFindClient` |
| Carrier dropdown | `settings/carriers/CarrierRepository` | `useCarriers` |
| Call types | `settings/call-types/CallTypeRepository` (`kpi_call_types`) | thin `useCallTypes` if absent |
| Products (by carrier) | `settings/products/ProductRepository` | existing product hooks |
| New application → pending policy | `policies/PolicyRepository` → `policyService` | `useCreatePolicy` (status `'pending'`) |
| Call disposition write | new `crm_set_call_disposition` RPC | new `useInboundCallDisposition` |

TanStack: all reads/mutations through Query; the create/disposition hooks invalidate the right keys so
the Policies page + the pop reflect changes live. (See the vault's TanStack table/query reference for
the call-history table grid in Phase 4.)

---

## 6. Verification plan (local)
1. Seed an agent + pcId (`crm_register_agent_pcid`); log in as that agent in a browser.
2. Fire `scripts/crm-simulate-inbound.sh` (or `crm-mock-caller.ts` POST with that pcId) → pop appears < ~1s.
3. In the pop: set carrier + call type + notes → confirm `crm_set_call_disposition` persists them on the row.
4. Submit a new application (status `pending`) → confirm it appears on the **Policies page** and a
   **`pending` advance commission** row exists (not a paid/earned one).
5. Fire the billing PATCH → pop auto-dismisses.
6. Second POST while a pop is open → replaces (not stacks). Unknown pcId → no pop. Log out → no pop, no JS error.
7. `npm run build` zero TS errors; financial check: pending policy/commission excluded from earned metrics.

## 7. Deploy
- Apply the Phase 3 migration (§4) via the runner; regenerate + commit `database.types.ts`.
- Phase 2's `crm-leads` must be deployed first (it writes the rows Phase 3 consumes).
- Realtime on `inbound_calls` (publication + `REPLICA IDENTITY FULL`) is already on prod from Phase 0.
- Frontend = standard Vercel push.

## 8. Out of scope
Phase 4 (Clients page — own-book + per-client call history grid), Phase 5 (observability / PII-retention
/ hardening), Phase 1b (credential + pcId admin UI).

## 9. Open questions / decisions
- **Proposed & baked into this doc** (confirm before building): per-call notes on `inbound_calls.notes`
  (client notes shown read-only); call types reuse `kpi_call_types`; inquiry carrier as call context
  (`inquiry_carrier_id`); pending app via the standard `useCreatePolicy` path.
- **Pending-application required fields:** how much to force mid-call. `useCreatePolicy` needs premiums +
  payment frequency + comp %. Option: capture essentials and let comp default to blank ($0 advance) for
  fill-in later — but confirm that's acceptable vs requiring comp up front.
- **Metrics guardrail (must verify):** `pending` policies + `pending` advance commissions excluded from
  earned/paid production dashboards.
- **Rehydration on reconnect:** on socket reconnect, query open calls (`status <> 'ended'`,
  `agent_id = user.id`; index `idx_inbound_calls_agent_open` supports it) to restore a missed pop —
  Phase 3 or defer to Phase 5.
