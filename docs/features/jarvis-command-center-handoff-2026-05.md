# Jarvis Command Center — MVP Foundation Handoff (2026-05-28)

**Status:** MVP foundation complete, committed, all automated gates green. Live
end-to-end run + production deploy NOT done (deferred, needs confirmation).
**Branch:** `feat/assistant-command-center` (off `main`), commit `7c3aa3fe`.
**Worktree:** `/Users/nickneessen/projects/commissionTracker-jarvis` (separate from the
main checkout, which a parallel session holds on the sunset branch). Not pushed.

---

## 1. What this is

An embedded, agentic AI "command center" ("Jarvis") inside The Standard HQ, at route
`/command-center`. It is a natural-language interface over **deterministic,
permission-checked tools** so the model gives **grounded** answers and never invents
production/policy/commission numbers. The experience target: "Jarvis, brief me on what
needs my attention today."

It is built as a first-class `features/assistant` module and a set of edge functions —
extractable later, but integrated now.

## 2. Architecture (and why)

The constraints (model must not touch raw tables; no keys/service-role in the browser;
external sends require approval; everything logged) force this shape:

```
Browser (/command-center)
  └─ useSendAssistantMessage → supabase.functions.invoke("assistant-orchestrator")  [user JWT auto-attached]
       └─ assistant-orchestrator (edge fn)
            • createSupabaseClient(authHeader)  → anon key + user JWT ⇒ RLS AS THE USER
            • route → agent (executive-briefing); load prefs; build system prompt + allowed tools
            • Anthropic tool-use loop (capped): model → tool_use → PermissionGuard → tool handler
                 tool handlers call EXISTING RPCs on the user-scoped client (RLS-scoped)
            • persist conversation/messages + redacted tool_calls (user-scoped ⇒ RLS-clean)
       ← { conversationId, agentKey, message, toolActivity, actionRequests }
Approve flow (email/sms):
  draft tool writes assistant_action_requests(status=pending_approval)  [no send]
  → UI approval modal (edit body + confirm recipient) → approve
  → assistant-action-execute: re-verify approved+owned+unexpired → race-safe →executing
       → calls existing send-email / send-sms → log result → executed|failed
```

**Linchpin:** `supabase/functions/_shared/supabase-client.ts createSupabaseClient(authHeader)`
returns an anon-key client carrying the user's JWT, so Postgres RLS applies exactly as in
the browser. Tool handlers therefore call the **existing canonical RPCs** and get automatic
tenant isolation — we reuse computation instead of re-implementing it, and the model never
sees raw tables.

**Reuses, does not add:** Anthropic (`@anthropic-ai/sdk@0.24.0`, secret `ANTHROPIC_API_KEY`,
model `claude-sonnet-4-6`), `send-email` (Mailgun), `send-sms` (Twilio), `_shared/cors.ts`.
**No new secrets.**

## 3. File map

**Backend (`supabase/functions/`):**
- `assistant-orchestrator/index.ts` — auth, agent routing, capped Anthropic tool-use loop
  (`MAX_TOOL_ITERATIONS=10`, ~25s wall-time, ~80k-token budget), redacted logging.
- `assistant-orchestrator/anthropic.ts` — Anthropic bootstrap (mirrors close-ai-builder).
- `assistant-orchestrator/core/` — **pure, esm-free, offline `deno test`-able** safety logic:
  `types.ts`, `registry.ts` (tool metadata), `guard.ts` (`canUseTool`), `state-machine.ts`
  (action lifecycle), `redaction.ts`, `routing.ts`, `agents.ts` (1 wired + 12 stub configs +
  the no-fabrication system rules).
- `assistant-orchestrator/tools/` — handlers typed against a structural `ToolDbClient` (also
  offline-testable): `getDailyBriefingData` (composite fan-out), `getTeamProductionSummary`,
  `getPolicyRiskAlerts`, `draftEmailMessage`, `draftSmsMessage`, plus `index.ts` (binds
  handlers + builds Anthropic tool defs).
- `assistant-action-execute/index.ts` — approval-gated email/SMS send.
- `assistant-voice-token/index.ts` — stub (voice-ready, mints no credential).

**DB:** `supabase/migrations/20260528064814_assistant_foundation.sql` — 5 tables.
Types surgically hand-added to `src/types/database.types.ts` (full regen would leak
local-only schema; see the branch-reorg lesson).

**Frontend (`src/features/assistant/`):** `AssistantPage.tsx`; `components/`
(`CommandCenterLayout`, `TranscriptPanel`, `CommandInput`, `PendingActionsPanel`,
`ActionApprovalModal`, `VoiceOrb` stub, `AssistantSettingsSheet`); `hooks/`
(`useAssistant`, `useAssistantActions`, `useAssistantPreferences`,
`useAssistantVoiceSession`); `types/assistant.types.ts`; barrel `index.ts`.

**Wiring:** `src/router.tsx` (`commandCenterRoute`, `<RouteGuard noRecruits>`),
`src/components/layout/sidebar/sidebar-nav.config.ts` ("Command Center" in "Main",
`public: true`).

**Tests:** `supabase/functions/assistant-orchestrator/**/__tests__/*.test.ts` (Deno),
`scripts/test-assistant-edge.sh`; `src/features/assistant/**/__tests__/*.test.tsx` (Vitest).

## 4. Data model + RLS

5 tables, all RLS-scoped `user_id = auth.uid()`, `imo_id` denormalized for analytics
(no FK), timestamps + `update_updated_at_column()` triggers; enum-like columns are plain
TEXT (no CHECK — project convention, enforced in TS):
`assistant_preferences`, `assistant_conversations`, `assistant_messages`,
`assistant_tool_calls`, `assistant_action_requests`.

