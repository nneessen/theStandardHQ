# The Standard HQ Voice Agent Implementation Guide

## Purpose

This document turns the voice-agent product direction into an implementation
plan that engineering can actually build against.

It answers five things:

1. what the customer-facing tab layout should be
2. what the super-admin experience should include
3. how inbound and outbound calls are authorized
4. what backend use cases and APIs must exist
5. how the public Close number and Retell telephony should work together

This guide assumes:

- users do not create their own Retell accounts
- all voice agents are created under the platform owner's managed Retell
  account
- Close CRM is required
- Google Calendar or Calendly is reused per workspace for booking

Reference:

- [voice-agent-self-serve-contract.md](voice-agent-self-serve-contract.md)

## Product Roles

There are two experiences.

### Standard user

The standard user should see a SaaS setup flow, not infrastructure controls.

They should never see:

- Retell API keys
- Retell agent IDs
- manual Retell number binding
- raw connection repair tools

They should see:

- what this product does
- how to start a trial
- how to create an agent
- how to choose a voice
- how to write instructions
- how to control inbound and outbound behavior
- how to test the agent
- how many minutes were used

### Super-admin

The super-admin can see everything the standard user sees, plus:

- provisioning status
- Retell linkage state
- internal call-routing state
- raw draft/LLM/admin repair tools
- manual provision and relink actions

This should be a separate admin tab, not mixed into the customer flow.

## Customer Information Architecture

The customer-facing voice page should use top-level tabs in this order.

### 1. Overview

Purpose:

- explain the product clearly
- show voice previews and sample conversations
- show trial or upgrade CTA
- show Close and calendar readiness
- show the next required action

Primary CTA by state:

- `Start Free Trial`
- `Create Your Agent`
- `Continue Setup`
- `Run Test Call`
- `Upgrade`

### 2. Setup

Purpose:

- guide the customer through the actual agent configuration

This tab should contain step tabs in this order:

1. `Voice`
2. `Instructions`
3. `Call Flow`
4. `Launch`

#### Voice

Fields:

- agent display name
- chosen voice
- greeting / opening line
- speaking style
- fallback voice

#### Instructions

Fields:

- what the agent does
- what the agent should never do
- qualification notes
- transfer rules
- booking behavior

#### Call Flow

Fields:

- inbound allowed statuses from Close
- after-hours behavior
- human transfer number
- voicemail policy
- outbound custom-field rule
- outbound source filters

#### Launch

Fields and actions:

- readiness checklist
- unsaved changes warning
- draft-vs-live status
- run test call
- publish draft

### 3. Stats

Purpose:

- give the customer a familiar reporting surface similar to the AI Chat Bot

Sections:

- plan and entitlement
- included and used minutes
- inbound and outbound call counts
- answered calls
- publish state
- sync / service health
- most recent test calls

### 4. Admin

This tab is super-admin only.

Sections:

- provisioning state
- managed Retell linkage
- raw runtime inspector
- raw draft / LLM editors
- relink / reprovision actions
- diagnostic errors

## Page State Model

The UI should be driven from one aggregated setup state.

### `inactive`

Meaning:

- the workspace does not have voice access yet

Primary CTA:

- `Start Free Trial`

### `trial_available`

Meaning:

- the workspace can start a free trial immediately

Primary CTA:

- `Start Free Trial`

### `trialing` or `active` with no linked agent

Meaning:

- the workspace has access
- no voice agent exists yet

Primary CTA:

- `Create Your Agent`

This CTA must sit above the fold in both Overview and Setup.

### `creating`

Meaning:

- a managed voice agent is currently being created and linked

Primary CTA:

- disabled loading state

User copy:

- `Creating your AI Voice Agent`
- `This usually takes less than a minute.`

### `ready_unpublished`

Meaning:

- the agent exists
- the user can edit it
- the user has not published it yet

Primary CTA:

- `Run Test Call`

Secondary CTA:

- `Publish Draft`

### `ready_published`

Meaning:

- the agent is live

Primary CTA:

- `View Stats`

Secondary CTA:

- `Edit Setup`

### `degraded`

Meaning:

- backend mismatch, routing issue, or runtime error

Primary CTA:

- standard user: `Refresh`
- super-admin: `Open Admin Diagnostics`

## Public Number Strategy

This is the most important architectural decision.

### Problem

Leads already know the Close number, not a Retell number.

That means inbound AI cannot rely on a hidden Retell number unless the public
Close number can feed calls into Retell.

### Options

