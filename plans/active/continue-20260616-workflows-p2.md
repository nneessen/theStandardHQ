# Continue: Workflows redesign + event expansion (P2 done → deferred-P2 / P3 / P4)

> ═══════════════ PASTE-READY CONTINUATION PROMPT ═══════════════
>
> Continue the System Workflows redesign + event expansion on branch **`feat/workflows-redesign`**.
> Read this file first, then `~/.claude/plans/you-completely-half-assed-this-zazzy-wirth.md` (the ~120-event
> catalog + 4-phase plan). **P1 (UI redesign), the P2 engine fix, and P2 Tier-A/B (70 active trigger events
> across 11 categories, 10 batches) are ALL DONE + committed + verified.** Working tree is clean of workflow
> work (any dirty files belong to other sessions — see "Do NOT touch" below).
>
> **Resume at the DEFERRED-P2 edge cases** (the 5 events that each need a product/RPC/server decision — listed
> below), **then P3 (Tier-C webhook events)**, **then P4 (Tier-D cron signal-sweep)**. Use the same per-batch
> recipe. **Do NOT push or open a PR unless I ask.** Commit per batch. Owner is visually picky, wants rich event
> coverage, and wants plain-English UI copy (no jargon).
> ═══════════════════════════════════════════════════════════════

**Branch:** `feat/workflows-redesign` (off `feat/system-workflows-overhaul`). NOT pushed, NOT a PR.
**Plan:** `~/.claude/plans/you-completely-half-assed-this-zazzy-wirth.md` (the ~120-event catalog + 4-phase plan).
**Sweep / discovery specs (file:method:line, recipient, vars, dedupe) — read with `jq '.result'`:**
- 525-candidate sweep: `…/a7f179c4-8125-4174-bbd0-8779d47383e6/tasks/wwdaiy4ov.output` → `.result.events`
- discovery run 1 (7 domains): `…/a7f179c4-…/tasks/wkl4uub78.output` → `.result[]`
- discovery run 2 (recruit-deeper, clients-underwriting): `…/tasks/wbxb5s4v9.output` → `.result[]`
  (base dir: `/private/tmp/claude-501/-Users-nickneessen-projects-commissionTracker/`)

---

## ✅ DONE + committed on this branch
- **P1 UI redesign** (6 commits `1e179036`→`f21e824f`): event-trigger picker rebuild + scalable chips; 4-step
  Create-Workflow wizard; Workflows list (table→card grid + empty state); Event Types tab → Board; Email
  Templates + editor + **wired the AI generator**; deleted dead 1,484-line ActionConfigPanel. Shared
  `src/features/workflows/board.ts` (`tint`, `TRIGGER_ACCENT`, `ACTION_ACCENT`).
  - Minor open: email LIST rows (`TemplateTable` in `EmailTemplatesTab.tsx`) still stock shadcn.
- **P2 engine fix** (`bca672de`, mig `20260616211910`): `enqueue_workflow_event` now injects
  `triggeredBy=created_by` + `workflowName=name` into run context (root bug: event→email NEVER worked — no
  owner in context → `send_email` threw). process-workflow `current_user` falls back to `ownerProfile.email`.
- **P2 Tier-A/B — 70 ACTIVE EVENTS across 11 categories** (from 11), 10 batches:
  | # | commit | events |
  |---|--------|--------|
  | 1 agent | `854877c5` | agent.approved / denied / licensed / contract_level_changed (userService.ts) |
  | 2 policy | `763667da` | policy.approved / active / denied / withdrawn / lapsed (policyService) |
  | 3 commission | `7c085294` | commission.cancelled / chargeback_reversed + chargeback.resolved + override.paid |
  | 4 contracting (new cat) | `b0754f29` | request ×3 + carrier status ×4 + held_under_set |
  | 5 documents (new cat) | `039f3fdd` | uploaded / approved / rejected / all_required_approved (recipient = OWNER) |
  | 6 hierarchy (new cat "Team & Access") | `b504b9c5` | invitation.accepted + join_request ×3 + agency_request ×3 + agency.created / ownership_transferred |
  | 7 recruit-deeper | `adce0819` | pipeline_enrolled / phase_completed[2 sites] / phase_blocked / checklist_item_completed / awaiting_approval / quiz_passed / quiz_failed / onboarding_completed |
  | 8 leads-prospects | `3d820083` | lead.accepted / rejected + lead_pack.roi_updated + prospect.converted / status_changed + instagram.lead_created |
  | 9 clients-underwriting (2 new cats) | `4f7d2457` | client.created + underwriting.rule_set_submitted / approved / rejected |
  | 10 training (new cat) | `ed25be2a` | assignment_created / lesson_completed / quiz_passed / quiz_failed / presentation_submitted / presentation_approved / roadmap_item_completed |
  - **VERIFIED:** drift test (70 events) + `npm run typecheck` + full `npm run build` (0 errors) + full vitest
    **1815 passed / 47 skipped, 0 regressions** + per-batch transactional DB fire-tests. IMO tenant safety
    confirmed (`trigger-workflow-event` derives IMO from caller JWT, NEVER request body).

