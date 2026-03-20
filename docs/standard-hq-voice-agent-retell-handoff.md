# Standard HQ Voice Agent Retell Handoff

## Purpose

This document is the working handoff for the AI Voice Agent feature inside Standard HQ.

The goal is:

- Standard HQ is the operator-facing control surface for the voice product.
- Users should be able to configure and fine-tune their voice agent from Standard HQ without needing direct access to Retell.
- `standard-chat-bot` remains the runtime and storage system behind the product.
- Voice remains a separate paid add-on from the AI Chat Bot.
- Self-serve checkout for voice is still blocked for now.

This handoff covers:

- what is already done
- what still needs to be wired or refined in Standard HQ
- the backend contract that Standard HQ now depends on
- the deployment sequence required before live testing
- the next implementation priorities

## Product Direction

Treat the AI Voice Agent as a first-class product inside Standard HQ.

That means Standard HQ should expose:

- Retell connection setup
- caller ID configuration
- workspace-level voice runtime toggles
- live Retell draft agent editing
- live Retell LLM editing
- Retell voice library management
- publish controls
- entitlement status
- sync status
- minute usage

Do not position Voice as something users must go configure in another app.

Do not use repo-name wording in UI copy. Use:

- `Standard HQ`
- `AI Voice Agent`
- `AI Chat Bot`
- `Retell`

Avoid old wording like:

- `managed outside`
- `configured in standard-chat-bot`
- `runtime owner`

Those assumptions are now obsolete from the Standard HQ product perspective.

## What Is Already Done

### 1. External Retell runtime API exists on the backend

The `standard-chat-bot` API now exposes external Retell runtime routes:

- `GET /api/external/agents/:id/retell/runtime`
- `PATCH /api/external/agents/:id/retell/agent`
- `POST /api/external/agents/:id/retell/agent/publish`
- `GET /api/external/agents/:id/retell/llm`
- `PATCH /api/external/agents/:id/retell/llm`
- `GET /api/external/agents/:id/retell/voices`
- `POST /api/external/agents/:id/retell/voices/search`
- `POST /api/external/agents/:id/retell/voices/add`

Supporting backend files:

- `apps/api/src/routes/external/retell.ts`
- `apps/api/src/services/retell-runtime.service.ts`
- `apps/api/src/plugins/services.ts`
- `apps/api/src/routes/external/index.ts`

### 2. Retell connection routes already exist

The backend already supports:

- `GET /api/external/agents/:id/connections/retell`
- `POST /api/external/agents/:id/connections/retell`
- `PATCH /api/external/agents/:id/connections/retell`
- `DELETE /api/external/agents/:id/connections/retell`

Important connection fields:

- `apiKey`
- `retellAgentId`
- `fromNumberSource`
- `fromNumber`
- `closePhoneNumber`

Relevant files:

- `apps/api/src/routes/external/connections.ts`
- `packages/shared/src/schemas/connection.ts`

### 3. Standard HQ edge function proxy is wired for Retell

The Standard HQ `chat-bot-api` edge function now proxies:

- Retell connection create/update/delete
- Retell runtime read
- Retell voices list/search/add
- Retell draft update
- Retell draft publish
- Retell LLM read/update

It also now includes voice config fields and `connections.retell` in `get_agent`.

Relevant file:

- `supabase/functions/chat-bot-api/index.ts`

### 4. Standard HQ React hooks are wired

The chat-bot hook layer now exposes:

- `useChatBotAgent`
- `useChatBotRetellRuntime`
- `useChatBotRetellLlm`
- `useChatBotRetellVoices`
- `useSaveRetellConnection`
- `useDisconnectRetellConnection`
- `useUpdateRetellAgentDraft`
- `usePublishRetellAgentDraft`
- `useUpdateRetellLlm`
- `useSearchRetellVoices`
- `useAddRetellVoice`
- `useUpdateBotConfig`

Relevant files:

- `src/features/chat-bot/hooks/useChatBot.ts`
- `src/features/chat-bot/index.ts`

### 5. The Voice Agent page is no longer status-only

The Voice Agent route now includes actual setup/config surfaces:

- Retell connection card
- workspace voice runtime config card
- live Retell studio card
- status card
- usage card

Relevant files:

- `src/features/voice-agent/VoiceAgentPage.tsx`
- `src/features/voice-agent/components/VoiceAgentConnectionCard.tsx`
- `src/features/voice-agent/components/VoiceAgentRuntimeCard.tsx`
- `src/features/voice-agent/components/VoiceAgentRetellStudioCard.tsx`
- `src/features/voice-agent/components/VoiceAgentLanding.tsx`
- `src/features/voice-agent/components/VoiceAgentStatusCard.tsx`
- `src/features/voice-agent/components/VoiceAgentUsageCard.tsx`
- `src/features/voice-agent/lib/retell-config.ts`

### 6. Sidebar item already exists

