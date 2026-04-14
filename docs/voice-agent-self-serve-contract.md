# The Standard HQ Voice Agent Self-Serve Contract

## Purpose

This document defines the contract needed to turn the AI Voice Agent into a
real SaaS onboarding flow inside The Standard HQ.

The current voice page can edit an already-linked voice agent, but it cannot
yet create one. That is why the UI falls back to vague "workspace is being
prepared" states.

This contract fixes that by defining:

- the user-facing create flow
- the backend provisioning contract
- the Stripe and trial model
- the shared Close CRM and calendar dependencies
- the safety controls required to prevent expensive accidents

## Non-Negotiables

- Users do **not** create their own Retell accounts.
- All voice agents are created under the platform owner's managed Retell
  account.
- Standard HQ is the product surface. Retell stays infrastructure.
- Close CRM is the source of truth for leads and inbound voice eligibility.
- Google Calendar or Calendly is the source of truth for booking.
- Outbound voice must be explicitly job-driven and rate-limited.
- Trial access must be minute-capped and abuse-resistant.

## Product Flow

The correct user flow is:

1. User lands on `AI Voice Agent`.
2. If no voice access exists, show `Start Free Trial`.
3. If voice access exists but no linked voice agent exists, show
   `Create Your Agent`.
4. Clicking `Create Your Agent` provisions a new voice agent under the managed
   Retell account and links it to the workspace.
5. User configures:
   - name
   - voice
   - prompt
   - call rules
   - booking behavior
6. User runs a test call.
7. User publishes the agent.
8. User upgrades from trial to paid when they want live usage beyond the trial
   minute cap.

The page should never imply that a user is waiting on some vague background
state if the real missing thing is:

- no entitlement, or
- no linked voice agent yet

## Read Model

The voice page should stop stitching together multiple unrelated calls just to
figure out if the page can render.

Add a single aggregated read action:

```json
{
  "action": "get_voice_setup_state"
}
```

Response shape:

```json
{
  "workspaceId": "uuid",
  "aiChatBotProvisioned": true,
  "close": {
    "connected": true,
    "orgName": "Agency Name",
    "leadSource": "close",
    "canHandleInboundVoice": true
  },
  "calendar": {
    "provider": "google",
    "connected": true,
    "canBookAppointments": true
  },
  "entitlement": {
    "status": "trial_available",
    "planCode": "voice_trial",
    "includedMinutes": 15,
    "hardLimitMinutes": 15,
    "usedMinutes": 0,
    "remainingMinutes": 15,
    "trialEndsAt": null
  },
  "agent": {
    "exists": false,
    "provisioningStatus": "not_created",
    "id": null,
    "displayName": null,
    "published": false,
    "draftUpdatedAt": null,
    "lastProvisionError": null
  },
  "rules": {
    "inboundAllowedLeadStatuses": [],
    "outboundMode": "custom_field",
    "outboundCustomFieldKey": "voice_outreach_state",
    "outboundAllowedLeadStatuses": [],
    "outboundAllowedLeadSources": []
  },
  "guardrails": {
    "maxCallDurationSeconds": 300,
    "silenceHangupSeconds": 20,
    "ringTimeoutSeconds": 30,
    "maxDailyOutboundCalls": 25,
    "maxAttemptsPerLead": 2,
    "outboundCooldownHours": 24,
    "trialMode": true,
    "inboundEnabled": false,
    "outboundEnabled": true
  },
  "demo": {
    "featuredVoices": [
      {
        "id": "voice_123",
        "name": "Warm Female",
        "provider": "elevenlabs",
        "previewAudioUrl": "https://..."
      }
    ],
    "sampleCalls": [
      {
        "id": "sample_123",
        "title": "Missed appointment follow-up",
        "transcriptPreview": "Hi, this is..."
      }
    ]
  }
}
```

Notes:

- `close.connected` and `calendar.connected` must be first-class signals in the
  voice UI.
- `agent.exists` is the signal that decides whether the page shows
  `Create Your Agent` or the actual setup editor.
- `provisioningStatus` must be explicit:
  - `not_created`
  - `creating`
  - `ready`
  - `failed`
- Do not overload `connections.retell.connected` as the only user-facing truth.

## Create Flow

Add a user-facing mutation:

```json
{
  "action": "create_voice_agent",
  "templateKey": "default_sales"
}
```

Behavior:

- authorize that the workspace has voice access
- create a new voice agent under the managed Retell account
- seed the default prompt, webhook config, safety defaults, and voice defaults
- persist the workspace -> voice agent mapping
- return the new aggregated `get_voice_setup_state` payload

Success response:

```json
{
  "success": true,
  "agent": {
    "exists": true,
    "provisioningStatus": "ready",
    "id": "voice_agent_123",
    "displayName": "The Standard HQ Voice Agent",
    "published": false
  }
}
```

Failure response:

```json
{
  "success": false,
  "error": "VOICE_AGENT_CREATE_FAILED",
  "message": "Failed to create the voice agent for this workspace."
}
```

Important:

- This is the missing action that makes `Create Your Agent` real.
- Users must never enter Retell API keys or Retell agent IDs.

## Trial and Stripe Model

The cleanest model is:

- free trial is app-managed
- paid conversion is Stripe-managed

Recommended voice access states:

- `inactive`
- `trial_available`
- `trialing`
- `active`
- `past_due`
- `exhausted`
- `canceled`

Recommended rules:

- `Start Free Trial` does **not** create a live Stripe subscription
- it grants a minute-capped entitlement in app state
- `Upgrade` creates the Stripe checkout session
- Stripe webhook upgrades entitlement from `trialing` to `active`

Why:

- a fake "$0 forever" plan creates billing clutter
- a real app-managed trial is simpler to reason about
- trial minute exhaustion is easier to enforce locally

The existing voice entitlement types already support minute caps:

- `includedMinutes`
- `hardLimitMinutes`
- `usedMinutes`
- `remainingMinutes`

Reference:

- [useChatBot.ts](src/features/chat-bot/hooks/useChatBot.ts#L159)

## Shared Workspace Dependencies

### Close CRM

Close CRM is required because:

- inbound calls are tied to the Close number
- the lead record lives in Close
- lead status determines whether inbound voice is allowed

Inbound voice permission should be a whitelist of Close lead statuses.

Example:

- `Contacted/Reschedule`
- `Contacted/Missed Appointment`
- `Quoted`

This must be configurable per workspace.

### Calendar

Google Calendar or Calendly must be reused from the same workspace connection
the SMS chat bot uses.

Rules:

- if a calendar is connected, the voice agent can book
- if no calendar is connected, the voice agent can still qualify and transfer
- the UI must show `Connect calendar to enable booking`

Voice should not create a separate calendar auth path.

## Telephony Model

This is the part that must be explicit in the product and backend contract.

There are three separate concepts:

- the public phone number the lead already knows
- the voice engine that answers or places the call
- the CRM record and rule engine that decides whether the call is allowed

For this product:

- Close CRM remains the source of truth for the lead record
- Retell remains the voice engine that actually runs the AI conversation
- The Standard HQ decides whether the call should be answered or initiated

### Public Number vs Voice Number

If a lead only knows the workspace's Close phone number, then that public
number is the inbound entry point.

Retell does not magically receive those calls unless one of these is true:

- the public number itself is a Retell-managed number, or
- the public number forwards inbound calls into a Retell-managed number, or
- the public number's telephony provider can hand the live call into Retell

This means the system needs an explicit public-number strategy. Without that,
inbound voice will be unreliable or impossible.

### Recommended Public Number Strategy

For this product, the cleanest approach is:

- keep the user's business number in Close as the public-facing number
- forward only approved inbound voice traffic from that number into Retell
- keep Retell as the live AI call engine behind the scenes

Why:

- leads already know the Close number
- call history and lead ownership stay aligned with Close
- the user does not need to learn or manage a separate Retell number

The product should still store the Retell telephony number internally, because
Retell needs a number binding for inbound and outbound call execution. That
number is infrastructure, not customer-facing setup.

### Inbound Call Flow

Inbound is event-driven from the public phone number.

The correct inbound flow is:

1. A lead dials the workspace's public Close number.
2. The telephony layer identifies the caller number.
3. The backend looks up the lead in Close CRM.
4. The backend checks the workspace's inbound voice rules.
5. If the lead is eligible, the call is handed to the workspace's linked
   Retell voice agent.
6. Dynamic variables are attached for that live call:
   - lead name
   - caller number
   - company name
   - allowed handoff behavior
   - calendar availability flags
   - workflow type such as `after_hours_inbound`
7. Retell runs the conversation.
8. Call events, transcript, and outcome flow back into the app and the lead
   timeline.

Inbound should only answer when all of these are true:

- voice is enabled for the workspace
- the voice agent exists and is published
- inbound voice is enabled
- the lead matches the allowed inbound lead-status rules
- the workspace is inside the allowed operating mode
  - after-hours only, or
  - full-time inbound coverage
- the workspace has remaining trial or paid minutes
- the global and workspace kill switches are not active

If any gate fails, the call must not go to the AI voice agent.

The fallback behavior should be explicit:

- do not answer with AI
- route normally through the business phone flow, or
- send to voicemail, or
- transfer to a human number

### Outbound Call Flow

Outbound is not triggered by a phone call arriving. It is triggered by a
workspace-approved job.

The correct outbound flow is:

1. A lead becomes eligible for voice outreach.
2. Eligibility is determined by workspace rules in The Standard HQ.
3. The backend creates an outbound voice job for that lead.
4. Guardrails verify that the call is still allowed.
5. Retell places the call using the workspace's linked voice agent and
   approved caller ID.
6. Dynamic variables are attached for the specific outreach reason:
   - missed appointment
   - reschedule follow-up
   - quote follow-up
   - other allowed campaign type
7. Retell runs the conversation.
8. Call results are written back to the workspace and Close.

Outbound should only initiate when all of these are true:

- voice is enabled for the workspace
- the voice agent exists and is published
- outbound voice is enabled
- the lead matches the outbound rule set
- the lead is not in cooldown
- the lead has not exceeded max attempts
- the workspace has not exceeded max daily outbound calls
- the workspace has remaining trial or paid minutes
- the platform outbound kill switch is off

### Recommended Rule Separation

Inbound and outbound should not share the same trigger model.

Inbound should use Close lead status because:

- the caller already exists in Close
- the question is whether the AI may answer that existing lead

Outbound should use a dedicated Close custom field or queue flag because:

- status changes happen too often
- statuses are too broad for safe automation
- it must be impossible to create runaway call loops from normal sales work

### Close and Retell Responsibilities

Close CRM should own:

- lead identity
- lead status
- lead source
- owner assignment
- notes and outcome logging
- the public business phone context

Retell should own:

- live AI conversation execution
- voice synthesis
- draft and publish state
- transcript and call events
- telephony binding used to make or receive the AI call leg

The Standard HQ should own:

- voice entitlement
- workspace setup
- agent creation under the managed Retell account
- inbound permission rules
- outbound job creation
- safety guardrails
- publishing controls
- calendar booking permissions

### Calendar Access During Calls

Yes, the voice agent should use the workspace's existing Google Calendar or
Calendly connection the same way the SMS chat bot does.

That means:

- each workspace authorizes its own calendar connection
- the voice agent uses that workspace-scoped booking access
- the agent can only book if calendar access is connected and healthy

If no calendar is connected:

- the voice agent may still answer and qualify
- the voice agent may still transfer to a human
- the voice agent must not pretend it can book an appointment
- the UI should say `Connect calendar to enable booking`

### Recommendation for This Product

For launch, the safest architecture is:

- Close number stays customer-facing
- inbound calls from that number are selectively routed into Retell
- outbound calls are created only from explicit voice jobs
- Retell numbers remain internal infrastructure, not customer setup fields

If the backend cannot yet bridge the public Close number into Retell, then
the product must say that inbound AI coverage is not live yet for that
workspace. It should not imply that inbound is already ready.

## Call Rules Contract

The voice add-on needs separate inbound and outbound rule models.

### Inbound

Inbound should be status-based.

Reason:

- the lead already exists in Close
- the user needs to say which lead statuses are voice-eligible
- this maps naturally to "the voice agent may answer inbound calls for these
  leads"

Add mutation:

```json
{
  "action": "update_voice_inbound_rules",
  "inboundAllowedLeadStatuses": [
    "Contacted/Reschedule",
    "Contacted/Missed Appointment"
  ]
}
```

### Outbound

Outbound should **not** use lead status alone.

Reason:

- lead status is too broad
- human workflow changes will create accidental call jobs
- it becomes too easy to spam or loop calls

Use a dedicated Close custom field or queue flag instead.

Recommended model:

- `voice_outreach_state`

Recommended values:

- `none`
- `eligible`
- `missed_appointment`
- `reschedule`
- `do_not_call`
- `completed`

Optional filters:

- allowed lead statuses
- allowed lead sources

Add mutation:

```json
{
  "action": "update_voice_outbound_rules",
  "outboundMode": "custom_field",
  "outboundCustomFieldKey": "voice_outreach_state",
  "outboundAllowedLeadStatuses": [
    "Contacted/Reschedule",
    "Contacted/Missed Appointment"
  ],
  "outboundAllowedLeadSources": [
    "Sitka Life"
  ]
}
```

## Safety Controls

These are mandatory.

### Runtime limits

- hard max call duration
- hang up after `x` seconds of silence
- hang up after ring timeout
- end call when voicemail is detected, if voicemail mode is off
- one workspace-level kill switch for all voice activity
- one platform-level kill switch for all outbound voice activity

### Outbound protections

- outbound calls must be queue-driven, never free-running scans
- dedupe by `lead_id + call_reason + cooldown_window`
- max daily outbound calls per workspace
- max attempts per lead
- cooldown between attempts
- no recursive retries on error
- no auto-redial loops
- no outbound while unpublished
- no outbound when trial minutes are exhausted

### Trial protections

- cap trial minutes hard
- optionally restrict trial to verified destination numbers only
- no public inbound number for trial unless explicitly allowed
- no bulk outbound during trial

### Audit and support

- log every create, publish, test call, and outbound job creation
- record the rule that authorized the call
- record the lead id, workspace id, and voice agent id
- keep the last provisioning failure visible to admins

## Frontend Information Architecture

The voice page should become:

### 1. Overview

- value proposition
- voice previews
- real sample conversations
- trial / upgrade CTA
- Close and calendar readiness

### 2. Create Agent

- primary CTA if no linked voice agent exists
- show provisioning progress
- once created, redirect into setup

### 3. Customize

- voice
- prompt
- greeting
- transfer behavior
- voicemail behavior

### 4. Call Rules

- inbound status permissions
- outbound custom-field rules
- booking behavior

### 5. Test

- listen to voice previews
- place a test call
- review transcript

### 6. Stats

- plan
- usage
- sync
- published state

Admin-only:

- manual provisioning repair
- raw Retell tools
- direct connection repair

## Backend Surface

### User-facing edge function actions

- `get_voice_setup_state`
- `start_voice_trial`
- `create_voice_agent`
- `update_voice_identity`
- `update_voice_prompt`
- `update_voice_call_routing`
- `update_voice_inbound_rules`
- `update_voice_outbound_rules`
- `publish_voice_agent`
- `request_voice_test_call`

### Admin-only edge function actions

- `admin_provision_voice_agent`
- `admin_repair_voice_agent_link`
- `admin_disconnect_voice_agent`

### External API additions needed

The current external voice routes are editor-only:

- `get_retell_runtime`
- `update_retell_agent`
- `publish_retell_agent`
- `get_retell_llm`
- `update_retell_llm`

Reference:

- [chat-bot-api index.ts](supabase/functions/chat-bot-api/index.ts#L522)

Add product-level external API routes that do not leak Retell into the main UI:

- `POST /api/external/agents/:id/voice/trial/start`
- `GET /api/external/agents/:id/voice/setup`
- `POST /api/external/agents/:id/voice/agent/create`
- `PATCH /api/external/agents/:id/voice/inbound-rules`
- `PATCH /api/external/agents/:id/voice/outbound-rules`
- `POST /api/external/agents/:id/voice/test-call`

Retell-specific routes can remain behind these service methods, but they should
stop being the primary contract the customer UI thinks in.

## Data Model Additions

Recommended workspace-level additions:

- `voice_agent_provisioning_status`
- `voice_agent_last_provision_error`
- `voice_trial_started_at`
- `voice_trial_ends_at`
- `voice_trial_minutes_granted`
- `voice_inbound_allowed_statuses text[]`
- `voice_outbound_mode text`
- `voice_outbound_custom_field_key text`
- `voice_outbound_allowed_statuses text[]`
- `voice_outbound_allowed_sources text[]`
- `voice_max_daily_outbound_calls int`
- `voice_max_attempts_per_lead int`
- `voice_outbound_cooldown_hours int`
- `voice_silence_hangup_seconds int`
- `voice_ring_timeout_seconds int`

Do **not** reuse general chat-bot `allowedLeadStatuses` as the final voice rule
store. Voice needs its own rule model.

## Testing Model

### Billing tests

- production uses Stripe live mode
- staging/local uses Stripe test mode
- trial should be testable without Stripe

### Product tests

Add an internal admin-only action:

- `Grant voice entitlement + create/link agent`

This is the fastest path for internal QA because it bypasses billing and tests
the real voice workflow directly.

## Implementation Order

1. Add `get_voice_setup_state`.
2. Add `create_voice_agent`.
3. Add admin-only manual provision action.
4. Change the UI empty state to `Create Your Agent`.
5. Add app-managed trial minutes.
6. Add Close inbound rule editor.
7. Add outbound custom-field rule editor.
8. Add calendar booking readiness to the setup flow.
9. Add test-call flow.
10. Keep Retell repair tooling admin-only.

## Bottom Line

The right product is:

- managed Retell account
- self-serve create under that managed account
- free trial minutes
- Close-backed inbound rules
- custom-field-backed outbound rules
- shared calendar booking
- hard safety rails

Until `create_voice_agent` exists, the UI will keep pretending.
