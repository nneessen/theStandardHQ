# Standard-Chat-Bot Voice API Verification Prompt

Copy/paste this into a Claude instance running inside the `standard-chat-bot` project.

---

## Prompt

I need you to verify and fix three voice-related API capabilities in this codebase. The commissionTracker frontend relies on these endpoints, and users are reporting that publishing and clone cancellation don't work. I also need you to verify that `blockedLeadStatuses` filtering applies to voice calls (inbound and outbound), not just SMS — and that the implementation shares code with the existing SMS bot filtering rather than duplicating it.

### 1. Verify: Voice Agent Publishing

**Expected endpoint**: `POST /api/external/agents/:agentId/retell/agent/publish`

- This should publish the Retell agent draft to live (calling Retell SDK's equivalent of making the draft the active agent).
- The commissionTracker frontend calls this via `publish_retell_agent` action → edge function proxy → this endpoint.
- **Verify**: Does this route exist? Does it actually call the Retell SDK to publish? What does it return on success/failure?
- **If missing or broken**: Implement it. The Retell SDK should have a method to publish/promote a draft agent.

### 2. Verify: Voice Clone Cancellation

**Expected endpoint**: `DELETE /api/external/agents/:agentId/voice/clone/:cloneId`

- This should cancel/abandon an in-progress voice clone session.
- The commissionTracker frontend calls this via `cancel_voice_clone` action → edge function proxy → this endpoint.
- **Verify**: Does this route exist? Does it actually delete/cancel the clone on Retell's side? What happens to uploaded audio segments?
- **If missing or broken**: Implement it. It should clean up any Retell-side clone resources and mark the clone as cancelled in the database.

### 3. Verify & Implement: Blocked Lead Statuses for Voice Calls

**Expected behavior**: When `blockedLeadStatuses` is set on an agent config (via `PATCH /api/external/agents/:agentId`), voice calls (both inbound and outbound) should be filtered the same way SMS messages are.

**Key questions**:
- Where does the SMS bot check `blockedLeadStatuses` before responding to a message? Find that code.
- Does the voice call handler (both inbound pickup and outbound dial) check `blockedLeadStatuses` before proceeding?
- **If not**: Wire it up. The critical requirement is **code reuse** — the same filtering function that checks blocked statuses for SMS should be called for voice. Do NOT duplicate the filtering logic. Create a shared utility if one doesn't exist.

**Architecture principle**: The `blockedLeadStatuses` field is already stored on the agent config (it's in `BOT_CONFIG_ALLOWED_KEYS` in the contract). The check should happen:
- **Inbound voice**: When a call comes in, before the Retell agent picks up, look up the lead by phone number in Close CRM → check if lead status is in `blockedLeadStatuses` → if blocked, don't answer (let it ring/go to voicemail).
- **Outbound voice**: Before placing an outbound call, check the target lead's status → if blocked, skip the call.

### 4. Verify: Voice Entitlement Endpoints

While you're at it, confirm these endpoints exist and work (commissionTracker billing integration depends on them):

- `PUT /api/external/agents/:agentId/voice-entitlement` (upsert with idempotency key)
- `POST /api/external/agents/:agentId/voice-entitlement/cancel`
- `GET /api/external/agents/:agentId/voice-entitlement`
- `GET /api/external/agents/:agentId/voice-usage`
- `POST /api/external/agents/:agentId/voice/agent/create` (provisions Retell agent + phone number)
- `GET /api/external/agents/:agentId/connections/retell` (returns `fromNumber`, `retellAgentId`, status)

### Output

For each item above, report:
1. **Status**: Working / Missing / Broken
2. **File path**: Where the route handler lives
3. **What you fixed** (if anything)
4. **Shared code**: For blocked lead statuses, confirm the filtering logic is shared between SMS and voice (not duplicated)

If you need to create a shared utility for lead status filtering, put it somewhere both the SMS handler and voice handler can import it (e.g., `src/services/lead-filtering.ts` or similar). The function signature should be something like:

```typescript
function isLeadBlocked(leadStatus: string, blockedStatuses: string[]): boolean
```

Or if it needs to do the Close CRM lookup:

```typescript
async function shouldBlockLead(agentId: string, phoneNumber: string): Promise<{ blocked: boolean; reason?: string }>
```