The AI Voice Agent nav item is already present in the Standard HQ sidebar.

Relevant file:

- `src/components/layout/Sidebar.tsx`

### 7. Validation already passed

These checks already passed after the current implementation:

- `pnpm typecheck`
- `pnpm vitest run src/features/chat-bot/__tests__/get-agent-contract.test.ts`
- `pnpm --filter @standard-chat-bot/api type-check`

## Current UX Model In Standard HQ

The Voice Agent page should now be understood as having four layers:

### Layer 1. Commercial state

This shows:

- plan
- rollout status
- sync state
- entitlement
- usage

Files:

- `VoiceAgentLanding.tsx`
- `VoiceAgentStatusCard.tsx`
- `VoiceAgentUsageCard.tsx`

### Layer 2. Workspace runtime config

This controls the product-level flags used by the voice system:

- `voiceEnabled`
- `voiceFollowUpEnabled`
- `afterHoursInboundEnabled`
- `afterHoursStartTime`
- `afterHoursEndTime`
- `afterHoursTimezone`
- `voiceProvider`
- `voiceId`
- `voiceFallbackVoiceId`
- `voiceTransferNumber`
- `voiceMaxCallDurationSeconds`
- `voiceVoicemailEnabled`
- `voiceHumanHandoffEnabled`
- `voiceQuotedFollowupEnabled`

File:

- `VoiceAgentRuntimeCard.tsx`

### Layer 3. Retell connection

This controls the workspace’s live Retell connection:

- Retell API key
- Retell agent ID
- caller ID source
- Retell number
- optional Close/Twilio caller ID path

File:

- `VoiceAgentConnectionCard.tsx`

### Layer 4. Live Retell studio controls

This is the Retell-like control surface:

- draft agent JSON editor
- LLM JSON editor
- publish button
- voice library
- provider voice search
- provider voice import

File:

- `VoiceAgentRetellStudioCard.tsx`

## Important Constraint

The new Retell editing tabs in Standard HQ depend on the updated `standard-chat-bot` API being deployed.

If Standard HQ is still calling an older deployed API, then:

- Retell connection save may work partially
- voice usage/status may still work
- but the Retell draft/LLM/voice-library tabs will fail or show missing data

This is not a frontend bug. It is a deployment mismatch.

## Deployment Sequence Required Before Live Testing

Follow this order.

### 1. Deploy the `standard-chat-bot` API changes

Required because Standard HQ now depends on the new external Retell routes.

Deploy the backend that includes:

- `routes/external/retell.ts`
- `services/retell-runtime.service.ts`
- updated `routes/external/index.ts`
- updated service registration

### 2. Confirm the Standard HQ edge function points to the updated API

Verify environment variables for the Standard HQ `chat-bot-api` edge function:

- `STANDARD_CHAT_BOT_API_URL`
- `STANDARD_CHAT_BOT_EXTERNAL_API_KEY`

The URL must point to the deployed backend that includes the new Retell routes.

### 3. Deploy the Standard HQ edge function changes

Required file:

- `supabase/functions/chat-bot-api/index.ts`

### 4. Run Standard HQ locally

Then test the Voice Agent page in Standard HQ with:

- local frontend
- local or deployed edge function
- deployed `standard-chat-bot` API

### 5. Only after that, test the live agent flow

The live flow should come after the control surface is confirmed working:

- connect Retell
- load runtime
- edit draft
- publish draft
- verify webhook config
- verify voice/caller ID
- then place test calls

## What To Test In Standard HQ

### Retell connection

On the Voice Agent page:

1. connect a Retell API key and Retell agent ID
2. choose Retell-managed caller ID
3. save
4. confirm the connection summary refreshes

Expected:

- `get_agent` shows `connections.retell`
- `get_retell_runtime` loads
- Retell draft panel unlocks

### Runtime config

Toggle and save:

- voice enabled
- voice follow-up enabled
- after-hours inbound enabled
- voicemail enabled
- human handoff enabled
- quoted follow-up enabled

Then change:

- timezone
- after-hours window
- transfer number
- max duration

Expected:

- values persist after refresh
- `get_agent` returns the updated voice fields

### Draft agent editor

Update a safe live field in the draft JSON, for example:

- `voice_id`
- `voice_speed`
- `voice_temperature`
- `language`
- `webhook_url`
- `webhook_events`
- `ring_duration_ms`
- `boosted_keywords`

Then save.

Expected:

- save succeeds
- refresh shows updated draft values

### LLM editor

Update a safe LLM field:

- `general_prompt`
- `begin_message`
- `model`
- `model_temperature`

If the connected Retell agent is using `retell-llm`, save should succeed.

If it is not using `retell-llm`, the page should explain that clearly.

### Publish flow

Click publish.

Expected:

- publish mutation succeeds
- runtime refresh reflects the published state

### Voice library

Search a provider voice, ideally `elevenlabs`.

Then:

