type JsonRecord = Record<string, unknown>;

export interface RetellStructuredAgentForm {
  agentName: string;
  voiceId: string;
  voiceModel: string;
  voiceSpeed: string;
  voiceTemperature: string;
  fallbackVoiceIds: string;
  language: string;
  boostedKeywords: string;
  sttMode: string;
  denoisingMode: string;
  responsiveness: string;
  interruptionSensitivity: string;
  ringDurationMs: string;
  beginMessageDelayMs: string;
  endCallAfterSilenceMs: string;
  maxCallDurationMs: string;
  allowUserDtmf: boolean;
  enableVoicemailDetection: boolean;
  voicemailDetectionTimeoutMs: string;
  voicemailOption: string;
  webhookUrl: string;
  webhookEvents: string;
  webhookTimeoutMs: string;
}

export interface RetellStructuredLlmForm {
  generalPrompt: string;
  beginMessage: string;
  model: string;
  modelTemperature: string;
  beginAfterUserSilenceMs: string;
  knowledgeBaseIds: string;
  toolCallStrictMode: boolean;
  defaultDynamicVariables: string;
  generalTools: string;
  mcps: string;
}

const SAFE_HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumberString(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArrayText(value: unknown): string {
  if (!Array.isArray(value)) return "";

  return value
    .filter((item): item is string => typeof item === "string")
    .join("\n");
}

function asJsonText(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(
  value: string,
  fieldLabel: string,
  options: {
    min?: number;
    max?: number;
  } = {},
): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`${fieldLabel} must be a whole number.`);
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} must be a whole number.`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${fieldLabel} must be at least ${options.min}.`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`${fieldLabel} must be ${options.max} or less.`);
  }

  return parsed;
}

function parseFloatValue(
  value: string,
  fieldLabel: string,
  options: {
    min?: number;
    max?: number;
  } = {},
): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} must be a number.`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${fieldLabel} must be at least ${options.min}.`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`${fieldLabel} must be ${options.max} or less.`);
  }

  return parsed;
}

function parseOptionalJson(value: string, fieldLabel: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }
}

function parseOptionalObject(
  value: string,
  fieldLabel: string,
): JsonRecord | null {
  const parsed = parseOptionalJson(value, fieldLabel);
  if (parsed === null) return null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }

  return parsed as JsonRecord;
}

