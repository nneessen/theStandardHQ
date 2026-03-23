# Handoff: Rewrite Voice Clone Recording Scripts for First-Person Voice

## Context

Voice cloning lets insurance agent subscribers record their own voice to create a custom AI voice. When a cloned voice is active, the AI voice agent **speaks as the agent themselves** — not as an assistant. This is the entire value proposition: leads hear what sounds like their actual insurance agent calling them.

However, the current recording scripts are written with **third-person/assistant framing** — phrases like "this is my assistant calling on behalf of your agent." This is wrong. If the subscriber is recording their own voice so the AI can impersonate them, the scripts must use **first-person framing** — the AI speaks as if it IS the agent.

### The Two Voice Modes

| Mode | Voice | Persona | Example Opening |
|------|-------|---------|-----------------|
| **Stock voice** (default) | Generic AI voice | Assistant | "Hi, this is a calling assistant for Nick at Standard Insurance..." |
| **Cloned voice** | Sounds like the agent | The agent themselves | "Hi, this is Nick from Standard Insurance, I'm calling because..." |

The recording scripts are what the subscriber reads aloud to create the voice clone. They serve two purposes:
1. **Voice capture** — Retell needs 60+ minutes of natural speech in the subscriber's voice to build the clone
2. **Tone training** — The scripts should represent realistic things the AI will actually say using that voice, so the clone sounds natural in context

Since the cloned voice speaks AS the agent, **every script must be written in first person** — as if the agent themselves is on the phone with a lead/client.

---

## What Needs to Change

### Location in standard-chat-bot

The scripts are defined in the shared package and served via the external API:

| Component | Likely Location | Purpose |
|-----------|-----------------|---------|
| Script definitions | `packages/shared/src/schemas/voice.ts` or similar | The 25 scripts with text, categories, metadata |
| API endpoint | `apps/api/src/routes/external/voice.ts` | `GET /agents/:id/voice/clone/scripts` |

Search for the script text content — look for phrases like "assistant", "on behalf of", or the greeting text. The scripts may be defined as a constant array.

### Script Response Shape (do not change the structure)

```json
{
  "segmentIndex": 0,
  "category": "Warm Greetings & Introductions",
  "title": "Morning/Afternoon Greetings",
  "scriptText": "The actual text the user reads aloud...",
  "minDurationSeconds": 180,
  "targetDurationSeconds": 300,
  "optional": false
}
```

**Only rewrite `scriptText` (and `title` if needed).** Do not change `segmentIndex`, `category`, `minDurationSeconds`, `targetDurationSeconds`, or `optional`. Do not change the number of scripts (25) or the API response structure.

---

## Voice Agent Use Cases (What the AI Actually Says)

The voice agent handles these scenarios for insurance agents. The scripts should cover ALL of these conversational contexts:

### 1. Outbound — Missed Appointment Recovery
The agent's lead no-showed a scheduled appointment. The AI calls to reschedule.
- Opening: identify yourself, reference the missed appointment
- Body: express understanding, offer to reschedule
- Objection handling: "I understand you're busy", "It'll only take 15 minutes"
- Close: confirm new time, set expectations

### 2. Outbound — Quoted Follow-Up
A lead received a quote but hasn't responded. The AI calls to follow up.
- Opening: identify yourself, reference the quote
- Body: ask if they had questions, offer to walk through options
- Objection handling: price concerns, "I need to think about it"
- Close: guide toward scheduling a deeper review

### 3. Outbound — General Follow-Up
A lead expressed interest but hasn't moved forward.
- Opening: identify yourself, reference prior conversation
- Body: check in, offer to answer questions
- Warm close: "I just wanted to make sure you had everything you need"

### 4. Inbound — After-Hours
A lead calls outside business hours. The AI answers and helps.
- Greeting: identify yourself, acknowledge after-hours
- Body: gather their need, offer to schedule a callback
- Close: confirm callback time, set expectations

### 5. Inbound — During Business Hours
A lead calls during hours when the agent is unavailable.
- Greeting: identify yourself naturally
- Body: determine what they need, answer basic questions
- Handoff: "Let me get you scheduled with me for a full review"

### 6. Voicemail
The AI reaches voicemail and leaves a message.
- Brief identification, reason for call, callback number
- Keep it under 30 seconds