Action lifecycle (enforced in `core/state-machine.ts`):
`draft → pending_approval → approved → executing → executed | failed`, plus
`(pending_approval|approved) → cancelled` and `pending_approval → expired` (`expires_at`,
default +24h).

**Applied to LOCAL only.** Remote/prod apply is deferred (see §8).

## 5. Safety invariants

Honest status as of the 2026-05-28 code review — some are DB/test-enforced, some are
edge/prompt-enforced with DB hardening tracked in `plans/active/jarvis-phase2-hardening.md`:

- **Model never touches raw tables** — only the typed tool registry; tools call RPCs on the
  user-scoped (RLS) client. *(Enforced — no raw-table path exists.)*
- **Reads never write** — read-tool handlers perform no inserts. *(Test-enforced with a fake
  client that records calls.)*
- **No send without approval** — the model can only *draft* (writes `pending_approval`);
  `assistant-action-execute` sends only when the row is `approved`, owned, unexpired, after a
  race-safe `approved→executing` transition; the human confirms recipient + body in the modal.
  *(Edge-enforced. CAVEAT (review H1): the lifecycle is enforced in TS only — the UPDATE RLS
  policy lets an owner reset an `executed` row to `approved` via the raw client and re-send
  within 24h. DB-level enforcement + idempotent execution is Tier-0 hardening before prod.)*
- **No fabrication** — every grounding read returns `{ available: bool, ... }` and the system
  prompt forbids inventing numbers. *(The data **shape** is enforced/tested; the model's
  **adherence** is prompt-guided, NOT programmatically verified — review H2.)*
- **Logging is redacted/truncated** — `core/redaction.ts` strips secret-ish *keys* and caps
  string/array size. *(CAVEAT (review M1): redaction is key-name-only — PII in RPC *values*
  (names, premiums) is currently logged in clear; Tier-0 fix tracked.)*

## 6. Decisions (confirmed with the user)

- **Access:** all authenticated users, RLS-scoped per user. Route gated `noRecruits` (recruit-
  only prospects have no production data and are redirected to their pipeline, matching every
  other production feature). Sidebar item is `public: true`.
- **Voice:** architecture + stubs only (no provider, no key).
- **Action proof:** email + SMS draft→approve→send wired (Slack/Discord deferred).
- **Scope:** focused MVP — 1 composite + 2 read tools, 1 wired agent (Executive Briefing); the
  other 12 agents are typed config stubs.
- **Briefing UI:** rendered as the assistant's grounded text (did NOT wire
  `HeroStatStrip`/`KPIGrid` to avoid prop-shape coupling).

## 7. Verification status

**Green (automated):** `npm run build` (tsc+vite), `tsc --noEmit`, ESLint (0 problems —
barrel architecture satisfied), `deno check` ×3 functions, **23 Deno safety tests**,
**7 Vitest tests**, `check-pinned-imports.sh`, Anthropic-SDK runtime-load smoke test.

**NOT done (deferred):** live end-to-end run (real Anthropic round-trip; real email/SMS
send). It needs the local stack + secrets + a session and sends real messages — do it against
a safe test recipient.

## 8. How to review / run / deploy

**Review the diff:**
```
cd /Users/nickneessen/projects/commissionTracker-jarvis
git diff main...HEAD
```
**Run the test suites:**
```
./scripts/test-assistant-edge.sh        # 23 Deno safety tests
npx vitest run src/features/assistant   # 7 Vitest tests
npm run build                           # tsc + vite (matches Vercel)
```
**Live local run:**
```
supabase functions serve assistant-orchestrator assistant-action-execute assistant-voice-token
npm run dev   # open /command-center, sign in, ask "Brief me on what needs my attention today"
```
Then draft + approve an email/SMS to a **safe test recipient** to exercise the send path.

**Deploy (after confirmation — task #13):** apply the migration to remote
(`DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh supabase/migrations/20260528064814_assistant_foundation.sql`),
deploy the 3 edge functions, confirm `ANTHROPIC_API_KEY`/Twilio/Mailgun secrets, and verify
the Mailgun **verified sender** for the from-domain.

## 9. Risks for the reviewer to scrutinize

1. **`acting_imo_id` scoping** — scoping inherits the app's current `get_effective_imo_id()`
   behavior. Super-admin "act as another IMO" cross-tenant briefing is bounded by the separate
   access-token-hook initiative and is OUT of scope here. Confirm a non-super-admin can only
   ever see their own IMO's data through these tools.
2. **Recipient authorization** — for MVP the only guard on *who* an email/SMS goes to is the
   human confirming the recipient in the modal. There is no server-side check that the
   recipient belongs to the user's book. Phase-2 hardening.
3. **Mailgun `from`** — `The Standard HQ <noreply@thestandardhq.com>` must be a verified sender
   on the deployed `MAILGUN_DOMAIN` or mail may land in spam.
4. **JWT lifetime in the loop** — the forwarded user JWT isn't refreshed mid-loop; the loop is
   capped (~25s / 10 iterations) so expiry is unlikely, but worth a look.
5. **Cross-function import** — `assistant-action-execute` imports `../assistant-orchestrator/
   core/{state-machine,redaction,types}.ts` (single source of truth for the state machine).
   Confirm this bundles correctly on `supabase functions deploy`.
6. **Token/cost** — full tool outputs are sent to the model (only logs are redacted). Briefing
   payloads are small; the token budget caps runaway loops.

## 10. Pointers

- Plan: `~/.claude/plans/new-plan-excited-for-binary-reddy.md`
- Memory: `project_jarvis_command_center.md`
- Parallel work (do not disturb): the sunset/FFG-revocation branch in the main checkout.
