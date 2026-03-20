# Retell Setup for `standard-chat-bot`

This guide is only for:

- `Retell`
- `standard-chat-bot`

This guide does **not** cover:

- `commissionTracker`
- Stripe
- billing
- entitlement sync

## The Exact Retell Choice For This Repo

For the first working setup in this repo, pick:

1. `Voice Agent`
2. `Single Prompt`
3. `Blank` or `Start from scratch`, if Retell shows a template picker

Do **not** use these for the first setup:

- `Chat Agent`
- `Multi-Prompt Tree`
- `Conversation Flow`

Why this is the correct choice here:

1. `standard-chat-bot` stores one Retell `agent_id` per bot.
2. The app already passes workflow-specific dynamic variables into that one Retell agent at call time.
3. I do **not** see any custom Retell function integrations in the local codebase that would require a more complex builder.
4. Retell’s own docs say `Single Prompt` is the simplest option and is best for quick prototypes, straightforward conversations, and agents with `1-3 functions`.

## Direct URLs

### Retell docs

- Dashboard: [https://dashboard.retellai.com](https://dashboard.retellai.com)
- Single/Multi Prompt overview: [https://docs.retellai.com/build/single-multi-prompt/prompt-overview](https://docs.retellai.com/build/single-multi-prompt/prompt-overview)
- Write a single prompt: [https://docs.retellai.com/build/single-multi-prompt/write-single-prompt](https://docs.retellai.com/build/single-multi-prompt/write-single-prompt)
- Configure basic settings: [https://docs.retellai.com/build/single-multi-prompt/configure-basic-settings](https://docs.retellai.com/build/single-multi-prompt/configure-basic-settings)
- Function calling overview: [https://docs.retellai.com/build/single-multi-prompt/function-calling](https://docs.retellai.com/build/single-multi-prompt/function-calling)
- Transfer call tool: [https://docs.retellai.com/build/single-multi-prompt/transfer-call](https://docs.retellai.com/build/single-multi-prompt/transfer-call)
- Manage API keys: [https://docs.retellai.com/accounts/manage-api-keys](https://docs.retellai.com/accounts/manage-api-keys)
- Setup versioning / deployment: [https://docs.retellai.com/agent/version](https://docs.retellai.com/agent/version)
- Purchase phone number: [https://docs.retellai.com/deploy/purchase-number](https://docs.retellai.com/deploy/purchase-number)
- Receive calls: [https://docs.retellai.com/deploy/inbound-call](https://docs.retellai.com/deploy/inbound-call)
- Inbound webhook: [https://docs.retellai.com/features/inbound-call-webhook](https://docs.retellai.com/features/inbound-call-webhook)
- Webhook overview: [https://docs.retellai.com/features/webhook-overview](https://docs.retellai.com/features/webhook-overview)
- Manage voices: [https://docs.retellai.com/api-references/add-voice](https://docs.retellai.com/api-references/add-voice)
- Clone voice: [https://docs.retellai.com/api-references/clone-voice](https://docs.retellai.com/api-references/clone-voice)
- Dynamic variables: [https://docs.retellai.com/build/dynamic-variables](https://docs.retellai.com/build/dynamic-variables)
- Get agent: [https://docs.retellai.com/api-references/get-agent](https://docs.retellai.com/api-references/get-agent)
- List agents: [https://docs.retellai.com/api-references/list-agents](https://docs.retellai.com/api-references/list-agents)
- List voices: [https://docs.retellai.com/api-references/list-voices](https://docs.retellai.com/api-references/list-voices)
- List phone numbers: [https://docs.retellai.com/api-references/list-phone-numbers](https://docs.retellai.com/api-references/list-phone-numbers)

### `standard-chat-bot`

Replace the placeholders below with your real host and real agent ID.

- Integrations page: `https://<standard-chat-bot-web>/agents/<standard-chat-bot-agent-id>/integrations`
- Bot Config page: `https://<standard-chat-bot-web>/agents/<standard-chat-bot-agent-id>/bot-config`
- Voice page: `https://<standard-chat-bot-web>/agents/<standard-chat-bot-agent-id>/voice`
- Retell call event webhook target: `https://<standard-chat-bot-api>/webhooks/retell`
- Retell inbound webhook target: `https://<standard-chat-bot-api>/webhooks/retell/inbound`

Local examples:

- `http://localhost:3100/agents/<standard-chat-bot-agent-id>/integrations`
- `http://localhost:3100/agents/<standard-chat-bot-agent-id>/bot-config`
- `http://localhost:3100/agents/<standard-chat-bot-agent-id>/voice`
- `http://localhost:3001/webhooks/retell`
- `http://localhost:3001/webhooks/retell/inbound`

## Copy/Paste Map

| Retell value        | Where you get it in Retell                       | Where you save it in `standard-chat-bot`                |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| Retell API key      | Dashboard -> `Settings` -> `API Keys`            | `Integrations` -> `Voice / Retell` -> `API Key`         |
| Retell `agent_id`   | Retell agent page or `List Agents` docs page     | `Integrations` -> `Voice / Retell` -> `Retell Agent ID` |
| Retell phone number | Dashboard -> `Phone Numbers`                     | `Integrations` -> `Voice / Retell` -> `From Number`     |
| Retell `voice_id`   | `Get Agent` docs page or `List Voices` docs page | `Bot Config` -> `Voice Settings` -> `Voice ID`          |

## Exact Setup

## 1. `[Retell]` Create the API key

1. Open [https://dashboard.retellai.com](https://dashboard.retellai.com).
2. Open `Settings`.
3. Open `API Keys`.
4. Click `Add`.
5. Create a new key.
6. Copy the full key immediately.
7. On the same `API Keys` page, select that key.
8. Click `Set as Webhook Key`.
9. Keep this exact same key for later.
10. You will paste this exact value into:
    - `[standard-chat-bot]` `Integrations` -> `Voice / Retell` -> `API Key`

Why this must be the same key:

1. Retell’s docs say webhooks are verified with `x-retell-signature` plus your Retell API key.
2. `standard-chat-bot` verifies Retell webhooks using the saved Retell API key for the agent.
3. If the Retell webhook key and the saved key are different, webhook verification will fail.

## 2. `[Retell]` Create the voice agent

1. Open [https://dashboard.retellai.com](https://dashboard.retellai.com).
2. Open `Agents`.
3. Click `Create an agent`.
4. Choose `Voice Agent`.
5. Choose `Single Prompt`.
6. If Retell shows a template picker, choose `Blank` or `Start from scratch`.
7. If Retell takes you directly into the prompt editor instead, continue there.
8. Finish the create flow until the agent page opens.
9. Set the agent name.

## 3. `[Retell]` Paste this prompt into the main prompt field

Paste this into the agent’s main prompt field:

```text
## Identity
You are the voice assistant for {{agent_name}} at {{company_name}}.
You handle short appointment follow-up and after-hours receptionist calls for an insurance office.

## Dynamic Variables
You may receive these runtime variables:
- workflow_type: {{workflow_type}}
- workflow_goal: {{workflow_goal}}
- workflow_opening_guidance: {{workflow_opening_guidance}}
- workflow_handoff_rule: {{workflow_handoff_rule}}
- workflow_context: {{workflow_context}}
- appointment_window_local: {{appointment_window_local}}
- lead_name: {{lead_name}}
- known_lead_name: {{known_lead_name}}
- caller_number: {{caller_number}}
- lead_status_label: {{lead_status_label}}
- product_type: {{product_type}}
- human_handoff_enabled: {{human_handoff_enabled}}
- transfer_number: {{transfer_number}}
- sms_history: {{sms_history}}
- lead_context: {{lead_context}}
- source_rules: {{source_rules}}

If any variable still appears with curly braces, treat it as missing and do not read it out loud.

## Style Guardrails
- Keep every reply to 1-2 short sentences.
- Ask only one question at a time.
- Sound warm, calm, and natural.
- Stay tightly on the current workflow.
- Do not talk like a salesperson.
- Do not guess or invent facts.

## Hard Limits
- Do not discuss coverage, policy details, prices, premiums, underwriting, carriers, product comparisons, or compliance-sensitive topics.
- If the caller asks for any of those, apologize briefly and offer a human callback or transfer.
- Do not claim you changed, booked, or confirmed an appointment unless a real booking system actually did it.
- If the situation becomes confusing, stop pushing forward and hand off to a human.

## Task
1. Determine the workflow from {{workflow_type}}.
2. Open the call yourself.
3. If workflow_type is after_hours_inbound, greet the caller like an after-hours receptionist for {{company_name}}.
4. If workflow_type is missed_appointment, reschedule, or quoted_followup, identify yourself as calling from {{company_name}} or {{agent_name}}'s office and use {{workflow_opening_guidance}} when it is available.
5. Keep the opening short and natural.
6. Ask one short question.

wait for user response

7. Stay focused on {{workflow_goal}} when it is available.
8. Keep the conversation only on scheduling, callback collection, or after-hours receptionist help.
9. If the caller asks for something outside that scope, follow {{workflow_handoff_rule}} when it is available.
10. If the caller explicitly asks for a human right now, and human_handoff_enabled is "true", and transfer_number is present, and the transfer_call tool is available, use transfer_call.
11. If transfer is not available, offer a callback from a human.
12. End politely once the next action is clear.

## Workflow Rules
### missed_appointment
- Open with empathy.
- Mention the missed appointment only if appointment_window_local is available.
- Ask if they want help finding a better time.

### reschedule
- Focus only on moving the appointment.
- If appointment_window_local is available, reference it briefly.
- Do not say the calendar has already been updated.

### after_hours_inbound
- Act like an after-hours receptionist.
- If known_lead_name is available, you may greet them by name.
- Ask what they need.
- Help only with basic appointment-status, callback, or transfer requests.

### quoted_followup
- Keep it very short.
- Offer a human callback.
- Do not discuss rates or policy details.
```

Why this prompt shape matches Retell’s docs:

1. Retell recommends sectional prompts.
2. Retell recommends writing the task as steps.
3. `standard-chat-bot` already passes `workflow_type`, `workflow_goal`, `workflow_opening_guidance`, and `workflow_handoff_rule` into Retell at runtime.

## 4. `[Retell]` Configure the basic settings

On the same Retell agent page, configure these:

1. `Language Model`
   - choose `GPT-4.1`
   - Retell’s docs explicitly recommend starting with `GPT-4.1`
2. `Voice Settings`
   - open the voice dropdown
   - choose the voice you want
   - if you want a custom/cloned voice, use:
     - [Add Voice](https://docs.retellai.com/api-references/add-voice)
     - [Clone Voice](https://docs.retellai.com/api-references/clone-voice)
3. `Opening / Begin Message`
   - if the current Retell UI shows a `Conversation Initiation`, `Begin Message`, or similar opening-message setting, leave the fixed begin message blank or unset
   - this lets Retell generate the opening from the prompt you pasted in step 3
   - if you do not see any such setting in your current dashboard, skip this entirely
4. `Privacy & Webhook`
   - do **not** set an agent-level `webhook_url` here for this first setup
   - this guide uses an account-level call event webhook later

## 5. `[Retell]` Optional: add the built-in `Transfer Call` tool

Only do this if you want the agent to transfer the caller to a human immediately.

1. On the agent detail page, go to the `Functions` section.
2. Click `+ Add`.
3. Choose `Transfer Call`.
4. Set the transfer destination to:
   - `{{transfer_number}}`
5. Choose `Cold transfer` for the first setup.
6. For caller ID, choose:
   - `Retell Agent’s number`
7. Save the tool.

Why this matches your repo:

1. `standard-chat-bot` passes `human_handoff_enabled` and `transfer_number` into Retell for after-hours inbound calls.
2. Retell’s docs say the `Transfer Call` tool can use a dynamic variable as the runtime destination.

If you do **not** want live transfer right now:

1. skip this step
2. the prompt above will still work
3. the agent will offer callback instead of transfer

## 6. `[Retell]` Publish the agent

1. On the Retell agent page, click `Deployment` in the upper-right corner.
2. Publish the agent.
3. You do **not** need to attach a phone number in the deployment modal if you do not have one yet.
4. Retell’s docs say you can attach phone numbers later from the `Phone Numbers` tab.

## 7. `[Retell]` Get the exact `agent_id` and `voice_id`

If the dashboard already shows the raw IDs, copy them there.

If the dashboard does **not** show `voice_id`, do this:

1. take the `agent_id` you already know
2. open [https://docs.retellai.com/api-references/get-agent](https://docs.retellai.com/api-references/get-agent)
3. click `Try it`
4. enter your Retell API key as the Bearer token
5. paste your `agent_id`
6. run the request
7. copy:
   - `agent_id`
   - `voice_id`

Why this is the easiest method:

1. the `Get Voice Agent` response includes the agent’s selected `voice_id` directly
2. you do not need to guess which voice in the full voice list matches the one attached to the agent

Fallback method if you still need the full voice record:

1. open [https://docs.retellai.com/api-references/list-voices](https://docs.retellai.com/api-references/list-voices)
2. click `Try it`
3. enter your Retell API key as the Bearer token
4. run the request
5. find the matching voice
6. copy `voice_id`

Save them for later:

- `agent_id` -> `[standard-chat-bot]` `Integrations` -> `Retell Agent ID`
- `voice_id` -> `[standard-chat-bot]` `Bot Config` -> `Voice ID`

## 8. `[Retell]` Add a payment method

1. Open [https://dashboard.retellai.com](https://dashboard.retellai.com).
2. Open the billing/payment area.
3. Add your payment method.
4. Save it.

## 9. `[Retell]` Buy the phone number

1. Open [https://dashboard.retellai.com](https://dashboard.retellai.com).
2. Open `Phone Numbers`.
3. Buy a number.
4. If Retell asks for area code, choose the one you want.
5. Finish the purchase.
6. Open the newly purchased number’s settings page.
7. Copy the full number in E.164 format, for example `+15551234567`.
8. You will later paste this exact value into:
   - `[standard-chat-bot]` `Integrations` -> `Voice / Retell` -> `From Number`

## 10. `[Retell]` Bind the number to the agent

Retell’s docs say the number only receives and makes calls after you bind agents to it.

On the number settings page:

1. find the inbound agent binding
2. find the outbound agent binding
3. set both to the same Retell agent for this first setup
4. save the number settings

Why this matters for your local code:

1. `standard-chat-bot` rejects the inbound webhook if `call_inbound.agent_id` is missing.
2. Retell’s docs say the number can leave `inbound_agent_id` unset, but you should **not** do that for this setup.

## 11. `[Retell]` Set the number’s inbound webhook

On the same number settings page:

1. find the inbound webhook URL field
2. set it to:
   - `https://<standard-chat-bot-api>/webhooks/retell/inbound`
3. save

Why this matters:

1. Retell’s inbound webhook is how you inject per-call dynamic variables for inbound calls.
2. `standard-chat-bot` uses this route to send `workflow_type=after_hours_inbound`, `caller_number`, `known_lead_name`, `human_handoff_enabled`, and `transfer_number` back to Retell.

## 12. `[Retell]` Set the account-level call event webhook

1. Open [https://dashboard.retellai.com](https://dashboard.retellai.com).
2. Open `Webhooks`.
3. Set the account-level webhook URL to:
   - `https://<standard-chat-bot-api>/webhooks/retell`
4. save

Important:

1. Retell’s docs say if you set an agent-level `webhook_url`, the account-level webhook will **not** fire for that agent.
2. This guide expects the account-level webhook to handle the call event stream.

## 13. `[Retell]` Verify the number and webhook config if the dashboard is unclear

1. Open [https://docs.retellai.com/api-references/list-phone-numbers](https://docs.retellai.com/api-references/list-phone-numbers).
2. Click `Try it`.
3. Enter your Retell API key as the Bearer token.
4. Run the request.
5. Confirm the purchased number has:
   - the correct `phone_number`
   - your agent bound for inbound
   - your agent bound for outbound
   - the correct `inbound_webhook_url`

## 14. `[standard-chat-bot]` Save the Retell connection

Open:

- `https://<standard-chat-bot-web>/agents/<standard-chat-bot-agent-id>/integrations`

Go to `Voice / Retell` and fill these exact fields:

1. `API Key`
   - paste the Retell API key from step 1
2. `Retell Agent ID`
   - paste the `agent_id` from step 7
3. `From Number`
   - paste the Retell phone number from step 9
4. click `Connect Retell` or `Update Retell`

The exact field labels in `standard-chat-bot` are:

- `API Key`
- `Retell Agent ID`
- `From Number`

## 15. `[standard-chat-bot]` Save the voice settings

Open:

- `https://<standard-chat-bot-web>/agents/<standard-chat-bot-agent-id>/bot-config`

Go to `Voice Settings` and fill these exact fields:

1. turn on `Enable Voice`
2. turn on `Voice Follow-Up` if you want outbound voice calls
3. turn on `After-Hours Inbound` if you want inbound after-hours coverage
4. set `Voice Provider` to:
   - `retell`
5. set `Voice ID` to the Retell `voice_id` from step 7
6. if you want transfer, set `Transfer Number`
7. optionally set `Fallback Voice ID`
8. optionally set `Max Call Duration (seconds)`
9. save

The exact field labels in `standard-chat-bot` are:

- `Enable Voice`
- `Voice Follow-Up`
- `After-Hours Inbound`
- `Voice Provider`
- `Voice ID`
- `Fallback Voice ID`
- `Transfer Number`
- `Max Call Duration (seconds)`
- `Allow Voicemail`
- `Human Handoff`

## 16. `[Retell]` Use these sample dynamic variables when testing manually

If the Retell test panel lets you paste dynamic variables, use these.

### Outbound missed appointment test

```json
{
  "workflow_type": "missed_appointment",
  "workflow_goal": "Reconnect after a missed appointment and offer a fast reschedule.",
  "workflow_opening_guidance": "Open with empathy, mention the missed appointment, and ask if they want a new time.",
  "workflow_handoff_rule": "If they ask detailed coverage, pricing, or anything beyond scheduling, offer a human callback.",
  "workflow_context": "Missed appointment window: Tue, Mar 18, 2:00 PM to 2:30 PM EDT",
  "appointment_window_local": "Tue, Mar 18, 2:00 PM to 2:30 PM EDT",
  "lead_name": "John Smith",
  "agent_name": "Nick",
  "company_name": "Nick Insurance",
  "product_type": "mortgage protection",
  "lead_status_label": "Missed appointment",
  "human_handoff_enabled": "true",
  "transfer_number": "+15551234567"
}
```

### Inbound after-hours test

```json
{
  "workflow_type": "after_hours_inbound",
  "caller_number": "+15555550199",
  "known_lead_name": "Jane Doe",
  "agent_name": "Nick",
  "company_name": "Nick Insurance",
  "human_handoff_enabled": "true",
  "transfer_number": "+15551234567"
}
```

## 17. `[standard-chat-bot]` Verify the setup

Open:

- `https://<standard-chat-bot-web>/agents/<standard-chat-bot-agent-id>/voice`

Check all of these:

1. the Retell connection is saved
2. `Voice ID` is not blank
3. `Voice follow-up` is correct
4. `After-hours inbound` is correct
5. the Voice page no longer shows the Retell side as missing

If Retell is connected but runtime still is not ready:

1. check that `Enable Voice` is on
2. check that `Voice ID` is saved
3. check that the voice add-on entitlement is active

## What The Local Code Actually Uses

These facts are from the local codebase, not guesses:

1. Outbound calls are created with the saved Retell `agent_id`.
2. `standard-chat-bot` passes dynamic variables into Retell at call creation time.
3. Inbound after-hours calls are also routed back into the same Retell `agent_id`, with dynamic variables added by the inbound webhook route.
4. `standard-chat-bot` verifies Retell webhooks using the saved Retell API key.
5. `standard-chat-bot` wants a `Voice ID` saved in Bot Config for its own readiness checks, even though the live audible voice is ultimately set on the Retell agent.

## Local File References

- Retell connection form: [/Users/nickneessen/projects/standard-chat-bot/apps/web/src/app/agents/[id]/integrations/page.tsx](/Users/nickneessen/projects/standard-chat-bot/apps/web/src/app/agents/[id]/integrations/page.tsx)
- Voice settings form: [/Users/nickneessen/projects/standard-chat-bot/apps/web/src/app/agents/[id]/bot-config/page.tsx](/Users/nickneessen/projects/standard-chat-bot/apps/web/src/app/agents/[id]/bot-config/page.tsx)
- Outbound Retell call creation: [/Users/nickneessen/projects/standard-chat-bot/apps/api/src/jobs/handlers/trigger-voice-call.handler.ts](/Users/nickneessen/projects/standard-chat-bot/apps/api/src/jobs/handlers/trigger-voice-call.handler.ts)
- Workflow dynamic variables: [/Users/nickneessen/projects/standard-chat-bot/apps/api/src/jobs/handlers/voice-workflow.ts](/Users/nickneessen/projects/standard-chat-bot/apps/api/src/jobs/handlers/voice-workflow.ts)
- Retell inbound webhook route: [/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/webhooks/retell.ts](/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/webhooks/retell.ts)
