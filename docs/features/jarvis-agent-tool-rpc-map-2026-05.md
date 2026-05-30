# Jarvis — Agent → Tool → RPC/Endpoint Map (2026-05-30)

Reference map of the `assistant-orchestrator` edge function: the 13 specialist
agents, the tools each may call, and the exact data source (RLS-scoped Postgres
RPC, live Close REST endpoint, or approval-gated write) behind every tool.

Source files: `supabase/functions/assistant-orchestrator/core/agents.ts`
(registry + per-agent `allowedToolNames`), `core/routing.ts` (intent → agent),
`tools/*.ts` (one file per tool), `close/provider.ts` (per-user Close key seam).

## Architecture in one paragraph

Each user message is keyword-classified by `classifyIntent()` to **exactly one**
specialist agent (no parallel fan-out); unmatched messages fall back to
**Executive Briefing**. The chosen agent runs a capped Anthropic tool-use loop
(`MAX_TOOL_ITERATIONS=10`) with **only** the tools in its `allowedToolNames`.
Internal data tools call existing canonical RPCs through a **user-JWT-scoped**
Supabase client (`ctx.db`), so every read is RLS-scoped exactly as in the
browser — the model never sees raw tables. Close tools instead hit the **live
Close REST API** via a read client bound to the caller's own decrypted Close key.
All outbound writes are **drafts only**: they insert an `assistant_action_requests`
row with `status='pending_approval'`; a human approves in the UI and
`assistant-action-execute` performs the real send/write.

## Tool → data-source map

### Internal data tools — RLS-scoped Postgres RPCs (`ctx.db.rpc`, user JWT)

| Tool | RPC(s) called | Args |
|------|---------------|------|
| `getDailyBriefingData` | **composite, 5 RPCs in parallel** (`Promise.allSettled`): `get_team_leaderboard_data`, `get_at_risk_commissions`, `get_user_commission_chargeback_summary`, `get_recruiting_leads_stats`, `avg_lead_heat_score` | `{}`, `{p_user_id}`, `()`, `{}`, `{p_user_id}` |
| `getTeamProductionSummary` | `get_team_leaderboard_data` | `{p_start_date?, p_end_date?}` (both optional) |
| `getPolicyRiskAlerts` | `get_at_risk_commissions` + `get_user_commission_chargeback_summary` (parallel) | `{p_user_id, p_risk_threshold}` / `()` |
| `getLeadPriorities` | `get_lead_priorities` | `{p_user_id, p_limit}` (limit default 10) |
| `getClientSnapshot` | `get_clients_with_stats` | `{}` |
| `getRecruitingSnapshot` | `get_recruiting_leads_stats` | `{}` |

Every read tool returns `{ available: boolean, ... }`. On error or empty result
it returns `available:false` with a `reason` (`unavailable`, `no_team_data`,
`no_lead_data`, …); the agent must report the gap, never fabricate. `ctx.userId`
comes from the verified JWT — the model can never supply a user id.

### Close CRM tools — live Close REST API (per-user key, NOT `ctx.db`/RLS)

Key seam (`close/provider.ts`): the orchestrator runs on the user JWT, but
`get_close_api_key(p_user_id)` is **service_role-only** and returns an *encrypted*
key. `createCloseProvider(userId)` captures `userId` in a closure (no model/tool
param), uses a service-role client **solely** to fetch + `decrypt()` the key for
`ctx.userId`, then hands the tool a read-only client bound to that key
(`bindCloseReadClient`). Raw key never leaves that file. Local dev honors a shared
`CLOSE_API_KEY` env only when `ENVIRONMENT=local`.

| Tool | Close REST endpoint (GET) | Notes |
|------|---------------------------|-------|
| `searchCloseLeads` | `/lead/?query=…&_limit=…&_fields=id,display_name,status_label,date_created,date_updated` | Lookup by name → name + Close lead id + status |
| `getCloseLeadSnapshot` | `/lead/{id}/?_fields=id,display_name,status_label,contacts,opportunities,date_created,date_updated` | By id, or by name (searches first via `leadSearchPath`). Contacts reduced to **presence counts**, never raw email/phone |
| `getCloseLeadActivity` | `/activity/?lead_id=…&_limit=…&_fields=…` | Type + date + direction only; no message bodies |
| `getCloseOpportunities` | `/opportunity/?status_type=active&_fields=…&_limit=…` | Open opps, most-stalled first |

