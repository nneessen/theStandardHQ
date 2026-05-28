# Jarvis Command Center — Handoff v2 (2026-05-28)

> Supersedes the MVP handoff (`jarvis-command-center-handoff-2026-05.md`). The build is
> **complete and fully hardened on the branch**; the only remaining milestone is the
> production deploy + live end-to-end test. Everything below is **local-only** on
> `feat/assistant-command-center` — nothing is on `main` and nothing is deployed.

## 1. TL;DR — current status

- **Branch:** `feat/assistant-command-center` (separate worktree at
  `/Users/nickneessen/projects/commissionTracker-jarvis`; the main checkout is held by a
  parallel session on the sunset branch — do not touch it).
- **HEAD:** `357b1cb6`. Commit arc this build: `7c3aa3fe` (MVP) → `c60ce102` (Epic-Life gate) →
  `5cdff67d` (Tier-0 H1/M1/L3) → `47d8f009` (M2) → `6ffe8ef3` (H2) → `8021b404` (Production
  Analyst + Policy Risk) → `16d8c9fd` (Lead Prioritization) → `357b1cb6` (remaining 9 agents).
- **All 13 specialist agents wired.** Tier-0 (H1/M1/L3) + Tier-1 (M2/H2) security hardening done.
- **Gates green:** `deno test` 47/47, `vitest` 7/7, `deno check` ×3 fns clean, `npm run build`
  clean, two SQL guard suites pass.
- **Not done:** remote/prod deploy, live E2E (real Anthropic round-trip + real email/SMS),
  `acting_imo_id` propagation (blocked on the JWT access-token-hook initiative), and the optional
  real integrations behind the advisory agents.

## 2. What it is

An embedded agentic assistant at `/command-center` (gated to Epic Life; super-admins bypass). The
`assistant-orchestrator` edge function runs an Anthropic tool-use loop on a **user-JWT-scoped**
Supabase client (`_shared/supabase-client.ts createSupabaseClient(authHeader)`), so every tool's DB
access is RLS-scoped exactly as in the browser. Tools call **existing canonical RPCs** — the model
never touches raw tables. External email/SMS are gated by a human: the model only *drafts*
(`assistant_action_requests(status='pending_approval')`); a person approves in a modal;
`assistant-action-execute` performs the send via the existing `send-email`/`send-sms` functions.

## 3. What's built

### Agents (all 13 wired — `core/agents.ts`)
- **Data agents** (RLS-scoped read tool + draft tools): Executive Briefing
  (`getDailyBriefingData`), Production Analyst (`getTeamProductionSummary`), Policy Risk
  (`getPolicyRiskAlerts`), Lead Prioritization (`getLeadPriorities`), CRM (`getClientSnapshot`),
  Recruiting (`getRecruitingSnapshot`), Coaching (reuses `getTeamProductionSummary`), Data Quality
  (reuses `getDailyBriefingData`, reads `available` flags as gap signals).
- **Advisory/drafting agents** (draft tools only — work from the user's input): SMS/Email Copy,
  Compliance, Calendar, Slack, Workflow. Calendar/Slack/Workflow prompts state plainly they have
  **no** live calendar/Slack/automation connection — they draft copy only.
- **Routing:** `core/routing.ts classifyIntent()` keyword-routes to the matched specialist (a
  general check-in wins first; the generic copywriter is last so a domain request keeps its domain
  agent). `routeToAgent` falls back to Executive Briefing when no specialist matches or the matched
  one isn't enabled. `ALL_AGENT_KEYS` is the default enabled set (orchestrator +
  `useAssistantPreferences`).

### Tools (`tools/`): 1 composite + 5 read + 2 draft
`getDailyBriefingData` (composite), `getTeamProductionSummary`, `getPolicyRiskAlerts`,
`getLeadPriorities`, `getRecruitingSnapshot`, `getClientSnapshot`, `draftEmailMessage`,
`draftSmsMessage`. `getClientSnapshot` deliberately computes a lean book summary and **drops contact
PII** (email/phone/address/DOB/notes) before it reaches the model.