1. import it into the Retell library
2. verify it appears in the current library list
3. set the imported `voice_id` in the draft agent JSON
4. save draft
5. publish

## Recommended Next Standard HQ Work

The current implementation is functional, but the Retell fine-tuning layer is still too raw for a paid production product.

The next priorities should be:

### Priority 1. Replace raw JSON-only editing with structured Retell sections

The current JSON editors are useful for power users and unblock the feature, but they are not enough for a premium operator workflow.

Add structured sections that map to the Retell dashboard categories:

- Speech Settings
- Realtime Transcription Settings
- Call Settings
- Post-Call Data Extraction
- Security & Fallback Settings
- Webhook Settings
- Functions
- Knowledge Base
- MCPs

Suggested approach:

- keep the raw JSON editor as an advanced fallback
- add structured forms for common fields
- write changes back into the JSON patch payloads

### Priority 2. Better field-level validation

Add validation before save for:

- phone numbers
- webhook URLs
- JSON schema shape
- timeout ranges
- duration ranges
- voice speed and temperature bounds
- voice provider consistency

### Priority 3. Better ElevenLabs-focused workflow

Voice quality is a key selling point.

Add a smoother path for:

- searching ElevenLabs voices
- previewing/importing the chosen voice
- pushing imported voice IDs into the draft agent form
- surfacing recommended fallback voice guidance

### Priority 4. Dirty-state clarity

Add clearer save-state UX:

- unsaved changes indicators
- reset to live state
- save success confirmation per section
- publish-needed indicator when draft changes are saved but not published

### Priority 5. Narrow the advanced editor to safe editable fields

The current implementation already filters to editable Retell keys, but the UX should make that more explicit.

Improve this by:

- grouping fields visually
- showing descriptions beside fields
- preventing obviously invalid payload structure before submission

### Priority 6. Add route-level readiness checks

The page should make it obvious when the workspace is blocked by missing prerequisites:

- no AI Chat Bot provisioned
- no Retell connection
- no voice entitlement
- backend deploy mismatch
- live Retell runtime unavailable

## Known Gaps Still Remaining

These are the main things not yet complete.

### 1. The Retell editor is still partly “advanced mode”

The current live draft and LLM editing is powerful, but it still expects JSON comfort.

That is acceptable for internal use and immediate testing, but not ideal for the final paid operator experience.

### 2. Voice purchase is still intentionally blocked

That is expected.

The UI can show the product and let operators configure it, but self-serve purchase should remain unavailable until explicitly enabled.

### 3. Live testing still depends on deployment alignment

If Standard HQ points at a backend that does not have the new Retell external routes, the new voice control surface will not work correctly.

### 4. Some copy still likely needs cleanup outside the Voice Agent page

Search Standard HQ for old assumptions and remove any wording that implies voice config must happen in another app.

## Files To Review First In Standard HQ

Start with these files in this order:

1. `supabase/functions/chat-bot-api/index.ts`
2. `src/features/chat-bot/hooks/useChatBot.ts`
3. `src/features/chat-bot/index.ts`
4. `src/features/voice-agent/VoiceAgentPage.tsx`
5. `src/features/voice-agent/components/VoiceAgentConnectionCard.tsx`
6. `src/features/voice-agent/components/VoiceAgentRuntimeCard.tsx`
7. `src/features/voice-agent/components/VoiceAgentRetellStudioCard.tsx`
8. `src/features/voice-agent/components/VoiceAgentLanding.tsx`
9. `src/features/voice-agent/components/VoiceAgentStatusCard.tsx`
10. `src/features/chat-bot/__tests__/get-agent-contract.test.ts`

## Recommended Implementation Order For The Next Standard HQ Session

When resuming inside Standard HQ, do the work in this order:

1. Verify the deployed backend includes the new external Retell routes.
2. Verify the Standard HQ edge function points to that updated backend.
3. Open the Voice Agent page and confirm the connection card renders.
4. Connect the live Retell agent.
5. Confirm runtime, LLM, and voices load.
6. Save a small draft change and publish it.
7. If that works, replace the raw JSON-first editing experience with structured Retell sections.
8. Then tighten validations and UX polish.

## Product Copy Guidance

When writing Standard HQ UI copy for this feature:

- say `AI Voice Agent`
- say `Retell`
- say `Standard HQ`
- say `voice add-on`
- say `publish draft`
- say `caller ID`

Do not say:

- `managed in another app`
- `configured elsewhere`
- `runtime owner is ...`
- repo names in customer-facing text

## Bottom Line

The missing foundation is now in place:

- backend external Retell management routes exist
- Standard HQ edge-function contract exists
- Standard HQ hooks exist
- Standard HQ Voice Agent page is now a real control surface

The next phase inside Standard HQ is no longer “start from scratch.”

It is:

- deploy the updated backend
- confirm the control surface works against the live API
- then upgrade the advanced JSON editing experience into a polished structured Retell configuration product
