# Handoff: Voice Clone Scripts — Bug Fix + Customization

## Priority 1: Fix segmentIndex Upload Error (BUG)

### Problem
Users get HTTP 422: `"segmentIndex must be 0-24"` when trying to upload a recorded voice clone segment.

### Root Cause (likely)
The `GET /api/external/agents/:agentId/voice/clone/scripts` endpoint returns scripts with `segmentIndex` values. The upload endpoint `POST /api/external/agents/:agentId/voice/clone/:cloneId/segments` validates that `segmentIndex` is in range [0, 24].

**Suspected issue:** The scripts are returning 1-indexed values (1-25) instead of 0-indexed (0-24), or the initial `activeIndex` in the frontend starts at 0 but doesn't match what the backend expects.

### How to Debug
1. Log the actual `segmentIndex` values returned from `GET .../voice/clone/scripts`
2. Verify they are 0-indexed: first script = 0, last script = 24
3. If they're 1-indexed, fix the response to be 0-indexed
4. Also verify the upload validation range matches the script range

### Files in standard-chat-bot
- Wherever `GET /api/external/agents/:agentId/voice/clone/scripts` is handled
- Wherever `POST /api/external/agents/:agentId/voice/clone/:cloneId/segments` validates `segmentIndex`

### Frontend (this repo) — no changes needed
- `src/features/voice-agent/components/clone-wizard/SegmentRecorder.tsx` sends `script.segmentIndex` directly from the scripts response
- `src/features/voice-agent/components/clone-wizard/RecordingStep.tsx` initializes `activeIndex = 0` and finds scripts by `segmentIndex`

---

## Priority 2: Make Voice Clone Scripts Editable Per Agent

### Problem
The 25 recording scripts are currently static/hardcoded in the backend. Users cannot customize them. In insurance, every agent has different products, different markets, different conversation styles — the scripts need to be personalized.

### Requirements

#### Backend Changes (standard-chat-bot)

**New endpoints needed:**

1. `GET /api/external/agents/:agentId/voice/clone/scripts`
   - **Current behavior:** Returns hardcoded static scripts
   - **New behavior:**
     - If agent has custom scripts stored → return those
     - If no custom scripts → return default scripts (current behavior)
     - Response shape stays the same: `{ scripts: VoiceCloneScript[], totalSegments: number, minimumAudioMinutes: number }`

2. `PUT /api/external/agents/:agentId/voice/clone/scripts`
   - **New endpoint** — saves custom scripts for this agent
   - Request body:
     ```json
     {
       "scripts": [
         {
           "segmentIndex": 0,
           "category": "Introduction",
           "title": "Who you are",
           "scriptText": "Hi, my name is Nick Neessen and I'm a licensed insurance agent with...",
           "minDurationSeconds": 120,
           "targetDurationSeconds": 300,
           "optional": false
         }
       ]
     }
     ```
   - Validation rules:
     - `segmentIndex` must be 0-indexed, unique, sequential
     - Maximum 25 scripts (indices 0-24)
     - Minimum 15 scripts (to ensure enough training data for voice cloning)
     - `scriptText` required, non-empty
     - `minDurationSeconds` >= 30, `targetDurationSeconds` >= `minDurationSeconds`
   - Returns the saved scripts

3. `DELETE /api/external/agents/:agentId/voice/clone/scripts`
   - **New endpoint** — resets to defaults (deletes custom scripts)
   - Returns the default scripts

**Storage:**
- New table or document store: `agent_voice_clone_scripts`
- Schema: `agentId` (FK), `scripts` (JSONB array), `updatedAt`
- One row per agent (upsert on PUT)

#### Edge Function Changes (this repo)

New action cases in `chat-bot-api/index.ts`:

```typescript
case "update_voice_clone_scripts": {
  const { scripts } = body;
  const res = await callChatBotApi(
    "PUT",
    `/api/external/agents/${agentId}/voice/clone/scripts`,
    { scripts },
  );
  return sendResult(res);
}

case "reset_voice_clone_scripts": {
  const res = await callChatBotApi(
    "DELETE",
    `/api/external/agents/${agentId}/voice/clone/scripts`,
  );
  return sendResult(res);
}
```

#### Frontend Changes (this repo)

After the backend endpoints exist, we'll build:

1. **Script Editor UI** in the voice clone wizard — before the recording step, let users review and edit each script's text
2. **"Reset to defaults"** button to restore the original scripts
3. **New hooks**: `useUpdateVoiceCloneScripts`, `useResetVoiceCloneScripts`
4. **Script staleTime** changes from `Infinity` to normal (since scripts are now mutable)

### Script Data Shape

```typescript
interface VoiceCloneScript {
  segmentIndex: number;    // 0-24, sequential
  category: string;        // e.g., "Introduction", "Objection Handling"
  title: string;           // e.g., "Who you are"
  scriptText: string;      // The text the user reads aloud
  minDurationSeconds: number;     // Minimum recording length
  targetDurationSeconds: number;  // Recommended recording length
  optional: boolean;       // Can be skipped
}
```

### Categories (for reference)

The current 25 scripts cover these categories:
1. Introduction / Identity (who you are, your agency)
2. Product descriptions (mortgage protection, term life, IUL, final expense, Medicare)
3. Qualification questions (coverage type, state, DOB, existing coverage)
4. Pricing handling (bridging to appointments)
5. Objection handling ("not interested", "already have an agent", "how much")
6. Appointment scheduling language
7. Transfer/handoff language
8. After-hours greeting
9. Follow-up call openings
10. Closing / goodbye phrases

### Why This Matters

Insurance agents sell different products, work different markets, and have different conversation styles. A Medicare specialist's scripts are completely different from a mortgage protection agent's scripts. The current one-size-fits-all scripts mean:
- Agents are reading text that doesn't match how they actually talk
- The cloned voice doesn't learn the agent's real vocabulary and cadence
- Training data quality suffers, producing a less convincing clone