### Security hardening (all DB/edge-enforced + tested)
- **H1** — `assistant_action_requests_status_guard` trigger (migration `20260528090704`, updated by
  `20260528112134`): enforces the lifecycle, rejects fabricated-approval inserts, makes terminal
  rows immutable, fires even under service role. Execution is idempotent (`.is("executed_at", null)`
  claim). **Content freeze:** `recipient`/`draft_payload`/`channel` are immutable once a row leaves
  `pending_approval`.
- **M1** — `summarizeToolOutput()` logs counts + per-section `available` flags only; raw client
  names/premiums/DOB never reach `assistant_tool_calls.output_redacted`.
- **M2** — `assistant_recipient_is_allowed(channel, recipient)` (migration `20260528112134`,
  SECURITY INVOKER → RLS defines the allowed set): blocks sends to anyone who isn't the caller's
  client/lead/teammate. No super-admin bypass during the Epic-Life MVP.
- **H2** — `core/grounding.ts assessGrounding()`: flags + logs (returns
  `grounding.ungroundedNumericWarning`) a turn that states figures while every tool section was
  `available:false`. Annotation, not a block.

## 4. File map

```
supabase/functions/
  assistant-orchestrator/
    index.ts                    # tool-use loop, auth + Epic-Life gate, grounding assessment
    anthropic.ts                # SDK client + model
    core/                       # PURE, offline deno-tested (no esm imports)
      agents.ts                 # 13 agent configs + prompts + ALL_AGENT_KEYS
      routing.ts                # classifyIntent + routeToAgent
      registry.ts               # TOOL_METADATA (category/risk/permissions)
      guard.ts                  # canUseTool permission gate
      state-machine.ts          # action lifecycle TRANSITIONS (mirrored by the DB trigger)
      redaction.ts              # redact() + summarizeToolOutput() (M1)
      grounding.ts              # assessGrounding() (H2)
      access.ts                 # canAccessAssistant() Epic-Life gate
      __tests__/                # routing, grounding, redaction, state-machine, guard, access
    tools/                      # effectful; typed against structural ToolDbClient
      getDailyBriefingData.ts getTeamProductionSummary.ts getPolicyRiskAlerts.ts
      getLeadPriorities.ts getRecruitingSnapshot.ts getClientSnapshot.ts
      draftEmailMessage.ts draftSmsMessage.ts  index.ts  types.ts  __tests__/
  assistant-action-execute/index.ts   # the ONLY send path (approved + recipient-authorized)
  assistant-voice-token/index.ts      # stub (voice deferred — mints no credential)
src/features/assistant/**             # UI, hooks (useAssistant, useAssistantActions, prefs), types
```

## 5. Data model + migrations (5, LOCAL only)

Five tables, all RLS `user_id = auth.uid()`: `assistant_preferences`, `assistant_conversations`,
`assistant_messages`, `assistant_tool_calls`, `assistant_action_requests`. Action lifecycle:
`draft → pending_approval → approved → executing → executed | failed | cancelled | expired`.

Apply **in this order** (remote is NOT yet applied):
1. `20260528064814_assistant_foundation.sql` — 5 tables + RLS + indexes.
2. `20260528090704_assistant_action_status_guard.sql` — H1 lifecycle trigger.
3. `20260528090923_track_get_at_risk_commissions.sql` — L3: captures the out-of-band
   `get_at_risk_commissions` into a tracked migration (no behavior change).
4. `20260528112134_assistant_recipient_authz.sql` — M2 RPC + content-freeze (updates the H1 trigger).
5. `20260528115847_get_lead_priorities.sql` — Lead Prioritization RPC.

`database.types.ts` already covers the 5 tables (added with the MVP). The new RPCs
(`assistant_recipient_is_allowed`, `get_lead_priorities`) are edge-only — the frontend never calls
them — so no regen is required for the build; a post-deploy regen is optional verification.

## 6. Verification status

**Green (automated):** `npm run build` (tsc+vite), `deno check` ×3 functions, **47 deno tests**,
**7 vitest tests**, two SQL guard suites (`scripts/test-assistant-action-status-guard.sh`,
`scripts/test-assistant-recipient-authz.sh`), `scripts/test-assistant-edge.sh`.

