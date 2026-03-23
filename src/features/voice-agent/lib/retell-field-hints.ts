// src/features/voice-agent/lib/retell-field-hints.ts
// Single source of truth for plain-English field descriptions shown to non-technical users.

export const AGENT_FIELD_HINTS: Record<string, string> = {
  // Voice & Greeting (Step 1)
  agentName:
    "A display name for this agent. Callers won't hear this — it's just for your reference.",
  language:
    "The language for speech recognition. Use 'en-US' for American English.",
  voiceSpeed:
    "1.0 is normal speed. Lower (0.8) sounds more deliberate. Higher (1.2) sounds more energetic. Most agents sound best between 0.9 and 1.1.",
  voiceTemperature:
    "Controls how expressive the voice sounds. 1.0 is natural. Higher values add more vocal variety. Lower values sound calmer.",
  responsiveness:
    "How fast the agent starts talking after the caller stops. 0.5 is balanced. Higher values (0.8+) feel snappier but may cut people off. Lower values (0.2) feel more patient.",
  interruptionSensitivity:
    "How easily the agent stops talking when interrupted. Higher values make it pause more easily when the caller speaks. Lower values make it more persistent.",
  enableDynamicVoiceSpeed:
    "Automatically speed up or slow down to match the caller's pace.",
  enableDynamicResponsiveness:
    "Automatically adjust response timing based on the conversation flow.",

  // Call Flow — Natural conversation (Step 3)
  enableBackchannel:
    "Let the agent say natural filler words like 'yeah', 'uh-huh', and 'got it' while listening. Makes the conversation feel more human.",
  backchannelFrequency:
    "How often the agent interjects with filler words. 0.5 is moderate. Higher values mean more frequent responses.",
  ambientSound:
    "Add subtle background noise to make the agent sound like it's calling from a real office.",
  ambientSoundVolume:
    "How loud the background sound should be. 1.0 is normal. Lower is more subtle.",

  // Call Flow — Silence & reminders (Step 3)
  reminderTriggerMs:
    "If the caller goes quiet, the agent gently re-prompts after this many seconds. 10 is typical.",
  reminderMaxCount:
    "How many times the agent should re-prompt before giving up. 2–3 is typical.",
  endCallAfterSilenceMs:
    "If nobody speaks for this long, the agent hangs up automatically. 60 seconds is typical for follow-ups.",
  beginMessageDelayMs:
    "How long the agent waits before speaking after the call connects. 0 means it speaks immediately.",

  // Call Flow — Voicemail (Step 3)
  enableVoicemailDetection:
    "Detect when the call reaches a voicemail greeting instead of a live person.",
  voicemailDetectionTimeoutMs:
    "How long to listen before deciding whether it's voicemail. 30 seconds is typical.",

  // Advanced (Step 4)
  sttMode:
    "'fast' prioritizes speed, 'accurate' prioritizes quality. Leave blank for the default.",
  denoisingMode:
    "Background noise reduction. Leave blank for automatic. 'noise-cancellation' removes background noise.",
  ringDurationMs:
    "How long the phone rings before pickup, in milliseconds. 15000 = 15 seconds.",
  maxCallDurationMs:
    "The absolute maximum length of any single call, in milliseconds. 1800000 = 30 minutes.",
  allowUserDtmf: "Let callers press phone keys during the call.",
  normalizeForSpeech:
    "Convert numbers, dates, and abbreviations to spoken form. '$150' becomes 'one hundred fifty dollars'.",
};

export const LLM_FIELD_HINTS: Record<string, string> = {
  generalPrompt:
    "Write this like you're training a new employee. Tell the agent who it is, what questions to ask, how to handle pushback, and when to transfer to a person.",
  beginMessage: "The first thing the agent says when a call connects.",
  boostedKeywords:
    "Help the voice recognition system hear industry terms correctly. Add one per line: product names, carrier names, your agency name, and common phrases.",
  model:
    "The AI model powering the conversation. gpt-4o-mini is fast and affordable. gpt-4o is smarter but costs more per minute.",
  modelTemperature:
    "Controls how creative vs. predictable the agent's responses are. 0 is robotic and consistent. 1.0 is natural. Above 1.5 is unpredictable.",
  knowledgeBaseIds:
    "Knowledge base IDs (one per line) giving the agent access to uploaded documents. Contact support for setup.",
  toolCallStrictMode:
    "When on, the agent follows exact parameter formats for connected tools. Leave off unless directed.",
  generalTools:
    "JSON array of tool definitions. For advanced integrations only — contact support.",
  mcps: "MCP server connections for extended capabilities. For advanced integrations only.",
};

export const AMBIENT_SOUND_OPTIONS = [
  { value: "", label: "None" },
  { value: "call-center", label: "Call center" },
  { value: "coffee-shop", label: "Coffee shop" },
  { value: "convention-hall", label: "Convention hall" },
  { value: "summer-outdoor", label: "Summer outdoor" },
  { value: "mountain-outdoor", label: "Mountain" },
  { value: "static-noise", label: "Static noise" },
] as const;