function parseOptionalArray(
  value: string,
  fieldLabel: string,
): unknown[] | null {
  const parsed = parseOptionalJson(value, fieldLabel);
  if (parsed === null) return null;
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON array.`);
  }

  return parsed;
}

function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return SAFE_HTTP_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function buildDiffPatch(current: JsonRecord, baseline: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => {
      return JSON.stringify(value) !== JSON.stringify(baseline[key]);
    }),
  );
}

function collectValidationError(errors: string[], validate: () => void) {
  try {
    validate();
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
  }
}

export function buildStructuredRetellAgentForm(
  agent: JsonRecord | null | undefined,
): RetellStructuredAgentForm {
  return {
    agentName: asString(agent?.agent_name),
    voiceId: asString(agent?.voice_id),
    voiceModel: asString(agent?.voice_model),
    voiceSpeed: asNumberString(agent?.voice_speed),
    voiceTemperature: asNumberString(agent?.voice_temperature),
    fallbackVoiceIds: asStringArrayText(agent?.fallback_voice_ids),
    language: asString(agent?.language),
    boostedKeywords: asStringArrayText(agent?.boosted_keywords),
    sttMode: asString(agent?.stt_mode),
    denoisingMode: asString(agent?.denoising_mode),
    responsiveness: asNumberString(agent?.responsiveness),
    interruptionSensitivity: asNumberString(agent?.interruption_sensitivity),
    ringDurationMs: asNumberString(agent?.ring_duration_ms),
    beginMessageDelayMs: asNumberString(agent?.begin_message_delay_ms),
    endCallAfterSilenceMs: asNumberString(agent?.end_call_after_silence_ms),
    maxCallDurationMs: asNumberString(agent?.max_call_duration_ms),
    allowUserDtmf: asBoolean(agent?.allow_user_dtmf),
    enableVoicemailDetection: asBoolean(agent?.enable_voicemail_detection),
    voicemailDetectionTimeoutMs: asNumberString(
      agent?.voicemail_detection_timeout_ms,
    ),
    voicemailOption: asString(agent?.voicemail_option),
    webhookUrl: asString(agent?.webhook_url),
    webhookEvents: asStringArrayText(agent?.webhook_events),
    webhookTimeoutMs: asNumberString(agent?.webhook_timeout_ms),
  };
}

export function buildStructuredRetellLlmForm(
  llm: JsonRecord | null | undefined,
): RetellStructuredLlmForm {
  return {
    generalPrompt: asString(llm?.general_prompt),
    beginMessage: asString(llm?.begin_message),
    model: asString(llm?.model),
    modelTemperature: asNumberString(llm?.model_temperature),
    beginAfterUserSilenceMs: asNumberString(llm?.begin_after_user_silence_ms),
    knowledgeBaseIds: asStringArrayText(llm?.knowledge_base_ids),
    toolCallStrictMode: asBoolean(llm?.tool_call_strict_mode),
    defaultDynamicVariables: asJsonText(llm?.default_dynamic_variables),
    generalTools: asJsonText(llm?.general_tools),
    mcps: asJsonText(llm?.mcps),
  };
}

export function serializeStructuredRetellAgentForm(
  form: RetellStructuredAgentForm,
): JsonRecord {
  return {
    agent_name: form.agentName.trim() || null,
    voice_id: form.voiceId.trim() || null,
    voice_model: form.voiceModel.trim() || null,
    voice_speed: parseFloatValue(form.voiceSpeed, "Voice speed", {
      min: 0.25,
      max: 4,
    }),
    voice_temperature: parseFloatValue(
      form.voiceTemperature,
      "Voice temperature",
      {
        min: 0,
        max: 2,
      },
    ),
    fallback_voice_ids: parseList(form.fallbackVoiceIds),
    language: form.language.trim() || null,
    boosted_keywords: parseList(form.boostedKeywords),
    stt_mode: form.sttMode.trim() || null,
    denoising_mode: form.denoisingMode.trim() || null,
    responsiveness: parseFloatValue(form.responsiveness, "Responsiveness", {
      min: 0,
      max: 1,
    }),
    interruption_sensitivity: parseFloatValue(
      form.interruptionSensitivity,
      "Interruption sensitivity",
      {
        min: 0,
        max: 1,
      },
    ),
    ring_duration_ms: parseInteger(form.ringDurationMs, "Ring duration", {
      min: 1_000,
      max: 600_000,
    }),
    begin_message_delay_ms: parseInteger(
      form.beginMessageDelayMs,
      "Begin message delay",
      {
        min: 0,
        max: 120_000,
      },
    ),
    end_call_after_silence_ms: parseInteger(
      form.endCallAfterSilenceMs,
      "End-call silence timeout",
      {
        min: 1_000,
        max: 600_000,
      },
    ),
    max_call_duration_ms: parseInteger(
      form.maxCallDurationMs,
      "Max call duration",
      {
        min: 30_000,
        max: 28_800_000,
      },
    ),
    allow_user_dtmf: form.allowUserDtmf,
    enable_voicemail_detection: form.enableVoicemailDetection,
    voicemail_detection_timeout_ms: parseInteger(
      form.voicemailDetectionTimeoutMs,
      "Voicemail detection timeout",
      {
        min: 0,
        max: 120_000,
      },
    ),
    voicemail_option: form.voicemailOption.trim() || null,
    webhook_url: form.webhookUrl.trim() || null,
    webhook_events: parseList(form.webhookEvents),
    webhook_timeout_ms: parseInteger(form.webhookTimeoutMs, "Webhook timeout", {
      min: 1_000,
      max: 300_000,
    }),
  };
}

export function serializeStructuredRetellLlmForm(
  form: RetellStructuredLlmForm,
): JsonRecord {
  return {
    general_prompt: form.generalPrompt.trim() || null,
    begin_message: form.beginMessage.trim() || null,
    model: form.model.trim() || null,
    model_temperature: parseFloatValue(
      form.modelTemperature,
      "Model temperature",
      {
        min: 0,
        max: 2,
      },
    ),
    begin_after_user_silence_ms: parseInteger(
      form.beginAfterUserSilenceMs,
      "Begin-after-user-silence timeout",
      {
        min: 0,
        max: 120_000,
      },
    ),
    knowledge_base_ids: parseList(form.knowledgeBaseIds),
    tool_call_strict_mode: form.toolCallStrictMode,
    default_dynamic_variables: parseOptionalObject(
      form.defaultDynamicVariables,
      "Default dynamic variables",
    ),
    general_tools: parseOptionalArray(form.generalTools, "Functions"),
    mcps: parseOptionalArray(form.mcps, "MCPs"),
  };
}

export function diffStructuredRetellAgentForm(
  currentForm: RetellStructuredAgentForm,
  baselineForm: RetellStructuredAgentForm,
): JsonRecord {
  return buildDiffPatch(
    serializeStructuredRetellAgentForm(currentForm),
    serializeStructuredRetellAgentForm(baselineForm),
  );
}

export function diffStructuredRetellLlmForm(
  currentForm: RetellStructuredLlmForm,
  baselineForm: RetellStructuredLlmForm,
): JsonRecord {
  return buildDiffPatch(
    serializeStructuredRetellLlmForm(currentForm),
    serializeStructuredRetellLlmForm(baselineForm),
  );
}

export function validateStructuredRetellAgentForm(
  form: RetellStructuredAgentForm,
): string[] {
  const errors: string[] = [];

  collectValidationError(errors, () => {
    parseFloatValue(form.voiceSpeed, "Voice speed", {
      min: 0.25,
      max: 4,
    });
  });
  collectValidationError(errors, () => {
    parseFloatValue(form.voiceTemperature, "Voice temperature", {
      min: 0,
      max: 2,
    });
  });
  collectValidationError(errors, () => {
    parseFloatValue(form.responsiveness, "Responsiveness", {
      min: 0,
      max: 1,
    });
  });
  collectValidationError(errors, () => {
    parseFloatValue(form.interruptionSensitivity, "Interruption sensitivity", {
      min: 0,
      max: 1,
    });
  });
  collectValidationError(errors, () => {
    parseInteger(form.ringDurationMs, "Ring duration", {
      min: 1_000,
      max: 600_000,
    });
  });
  collectValidationError(errors, () => {
    parseInteger(form.beginMessageDelayMs, "Begin message delay", {
      min: 0,
      max: 120_000,
    });
  });
  collectValidationError(errors, () => {
    parseInteger(form.endCallAfterSilenceMs, "End-call silence timeout", {
      min: 1_000,
      max: 600_000,
    });
  });
  collectValidationError(errors, () => {
    parseInteger(form.maxCallDurationMs, "Max call duration", {
      min: 30_000,
      max: 28_800_000,
    });
  });
  collectValidationError(errors, () => {
    parseInteger(
      form.voicemailDetectionTimeoutMs,
      "Voicemail detection timeout",
      {
        min: 0,
        max: 120_000,
      },
    );
  });
  collectValidationError(errors, () => {
    parseInteger(form.webhookTimeoutMs, "Webhook timeout", {
      min: 1_000,
      max: 300_000,
    });
  });

  const webhookUrl = form.webhookUrl.trim();
  if (webhookUrl && !isSafeUrl(webhookUrl)) {
    errors.push("Webhook URL must be a valid http:// or https:// URL.");
  }

  return errors;
}

export function validateStructuredRetellLlmForm(
  form: RetellStructuredLlmForm,
): string[] {
  const errors: string[] = [];

  collectValidationError(errors, () => {
    parseFloatValue(form.modelTemperature, "Model temperature", {
      min: 0,
      max: 2,
    });
  });
  collectValidationError(errors, () => {
    parseInteger(
      form.beginAfterUserSilenceMs,
      "Begin-after-user-silence timeout",
      {
        min: 0,
        max: 120_000,
      },
    );
  });
  collectValidationError(errors, () => {
    parseOptionalObject(
      form.defaultDynamicVariables,
      "Default dynamic variables",
    );
  });
  collectValidationError(errors, () => {
    parseOptionalArray(form.generalTools, "Functions");
  });
  collectValidationError(errors, () => {
    parseOptionalArray(form.mcps, "MCPs");
  });

  return errors;
}

export function mergeStructuredRetellAgentForm(
  base: JsonRecord | null | undefined,
  form: RetellStructuredAgentForm,
): JsonRecord {
  return {
    ...(base ?? {}),
    ...serializeStructuredRetellAgentForm(form),
  };
}

export function mergeStructuredRetellLlmForm(
  base: JsonRecord | null | undefined,
  form: RetellStructuredLlmForm,
): JsonRecord {
  return {
    ...(base ?? {}),
    ...serializeStructuredRetellLlmForm(form),
  };
}
