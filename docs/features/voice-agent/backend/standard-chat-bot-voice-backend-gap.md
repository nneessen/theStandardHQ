# Standard Chat Bot Voice Backend Gap

## Purpose

This document exists to stop frontend work from getting ahead of the backend.

The current state in `commissionTracker` is:

- the Voice Agent UI and edge-function proxy were started
- some read/update voice routes are assumed to exist upstream
- the actual backend provisioning flow is still incomplete in
  `standard-chat-bot`
- the most important missing backend action is why `Create Your Voice Agent`
  currently fails

This file is the backend-first handoff for what still must be built in
`standard-chat-bot` before we return to finish the frontend here.

## Current Reality

The frontend in this repo currently assumes that `standard-chat-bot` can do all
of the following:

- create and link a managed voice agent for a workspace
- return a reliable voice setup state for the page
- return live voice entitlement and usage
- return live voice draft/runtime data
- return Close-backed metadata for guided setup
- enforce voice guardrails server-side
- decide when inbound voice is allowed
- decide when outbound voice is allowed

That assumption is not fully true yet.

The clearest example:

- `commissionTracker` edge function already calls
  `POST /api/external/agents/:id/voice/agent/create`
- that upstream route is not available in the environment being used
- therefore `Create Your Voice Agent` fails by design

Reference in this repo:

- [chat-bot-api/index.ts](../../../../supabase/functions/chat-bot-api/index.ts)

## Decision

Frontend work in `commissionTracker` should pause until the backend contract in
`standard-chat-bot` is finished and deployed.

Do not continue building more voice UI here until the backend can:

1. create the agent
2. return a complete setup state
3. expose the real setup metadata
4. enforce the call safety model

## What Already Exists

These backend pieces appear to already exist or are already assumed in earlier
handoff docs:

### Existing or partly existing

- external Retell runtime routes
- external Retell connection routes
- external lead-statuses route
- voice entitlement route
- voice usage route
- webhook concepts for inbound and call events

Existing docs that already describe part of the intended system:

- [standard-hq-voice-agent-retell-handoff.md](../../../standard-hq-voice-agent-retell-handoff.md)
- [voice-agent-self-serve-contract.md](../../../voice-agent-self-serve-contract.md)
- [voice-agent-implementation-guide.md](../../../voice-agent-implementation-guide.md)
- [external-api-reference.md](../../../reference/external-api-reference.md)

## What Is Missing

These are the backend items that still need to be finished in
`standard-chat-bot`.

## 1. Create Voice Agent API

This is the primary blocker.

Required route:

- `POST /api/external/agents/:id/voice/agent/create`

Required behavior:

- authorize that the workspace is allowed to use voice
- create a managed voice agent under the platform-owned Retell account
- seed the default draft/runtime fields
- seed default guardrails
- seed webhook configuration
- persist the workspace -> voice agent linkage
- persist enough metadata so future reads do not depend on vague "prepared"
  states
- return the created or linked voice agent state

This route must be:

- idempotent
- safe to retry
- safe if called twice
- safe if the workspace already has a linked voice agent

Expected result:

- if a voice agent already exists, return that existing mapping
- if not, create it and return the new mapping
- do not create duplicates

## 2. Aggregated Voice Setup Read Model

The frontend should not need to stitch together multiple separate calls just to
decide what screen to show.

Required route:

- `GET /api/external/agents/:id/voice/setup-state`

This route should return one payload that answers:

- does the workspace have Close connected
- does the workspace have calendar connected
- does the workspace have voice entitlement
- does a voice agent exist
- is that voice agent being created
- is it ready
- is it published
- what call rules already exist
- what guardrails already exist

Minimum response responsibilities:

- clear `agent.exists`
- clear `agent.provisioningStatus`
  - `not_created`
  - `creating`
  - `ready`
  - `failed`
- close connection state
- calendar connection state
- entitlement state
- usage snapshot
- inbound/outbound rule summary
- guardrail summary

Without this route, the frontend will keep inventing page logic from too many
partial reads.

## 3. Close CRM Metadata APIs For Guided Setup

Voice setup needs real workspace-specific metadata from each connected Close
account.

Required routes:

- `GET /api/external/agents/:id/lead-statuses`
- `GET /api/external/agents/:id/close/custom-fields`
- `GET /api/external/agents/:id/close/smart-views`
- optionally `POST /api/external/agents/:id/close/metadata/refresh`