### 7. Objection Handling & Compliance
- Handling "I'm not interested" gracefully
- Explaining you're a licensed agent (compliance)
- Handling "How did you get my number?"
- DNC respect: "I understand, I'll remove you from our list"

### 8. Appointment Confirmation
- Confirming upcoming appointments
- Providing preparation instructions
- "I'm looking forward to speaking with you"

---

## Script Rewriting Guidelines

### Tone
- **Professional but warm** — insurance agents build trust through relatability
- **Conversational, not robotic** — these are phone calls, not emails
- **Confident but not pushy** — the agent is an expert helping, not a telemarketer selling
- **Natural pauses and filler appropriate** — "So, I was looking at your information and..." reads more naturally than clipped corporate-speak

### Persona Rules
- Always first person: "I", "my", "me" — never "your agent", "the assistant", "on behalf of"
- Use a placeholder `[Name]` where the agent would say a lead's name
- Reference "my office", "my team", "I specialize in" — language that reinforces this IS the agent
- Insurance-specific terminology where natural: "coverage", "policy", "premium", "carrier", "application"

### Duration Targets
Each script should be long enough for the subscriber to speak naturally for the target duration. The minimum is what Retell needs for voice quality; the target produces better results.

- **Short scripts (180s min / 300s target):** These should have enough text for 3-5 minutes of natural reading. Include stage directions like "(pause)" or "(wait for response)" to encourage natural pacing.
- **Longer scripts:** Some categories may have longer targets. Ensure the text fills the time without forcing the reader to stretch or pad.

### Structure per Script
Each script should include:
1. **Opening line** — How the call starts (greeting + identification)
2. **Body** — The main conversational content (2-4 exchanges worth)
3. **Transition/objection** — Handling a common response
4. **Close** — How the call wraps up