## 🚀 DEPLOY STEPS (P2 — when owner asks to ship)
1. Apply ALL 10 seed migrations to PROD via `./scripts/migrations/run-migration.sh` (they are LOCAL-only):
   `20260616213823`(agent) `20260617065836`(policy) `20260617070501`(commission) `20260617071320`(contracting)
   `20260617071932`(document) `20260617072713`(hierarchy) `20260617074054`(recruit) `20260617074722`(leads)
   `20260617075237`(client/uw) `20260617075915`(training).
2. **NO `generate:types`** — all 10 are data-only INSERT/UPDATE/DELETE on `trigger_event_types` (no DDL).
3. SPOT-CHECK (plan Part-5): fire ONE event per NEW category, confirm a pending run lands with `recipientId`
   populated. The `as {owner_id?}` casts (prospect/agency/createAgency) + quiz `existing.user_id` + roadmap
   prior-status degrade GRACEFULLY to owner-delivery if a column name is off — non-fatal, no leak, but worth
   the ~6 checks.

---

## ▶️ NEXT — DEFERRED P2 events (each needs a product/RPC/server decision)
- **contracting `sponsorship.{requested,approved,denied}`** — `createSponsorship`/`approveSponsorship` discard
  the RPC return (`const { error }`). Change to `{ data, error }`, then disambiguate "approved" vs the
  final-approve stage via `overall_status` before emitting.
- **contracting `carrier_newly_eligible`** — fan-out to N downline agents → belongs in the Tier-D DB sweep
  (P4), not a single client emit.
- **`invitation.sent` / `recruit.invitation_sent`** — invitee has no `user_profiles` row yet, so recipientId
  can't resolve; recipient is an email. Needs a recipient-by-email path (or skip).
- **`lead.submitted`** — fires from a PUBLIC unauthenticated page; a JWT-gated emitter would 401. Needs a
  server-side emit path (edge fn with explicit p_imo_id).
- **`policy.premium_updated`** — the natural emit site is `useUpdatePolicy` onSuccess (a feature HOOK), but
  eslint blocks importing the emitter from `src/features/**/hooks/**`. Move the emit into a service method, or skip.

## ▶️ THEN — P3 (Tier-C webhook events)
Emit from edge functions with an **EXPLICIT `p_imo_id` (never null)** — no caller JWT in a webhook.
- **billing** via `stripe-webhook` (subscription created/updated/canceled, payment succeeded/failed, etc.)
- **messaging** via `sms-inbound-webhook` / inbound-email / Instagram DM webhooks
- **`kpi.lead_outcome_won` / `kpi.lead_outcome_lost`**, **`training.certification_awarded`**
- Same data-layer recipe but the emit is server-side; thread `recipientId` from the webhook payload's resolved
  agent. Add seed-migration rows + flip catalog entries active.

## ▶️ THEN — P4 (Tier-D cron signal-sweep)
New `workflow-signal-sweep` edge fn + `pg_cron` schedule + an **idempotency ledger** (don't re-fire the same
signal each tick). Derived/threshold signals: license-expiry, goals/targets reached, leaderboard rank change,
persistency thresholds, `document.expiring`, `training.roadmap_completed`, `contracting.carrier_newly_eligible`.
Flips the reserved Tier-D catalog events from declared → active.

---

## 🔁 PER-BATCH RECIPE (proven across all 10 P2 batches)
1. **consts** → `src/lib/workflow-event-names.ts` (in `@/lib` so emitter + features import without crossing the boundary).
2. **catalog** → `src/features/workflows/eventCatalog.ts`: add entries with `availableVariables` = recipient
   var group + `COMMON`. **Recipient vars ONLY** — `AGENT_VARS` (agent_*) or `AGENT` (recruit_name/first/email)
   or `RECRUIT`. Domain values (policyId, carrierId, …) ride in emit context and surface as `context_*` — do
   NOT advertise them as tags. **Zero template-variable-contract changes per batch.**
