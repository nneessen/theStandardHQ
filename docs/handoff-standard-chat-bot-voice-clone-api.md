# Handoff: Voice Clone API Endpoints for commissionTracker

## Context

Voice cloning lets subscribers record their own voice and use it for all AI voice calls.
The recording wizard currently lives inside the standard-chat-bot web app. commissionTracker
links out to it, which breaks the product UX — subscribers should never leave commissionTracker
to configure their agent.

**Goal:** Expose the voice clone operations as external API endpoints so commissionTracker
can build a native recording wizard. commissionTracker already proxies all agent operations
through `chat-bot-api` edge function → standard-chat-bot external API. Voice cloning
should follow the same pattern.

---

## What Already Exists

| Feature | Endpoint | Status |
|---------|----------|--------|
| Clone status | `GET /api/external/agents/{id}/voice/clone-status` | Working |

The status endpoint returns:

```json
{
  "hasActiveClone": false,
  "activeVoiceId": null,
  "inProgressCloneId": "uuid-or-null",
  "completedSegments": 12,
  "totalSegments": 25,
  "remainingAttempts": 3
}
```

This is the ONLY endpoint. No mutations exist.

---

## New Endpoints Needed

All endpoints follow the existing external API pattern:
- Auth: `X-API-Key` header (same key as all other external endpoints)
- Base path: `/api/external/agents/{agentId}/voice/clone`
- JSON request/response bodies (except audio upload which is multipart)

### 1. Get Recording Scripts

Returns the list of guided scripts/phrases the user needs to record.

```
GET /api/external/agents/{agentId}/voice/clone/scripts
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "scripts": [
      {
        "id": 1,
        "title": "Introduction",
        "text": "Hi, this is [Name]. I'm calling to follow up on...",
        "estimatedDurationSeconds": 45,
        "tips": "Speak naturally, as if talking to a real client"
      }
    ],
    "totalSegments": 25,
    "minimumSegments": 20,
    "minimumAudioMinutes": 60
  }
}
```

**Why:** commissionTracker needs the script list to render the recording UI with prompts.
The scripts may change over time (better phrases, different ordering) so they should
come from the backend, not be hardcoded in commissionTracker.

---

### 2. Start Clone Session

Creates a new clone attempt. Returns a session ID for subsequent segment uploads.

```
POST /api/external/agents/{agentId}/voice/clone/start
```

**Request body:**

```json
{
  "voiceName": "Nick's Voice"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "cloneId": "uuid",
    "status": "recording",
    "remainingAttempts": 2
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 409 | `CLONE_IN_PROGRESS` | A clone session is already active |
| 403 | `NO_ATTEMPTS_REMAINING` | All 3 lifetime attempts used |
| 403 | `NO_VOICE_ENTITLEMENT` | Voice entitlement not active |

**Why:** Decrements the remaining attempts counter and creates the session record.
Prevents starting multiple concurrent sessions.

---

### 3. Upload Audio Segment

Uploads a single recorded audio segment for a specific script.

```
POST /api/external/agents/{agentId}/voice/clone/{cloneId}/segments
```

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | audio file | yes | Recorded audio (webm, ogg, mp3, mp4, m4a, wav) |
| `scriptId` | number | yes | Which script this recording is for |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "segmentId": "uuid",
    "scriptId": 1,
    "durationSeconds": 52,
    "completedSegments": 13,
    "totalSegments": 25,
    "totalAudioMinutes": 34.5
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 404 | `CLONE_NOT_FOUND` | Clone session doesn't exist or is not in `recording` status |
| 400 | `INVALID_AUDIO` | File format not supported or file is empty/corrupt |
| 400 | `SEGMENT_TOO_LONG` | Single segment exceeds 10 minute limit |
| 409 | `SEGMENT_EXISTS` | This scriptId already has a recording (use re-record endpoint) |

**Notes:**
- Max file size: 50MB per segment
- Allowed formats: webm, ogg, mpeg, mp3, mp4, m4a, wav
- Duration limit: 600 seconds (10 minutes) per segment

---

### 4. Re-record a Segment

Replaces a previously uploaded segment for a specific script.

```
PUT /api/external/agents/{agentId}/voice/clone/{cloneId}/segments/{scriptId}
```

**Request:** `multipart/form-data` (same as upload)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | audio file | yes | New recording |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "segmentId": "uuid",
    "scriptId": 1,
    "durationSeconds": 48,
    "completedSegments": 13,
    "totalSegments": 25,
    "totalAudioMinutes": 34.2
  }
}
```

**Why:** Users will want to re-do segments if they stumbled or aren't happy with a take.

---

### 5. Get Clone Session Detail

Returns full session state including which segments are completed.

```
GET /api/external/agents/{agentId}/voice/clone/{cloneId}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "cloneId": "uuid",
    "status": "recording",
    "voiceName": "Nick's Voice",
    "completedSegments": 13,
    "totalSegments": 25,
    "totalAudioMinutes": 34.5,
    "minimumAudioMinutes": 60,
    "minimumSegments": 20,
    "segments": [
      {
        "scriptId": 1,
        "segmentId": "uuid",
        "durationSeconds": 52,
        "recordedAt": "2026-03-23T14:30:00Z"
      },
      {
        "scriptId": 2,
        "segmentId": "uuid",
        "durationSeconds": 61,
        "recordedAt": "2026-03-23T14:32:00Z"
      }
    ],
    "canSubmit": false,
    "submitBlockReason": "Need at least 20 segments (have 13) and 60 minutes of audio (have 34.5)"
  }
}
```