Unavailable reasons surface the real cause: `close_not_connected` (no active
`close_config` row), `close_auth_failed` (expired/invalid key), `no_match`.

### Draft / write tools — approval-gated inserts (no live send)

All four insert one `assistant_action_requests` row with
`status='pending_approval'`; nothing is sent by the model. A human approves in the
UI and `assistant-action-execute` performs the real action (email/SMS via
`send-email`/`send-sms`; note/task via the Close write client).

| Tool | `channel` written | Payload |
|------|-------------------|---------|
| `draftEmailMessage` | `email` | subject + body |
| `draftSmsMessage` | `sms` | body |
| `draftCloseNote` | `close_note` | Close lead id + note text |
| `draftCloseTask` | `close_task` | Close lead id + text + optional due date (YYYY-MM-DD) |

## Agent → tools matrix

`DRAFT_TOOLS = [draftEmailMessage, draftSmsMessage]` is appended to every agent
except Data Quality (read-only diagnostic).

| Agent (key) | Data tools | Draft tools |
|-------------|-----------|-------------|
| Executive Briefing (`executive-briefing`, default/fallback) | `getDailyBriefingData`, `getTeamProductionSummary`, `getPolicyRiskAlerts` | email, sms |
| Production Analyst (`production-analyst`) | `getTeamProductionSummary` | email, sms |
| Policy Risk (`policy-risk`) | `getPolicyRiskAlerts` | email, sms |
| Lead Prioritization (`lead-priority`) | `getLeadPriorities` | email, sms |
| CRM (`crm`) | `getClientSnapshot` | email, sms |
| Close CRM (`close`) | `searchCloseLeads`, `getCloseLeadSnapshot`, `getCloseLeadActivity`, `getCloseOpportunities` | email, sms, **close_note**, **close_task** |
| SMS / Email Copy (`sms-email-copy`) | — | email, sms |
| Compliance (`compliance`) | — | email, sms |
| Recruiting (`recruiting`) | `getRecruitingSnapshot` | email, sms |
| Agent Coaching (`coaching`) | `getTeamProductionSummary` | email, sms |
| Calendar / Scheduling (`calendar`) | — *(no live calendar)* | email, sms |
| Slack / Notifications (`slack`) | — *(no Slack connection)* | email, sms |
| Workflow Builder (`workflow`) | — *(no automation engine)* | email, sms |
| Data Quality (`data-quality`) | `getDailyBriefingData` (reads `available` flags) | **none** |

## Routing order (first keyword match wins)

`classifyIntent()` checks in this order so general/specific intents resolve
correctly: executive-briefing → compliance → data-quality → recruiting → workflow
→ slack → calendar → policy-risk → **close** → lead-priority → coaching → crm →
production-analyst → sms-email-copy (generic copywriter last). `close` is placed
before `lead-priority`/`crm` and gated on Close-specific signals (the CRM name,
opportunity/pipeline language, an explicit lookup) so the common verb "close" or a
lead-heat ask doesn't grab it. A matched specialist only wins if it's in the
`enabledAgents` set; otherwise it falls back to Executive Briefing.

## Notes / boundaries

- **Lead heat ≠ Close-live.** Lead Prioritization (`getLeadPriorities`) reads the
  synced weekly `lead_heat_scores` slice; the Close agent reads the **live** Close
  pipeline. "Hottest leads to call" = lead heat, not Close.
- **PII is dropped at the tool layer**, not just in prompts: Close snapshots return
  counts/statuses/dates only; `getClientSnapshot` returns names + policy counts +
  premium only — no contact details, DOB, or notes.
- **Advisory agents have no live integration** — Calendar/Slack/Workflow draft copy
  only; their prompts say so explicitly.
- **Grounding backstop** (`core/grounding.ts`) flags a turn that states figures
  while every tool section was `available:false`.