| Option | How it works | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Retell number becomes public number | Leads call a Retell-managed number directly | Simple Retell setup | Breaks the existing Close phone identity and confuses users | No |
| Close/Twilio forwards to Retell | Public Close number stays the same, eligible calls are forwarded into Retell | Best customer experience, preserves the known number | Requires telephony bridge logic | Yes |
| Close/Twilio remains separate and Retell only handles outbound | AI can place calls, but inbound AI is limited or absent | Lowest complexity | No real inbound AI on the known number | Temporary fallback only |

### Launch recommendation

Use:

- Close number as the public-facing number
- Retell as the AI engine behind the scenes
- a telephony bridge from the public Close number into Retell for approved
  inbound AI calls

If the bridge is not implemented yet:

- do not promise inbound AI on the existing Close number
- allow outbound, testing, and setup
- show inbound as `Not live yet for this workspace`

## Inbound Authorization Model

Inbound should be evaluated synchronously when a call hits the public number.

### Required checks

1. workspace has voice entitlement
2. workspace voice is enabled
3. a linked voice agent exists
4. the linked voice agent is published
5. inbound voice is enabled
6. the caller matches a lead in Close, or the workspace's unknown-caller policy
   allows AI
7. the lead's Close status is in the allowed inbound list
8. the workspace is in an allowed availability window
9. trial or paid minutes remain
10. platform and workspace kill switches are off

### Allowed results

- `allow_ai`
- `route_normal_business_flow`
- `voicemail_only`
- `transfer_to_human`
- `reject_due_to_guardrail`

### Pseudocode

```ts
if (!voiceEntitled) return routeNormalBusinessFlow();
if (!voiceEnabled) return routeNormalBusinessFlow();
if (!linkedVoiceAgent || !published) return routeNormalBusinessFlow();
if (!inboundEnabled) return routeNormalBusinessFlow();
if (workspaceKillSwitch || platformKillSwitch) return rejectDueToGuardrail();
if (!minutesRemaining) return routeNormalBusinessFlow();

const lead = await closeGateway.findLeadByPhone(callerNumber);
if (!lead) return routeNormalBusinessFlow();
if (!inboundAllowedStatuses.includes(lead.status)) {
  return routeNormalBusinessFlow();
}
if (!isWithinAllowedAvailabilityWindow(now, workspaceRules)) {
  return routeNormalBusinessFlow();
}

return allowAi();
```

### Dynamic variables for inbound

When a call is handed into Retell, attach:

- workspace id
- voice agent id
- lead id
- lead name
- caller number
- company name
- transfer number
- booking enabled
- calendar provider
- workflow type

## Outbound Authorization Model

Outbound should never be driven by scanning broad lead statuses.

It should start from an explicit outbound voice job.

### Recommended trigger field

Use a dedicated Close custom field:

- `voice_outreach_state`

Recommended values:

- `none`
- `eligible`
- `missed_appointment`
- `reschedule`
- `quote_followup`
- `do_not_call`
- `completed`

### Required checks before enqueue

1. workspace has voice entitlement
2. workspace voice is enabled
3. a linked voice agent exists
4. the linked voice agent is published
5. outbound voice is enabled
6. lead matches allowed custom-field state
7. lead matches optional allowed statuses and sources
8. lead is outside cooldown
9. lead has not exceeded max attempts
10. workspace has not exceeded max daily outbound calls
11. trial or paid minutes remain
12. platform outbound kill switch is off

### Allowed results

- `enqueue_outbound_call`
- `skip_not_eligible`
- `skip_in_cooldown`
- `skip_attempt_limit`
- `skip_workspace_limit`
- `skip_guardrail`

### Pseudocode

```ts
if (!voiceEntitled || !voiceEnabled || !outboundEnabled) return skip();
if (!linkedVoiceAgent || !published) return skip();
if (platformOutboundKillSwitch || workspaceKillSwitch) return skip();
if (!minutesRemaining) return skip();
if (!matchesOutboundCustomField(lead)) return skip();
if (!matchesOptionalFilters(lead, rules)) return skip();
if (isInCooldown(lead, rules)) return skip();
if (hasExceededMaxAttempts(lead, rules)) return skip();
if (hasExceededWorkspaceDailyLimit(workspace, rules)) return skip();

return enqueueOutboundCall();
```

## Safety and Cost Controls

These must exist before broad rollout.

### Hard call limits

- max call duration in seconds
- silence hangup in seconds
- ring timeout in seconds
- voicemail detection behavior