Required behavior:

- fetch from that workspace's connected Close org
- never return platform-global defaults as if they were real org metadata
- return stable ids and labels

These are needed because users must be able to choose:

- inbound allowed lead statuses
- outbound trigger field
- optional outbound status filters
- optional smart views for review or QA

## 4. Close CRM Setup Assistance APIs

The voice setup should be able to recommend and optionally create missing Close
fields the user needs.

Required routes:

- `POST /api/external/agents/:id/close/custom-fields/create`
- `POST /api/external/agents/:id/close/smart-views/create`

Suggested create helpers:

- outbound custom field such as `voice_outreach_state`
- optional review field such as `voice_last_outcome`
- optional smart view for "voice outreach eligible"

Required behavior:

- create only workspace-scoped resources in the connected Close org
- be idempotent where possible
- return the created resource ids and labels
- fail clearly if the field already exists with an incompatible shape

## 5. Voice Rule Model In The Backend

The call decision logic must live in `standard-chat-bot`, not in the frontend.

Required stored rule model:

- inbound allowed Close lead statuses
- outbound trigger mode
- outbound custom field key
- outbound allowed statuses
- outbound allowed lead sources
- after-hours inbound rules
- transfer number
- voicemail settings
- booking permissions

Required backend behavior:

- persist these rules
- validate them
- expose them in the aggregated setup read
- use them when deciding whether a call is allowed

## 6. Inbound Call Authorization Engine

The backend must know when the voice agent is allowed to answer inbound calls.

Required backend decision flow:

1. identify workspace from the incoming public number / routing config
2. identify the caller and matching lead in Close
3. load workspace voice setup state
4. evaluate inbound gates

Required inbound gates:

- workspace has active voice entitlement
- workspace has a linked voice agent
- voice agent is published
- inbound voice is enabled
- lead exists in Close
- lead status is on the inbound allowlist
- after-hours rule allows this call when applicable
- minutes remain
- global/platform kill switch is off
- workspace kill switch is off

If any gate fails:

- do not hand the call to the AI
- return a clear backend reason code

Suggested reason codes:

- `VOICE_DISABLED`
- `NO_LINKED_AGENT`
- `AGENT_UNPUBLISHED`
- `NO_MATCHING_LEAD`
- `STATUS_NOT_ALLOWED`
- `OUTSIDE_ALLOWED_WINDOW`
- `MINUTES_EXHAUSTED`
- `WORKSPACE_SUSPENDED`
- `PLATFORM_KILL_SWITCH`

## 7. Outbound Call Job Engine

Outbound must not be open-ended or status-only.

Required backend model:

- outbound jobs are created explicitly
- each job is tied to:
  - workspace id
  - lead id
  - voice agent id
  - reason
  - trigger source

Required behavior:

- create an outbound job only when the workspace rule model allows it
- evaluate all guardrails before dialing
- write attempt history
- write outcome history
- write Close updates after completion

Outbound should not rely on lead status alone.

Preferred trigger:

- dedicated Close custom field or queue field

Optional additional filters:

- lead status
- lead source
- cooldown eligibility

## 8. Voice Guardrails And Cost Protection

These are non-negotiable backend safety controls.

Required guardrails:

- max call duration
- silence hangup timeout
- ring timeout
- max daily outbound calls
- max attempts per lead
- outbound cooldown window
- no dialing when unpublished
- no dialing when entitlement is exhausted
- no dialing when workspace is suspended
- platform-level kill switch
- workspace-level kill switch

Suggested defaults:

- `maxCallDurationSeconds = 300`
- `silenceHangupSeconds = 20`
- `ringTimeoutSeconds = 30`
- `maxDailyOutboundCalls = 25`
- `maxAttemptsPerLead = 2`
- `outboundCooldownHours = 24`

Required backend behavior:

- these values must be enforced server-side
- the frontend may display them, but never own them

## 9. Calendar Booking Reuse

The voice agent should reuse the same workspace-scoped calendar integrations as
the SMS bot.

Required backend behavior:

- if Google Calendar is connected, allow booking through that workspace
- if Calendly is connected, allow booking through that workspace
- if no calendar is connected:
  - allow answer / qualify / transfer
  - do not allow fake booking behavior
  - return explicit `canBookAppointments = false` in setup state

