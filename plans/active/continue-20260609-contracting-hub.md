# ACTIVE — Contracting Hub continuation (2026-06-09)

Approved plan: `~/.claude/plans/hi-in-the-business-parallel-zephyr.md`. Concept **C** chosen.
Owner decisions: override → **alternate sponsor's leg**; audience → **all approved agents**; alert scope → **direct reports only**.

## DONE this session (backend — applied to LOCAL only, verified)
4 migrations written + applied locally + tracked in function_versions:
- `20260609203445_contracting_set_carrier_contract_status_rpc.sql` — `set_carrier_contract_status(p_agent_id,p_carrier_id,p_status,p_writing_number)`. approved/denied/terminated → upline/staff/super-admin; submitted/pending → agent-self (eligibility-gated) or manager.
- `20260609203545_contracting_eligibility_alert_and_newly_eligible.sql` — AFTER trigger `notify_downline_carrier_eligible` on carrier_contracts (transition into approved → notify DIRECT reports, `carrier_eligible`); `get_newly_eligible_carriers()` self-only RPC.
- `20260609203645_contracting_sponsorship_requests.sql` — table `carrier_sponsorship_requests` + RPCs `create_sponsorship_request`/`approve_sponsorship_request`/`cancel_sponsorship_request`. RLS SELECT-only (participants), revocation_deny, imo_id scoped. On final approval: sets `override_recipient_id=alternate_sponsor_id`, upserts requester pending carrier_contracts row, notifies (`sponsorship_request`/`sponsorship_decision`).
- `20260609203845_override_alternate_sponsor_attribution.sql` — `create_override_commissions()` + `regenerate_override_commissions()` seed the CTE with the alternate sponsor when an approved sponsorship exists for (agent,carrier) AND `policy.effective_date >= sponsorship.approved_at` (prospective-only). Else normal upline. Math otherwise unchanged.

Verified: `scripts/smoke-contracting-sql.sql` (transactional, rolls back) — TEST1/1b alert→direct only, TEST2/2b/2c self-submit gating, TEST3 two-approval, **TEST4 sponsored→alt-sponsor leg, TEST4b pre-approval→normal upline**. ALL PASS.
- Mig D (RBAC grant) DROPPED: `agent` is a system role; `prevent_system_role_permission_changes` blocks it. Audience handled in frontend instead (below).
- Pre-existing benign warning during policy insert: "Audit trigger error … no field agent_id" (overrides still generate correctly).

## NEXT (do in order)

> ⚠ SEQUENCING (advisor): do NOT apply migrations to prod before the frontend ships.
> Mig B's trigger is global on `carrier_contracts` — the existing `AgentCarrierContractsCard`/
> `toggle_agent_carrier_contract` flow already flips carriers to `approved` in prod, so the
> moment Mig B is on prod it emits `carrier_eligible` notifications whose `metadata.link`
> → `/contracting?tab=mine` (a route that won't render as the hub until the frontend exists =
> live notifications with dead links). Phase 2 is type-neutral (only replaces two function
> bodies, identical signatures → no `database.types.ts` change), so prod-apply is NOT needed
> to unblock types or the frontend. Apply all FOUR migrations to prod as ONE go-live step WITH
> the frontend deploy (step 4).

### 1. Types for the frontend
Build against local types. Either fix the pre-existing local/prod `imo_id` drift on carriers/comp_guide (so `gen-types-local.sh` is clean), or run `gen-types-local.sh` and ignore the 5 unrelated `imo_id` errors during dev. The COMMITTABLE types come from `npm run generate:types` at go-live (after prod-apply). New objects (`carrier_sponsorship_requests`, `set_carrier_contract_status`, `create_sponsorship_request`, `approve_sponsorship_request`, `cancel_sponsorship_request`, `get_newly_eligible_carriers`) are already present in local-gen.

