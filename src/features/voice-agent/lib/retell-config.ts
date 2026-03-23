// src/features/voice-agent/lib/retell-config.ts
// Helpers for presenting only Retell fields that can be meaningfully edited from The Standard HQ.

export const RETELL_AGENT_EDITABLE_KEYS = [
  "agent_name",
  "voice_id",
  "voice_model",
  "voice_speed",
  "voice_temperature",
  "fallback_voice_ids",
  "language",
  "boosted_keywords",
  "stt_mode",
  "custom_stt_config",
  "denoising_mode",
  "allow_user_dtmf",
  "user_dtmf_options",
  "begin_message_delay_ms",
  "end_call_after_silence_ms",
  "max_call_duration_ms",
  "ring_duration_ms",
  "responsiveness",
  "interruption_sensitivity",
  "enable_backchannel",
  "backchannel_frequency",
  "backchannel_words",
  "enable_dynamic_responsiveness",
  "enable_dynamic_voice_speed",
  "ambient_sound",
  "ambient_sound_volume",
  "enable_voicemail_detection",
  "voicemail_detection_timeout_ms",
  "voicemail_option",
  "reminder_trigger_ms",
  "reminder_max_count",
  "normalize_for_speech",
  "data_storage_setting",
  "data_storage_retention_days",
  "opt_in_signed_url",
  "pii_config",
  "guardrail_config",
  "post_call_analysis_data",
  "post_call_analysis_model",
  "analysis_successful_prompt",
  "analysis_summary_prompt",
  "analysis_user_sentiment_prompt",
  "pronunciation_dictionary",
  "webhook_url",
  "webhook_events",
  "webhook_timeout_ms",
  "is_public",
] as const;

export const RETELL_LLM_EDITABLE_KEYS = [
  "begin_after_user_silence_ms",
  "begin_message",
  "default_dynamic_variables",
  "general_prompt",
  "general_tools",
  "kb_config",
  "knowledge_base_ids",
  "mcps",
  "model",
  "model_high_priority",
  "model_temperature",
  "s2s_model",
  "start_speaker",
  "starting_state",
  "states",
  "tool_call_strict_mode",
] as const;

export const RETELL_VOICE_PROVIDERS = [
  "elevenlabs",
  "cartesia",
  "minimax",
  "fish_audio",
] as const;

type JsonRecord = Record<string, unknown>;

function omitUndefinedValues(input: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function pickKeys(
  source: JsonRecord | null | undefined,
  keys: readonly string[],
): JsonRecord {
  if (!source) return {};

  return omitUndefinedValues(
    keys.reduce<JsonRecord>((acc, key) => {
      if (key in source) {
        acc[key] = source[key];
      }
      return acc;
    }, {}),
  );
}

export function extractEditableRetellAgent(
  agent: JsonRecord | null | undefined,
): JsonRecord {
  return pickKeys(agent, RETELL_AGENT_EDITABLE_KEYS);
}

export function extractEditableRetellLlm(
  llm: JsonRecord | null | undefined,
): JsonRecord {
  return pickKeys(llm, RETELL_LLM_EDITABLE_KEYS);
}

export function formatRetellJson(value: JsonRecord | null | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parseRetellJson(value: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON must be an object");
  }
  return parsed as JsonRecord;
}