### Outbound protections

- queue-driven only
- dedupe key: `workspace_id + lead_id + reason + cooldown_bucket`
- max daily outbound calls
- max attempts per lead
- cooldown hours between attempts
- no automatic infinite retries
- no outbound while unpublished
- no outbound when minutes are exhausted

### Trial protections

- hard minute cap
- optional verified-number-only test calls
- no public inbound line during trial unless explicitly enabled
- no bulk outbound during trial

### Emergency controls

- workspace kill switch
- platform outbound kill switch
- platform global voice kill switch

### Audit requirements

Persist:

- why the call was allowed
- which rule authorized it
- workspace id
- lead id
- voice agent id
- call direction
- attempt number
- reason code

## Calendar and Booking Behavior

Voice should reuse the same workspace calendar integration used by the AI Chat
Bot.

Supported behavior:

- if Google or Calendly is connected, the voice agent may book
- if no calendar is connected, the voice agent may qualify and transfer only

The prompt layer must know this.

The UI must show:

- `Booking enabled`
- or `Connect calendar to enable booking`

## Backend Bounded Context

The cleanest implementation is a dedicated voice bounded context with
use-case-first APIs.

### Domain objects

- `VoiceWorkspace`
- `VoiceAgent`
- `VoiceEntitlement`
- `VoiceRoutingPolicy`
- `VoiceGuardrails`
- `VoiceUsageSnapshot`
- `VoiceProvisioningState`

### Application use cases

- `GetVoiceSetupState`
- `StartVoiceTrial`
- `CreateVoiceAgent`
- `UpdateVoiceIdentity`
- `UpdateVoiceInstructions`
- `UpdateVoiceRoutingPolicy`
- `UpdateVoiceInboundRules`
- `UpdateVoiceOutboundRules`
- `PublishVoiceAgent`
- `RequestVoiceTestCall`
- `EvaluateInboundVoiceCall`
- `EnqueueOutboundVoiceCall`
- `RecordVoiceCallEvent`

### Application ports

- `VoiceAgentRepository`
- `VoiceEntitlementRepository`
- `VoiceUsageRepository`
- `CloseGateway`
- `CalendarGateway`
- `RetellGateway`
- `TelephonyGateway`
- `BillingGateway`
- `AuditLogPort`
- `JobQueuePort`

### Infrastructure adapters

- Retell API adapter
- Close API adapter
- Google adapter
- Calendly adapter
- Stripe webhook adapter
- phone-routing / forwarding adapter
- Supabase/Postgres repositories

## Backend API Contract

These routes should exist behind the Standard HQ edge function.

### Read model

`GET /api/external/agents/:id/voice/setup`

Returns:

- entitlement state
- Close readiness
- calendar readiness
- linked agent state
- rule summaries
- guardrail summaries
- next recommended action

### Trial start

`POST /api/external/agents/:id/voice/trial/start`

Behavior:

- grants trial entitlement
- seeds minute cap
- returns updated setup state

### Agent creation

`POST /api/external/agents/:id/voice/agent/create`

Behavior:

- creates Retell agent under the managed account
- assigns internal telephony binding
- seeds prompt, webhook, and guardrail defaults
- persists workspace linkage
- returns updated setup state

### Voice identity update

`PATCH /api/external/agents/:id/voice/identity`

Fields:

- display name
- selected voice id
- greeting
- speaking style
- fallback voice id

### Instruction update

`PATCH /api/external/agents/:id/voice/instructions`

Fields:

- general prompt
- begin message
- qualification notes
- transfer notes
- booking notes

### Routing update

`PATCH /api/external/agents/:id/voice/routing`

Fields:

- after-hours mode
- transfer number
- voicemail behavior
- max call duration
- silence hangup seconds
- ring timeout seconds

### Inbound rules update

`PATCH /api/external/agents/:id/voice/inbound-rules`

Fields:

- allowed lead statuses
- unknown caller policy
- inbound enabled
- after-hours only toggle

### Outbound rules update

`PATCH /api/external/agents/:id/voice/outbound-rules`

Fields:

- outbound enabled
- outbound mode
- custom field key
- allowed field values
- optional allowed statuses
- optional allowed sources
- cooldown hours
- max attempts per lead
- max daily outbound calls

### Test call

`POST /api/external/agents/:id/voice/test-call`

Fields:

- destination number
- scenario key

Rules:

- standard users can only call verified or explicitly allowed test numbers
- test calls consume trial or paid minutes
- test calls must be rate-limited

