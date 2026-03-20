# Handoff: Standard-ChatBot — Retell Feature Gap Analysis

## Context

The commissionTracker frontend proxies ALL Retell API calls through the
Standard-ChatBot external API (`/api/external/agents/{agentId}/...`).
Users cannot access any Retell feature unless Standard-ChatBot exposes
an endpoint for it.

This document maps every Retell feature, what's currently exposed, and
what new endpoints are needed.

---

## Currently Exposed Endpoints (Working)

| Feature | Standard-ChatBot Endpoint | commissionTracker Action |
|---------|--------------------------|------------------------|
| Get agent + LLM config | `GET /agents/{id}/retell/runtime` | `get_retell_runtime` |
| Update agent properties | `PATCH /agents/{id}/retell/agent` | `update_retell_agent` |
| Update LLM config | `PATCH /agents/{id}/retell/llm` | `update_retell_llm` |
| Publish agent | `POST /agents/{id}/retell/publish` | `publish_retell_agent` |
| Create voice agent | `POST /agents/{id}/voice/agent/create` | `create_voice_agent` |
| Get setup state | `GET /agents/{id}/voice/setup-state` | `get_voice_setup_state` |
| Connect Close CRM | `POST /agents/{id}/connections/close` | `connect_close` |
| Disconnect Close CRM | `DELETE /agents/{id}/connections/close` | `disconnect_close` |
| Search voices | `GET /agents/{id}/retell/voices` | `get_retell_voices` |
| Get LLM config | `GET /agents/{id}/retell/llm` | `get_retell_llm` |
| Voice entitlement sync | Custom voice client | `start_voice_trial` |
| Provision workspace | `POST /agents` | `ensureAgentContext` |

---

## TIER 1 — High Priority (Users Need Now)

### 1. Knowledge Base Management

Users need to upload documents (product guides, FAQs, scripts) that the
AI agent can reference during calls. This is the #1 missing feature.

**Retell API endpoints to proxy:**

```
POST   /create-knowledge-base
  Body: { knowledge_base_name, knowledge_base_texts[]?, enable_auto_refresh? }
  Files: multipart upload (up to 25 files, 50MB each)
  Supported: PDF, TXT, DOCX, MD, CSV, XLSX, JSON, PPTX

GET    /get-knowledge-base/{kb_id}

GET    /list-knowledge-bases

DELETE /delete-knowledge-base/{kb_id}

POST   /knowledge-base/{kb_id}/add-source
  Body: { knowledge_base_texts[]? }
  Files: multipart upload

DELETE /knowledge-base/{kb_id}/delete-source/{source_id}
```

**Standard-ChatBot endpoints needed:**

```
POST   /api/external/agents/{agentId}/knowledge-bases
  → Proxy to Retell POST /create-knowledge-base
  → Store KB ID mapping in agent config
  → Support multipart file upload passthrough

GET    /api/external/agents/{agentId}/knowledge-bases
  → List all KBs associated with this agent

GET    /api/external/agents/{agentId}/knowledge-bases/{kbId}
  → Get KB details + sources

DELETE /api/external/agents/{agentId}/knowledge-bases/{kbId}
  → Delete KB from Retell + remove from agent's knowledge_base_ids

POST   /api/external/agents/{agentId}/knowledge-bases/{kbId}/sources
  → Add documents/URLs/text to existing KB
  → Support multipart file upload

DELETE /api/external/agents/{agentId}/knowledge-bases/{kbId}/sources/{sourceId}
  → Remove a single source from a KB
```

**After KB CRUD works, also need:**

```
PATCH  /api/external/agents/{agentId}/retell/llm
  → Already exists, but UI needs to manage knowledge_base_ids array
  → Also expose kb_config: { top_k, filter_score }
```

**commissionTracker UI needed:**
- Knowledge base list/card view
- File upload dropzone (PDF, TXT, DOCX, etc.)
- URL source input (paste a URL to scrape)
- Text source input (paste raw text)
- Per-KB source list with delete
- KB attachment toggle (connect/disconnect KB from agent)

---

### 2. Custom Tools / Function Builder

Users need to configure what actions the agent can take during calls
(book appointments, check availability, look up CRM data, send SMS).

**Retell tool types to support:**

| Tool Type | Description | Priority |
|-----------|-------------|----------|
| `end_call` | Hang up the call | High |
| `transfer_call` | Transfer to human | High |
| `check_availability_cal` | Check calendar (Cal.com) | High |
| `book_appointment_cal` | Book appointment (Cal.com) | High |
| `send_sms` | Send SMS during call | Medium |
| `custom` | HTTP webhook to any URL | Medium |
| `press_digit` | DTMF input (IVR nav) | Low |
| `agent_swap` | Switch to different agent | Low |

**Standard-ChatBot endpoints needed:**

Tools are configured as part of the LLM config (`general_tools` array).
The existing `PATCH /agents/{id}/retell/llm` endpoint handles this, but
Standard-ChatBot should provide:

```
GET    /api/external/agents/{agentId}/tools
  → Extract general_tools from LLM config, return structured list

POST   /api/external/agents/{agentId}/tools
  → Add a tool to general_tools array
  → Validate tool schema (name, description, parameters, url, etc.)

PUT    /api/external/agents/{agentId}/tools/{toolName}
  → Update a specific tool definition

DELETE /api/external/agents/{agentId}/tools/{toolName}
  → Remove a tool from general_tools array

GET    /api/external/agents/{agentId}/tools/templates
  → Return pre-built tool templates for common actions
  → (book_appointment, check_availability, transfer_call, etc.)
```

**commissionTracker UI needed:**
- Tool list view with add/edit/delete
- Tool template picker (pre-built options)
- Visual tool builder (name, description, parameters, URL, headers)
- Test tool button (dry-run with sample data)

---

### 3. Call History & Recordings

Users need to see past calls, listen to recordings, and read transcripts.

**Retell API endpoints to proxy:**

```
GET    /list-calls
  Query: agent_id, limit, pagination, sort, filter_criteria[]

GET    /get-call/{call_id}
  → Returns: transcript, recording_url, call_analysis,
     latency stats, cost, duration, disconnection_reason
```

**Standard-ChatBot endpoints needed:**

```
GET    /api/external/agents/{agentId}/calls
  → List calls with pagination + filters (date range, status, duration)

GET    /api/external/agents/{agentId}/calls/{callId}
  → Full call detail: transcript, recording URL, analysis, metrics

GET    /api/external/agents/{agentId}/calls/{callId}/recording
  → Proxy or signed URL for audio playback

GET    /api/external/agents/{agentId}/calls/{callId}/transcript
  → Structured transcript with timestamps + speaker labels
```

---

## TIER 2 — Important (Build After Tier 1)

### 4. Post-Call Analysis Configuration

Users need to define what data the AI extracts after each call
(sentiment, summary, appointment booked, callback requested, etc.).

**Retell agent fields:**
```json
{
  "post_call_analysis_data": [
    {
      "name": "appointment_booked",
      "type": "boolean",
      "description": "Whether an appointment was scheduled"
    },
    {
      "name": "caller_sentiment",
      "type": "enum",
      "choices": ["positive", "neutral", "negative"],
      "description": "Overall caller sentiment"
    },
    {
      "name": "call_summary",
      "type": "string",
      "description": "Brief summary of the call"
    }
  ],
  "post_call_analysis_model": "gpt-4.1"
}
```

**Standard-ChatBot endpoint needed:**

```
GET    /api/external/agents/{agentId}/post-call-analysis
  → Return current analysis config

PUT    /api/external/agents/{agentId}/post-call-analysis
  → Update analysis fields + model selection

GET    /api/external/agents/{agentId}/post-call-analysis/templates
  → Pre-built templates for insurance (appointment, sentiment, callback, etc.)
```

---

### 5. Phone Number Management

Users need to configure inbound phone numbers and caller ID.

**Retell API endpoints:**
```
GET    /list-phone-numbers
POST   /create-phone-number (Twilio/Telnyx)
POST   /import-phone-number (BYO via SIP trunk)
PATCH  /update-phone-number/{number_id}
DELETE /delete-phone-number/{number_id}
```

**Standard-ChatBot endpoints needed:**

```
GET    /api/external/agents/{agentId}/phone-numbers
  → List numbers assigned to this agent

POST   /api/external/agents/{agentId}/phone-numbers
  → Purchase or import a number

PATCH  /api/external/agents/{agentId}/phone-numbers/{numberId}
  → Update routing (inbound agent, outbound agent, SMS agent)

DELETE /api/external/agents/{agentId}/phone-numbers/{numberId}
  → Release a number
```

---

### 6. Voice Cloning

Users may want to clone their own voice for the agent.

**Retell API:**
```
POST   /create-voice
  → Multipart upload of audio files (up to 25)
  → Returns voice_id for use in agent config
```

**Standard-ChatBot endpoint needed:**

```
POST   /api/external/agents/{agentId}/voices/clone
  → Multipart audio upload passthrough to Retell
  → Store voice mapping in agent config
```

---

## TIER 3 — Nice to Have (Future)