3. **new category only** → add to picker `CATEGORY_META` (`src/features/workflows/event-picker-meta.tsx`) +
   `EVENT_CATEGORIES` (`src/features/workflows/components/EventTypeManager.tsx`).
4. **seed migration** (new file, `date +%Y%m%d%H%M%S`): `INSERT … ON CONFLICT(event_name) DO UPDATE` the rows
   + `DELETE … WHERE event_name NOT IN (<full growing whitelist>)`. Apply via `run-migration.sh`. Get current
   rows: `./scripts/migrations/run-sql.sh "SELECT event_name FROM trigger_event_types ORDER BY 1;"`
5. **emit wiring** — in a SERVICE (`src/services/**` or `src/features/**/services/**`), AFTER the mutation's
   success branch. `recipientId` = the AFFECTED person's `user_profiles.id`. `emit()` never throws (catches
   internally) → inherently non-fatal, but still capture-before-mutate for transition events to avoid double-fire.
6. **drift test** → `src/features/workflows/__tests__/eventCatalog.test.ts`: update the exact-equality "active
   events are the N currently-emitted ones" assertion (sorted event-name list).
7. **VERIFY:** `npx vitest run eventCatalog` (drift) → `npm run typecheck` → periodically full `npm run build`
   + full `npm run test:run` → optional transactional DB fire-test → commit.

## 🧷 GOTCHAS / CONSTRAINTS
- **recipientId drives BOTH delivery AND template-var population** — engine fetches that profile, fills
  `agent_*`/`recruit_*` tags. Wrong id = wrong recipient.
- **Tenant from JWT, never body** — omitting `organizationId` in emit context is CORRECT.
- **`workflows.trigger_event_name` is GENERATED** = `config->'trigger'->>'eventName'`. To seed a test workflow,
  set `config:{"trigger":{"eventName":X}}` — you cannot insert the column directly.
- **eslint boundary:** `src/services/**` and `src/features/**/services/**` MAY import the emitter;
  `src/features/**/hooks/**` may NOT. Cross-feature deep imports (e.g. `@/features/workflows/board` from
  training-hub) are also blocked → inline the value there.
- **Deno edge-fn `never`-type / "Cannot find module" TS diagnostics are FALSE positives** — run
  `deno check --config supabase/functions/deno.json supabase/functions/<fn>/index.ts` (authoritative).
- **Migrations:** NEVER psql; ALWAYS `./scripts/migrations/run-migration.sh` (tracks function_versions, blocks downgrades).
- **`generate:types` targets PROD** → defer `database.types.ts` regen to deploy. P2 needs none (data-only).
- **NEVER read `database.types.ts` whole** — `node scripts/dbtype.mjs <name>`.
- **NEVER touch real auth logins.** Playwright harness uses `.env.local` E2E creds (epiclife.neessen@gmail.com);
  venv `/tmp/wfvenv/bin/python`; shots → `/tmp/wf-shots`. Local dev: `npm run dev` (port 3000, also serves edge fns).
- **Useful IDs:** Epic imo `2fd256e9-9abb-445e-b405-62436555648a`; super-admin owner
  `d0d3edea-af6d-4990-80b8-1765ba829896` (epiclife.neessen@gmail.com); an Epic agent
  `58a7bb4f-06e8-4e67-a72e-2cad84eb57f3`.
- **Commit per batch; push/PR only when owner asks.**

## ⛔ Do NOT touch (other sessions' uncommitted work in the tree)
`src/services/commissions/CommissionRepository.ts`, `docs/system-prompts/highValueAddOns.md` (deleted),
`docs/inbound-lead-feature/`, `docs/todo/edge-functions-check.md`,
`plans/active/MASTER-implementation-plan-20260617.md`, `plans/active/auth-security-hardening-plan-20260617.md`,
`plans/active/continue-20260616-system-workflows.md`, `scripts/gen-integration-response-docx.cjs`,
`supabase/migrations/20260617064225_guard_user_profiles_admin_columns.sql`. These are the inbound-lead + auth
hardening tracks — leave them as-is.