**Not yet done:** live E2E — no real Anthropic round-trip, no real email/SMS send, no click-through
of approve→send against a deployed function. This is the core of the next session.

## 7. What's NOT done (next-session backlog)

1. **Production deploy + live E2E** (task #13) — the runbook is §8. Needs the user's explicit
   go-ahead and the Mailgun verified-sender prerequisite.
2. **`acting_imo_id` propagation** — super-admin "act as another IMO" is not reflected in the
   assistant; blocked on the separate JWT access-token-hook initiative.
3. **Advisory-agent real integrations** (optional/future) — Google Calendar (Calendar), Slack API
   (Slack), the workflow engine (Workflow) so they do more than draft copy.

## 8. Deploy runbook (task #13 — needs user go-ahead)

Project ref / id: `pcyaqwodnyrpkaiojnpz`. **Migration runner only — never psql.** Apply each
migration to remote **in the order in §5**:

```bash
source .env && for f in \
  20260528064814_assistant_foundation \
  20260528090704_assistant_action_status_guard \
  20260528090923_track_get_at_risk_commissions \
  20260528112134_assistant_recipient_authz \
  20260528115847_get_lead_priorities ; do
  DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh "supabase/migrations/$f.sql"
done
# Confirm the "Target DB" banner shows REMOTE on each.
```

Deploy the 3 edge functions (they use the user JWT — deploy WITH jwt verification, i.e. no
`--no-verify-jwt`):

```bash
for fn in assistant-orchestrator assistant-action-execute assistant-voice-token ; do
  npx supabase functions deploy "$fn" --project-ref pcyaqwodnyrpkaiojnpz
done
```

Secrets / config to confirm on the deployed project:
- `ANTHROPIC_API_KEY` is set (the orchestrator needs it; `SUPABASE_URL`/`SUPABASE_ANON_KEY` are
  auto-provided).
- Mailgun + Twilio secrets already live in the existing `send-email`/`send-sms` functions
  (the assistant reuses them) — confirm those functions are healthy in prod.
- **Mailgun verified sender** for `noreply@thestandardhq.com` on the deployed `MAILGUN_DOMAIN`
  (the execute fn sends `From: The Standard HQ <noreply@thestandardhq.com>`). If the sender/domain
  isn't verified, email sends will fail — verify before the live test.

Live E2E (the acceptance test):
1. As an Epic Life user, open `/command-center`; send "brief me on what needs my attention" → a
   grounded reply (or honest "no data" per section).
2. Ask a specialist intent (e.g. "who should I call?" → Lead Prioritization; "summarize my book" →
   CRM) and confirm routing + grounded output.
3. Draft an email to one of your own clients → approve in the modal → confirm it sends and the row
   goes `executed`. Then attempt a second execute on the same row → must be **rejected** (H1).
4. Confirm `assistant_tool_calls` carries **no raw PII** (M1) and a drafted send to a non-contact
   address is **blocked** (M2).

## 9. Constraints / gotchas (from CLAUDE.md + this build)

- **Migration runner only** (`./scripts/migrations/run-migration.sh`); never `psql`. Apply local
  AND remote.
- **Never push non-main branches** (Vercel deploys on push). Deploy = remote DB + edge functions;
  the branch only merges to `main` on explicit user decision.
- **Never `--no-verify`** on commits; the husky pre-commit hook (eslint+prettier) must pass.
  Prettier reflows generated/long files — expected.
- Edge functions are **Deno** — validate with `deno check`, not the frontend tsc. The IDE's
  TS server flags Deno globals (`Deno`, the `https://`/`jsr:` imports) as errors — those are
  **false positives**.
- Both reused SECURITY DEFINER RPCs (`get_recruiting_leads_stats`, `get_clients_with_stats`)
  `COALESCE(arg, auth.uid())` and scope to the caller — safe when called scoped to the caller, the
  same bounded pattern as `get_at_risk_commissions`.
- Knowledge vault: the wiki page `wiki/commission-tracker/command-center-assistant.md` is current
  (lint 0). If you produce a new durable doc under `docs/`, sync it (`-p commission-tracker`).