### 2. Phase 3 — frontend `src/features/contracting/` (Concept C). NO dead buttons; everything wired.
Rework `ContractingPage.tsx` → new `ContractingHubPage` (delete orphaned `ContractingDashboard` route use; recruit-onboarding contracting already lives in recruiting `RecruitDetailPanel > ContractingTab`).
Primitives (verified): `SectionShell` `@/components/v2`; header `Cap`+tokens `T` `@/components/board`; tabs `PillNav` `@/components/v2` (or LicensingHubPage button-row); tables `@/components/ui/table`; `EmptyState` `@/components/board`; toasts `sonner`.
Pagination (copy `ContractingDashboard.tsx`): `PAGE_SIZE=50`, service `.select(...,{count:'exact'}).range(from,to)`, `placeholderData:keepPrevious`, inline Prev/Next (`ChevronLeft/Right`), `useEffect(()=>setPage(1),[filters,search])`.
Reuse verbatim (signatures in plan): `InlineEditableCell`, `ContractingFilters`(`ContractingFilterState`), `BulkActionToolbar`, `BulkStatusChangeDialog`.
Layout: Action Center (newly eligible from `get_newly_eligible_carriers()` → "Start request" calls `set_carrier_contract_status(self,carrier,'submitted')`; Approvals inbox = sponsorship rows awaiting me, Step1/Step2 chain, Approve/Deny → `approve_sponsorship_request`). My Downline (only if `has_downlines()`): roster (full subtree `hierarchyService.getMyDownlines()`, paginated) → per-agent detail table, upline edits status/writing# inline. My Contracting (own table read-only status; "Request different upline" modal — needs a NEW agent carrier picker, NOT recruiting's recruit-scoped AddCarrierDialog).
Editability matrix: My Contracting status cells READ-ONLY (only Start/Submit/Request-different-upline actionable); My Downline detail = editable for the upline.
Notifications: extend `NotificationType` + `NotificationMetadata` in `src/types/notification.types.ts`; add `getNotificationIcon` cases in `src/components/notifications/NotificationItem.tsx` for `carrier_eligible`/`sponsorship_request`/`sponsorship_decision`; deep-link via `metadata.link` (already set to `/contracting?tab=...` by the RPCs/trigger).
Hooks/service: feature-local `contractingService` methods calling the RPCs + a paginated `carrier_sponsorship_requests` query; hooks `useNewlyEligibleCarriers`, `useMyContracts`, `useDownlineRoster`, `useAgentContractDetail`, `useSponsorshipInbox`, `useSetContractStatus`, `useCreateSponsorship`, `useApproveSponsorship`.
Modal disclosure copy (honest, override ships with this): "Override on this carrier's business will roll up your alternate sponsor's leg for business written after approval."

### 3. Phase 4 — nav + route + audience
- `src/components/layout/sidebar/sidebar-nav.config.ts`: add `{icon: FileCheck, label:"Contracting", href:"/contracting", public:true}` to the **business** group (~lines 86–119). (`public:true`, like Licensing — NOT a permission, since the RBAC grant is blocked.)
- `src/router.tsx` `contractingRoute` (~line 832): change guard from `permission="nav.contracting_hub"` → `noRecruits` only (drop the permission so all non-recruit agents access); add `validateSearch` for `?tab=mine|downline|approvals` (pattern: `theStandardTeamRoute` ~957–979); point at `ContractingHubPage`.

### 4. Verify
- `npx tsc` + `npm run build` + eslint + vitest green.
- `scripts/smoke-contracting.py` (Playwright/REST) on throwaway `@epiclife-demo.test` only — **NEVER real accounts** ([[feedback_never_touch_real_accounts_use_env_local]]): alert path, two-approval inbox, money path. Run the app: `/contracting` renders, no console errors, no dead buttons.
- Obsidian: update `wiki/commission-tracker/carrier-rules-contracts.md`, `hierarchy-architecture.md` (alt-sponsor override + re-parent gap), `commissions-overrides.md` (carrier-scoped seed + prospective rule); add `docs/` doc; `/ingest` + `wiki-lint.sh -p commission-tracker` to 0.

### 5. GO-LIVE (owner-gated; money + global trigger) — ONE step with the frontend deploy
```
# all four, in order, to prod:
DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh supabase/migrations/20260609203445_contracting_set_carrier_contract_status_rpc.sql
DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh supabase/migrations/20260609203545_contracting_eligibility_alert_and_newly_eligible.sql
DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh supabase/migrations/20260609203645_contracting_sponsorship_requests.sql
DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh supabase/migrations/20260609203845_override_alternate_sponsor_attribution.sql
npm run generate:types && npx tsc --noEmit && npm run build   # committable types from prod
```
Then commit + push (per [[feedback_autocommit_merge_to_main]]: land on main + push main). Override change is dormant until a sponsorship is approved (identical behavior otherwise).

## Mockups (owner-reviewed, throwaway): `mockups/contracting/` (a/b/c + index).