### 7. Conversation Flow Builder
Visual node-based conversation design (Retell's newer feature).
14 node types. Would replace prompt-based approach for complex workflows.

### 8. Batch Call Management
Schedule outbound call campaigns with concurrency control.
```
POST /create-batch-call
GET  /get-batch-call/{id}
GET  /list-batch-calls
```

### 9. Agent Versioning
Rollback to previous configurations, A/B testing between versions.

### 10. Real-Time Call Monitoring
WebSocket connection for live call listening + intervention.

### 11. Webhook Event Management
Visual webhook configuration with event type filtering and test events.

### 12. Pronunciation Dictionary
Custom word pronunciations for industry terms, names, acronyms.

---

## Agent Configuration Fields We Should Expose

These fields exist on the Retell agent object and are editable via
`PATCH /update-agent/{id}`, but our UI doesn't expose them yet:

| Field | What It Does | Priority |
|-------|-------------|----------|
| `voice_emotion` | Set agent emotion (calm/happy/etc.) | High |
| `volume` | Output volume (0-2) | Medium |
| `reminder_trigger_ms` | Silence reminder timing | Medium |
| `reminder_max_count` | Max silence reminders before end | Medium |
| `normalize_for_speech` | Auto-format numbers/dates for speech | High |
| `ambient_sound` | Background noise (office/cafe/etc.) | Low |
| `ambient_sound_volume` | Background noise level | Low |
| `enable_backchannel` | "Mm-hmm", "I see" while listening | High |
| `backchannel_frequency` | How often backchanneling happens | Medium |
| `pronunciation_dictionary` | Custom pronunciations | Medium |
| `ivr_option` | IVR detection behavior | Low |

These can all be added to the commissionTracker UI without new
Standard-ChatBot endpoints — the existing `update_retell_agent` action
already patches arbitrary agent fields.

---

## Summary: New Standard-ChatBot Endpoints Needed

### Tier 1 (Build Now)
```
# Knowledge Base (6 endpoints)
POST   /api/external/agents/{agentId}/knowledge-bases
GET    /api/external/agents/{agentId}/knowledge-bases
GET    /api/external/agents/{agentId}/knowledge-bases/{kbId}
DELETE /api/external/agents/{agentId}/knowledge-bases/{kbId}
POST   /api/external/agents/{agentId}/knowledge-bases/{kbId}/sources
DELETE /api/external/agents/{agentId}/knowledge-bases/{kbId}/sources/{sourceId}

# Tools (5 endpoints)
GET    /api/external/agents/{agentId}/tools
POST   /api/external/agents/{agentId}/tools
PUT    /api/external/agents/{agentId}/tools/{toolName}
DELETE /api/external/agents/{agentId}/tools/{toolName}
GET    /api/external/agents/{agentId}/tools/templates

# Call History (4 endpoints)
GET    /api/external/agents/{agentId}/calls
GET    /api/external/agents/{agentId}/calls/{callId}
GET    /api/external/agents/{agentId}/calls/{callId}/recording
GET    /api/external/agents/{agentId}/calls/{callId}/transcript
```

### Tier 2 (Build After)
```
# Post-Call Analysis (3 endpoints)
GET    /api/external/agents/{agentId}/post-call-analysis
PUT    /api/external/agents/{agentId}/post-call-analysis
GET    /api/external/agents/{agentId}/post-call-analysis/templates

# Phone Numbers (4 endpoints)
GET    /api/external/agents/{agentId}/phone-numbers
POST   /api/external/agents/{agentId}/phone-numbers
PATCH  /api/external/agents/{agentId}/phone-numbers/{numberId}
DELETE /api/external/agents/{agentId}/phone-numbers/{numberId}

# Voice Cloning (1 endpoint)
POST   /api/external/agents/{agentId}/voices/clone
```

### Also Needed (from previous handoff)
```
# Provision fix
POST   /api/external/agents — make leadLimit optional for voice-only

# Default template
POST   /agents/{id}/voice/agent/create — use comprehensive prompt template
```

---

## Implementation Notes for Standard-ChatBot

### Knowledge Base File Upload
Retell's KB endpoints accept multipart form data. Standard-ChatBot needs
to passthrough the multipart upload, not re-encode it. The proxy should:
1. Accept multipart from commissionTracker edge function
2. Forward directly to Retell's API
3. Return the KB ID + source IDs

### Tool Definitions
Tools are stored in the LLM's `general_tools` array. Each tool has:
```json
{
  "type": "custom",
  "name": "book_appointment",
  "description": "Book an appointment for the caller",
  "url": "https://your-api.com/book",
  "speak_during_execution": true,
  "speak_after_execution": true,
  "parameters": {
    "type": "object",
    "properties": {
      "date": { "type": "string", "description": "Appointment date" },
      "time": { "type": "string", "description": "Appointment time" }
    },
    "required": ["date", "time"]
  }
}
```

The tool endpoints should validate this schema and merge into the
existing `general_tools` array on the LLM config.

### Call Data
Retell's `GET /list-calls` supports filtering by `agent_id`. Since each
Standard-ChatBot workspace has a Retell agent, the endpoint should:
1. Resolve the workspace's Retell agent ID
2. Call Retell's `/list-calls?filter_criteria=[{field:"agent_id",operator:"eq",value:"..."}]`
3. Return paginated results with transcript + recording URLs

### Auth & Isolation
All new endpoints must:
- Authenticate via `X-API-Key` header (same as existing endpoints)
- Scope to the requesting agent's workspace only
- Never expose one agent's data to another