**Why:** commissionTracker needs this to resume a recording session — show which
scripts are done, which are pending, and whether the user can submit yet.

---

### 6. Submit Clone for Processing

Triggers Retell voice generation from the uploaded segments.

```
POST /api/external/agents/{agentId}/voice/clone/{cloneId}/submit
```

**Request body:** none

**Response (200):**

```json
{
  "success": true,
  "data": {
    "cloneId": "uuid",
    "status": "processing"
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `INSUFFICIENT_SEGMENTS` | Fewer than 20 segments recorded |
| 400 | `INSUFFICIENT_AUDIO` | Less than 60 minutes total audio |
| 404 | `CLONE_NOT_FOUND` | Clone session doesn't exist or not in `recording` status |
| 409 | `ALREADY_SUBMITTED` | Clone already submitted/processing |

**Backend behavior:**
1. Collect all uploaded audio files for this session
2. Call Retell `POST /clone-voice` with the files
3. Update clone status to `processing`
4. When Retell finishes (webhook or poll), update to `ready` or `failed`

---

### 7. Activate Cloned Voice

Switches the agent to use the cloned voice for all calls.

```
POST /api/external/agents/{agentId}/voice/clone/{cloneId}/activate
```

**Request body:** none

**Response (200):**

```json
{
  "success": true,
  "data": {
    "cloneId": "uuid",
    "status": "active",
    "voiceId": "retell-voice-id"
  }
}
```

**Error responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `NOT_READY` | Clone is not in `ready` status |
| 404 | `CLONE_NOT_FOUND` | Clone session doesn't exist |

**Backend behavior:**
1. Update the Retell agent's voice to the cloned voice ID
2. Archive any previously active clone
3. Update clone status to `active`

---

### 8. Deactivate Cloned Voice (Revert to Stock)

Reverts the agent back to the stock/default voice.

```
POST /api/external/agents/{agentId}/voice/clone/deactivate
```

**Request body:** none

**Response (200):**

```json
{
  "success": true,
  "data": {
    "revertedToVoiceId": "stock-voice-id"
  }
}
```

**Backend behavior:**
1. Switch the Retell agent's voice back to the default stock voice
2. Archive the active clone (status → `archived`, not deleted)

---

### 9. Delete a Segment (Optional)

Removes a specific segment so the user can skip that script entirely.

```
DELETE /api/external/agents/{agentId}/voice/clone/{cloneId}/segments/{scriptId}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "completedSegments": 12,
    "totalAudioMinutes": 32.1
  }
}
```

---

## Clone Lifecycle States

```
(start) → recording → processing → ready → active
                         ↓                    ↓
                       failed             archived
```

| Status | Description | Transitions To |
|--------|-------------|---------------|
| `recording` | Segments being uploaded | `processing` (on submit) |
| `processing` | Submitted to Retell, generating voice | `ready` or `failed` |
| `ready` | Clone voice created, waiting for activation | `active` |
| `failed` | Retell cloning failed | (terminal — user starts new attempt) |
| `active` | Clone is the agent's current voice | `archived` (on deactivate or new clone) |
| `archived` | Superseded or deactivated | (terminal) |

---

## Business Rules (Enforce in Backend)

| Rule | Value |
|------|-------|
| Max clone attempts per agent | 3 (lifetime, not per billing cycle) |
| Total scripts | 25 |
| Minimum segments to submit | 20 |
| Minimum total audio to submit | 60 minutes |
| Max duration per segment | 10 minutes (600 seconds) |
| Max file size per segment | 50 MB |
| Allowed audio formats | webm, ogg, mpeg, mp3, mp4, m4a, wav |
| Concurrent sessions | 1 per agent (block start if one exists) |
| Voice entitlement required | active or trialing |

---

## commissionTracker Integration Plan

Once these endpoints are available, commissionTracker will:

1. **Proxy all endpoints** through `chat-bot-api` edge function (same pattern as every other voice operation)
2. **Build recording wizard UI** — step-by-step guided recording using browser `MediaRecorder` API
3. **Session resume** — call get-session-detail to repopulate progress on return visits
4. **Real-time progress** — update segment count after each upload
5. **Submit + activate flow** — submit button enabled when minimums met, activate after processing completes

No new Supabase tables or migrations needed in commissionTracker. All clone data lives in standard-chat-bot's database.

---

## Retell API Reference (for Backend Implementation)

The backend will ultimately call Retell's clone endpoint:

```
POST https://api.retellai.com/clone-voice
Content-Type: multipart/form-data

files: [audio files]
voice_name: "Nick's Voice"
voice_provider: "elevenlabs"  (or "platform", etc.)
```

File limits per provider: ElevenLabs (25), Cartesia (1), Platform (25).

The backend should:
- Collect all uploaded segments from storage
- Bundle them into the Retell API call
- Store the returned `voice_id` for activation

---

## Priority

High — voice cloning is a shipped feature that subscribers can see in their dashboard
but cannot use without leaving the platform. Every other voice agent feature is
configurable inside commissionTracker. This is the only one that requires an
external login.
