# Prompt for standard-chat-bot: Voice Clone & Voice Schedule Overhaul

Paste this entire prompt into Claude Code in the standard-chat-bot project.

---

I need you to implement three things in this codebase. Read the relevant files first, then implement.

## 1. Fix Voice Clone Recording Scripts — Must Be First Person

The voice clone recording scripts (the 25 scripts users read aloud to create their voice clone) are currently written in **third person / assistant framing**. This is wrong.

When a user clones their voice, the AI voice agent speaks **as if it IS that human agent** — first person. The scripts need to match, because:
- The scripts are what the user reads aloud to train the voice clone
- The clone will be used during business hours to sound like the actual agent
- Scripts should represent realistic things the AI will say using that voice

**Current (wrong):** "Good morning, this is my assistant calling on behalf of your agent. I'm reaching out because we had a chance to look at your information..."

**Correct (first person):** "Good morning, this is [pause] from [pause] Insurance. I'm reaching out because I had a chance to look at your information and I wanted to help get something on the calendar..."

### Rules for rewriting:
- Every script must be **first person** — the speaker IS the insurance agent
- Use `[pause]` where the agent's name or agency name would go (since these are generic recording scripts)
- Cover all use cases the voice agent handles:
  - Outbound: missed appointment recovery, follow-up calls, quoted follow-up
  - Inbound: after-hours calls, general inquiries
  - Objection handling: "not interested", "how much does it cost?", "I already have an agent", "call me back later"
  - Transfer/handoff: when to connect to a live person
  - Qualification: asking about coverage type, state, DOB, current coverage
  - Closing/scheduling: booking appointments, confirming times
  - Voicemail: leaving a voicemail message
- Keep the same number of scripts (25), same categories, same structure
- Only change `scriptText` and `title` — do NOT change `segmentIndex`, `category`, `minDurationSeconds`, `targetDurationSeconds`, or `optional`
- Scripts should sound natural and conversational, not robotic
- Include natural speech patterns: "um", "you know", brief pauses — this helps the voice clone sound more human

Find the scripts — likely in `packages/shared/src/schemas/voice.ts` or similar. Search for the script text content.

## 2. Voice Schedule: Business Hours vs After Hours Voice & Persona Switching

Implement time-based voice and persona switching for agents that have a cloned voice active.

### The two modes:

| Time | Voice | Persona | Prompt framing |
|------|-------|---------|----------------|
| **Business hours** | User's cloned voice (`activeVoiceId`) | The agent themselves | First person: "Hi, this is Nick from ABC Insurance..." |
| **After hours** | Stock/default voice (original `voice_id` before clone was activated) | Agent's assistant | Third person: "Hi, this is an assistant calling on behalf of Nick at ABC Insurance..." |

### What already exists:
- The agent config already has `afterHoursStartTime`, `afterHoursEndTime`, `afterHoursTimezone` fields
- The agent config has `voiceId` (current active voice) and voice clone status tracking
- The Retell agent has a `voice_id` field that determines the voice used on calls

### What needs to happen:
1. When a voice clone is activated, store BOTH the cloned voice ID AND the original stock voice ID on the agent config (e.g. `clonedVoiceId` and `stockVoiceId`)
2. Before each outbound call (and when routing inbound calls), check the current time against the agent's business hours
3. If within business hours AND agent has an active clone:
   - Set Retell agent `voice_id` to the cloned voice
   - Use first-person prompt framing in the system prompt ("You are [Agent Name] from [Agency]...")
4. If after hours OR no active clone:
   - Set Retell agent `voice_id` to the stock voice
   - Use third-person prompt framing ("You are a professional assistant calling on behalf of [Agent Name] at [Agency]...")
5. The prompt framing switch should happen dynamically — either by having two prompt templates that get selected at call time, or by prepending a persona context block to the existing prompt

### Important edge cases:
- If no clone is active, always use stock voice + assistant persona (no time check needed)
- If no business hours are configured, default to always using the cloned voice + first person (assume always business hours)
- The Retell `voice_id` swap needs to happen BEFORE the call is placed, not during
- Consider timezone correctly — use the agent's configured `afterHoursTimezone`

## 3. Voice Clone Session Reset / Redo Capability

Currently users get 3 lifetime attempts to clone their voice, and there's no way to:
- Reset a session that's in progress
- Redo recordings after they've been completed
- Start fresh if they're unhappy with the result

### Implement:
1. **Reset in-progress session** — Add a `POST /agents/:id/voice/clone/:cloneId/reset` endpoint that:
   - Deletes all uploaded segments for the session
   - Resets the session back to "recording" state with 0 completed segments
   - Does NOT consume an additional attempt (it's the same session)

2. **Increase or remove attempt limit** — Either:
   - Increase from 3 to unlimited (recommended — there's no real cost to letting users re-record)
   - Or add an admin endpoint to reset attempt count for a specific agent

3. **Allow re-cloning when a clone is already active** — Users should be able to start a new clone session even if they have an active clone. The old clone stays active until the new one is activated.

4. **Expose the reset in the API response** — Make sure `VoiceCloneStatus` response includes a flag like `canReset: boolean` so the frontend knows when to show a reset button.

---

## Implementation order:
1. Scripts fix first (smallest change, highest impact)
2. Session reset/redo (unblocks users who are stuck)
3. Voice schedule (largest change, needs careful testing)

## After implementation:
- Run all existing tests
- Test the scripts endpoint returns first-person text
- Test the reset endpoint works on an in-progress session
- Test the voice schedule by mocking different times against business hours config