The subscriber reads the AGENT SIDE of the conversation only (not the lead's responses). Include brief stage directions in parentheses where the lead would respond, e.g., "(Lead responds)" or "(Pause for response)".

---

## Proposed Script Categories (25 scripts)

Keep the existing category groupings if they make sense, or restructure to cover all use cases. Here's a recommended breakdown:

| Category | Scripts | Count |
|----------|---------|-------|
| **Warm Greetings & Introductions** | Morning greeting, afternoon greeting, evening/after-hours greeting | 3 |
| **Missed Appointment Recovery** | Initial call, voicemail, follow-up if no answer first time | 3 |
| **Quoted Follow-Up** | Initial follow-up, addressing price concerns, re-engagement after silence | 3 |
| **General Follow-Up & Check-In** | New lead follow-up, existing client check-in, referral follow-up | 3 |
| **Inbound Call Handling** | During hours greeting, after-hours greeting, gathering needs | 3 |
| **Appointment Setting & Confirmation** | Offering times, confirming appointment, rescheduling | 3 |
| **Objection Handling** | "Not interested", "Too expensive", "I need to think about it" | 3 |
| **Voicemail Messages** | Missed appointment VM, follow-up VM, general VM | 3 |
| **Compliance & Wrap-Up** | Licensing disclosure, DNC handling, call closing/thank you | 1 |

**Total: 25 scripts**

---

## Example Rewrites

### Before (Current — Wrong)
```
"Good morning, this is my assistant calling on behalf of your agent. I'm reaching out
because we had a chance to look at your information and I wanted to help get something
on the calendar. How are you doing today?"
```

### After (Correct — First Person)
```
"Good morning, [Name]! This is [AgentName] with [Agency]. I hope I'm catching you at
a good time. (Pause for response) Great to hear. So the reason I'm calling — I had a
chance to review the information you submitted, and I found some really solid options
I'd love to walk you through. I think we can get you better coverage than what you have
now, and in a lot of cases we're seeing people save quite a bit on their premiums too.
(Pause for response) What I'd like to do is set up about fifteen or twenty minutes for
us to go over everything together. I can answer any questions you have and we can figure
out what makes the most sense for your situation. Do you have your calendar handy?
(Pause for response) Perfect. I've got some availability this week — would [Day] around
[Time] work for you, or is there a better time? (Pause for response) That works great.
I'll send you a confirmation with all the details. And [Name], if anything comes up
before then or you think of questions, don't hesitate to give me a call back at this
number. I'm looking forward to speaking with you. Have a great rest of your day."
```

### Another Example — Missed Appointment

**Before (Wrong):**
```
"Hi, I'm calling on behalf of your insurance agent regarding a missed appointment..."
```

**After (Correct):**
```
"Hey [Name], this is [AgentName]. I'm calling because we had an appointment set up for
earlier today and I just wanted to make sure everything's okay — I know things come up.
(Pause for response) No worries at all, I totally understand. Life gets busy. The good
news is I still have all your information pulled up and I'd love to get us rescheduled
so we can go over those options I found for you. (Pause for response) Let me take a
look at what I've got open this week. How does [Day] around [Time] sound? Or if
evenings work better for you, I can do that too. (Pause for response) Perfect, I'll
get that on the calendar right now. And [Name], I'll send you a quick reminder the day
before so it's fresh on your radar. Sound good? (Pause for response) Great. Talk to
you then — take care."
```

### Voicemail Example

```
"Hey [Name], it's [AgentName] from [Agency]. I was giving you a call because I had a
chance to look into some coverage options for you and I found a few things I think
you're really going to like. Give me a call back when you get a chance — my number is
[PhoneNumber]. I'm available most of the day, so whenever works for you. Looking
forward to connecting. Take care."
```

---

## Important Constraints

1. **Do NOT change the API response structure** — CommissionTracker's wizard consumes `segmentIndex`, `category`, `title`, `scriptText`, `minDurationSeconds`, `targetDurationSeconds`, `optional`
2. **Keep exactly 25 scripts** — the minimum segments to submit (20) and total (25) are hardcoded in business rules
3. **Keep `minDurationSeconds` and `targetDurationSeconds` reasonable** — the scripts need to be long enough to fill the time naturally. If a script's target is 300 seconds (5 min), the text should support ~5 minutes of natural speech.
4. **Use `[AgentName]`, `[Name]`, `[Agency]`, `[PhoneNumber]`, `[Day]`, `[Time]` as placeholders** — the wizard UI can display these literally; the subscriber substitutes their own info while reading
5. **Include `(Pause for response)` stage directions** — this helps the subscriber maintain natural pacing and produces better voice quality
6. **Every script must stand alone** — the subscriber may record them in any order across multiple sessions
7. **No emojis in script text**
8. **Insurance-industry appropriate language** — these are licensed insurance agents, not generic salespeople

---

## Verification

After rewriting the scripts:

1. Read each script aloud and time it — does it fill the `targetDurationSeconds` naturally?
2. Does every script use first-person "I/me/my" language with zero third-person "your agent/assistant" references?
3. Do the 25 scripts collectively cover all 8 use case categories listed above?
4. Are the `(Pause for response)` directions placed where a real conversation would have back-and-forth?
5. Call the API: `GET /api/external/agents/{testAgentId}/voice/clone/scripts` — verify 25 scripts returned with correct structure
6. Test in CommissionTracker wizard: navigate to `/voice-agent/clone`, start a session, verify scripts display correctly in the sidebar grouped by category

**Test agent ID:** `662d3063-d5cc-4148-b218-1dc7eec97e7b`

---

## Files to Find and Modify in standard-chat-bot

| What to Find | Search For | Expected Location |
|-------------|-----------|-------------------|
| Script definitions (the 25 scripts array) | `scriptText`, `segmentIndex`, `Warm Greetings`, `minDurationSeconds` | `packages/shared/src/schemas/voice.ts` or `packages/shared/src/constants/` |
| API endpoint serving scripts | `clone/scripts`, `getScripts`, `RECORDING_SCRIPTS` | `apps/api/src/routes/external/voice.ts` or `apps/api/src/services/voice-clone.service.ts` |

The scripts may be a constant array exported from the shared package, or they may be stored in a database table. Either way, the text content needs to be rewritten.

---

## Summary

| Item | Status |
|------|--------|
| Problem | Recording scripts use assistant/third-person framing |
| Fix | Rewrite all 25 scripts to first-person agent framing |
| Scope | Text content only — no structural/API changes |
| Risk | Zero — content change, no code logic affected |
| CommissionTracker impact | None — scripts are fetched from API, wizard renders whatever is returned |