The voice stack should not create a second booking ownership model.

## 10. Telephony Routing Model

This still needs a firm backend decision.

Known product requirement:

- leads know the Close phone number
- inbound calls come to the Close number
- leads and statuses live in Close

Backend must define exactly how calls move from the public Close-facing number
into the managed voice runtime.

This needs a documented decision for:

- public number ownership
- call forwarding / bridging
- caller id for outbound
- webhook routing
- fail-open or fail-closed behavior

This is not a frontend concern. It must be solved in the backend/system design
first.

## 11. Voice Entitlement Lifecycle

The backend already appears to have some voice entitlement concepts, but the
full workflow still needs to be finished and verified.

Required behavior:

- `inactive`
- `trial_available`
- `trialing`
- `active`
- `past_due`
- `exhausted`
- `canceled`

Required logic:

- app-managed free trial minute allocation
- paid activation via Stripe webhook
- minute usage decrementing
- hard-stop when exhausted
- cancellation handling

The create-agent route must refuse creation if entitlement rules do not allow
it.

## 12. Observability And Audit Trail

This system needs explainable logs for expensive actions.

Required audit logging:

- voice agent created
- voice agent linked
- voice agent publish event
- inbound call accepted
- inbound call rejected with reason code
- outbound job created
- outbound job skipped with reason code
- outbound call placed
- outbound call completed
- guardrail block triggered

At minimum, each event should capture:

- workspace id
- external agent id
- voice agent id
- lead id when applicable
- call id when applicable
- reason code
- timestamp

## 13. Deployment Requirements

Before frontend work resumes, the following must be true in the deployed
backend:

### Must exist and be deployed

- `POST /api/external/agents/:id/voice/agent/create`
- `GET /api/external/agents/:id/voice/setup-state`
- `GET /api/external/agents/:id/close/custom-fields`
- `GET /api/external/agents/:id/close/smart-views`
- whichever create-helper Close routes are approved

### Must be verified

- create route is idempotent
- setup-state route returns real workspace data
- Close metadata routes return workspace-specific org data
- voice entitlement is enforced
- unpublished agents cannot place calls
- guardrails are enforced

## 14. Definition Of Backend Complete

The backend should be considered ready for frontend resumption only when all of
the following are true.

### Core provisioning

- create route exists
- create route is deployed
- create route works in local and deployed environments
- duplicate create requests do not create duplicate agents

### Read model

- setup-state route exists
- setup-state route returns all page-critical data in one payload
- setup-state route distinguishes `not_created`, `creating`, `ready`, and
  `failed`

### Close integration

- lead statuses route works
- custom fields route works
- smart views route works
- optional create helpers work if they are part of scope

### Call logic

- inbound authorization engine exists
- outbound job engine exists
- guardrails exist
- reason codes are logged

### Booking reuse

- calendar capability is exposed correctly
- no-booking fallback is explicit

### Observability

- creation, publish, inbound, outbound, and blocked events are logged

## 15. What The Frontend In This Repo Should Do After Backend Is Ready

Only after the backend items above are complete should `commissionTracker`
resume voice frontend work.

At that point, the frontend should:

1. switch to one aggregated `get_voice_setup_state` read
2. use `Create Your Voice Agent` only when the create route is verified live
3. replace placeholder blocking states with real setup-state transitions
4. swap hardcoded setup assumptions for Close metadata reads
5. split basic vs advanced setup cleanly
6. keep SMS and Voice isolated at the UI/state level so one product cannot
   break the other

## 16. Immediate Next Step

Do not continue Voice Agent frontend work in `commissionTracker` right now.

The next engineering session should happen in `standard-chat-bot` and should
start with this order:

1. implement `POST /api/external/agents/:id/voice/agent/create`
2. implement `GET /api/external/agents/:id/voice/setup-state`
3. implement Close metadata routes for custom fields and smart views
4. document the inbound and outbound authorization engine
5. document and enforce voice guardrails
6. deploy and verify all of the above
7. only then return here and finish the frontend

## Bottom Line

The frontend in this repo got ahead of the backend.

That was the wrong order.

The backend in `standard-chat-bot` still needs a real provisioning contract,
real setup-state contract, real Close metadata contract, and real call safety
contract before this Voice Agent can be finished properly in
`commissionTracker`.
