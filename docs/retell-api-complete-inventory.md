# Retell AI API -- Complete Feature Inventory

Generated: 2026-03-20
Source: https://docs.retellai.com/api-references

---

## Table of Contents

1. [Agent Management](#1-agent-management)
2. [LLM (Response Engine) Management](#2-llm-response-engine-management)
3. [Conversation Flow Management](#3-conversation-flow-management)
4. [Voice Library](#4-voice-library)
5. [Knowledge Base Management](#5-knowledge-base-management)
6. [Phone Number Management](#6-phone-number-management)
7. [Call Management](#7-call-management)
8. [Chat Management](#8-chat-management)
9. [Webhook Configuration](#9-webhook-configuration)
10. [Custom Tools / Functions](#10-custom-tools--functions)
11. [Analytics, Monitoring, and Testing](#11-analytics-monitoring-and-testing)
12. [Concurrency Management](#12-concurrency-management)
13. [Gap Analysis vs Our Project](#13-gap-analysis-vs-our-project)

---

## 1. Agent Management

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| Create Agent | POST | `/create-agent` | One-time |
| Get Agent | GET | `/get-agent/{agent_id}?version=` | On-demand |
| List Agents | GET | `/list-agents?limit=&pagination_key=` | On-demand |
| Update Agent | PATCH | `/update-agent/{agent_id}` | Ongoing |
| Delete Agent | DELETE | `/delete-agent/{agent_id}` | One-time |
| Publish Agent | POST | `/publish-agent/{agent_id}` | Ongoing |
| Create Chat Agent | POST | `/create-chat-agent` | One-time |

### Agent Object -- ALL Fields

#### Required
- `response_engine` -- object, oneOf: RetellLLM (`type:"retell-llm"`, `llm_id`, `version`), CustomLLM (`type:"custom-llm"`, `llm_websocket_url`), ConversationFlow (`type:"conversation-flow"`, `conversation_flow_id`, `version`)
- `voice_id` -- string, unique voice identifier

#### Basic Configuration
- `agent_name` -- string, nullable, reference name only
- `version_description` -- string, nullable, documentation for version
- `is_public` -- boolean, nullable, enables public preview link

#### Voice Configuration
- `voice_id` -- string, required
- `voice_model` -- string enum: `eleven_turbo_v2`, `eleven_flash_v2`, `eleven_turbo_v2_5`, `eleven_flash_v2_5`, `eleven_multilingual_v2`, `eleven_v3`, `sonic-3`, `sonic-3-latest`, `tts-1`, `gpt-4o-mini-tts`, `speech-02-turbo`, `speech-2.8-turbo`, `s1`, null
- `voice_temperature` -- number [0,2], default 1, controls voice stability
- `voice_speed` -- number [0.5,2], default 1, controls speech rate
- `voice_emotion` -- string enum: `calm`, `sympathetic`, `happy`, `sad`, `angry`, `fearful`, `surprised`, null (Cartesia/Minimax only)
- `volume` -- number [0,2], default 1, output volume
- `fallback_voice_ids` -- array of strings, nullable, backup voices during provider outages
- `enable_dynamic_voice_speed` -- boolean, default false, adapts to user speech rate
- `enable_dynamic_responsiveness` -- boolean, default false, adapts response timing

#### Conversation Behavior
- `responsiveness` -- number [0,1], default 1, controls response speed
- `interruption_sensitivity` -- number [0,1], default 1, how easily user can interrupt (0 = prevent)
- `reminder_trigger_ms` -- number, default 10000, silence before reminder
- `reminder_max_count` -- integer, default 1, max reminders (0 = disable)
- `enable_backchannel` -- boolean, default false, agent says "yeah", "uh-huh"
- `backchannel_frequency` -- number [0,1], default 0.8
- `backchannel_words` -- array of strings, nullable, custom backchannel phrases

#### Ambient Sound
- `ambient_sound` -- string enum: `coffee-shop`, `convention-hall`, `summer-outdoor`, `mountain-outdoor`, `static-noise`, `call-center`, null
- `ambient_sound_volume` -- number [0,2], default 1

#### Language and Transcription
- `language` -- string enum, default `en-US`, 50+ language/dialect codes + `multi` for multilingual
- `vocab_specialization` -- string enum: `general`, `medical` (English only)
- `stt_mode` -- string enum: `fast`, `accurate`, `custom`
- `custom_stt_config` -- object: `provider` (azure|deepgram), `endpointing_ms`
- `denoising_mode` -- string enum: `no-denoise`, `noise-cancellation`, `noise-and-background-speech-cancellation`
- `boosted_keywords` -- array of strings, nullable, biases transcription
- `normalize_for_speech` -- boolean, default false, converts numbers/dates/currency to spoken form

#### DTMF Configuration
- `allow_user_dtmf` -- boolean, default true
- `user_dtmf_options` -- object: `digit_limit` [1,50], `termination_key` (0-9, #, *), `timeout_ms` [1000,15000]

#### Call Timing
- `begin_message_delay_ms` -- integer [0,5000], default 0
- `end_call_after_silence_ms` -- integer, min 10000, default 600000 (10 min)
- `max_call_duration_ms` -- integer [60000, 7200000], default 3600000 (1 hr)
- `ring_duration_ms` -- integer [5000, 300000], default 30000

#### Voicemail Handling
- `voicemail_option` -- object with `action`: oneOf `prompt` (type+text), `static_text` (type+text), `hangup`, `bridge_transfer`
- `voicemail_detection_timeout_ms` -- integer [5000, 180000], default 30000
- `voicemail_message` -- string, DEPRECATED

#### IVR Detection
- `ivr_option` -- object with `action`: currently only `hangup` type supported

#### Pronunciation
- `pronunciation_dictionary` -- array of objects: `word` (string), `alphabet` (ipa|cmu), `phoneme` (string)

#### Webhook (Agent-Level)
- `webhook_url` -- string, nullable, overrides account-level webhook
- `webhook_events` -- array: `call_started`, `call_ended`, `call_analyzed`, `transcript_updated`, `transfer_started`, `transfer_bridged`, `transfer_cancelled`, `transfer_ended`
- `webhook_timeout_ms` -- integer, default 10000

#### Data Storage and Privacy
- `data_storage_setting` -- string enum: `everything`, `everything_except_pii`, `basic_attributes_only`
- `data_storage_retention_days` -- integer [1,730], nullable (default: forever)
- `opt_in_signed_url` -- boolean, default false, 24-hour expiring signed URLs
- `signed_url_expiration_ms` -- integer, default 86400000 (24 hrs)

#### PII Configuration
- `pii_config` -- object: `mode` ("post_call"), `categories` array: `person_name`, `address`, `email`, `phone_number`, `ssn`, `passport`, `driver_license`, `credit_card`, `bank_account`, `password`, `pin`, `medical_id`, `date_of_birth`, `customer_account_number`

#### Guardrail Configuration
- `guardrail_config` -- object:
  - `output_topics` -- array: `harassment`, `self_harm`, `sexual_exploitation`, `violence`, `defense_and_national_security`, `illicit_and_harmful_activity`, `gambling`, `regulated_professional_advice`, `child_safety_and_exploitation`
  - `input_topics` -- array: `platform_integrity_jailbreaking`

#### Post-Call Analysis
- `post_call_analysis_data` -- array of AnalysisData: `StringAnalysisData`, `EnumAnalysisData`, `BooleanAnalysisData`, `NumberAnalysisData` (each has: type, name, description, examples/choices, required)
- `post_call_analysis_model` -- string enum: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-5`, `gpt-5-mini`, `claude-4.5-sonnet`, `claude-4.6-sonnet`, `claude-4.5-haiku`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3.0-flash`, etc.
- `analysis_successful_prompt` -- string, max 2000 chars
- `analysis_summary_prompt` -- string, max 2000 chars
- `analysis_user_sentiment_prompt` -- string, max 2000 chars

**Total Agent Fields: ~54**

---

## 2. LLM (Response Engine) Management

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| Create LLM | POST | `/create-retell-llm` | One-time |
| Get LLM | GET | `/get-retell-llm/{llm_id}?version=` | On-demand |
| List LLMs | GET | `/list-retell-llms?limit=&pagination_key=` | On-demand |
| Update LLM | PATCH | `/update-retell-llm/{llm_id}?version=` | Ongoing |
| Delete LLM | DELETE | `/delete-retell-llm/{llm_id}` | One-time |

### LLM Object -- ALL Fields

#### Model Configuration
- `model` -- string enum: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `claude-4.5-sonnet`, `claude-4.6-sonnet`, `claude-4.5-haiku`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3.0-flash`, etc. Default: `gpt-4.1`
- `s2s_model` -- string enum: `gpt-realtime-1.5`, `gpt-realtime`, `gpt-realtime-mini`, null (speech-to-speech, cannot set with `model`)
- `model_temperature` -- number [0,1], default 0
- `model_high_priority` -- boolean, default false, dedicated resource pool (higher cost)
- `tool_call_strict_mode` -- boolean, nullable, enforces strict tool calling

#### Prompts and Instructions
- `general_prompt` -- string, nullable, system prompt applied across all states
- `begin_message` -- string, nullable, first agent utterance (empty = wait for user)
- `begin_after_user_silence_ms` -- integer, nullable, delay before agent speaks

#### Conversation States (Multi-Prompt)
- `states` -- array of State objects, each with:
  - `name` -- state identifier
  - `state_prompt` -- instruction for this state
  - `tools` -- state-specific tools
  - `edges` -- transition conditions to other states (prompt-based or equation-based)
- `starting_state` -- string, required if states are defined
- `start_speaker` -- string enum: `user`, `agent`

#### Tools and Knowledge
- `general_tools` -- array of Tool objects (see Section 10)
- `knowledge_base_ids` -- array of strings, KB identifiers for RAG
- `kb_config` -- object: `top_k` [1,10] default 3, `filter_score` [0,1] default 0.6

#### Dynamic Variables
- `default_dynamic_variables` -- object, key-value string pairs injected into prompts and tool descriptions

#### Integrations
- `mcps` -- array of MCP objects, Model Context Protocol server configurations

#### Response Fields (read-only)
- `llm_id` -- unique identifier
- `version` -- integer
- `is_published` -- boolean
- `last_modification_timestamp` -- integer (ms since epoch)

---

## 3. Conversation Flow Management

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| Create Flow | POST | `/create-conversation-flow` | One-time |
| Get Flow | GET | `/get-conversation-flow/{id}?version=` | On-demand |
| List Flows | GET | `/list-conversation-flows?limit=&pagination_key=` | On-demand |
| Update Flow | PATCH | `/update-conversation-flow/{id}?version=` | Ongoing |
| Delete Flow | DELETE | `/delete-conversation-flow/{id}` | One-time |

### Conversation Flow Object -- ALL Fields

#### Core Configuration
- `start_speaker` -- string enum: `user`, `agent` (required)
- `model_choice` -- object: `type` ("cascading"), `model` (LLM model), `high_priority` (boolean)
- `model_temperature` -- number [0,1]
- `tool_call_strict_mode` -- boolean
- `global_prompt` -- string, system-level instruction for all nodes
- `start_node_id` -- string, entry point node
- `default_dynamic_variables` -- object, key-value pairs
- `knowledge_base_ids` -- array
- `kb_config` -- object: `top_k`, `filter_score`
- `begin_after_user_silence_ms` -- integer
- `mcps` -- array of MCP configurations
- `is_transfer_llm` -- boolean

#### Node Types (14 types)
1. **Conversation Node** -- dialogue with instruction, edges, optional tools
2. **End Node** -- terminates call with optional farewell
3. **Function Node** -- executes tool with success/failure handling
4. **Code Node** -- runs JavaScript in sandbox
5. **Transfer Call Node** -- routes to external number
6. **Press Digit Node** -- sends DTMF tones to IVR
7. **Branch Node** -- conditional routing without agent speech
8. **SMS Node** -- sends SMS with success/failure edges
9. **Extract Dynamic Variables Node** -- extracts data from conversation
10. **Agent Swap Node** -- transfers to different agent
11. **MCP Node** -- calls MCP tool
12. **Component Node** -- references local or shared component
13. **Bridge Transfer Node** -- warm transfer bridging
14. **Cancel Transfer Node** -- cancels warm transfer

#### Edge/Transition Types
- **Standard Edge** -- prompt-based or equation-based condition
- **Skip Response Edge** -- skips agent response
- **Always Edge** -- unconditional
- **Else Edge** -- default fallback
- **Transfer Failed Edge** -- handles transfer failure
- **SMS Edges** -- "Sent successfully" / "Failed to send"

#### Condition Types
- Prompt-based: LLM evaluates natural language condition
- Equation-based: operators `==`, `!=`, `>`, `<`, `contains`, `exists`, etc.

#### Tools Array
- Same tool types as LLM general_tools (see Section 10)
- `components` -- array of embedded local components with their own nodes

---

## 4. Voice Library

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| List Voices | GET | `/list-voices` | On-demand |
| Get Voice | GET | `/get-voice/{voice_id}` | On-demand |
| Search Community Voice | POST | `/search-community-voice` | On-demand |
| Add Community Voice | POST | `/add-community-voice` | One-time |
| Clone Voice | POST | `/clone-voice` | One-time |

### Voice Object Fields
- `voice_id` -- string, unique identifier (required)
- `voice_name` -- string, display name (required)
- `provider` -- string enum: `elevenlabs`, `openai`, `deepgram`, `cartesia`, `minimax`, `fish_audio`, `platform` (required)
- `gender` -- string enum: `male`, `female` (required)
- `accent` -- string, optional (e.g., "American")
- `age` -- string, optional (e.g., "Young")
- `preview_audio_url` -- string, optional, audio sample URL

### Search Parameters
- `search_query` -- string, required, search by name/description/ID
- `voice_provider` -- string enum: `elevenlabs`, `cartesia`, `minimax`, `fish_audio`

### Search Response
- `voices` -- array: `provider_voice_id`, `name`, `description`, `public_user_id` (ElevenLabs only)

### Add Voice Parameters
- `provider_voice_id` -- string, required
- `voice_name` -- string [1-200 chars], required
- `voice_provider` -- string enum, default `elevenlabs`
- `public_user_id` -- string, required for ElevenLabs only

### Clone Voice Parameters
- `files` -- array of audio files, required
- `voice_name` -- string [1-200 chars], required
- `voice_provider` -- string enum: `elevenlabs`, `cartesia`, `minimax`, `fish_audio`, `platform`
- File limits per provider: ElevenLabs (25), Cartesia (1), MiniMax (1), Fish Audio (25), Platform (25), Inworld (3)

---

## 5. Knowledge Base Management

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| Create KB | POST | `/create-knowledge-base` | One-time |
| Get KB | GET | `/get-knowledge-base/{kb_id}` | On-demand |
| List KBs | GET | `/list-knowledge-bases` | On-demand |
| Delete KB | DELETE | `/delete-knowledge-base/{kb_id}` | One-time |
| Add Sources | POST | `/add-knowledge-base-sources/{kb_id}` | Ongoing |
| Delete Sources | DELETE | `/delete-knowledge-base-sources/{kb_id}` | Ongoing |

### Create Knowledge Base Parameters
- `knowledge_base_name` -- string, required, max 40 chars
- `knowledge_base_texts` -- array of objects: `title`, `text`
- `knowledge_base_files` -- array of binary files, max 25 files, each max 50MB
- `knowledge_base_urls` -- array of valid URLs
- `enable_auto_refresh` -- boolean, auto-refresh URLs every 12 hours
- `max_chunk_size` -- integer [600,6000], default 2000 (immutable after creation)
- `min_chunk_size` -- integer [200,2000], default 400, must be < max (immutable after creation)

### Knowledge Base Response
- `knowledge_base_id` -- string
- `knowledge_base_name` -- string
- `status` -- enum: `in_progress`, `complete`, `error`, `refreshing_in_progress`
- `knowledge_base_sources` -- array (populated after processing)
- `max_chunk_size`, `min_chunk_size` -- integers
- `enable_auto_refresh` -- boolean
- `last_refreshed_timestamp` -- integer (ms since epoch)

### How Knowledge Bases Attach to LLMs/Flows
- Set `knowledge_base_ids` array on the LLM or Conversation Flow object
- Configure retrieval via `kb_config`: `top_k` [1,10] (default 3), `filter_score` [0,1] (default 0.6)

### Supported Source Types
- File upload (documents, up to 25 files at 50MB each)
- URL scraping (with optional 12-hour auto-refresh)
- Inline text entries (title + text)

---

## 6. Phone Number Management

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| Create (Purchase) | POST | `/create-phone-number` | One-time |
| Import (BYO SIP) | POST | `/import-phone-number` | One-time |
| Get Number | GET | `/get-phone-number/{phone_number}` | On-demand |
| List Numbers | GET | `/list-phone-numbers` | On-demand |
| Update Number | PATCH | `/update-phone-number/{phone_number}` | Ongoing |
| Delete Number | DELETE | `/delete-phone-number/{phone_number}` | One-time |

### Create Phone Number Parameters
- `area_code` -- integer, 3-digit US area code
- `country_code` -- string: `US` or `CA`, default `US`
- `toll_free` -- boolean, higher cost
- `phone_number` -- string E.164, request specific number
- `number_provider` -- string: `twilio` or `telnyx`, default `twilio`
- `nickname` -- string, reference label
- `inbound_agents` -- array of {agent_id, weight}, weights must total 1
- `outbound_agents` -- array of {agent_id, weight}
- `inbound_webhook_url` -- string, webhook for inbound call customization
- `allowed_inbound_country_list` -- array of ISO 3166-1 alpha-2 codes
- `allowed_outbound_country_list` -- array of ISO 3166-1 alpha-2 codes
- `transport` -- string: `TLS`, `TCP`, `UDP`, default `TCP`
- `fallback_number` -- string, enterprise only

### Import Phone Number Parameters
- `phone_number` -- string E.164, required
- `termination_uri` -- string, required (SIP trunk endpoint)
- `sip_trunk_auth_username` -- string
- `sip_trunk_auth_password` -- string
- `ignore_e164_validation` -- boolean, default true
- `transport` -- string: `TLS`, `TCP`, `UDP`
- Plus all agent binding and webhook fields from Create

### Update Phone Number Parameters
- `nickname` -- string
- `inbound_agents` / `outbound_agents` -- agent binding arrays
- `inbound_sms_agents` / `outbound_sms_agents` -- SMS agent bindings
- `inbound_webhook_url` / `inbound_sms_webhook_url` -- webhook URLs
- `allowed_inbound_country_list` / `allowed_outbound_country_list`
- `fallback_number` -- enterprise only
- `termination_uri`, `auth_username`, `auth_password`, `transport` -- SIP trunk config

### Phone Number Response Fields
- `phone_number` -- E.164 format
- `phone_number_pretty` -- formatted display
- `phone_number_type` -- enum: `retell-twilio`, `retell-telnyx`, `custom`
- `area_code` -- integer
- `nickname` -- string
- All agent binding arrays, webhook URLs, country lists, SIP config
- `last_modification_timestamp` -- integer

---

## 7. Call Management

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| Create Phone Call | POST | `/v2/create-phone-call` | Per-call |
| Create Web Call | POST | `/create-web-call` | Per-call |
| Create Batch Call | POST | `/create-batch-call` | Per-batch |
| Get Call | GET | `/v2/get-call/{call_id}` | On-demand |
| List Calls | POST | `/v2/list-calls` | On-demand |
| Update Call | PATCH | `/v2/update-call/{call_id}` | Per-call |
| Delete Call | DELETE | `/v2/delete-call/{call_id}` | One-time |
| Register Call | POST | `/register-call` | DEPRECATED |

### Create Phone Call Parameters
- `from_number` -- string E.164, required (Retell-owned number)
- `to_number` -- string E.164, required
- `override_agent_id` -- string, optional, temporary agent swap
- `override_agent_version` -- integer, optional
- `agent_override` -- object, full agent/LLM/flow override for this call
- `metadata` -- object, max 50kB, arbitrary storage
- `retell_llm_dynamic_variables` -- object, key-value string pairs injected into prompts
- `custom_sip_headers` -- object
- `ignore_e164_validation` -- boolean, default false

### Create Web Call Parameters
- `agent_id` -- string, required
- `agent_version` -- integer, optional
- `agent_override` -- object, full override
- `metadata` -- object
- `retell_llm_dynamic_variables` -- object
- `current_node_id` -- string, start at specific conversation flow node
- `current_state` -- string, start at specific LLM state

### Create Batch Call Parameters
- `from_number` -- string E.164, required
- `tasks` -- array, required, each task has:
  - `to_number` -- string E.164, required
  - `override_agent_id`, `override_agent_version`, `agent_override`, `retell_llm_dynamic_variables`, `metadata`, `custom_sip_headers`, `ignore_e164_validation` -- all optional per-task
- `name` -- string, batch reference label
- `trigger_timestamp` -- number (ms since epoch), schedule for later
- `reserved_concurrency` -- integer, reserve slots for non-batch calls
- `call_time_window` -- object, calling windows with timezone/day restrictions

### Update Call Parameters
- `metadata` -- object, max 50kB
- `data_storage_setting` -- string enum (cannot downgrade)
- Override dynamic variables -- key-value pairs (null = remove override)
- `custom_attributes` -- object (string/number/boolean values)

### Call Response Object -- ALL Fields

#### Core
- `call_id`, `agent_id`, `agent_name`, `agent_version`
- `call_type` -- `web_call` or `phone_call`
- `call_status` -- `registered`, `not_connected`, `ongoing`, `ended`, `error`

#### Timing
- `start_timestamp`, `end_timestamp`, `transfer_end_timestamp` -- ms since epoch
- `duration_ms` -- total call duration

#### Phone Call Specific
- `from_number`, `to_number`, `direction` (inbound/outbound)
- `telephony_identifier` -- contains `twilio_call_sid`

#### Web Call Specific
- `access_token` -- JWT for joining call room

#### Transcript and Audio
- `transcript` -- full text
- `transcript_object` -- utterances with word-level timestamps
- `transcript_with_tool_calls` -- includes tool invocations
- `scrubbed_transcript_with_tool_calls` -- PII-removed version
- `recording_url` -- call recording
- `recording_multi_channel_url` -- separate channels per party
- `scrubbed_recording_url` -- PII-removed recording
- `scrubbed_recording_multi_channel_url`

#### Analysis
- `call_analysis` -- object: `summary`, `sentiment`, `success` flag, custom extracted data
- `public_log_url` -- debugging logs with latency tracking
- `knowledge_base_retrieved_contents_url`

#### Metadata
- `metadata`, `retell_llm_dynamic_variables`, `collected_dynamic_variables`
- `custom_sip_headers`, `custom_attributes`
- `data_storage_setting`, `opt_in_signed_url`

#### Performance
- `latency` -- percentiles (p50, p90, p95, p99, max, min) for: e2e, ASR, LLM, TTS, knowledge_base, S2S
- `llm_token_usage` -- token counts, request statistics
- `call_cost` -- product costs, duration pricing, combined total

#### Disposition
- `disconnection_reason` -- `user_hangup`, `agent_hangup`, `call_transfer`, `voicemail_reached`, `inactivity`, `max_duration_reached`, `concurrency_limit_reached`, `no_valid_payment`, `error_inbound_webhook`, `dial_busy`, `dial_no_answer`, etc.
- `transfer_destination`

### List Calls -- Filter Parameters
- `call_id`, `agent_id`, `version` -- arrays
- `call_status` -- `not_connected`, `ongoing`, `ended`, `error`
- `in_voicemail` -- boolean array
- `disconnection_reason` -- multiple reasons
- `from_number`, `to_number` -- arrays
- `batch_call_id` -- array
- `call_type` -- `web_call`, `phone_call`
- `direction` -- `inbound`, `outbound`
- `user_sentiment` -- `Negative`, `Positive`, `Neutral`, `Unknown`
- `call_successful` -- boolean array
- `start_timestamp`, `end_timestamp`, `duration_ms`, `e2e_latency_p50` -- range filters (upper/lower threshold)
- `metadata` -- dot notation filtering (e.g., `metadata.customer_id`)
- `dynamic_variables` -- dot notation filtering
- `sort_order` -- `ascending`, `descending` (default: descending)
- `limit` -- integer, default 50, max 1000
- `pagination_key` -- string (call_id)

---

## 8. Chat Management

### Endpoints

| Operation | Method | Path | Setup Type |
|-----------|--------|------|------------|
| Create Chat | POST | `/create-chat` | Per-chat |
| Get Chat | GET | `/get-chat/{chat_id}` | On-demand |
| List Chats | GET/POST | `/list-chats` | On-demand |
| Update Chat | PATCH | `/update-chat/{chat_id}` | Per-chat |
| End Chat | POST | `/end-chat/{chat_id}` | Per-chat |

### Chat Agent Differences from Voice Agent
- `end_chat_after_silence_ms` -- replaces end_call_after_silence_ms [120000, 259200000], default 3600000
- `auto_close_message` -- string displayed when chat auto-terminates
- No voice-specific fields (voice_id, voice_model, ambient_sound, etc.)
- Same analysis, webhook, data storage, guardrail, and PII configs

### Create Chat Parameters
- `agent_id` -- string, required
- `agent_version` -- integer, optional
- `metadata` -- object, arbitrary storage
- `retell_llm_dynamic_variables` -- object, prompt injection

### Chat Response Fields
- `chat_id`, `agent_id`, `chat_status` (ongoing/ended/error), `chat_type` (api_chat/sms_chat)
- `start_timestamp`, `end_timestamp`
- `transcript` -- full text
- `message_with_tool_calls` -- messages with tool invocations
- `retell_llm_dynamic_variables`, `collected_dynamic_variables`
- `metadata`, `custom_attributes`
- `chat_cost` -- product costs, combined total
- `chat_analysis` -- summary, sentiment, success, custom data

---

## 9. Webhook Configuration

### Two Levels
1. **Account-Level** -- configured in Retell dashboard, applies to all agents
2. **Agent-Level** -- set `webhook_url` on agent object, overrides account-level for that agent

### Webhook Events
| Event | Description |
|-------|-------------|
| `call_started` | Call begins |
| `call_ended` | Call ends (includes full transcript, analysis) |
| `call_analyzed` | Post-call analysis complete |
| `transcript_updated` | Real-time transcript updates during call |
| `transfer_started` | Call transfer initiated |
| `transfer_bridged` | Transfer connected |
| `transfer_cancelled` | Transfer cancelled |
| `transfer_ended` | Transfer completed |
| `chat_started` | Chat session begins |
| `chat_ended` | Chat session ends |
| `chat_analyzed` | Post-chat analysis complete |

### Configuration
- `webhook_url` -- string, nullable, HTTPS endpoint
- `webhook_events` -- array of event strings, default: [call_started, call_ended, call_analyzed]
- `webhook_timeout_ms` -- integer, default 10000

### Inbound Webhook
- Set `inbound_webhook_url` on phone number
- Called when inbound call arrives, allows dynamic agent override per call

---

## 10. Custom Tools / Functions

### Tool Types Available in LLM and Conversation Flow

| Tool Type | Description | Key Parameters |
|-----------|-------------|----------------|
| `end_call` | Terminates the call | Optional farewell message |
| `transfer_call` | Cold/warm transfer to phone number | `number`, `caller_id_override`, SIP headers, warm transfer config |
| `check_availability_cal` | Cal.com calendar availability | `cal_api_key`, `event_type_id`, `timezone` |
| `book_appointment_cal` | Cal.com appointment booking | `cal_api_key`, `event_type_id`, `timezone` |
| `agent_swap` | Transfer to different Retell agent | `agent_id` |
| `press_digit` | Send DTMF tones | digits, delay |
| `send_sms` | Send text message | content (inferred or specified) |
| `custom` | HTTP API call | See below |
| `code` | JavaScript sandbox execution | Source code, response variables |
| `extract_dynamic_variables` | Extract data from conversation | field definitions |
| `bridge_transfer` | Warm transfer bridging | transfer destination |
| `cancel_transfer` | Cancel warm transfer | -- |
| `mcp` | Model Context Protocol tool call | MCP server config |

### Custom Tool (HTTP API Call) Configuration
- `type` -- "custom"
- `name` -- tool name
- `description` -- what the tool does (for LLM context)
- `url` -- HTTP endpoint
- `method` -- GET, POST, PUT, PATCH, DELETE
- `headers` -- object, request headers
- `query_params` -- object
- `body_params` -- JSON Schema for request body
- `response_variables` -- extraction via JSON paths
- `speak_during_execution` -- boolean, agent talks while tool runs
- `speak_after_execution` -- boolean, agent talks after result
- `execution_message_description` -- prompt or static text
- `timeout_ms` -- [1000, 600000], default 120000

### Tool Call Modes
- `speak_during_execution` with prompt or static_text -- agent speaks while waiting
- `speak_after_execution` with prompt or static_text -- agent speaks after result

### Dynamic Variables in Tools
- All tool descriptions and parameters support `{{variable_name}}` interpolation
- Variables set via `default_dynamic_variables` or `retell_llm_dynamic_variables` at call creation time
- Variables can be collected during call via `extract_dynamic_variables` tool

---

## 11. Analytics, Monitoring, and Testing

### Call Analytics (via Call Response Object)
- `call_analysis` -- summary, user_sentiment, call_successful, custom extracted data
- `latency` -- e2e, ASR, LLM, TTS, knowledge_base latencies (p50/p90/p95/p99/min/max)
- `llm_token_usage` -- token counts, averages, request count
- `call_cost` -- itemized cost breakdown
- `public_log_url` -- debugging logs
- `knowledge_base_retrieved_contents_url` -- RAG retrieval details

### Post-Call Analysis
- Automatic: summary, sentiment, success determination
- Custom: define extraction fields via `post_call_analysis_data`
- Model selection via `post_call_analysis_model`
- Custom prompts for success, summary, sentiment evaluation

### Batch Testing

| Operation | Method | Path |
|-----------|--------|------|
| Create Batch Test | POST | `/create-batch-test` |
| Get Batch Test | GET | `/get-batch-test/{id}` |

- `test_case_definition_ids` -- array [1-1000], required
- `response_engine` -- Retell LLM or Conversation Flow (custom LLM not supported)
- Response: `batch_job_id`, `status` (in_progress/complete), pass/fail/error counts

### AI Quality Assurance
- Define QA cohorts, resolution criteria
- View QA results and metrics
- Address metric issues

### Dashboard Analytics
- Analytics dashboard (Retell web console)
- Session history viewer
- Alerting system

---

## 12. Concurrency Management

### Endpoint

| Operation | Method | Path |
|-----------|--------|------|
| Get Concurrency | GET | `/get-concurrency` |

### Response Fields
- `current_concurrency` -- integer, ongoing calls count
- `concurrency_limit` -- integer, max simultaneous calls (base + purchased)
- `base_concurrency` -- integer, free tier limit
- `purchased_concurrency` -- integer, additional purchased capacity
- `concurrency_purchase_limit` -- integer, max purchasable
- `remaining_purchase_limit` -- integer, available to purchase
- `concurrency_burst_enabled` -- boolean, surge mode
- `concurrency_burst_limit` -- integer, max during burst (min of 3x normal or normal+300)

---

## 13. Gap Analysis vs Our Project

### Fields Our Project Currently Exposes (retell-config.ts)

#### Agent Fields We Have (RETELL_AGENT_EDITABLE_KEYS):
- agent_name, voice_id, voice_model, voice_speed, voice_temperature
- fallback_voice_ids, language, boosted_keywords
- stt_mode, custom_stt_config, denoising_mode
- allow_user_dtmf, user_dtmf_options
- begin_message_delay_ms, end_call_after_silence_ms, max_call_duration_ms, ring_duration_ms
- responsiveness, interruption_sensitivity
- enable_backchannel, backchannel_frequency, backchannel_words
- enable_dynamic_responsiveness, enable_dynamic_voice_speed
- ambient_sound, ambient_sound_volume
- enable_voicemail_detection (NOTE: deprecated field name), voicemail_detection_timeout_ms, voicemail_option
- data_storage_setting, data_storage_retention_days, opt_in_signed_url
- pii_config, guardrail_config
- post_call_analysis_data, post_call_analysis_model
- analysis_successful_prompt, analysis_summary_prompt, analysis_user_sentiment_prompt
- pronunciation_dictionary
- webhook_url, webhook_events, webhook_timeout_ms
- is_public

#### Agent Fields We Are MISSING:
- `response_engine` -- the actual LLM/flow/custom-LLM binding (we handle separately)
- `voice_emotion` -- calm/sympathetic/happy/sad/angry/fearful/surprised (Cartesia/Minimax)
- `volume` -- [0,2] output volume control
- `reminder_trigger_ms` -- silence before reminder (10s default)
- `reminder_max_count` -- max reminders (1 default)
- `normalize_for_speech` -- text-to-spoken-form normalization
- `vocab_specialization` -- general vs medical (English only)
- `ivr_option` -- IVR detection and action
- `signed_url_expiration_ms` -- signed URL expiration control
- `version_description` -- version documentation

#### LLM Fields We Have (RETELL_LLM_EDITABLE_KEYS):
- begin_after_user_silence_ms, begin_message
- default_dynamic_variables, general_prompt, general_tools
- kb_config, knowledge_base_ids, mcps
- model, model_high_priority, model_temperature
- s2s_model, start_speaker, starting_state, states
- tool_call_strict_mode

#### LLM Fields We Are MISSING:
- None significant -- our LLM editable keys cover all documented fields

#### Features We Have No UI/API For:
- Knowledge Base CRUD (create/add sources/delete)
- Voice cloning
- Conversation Flow CRUD
- Batch call creation
- Phone number purchase/import/management
- Chat agent management
- Concurrency monitoring
- Batch testing
- Call list filtering/analytics queries
- Agent publishing/versioning workflow
- Per-call agent/LLM overrides

### Summary of Missing Agent Fields (Priority)

| Missing Field | Impact | Priority |
|---------------|--------|----------|
| `voice_emotion` | Emotional voice control | Medium |
| `volume` | Output volume | Medium |
| `reminder_trigger_ms` | Silence reminders | Medium |
| `reminder_max_count` | Reminder frequency | Medium |
| `normalize_for_speech` | Better number/date pronunciation | Low |
| `vocab_specialization` | Medical vocabulary | Low (niche) |
| `ivr_option` | IVR detection | Medium |
| `signed_url_expiration_ms` | Security tuning | Low |
| `version_description` | Version notes | Low |
| `enable_voicemail_detection` | Our key is deprecated name | Fix needed |