### Publish

`POST /api/external/agents/:id/voice/publish`

Behavior:

- validates required setup fields
- publishes latest draft to live
- records audit event
- returns updated setup state

## Edge Function Contract

The Standard HQ edge function should expose product-level actions instead of
making the customer UI think in Retell terms.

### User-facing actions

- `get_voice_setup_state`
- `start_voice_trial`
- `create_voice_agent`
- `update_voice_identity`
- `update_voice_instructions`
- `update_voice_routing`
- `update_voice_inbound_rules`
- `update_voice_outbound_rules`
- `request_voice_test_call`
- `publish_voice_agent`
- `get_voice_stats`

### Admin-only actions

- `admin_get_voice_diagnostics`
- `admin_reprovision_voice_agent`
- `admin_relink_voice_agent`
- `admin_disconnect_voice_agent`
- `admin_get_retell_runtime`
- `admin_update_retell_agent`
- `admin_publish_retell_agent`
- `admin_get_retell_llm`
- `admin_update_retell_llm`

## Frontend Query Model

Follow a single read model plus narrow mutations.

### Query keys

Create canonical query keys for voice:

- `voiceKeys.setup(agentId)`
- `voiceKeys.stats(agentId)`
- `voiceKeys.adminDiagnostics(agentId)`

### Query rules

- Overview and Setup read from `voiceKeys.setup`
- Stats reads from `voiceKeys.stats`
- Admin reads from `voiceKeys.adminDiagnostics`
- mutations update or invalidate only the affected voice keys

### Recommended stale times

- setup: `30s`
- stats: `30s`
- admin diagnostics: `10s`

## Data Model Additions

Recommended workspace-level or linked-agent fields:

- `voice_agent_id`
- `voice_agent_display_name`
- `voice_agent_provisioning_status`
- `voice_agent_last_provision_error`
- `voice_agent_published_at`
- `voice_trial_started_at`
- `voice_trial_ends_at`
- `voice_trial_minutes_granted`
- `voice_inbound_allowed_statuses text[]`
- `voice_unknown_caller_policy text`
- `voice_outbound_mode text`
- `voice_outbound_custom_field_key text`
- `voice_outbound_allowed_values text[]`
- `voice_outbound_allowed_statuses text[]`
- `voice_outbound_allowed_sources text[]`
- `voice_max_daily_outbound_calls int`
- `voice_max_attempts_per_lead int`
- `voice_outbound_cooldown_hours int`
- `voice_silence_hangup_seconds int`
- `voice_ring_timeout_seconds int`
- `voice_test_call_verified_numbers text[]`

## Event and Job Model

### Inbound path

1. public number receives call
2. inbound policy evaluator runs
3. if approved, call is bridged into Retell
4. call event webhook records transcript and outcome
5. Close note/timeline is updated

### Outbound path

1. lead becomes eligible
2. outbound evaluator creates a voice job
3. job worker performs final guardrail check
4. Retell places the call
5. call event webhook records transcript and outcome
6. Close note/timeline is updated

### Stripe path

1. user starts trial without Stripe subscription
2. user upgrades through Stripe checkout
3. Stripe webhook updates entitlement to active
4. setup state refreshes

## Build Phases

### Phase 1. Honest product states

- add `get_voice_setup_state`
- replace vague copy with explicit state names
- show `Start Free Trial` and `Create Your Agent`

### Phase 2. Managed creation

- add `start_voice_trial`
- add `create_voice_agent`
- seed defaults automatically

### Phase 3. Guided setup

- finish the user Setup tab fields
- add inbound and outbound rule editors
- add booking readiness and prompts

### Phase 4. Safe launch

- add test-call flow
- add publish validation
- add audit events and guardrail enforcement

### Phase 5. Telephony bridge

- wire the public Close number into Retell for eligible inbound AI calls
- if this is delayed, mark inbound AI as not live

### Phase 6. Admin tooling

- isolate raw Retell tools to Admin
- add reprovision and relink tools
- add diagnostics page

## Bottom Line

The product should behave like this:

- users connect Close and calendar
- users start a trial or buy the add-on
- users click `Create Your Agent`
- the system creates and links a managed Retell agent automatically
- users configure the agent in clear tabs
- inbound AI answers only when Close-based rules allow it
- outbound AI calls only happen from explicit, rate-limited jobs
- all risky behavior is constrained by hard guardrails

That is the SaaS version of this feature. Anything that exposes raw Retell
plumbing in the main user flow is fallback tooling, not the product.
