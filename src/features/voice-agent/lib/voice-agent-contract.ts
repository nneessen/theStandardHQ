import {
  RETELL_AGENT_EDITABLE_KEYS,
  RETELL_LLM_EDITABLE_KEYS,
  RETELL_VOICE_PROVIDERS,
} from "./retell-config.ts";

type JsonRecord = Record<string, unknown>;

const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const VOICE_PROVIDER_SET = new Set<string>(RETELL_VOICE_PROVIDERS);
const RETELL_AGENT_PATCH_KEY_SET = new Set<string>(RETELL_AGENT_EDITABLE_KEYS);
const RETELL_LLM_PATCH_KEY_SET = new Set<string>(RETELL_LLM_EDITABLE_KEYS);
// Allowlist for the general `update_config` action — prevents injection of
// privileged fields like billingExempt, leadLimit, or isActive.
const BOT_CONFIG_ALLOWED_KEYS = new Set([
  "name",
  "botEnabled",
  "timezone",
  "autoOutreachLeadSources",
  "allowedLeadStatuses",
  "blockedLeadStatuses",
  "calendlyEventTypeSlug",
  "leadSourceEventTypeMappings",
  "companyName",
  "jobTitle",
  "bio",
  "yearsOfExperience",
  "residentState",
  "nonResidentStates",
  "specialties",
  "website",
  "location",
  "remindersEnabled",
  "responseSchedule",
  "dailyMessageLimit",
  "maxMessagesPerConversation",
  "voiceEnabled",
  "voiceFollowUpEnabled",
  "afterHoursInboundEnabled",
  "afterHoursStartTime",
  "afterHoursEndTime",
  "afterHoursTimezone",
  "voiceProvider",
  "voiceId",
  "voiceFallbackVoiceId",
  "voiceTransferNumber",
  "voiceMaxCallDurationSeconds",
  "voiceVoicemailEnabled",
  "voiceHumanHandoffEnabled",
  "voiceQuotedFollowupEnabled",
  "primaryPhone",
  "statusTriggerSequences",
  "reEngagementEnabled",
  "reEngagementDelayHours",
  "reEngagementMaxAttempts",
]);

const PENDING_VOICE_AGENT_STATUSES = new Set([
  "pending",
  "queued",
  "requested",
  "creating",
  "provisioning",
]);
const READY_VOICE_AGENT_STATUSES = new Set([
  "ready",
  "active",
  "created",
  "linked",
]);

function isPlainObject(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(
  value: unknown,
  label: string,
): asserts value is JsonRecord {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertNoUnknownKeys(
  value: JsonRecord,
  allowedKeys: readonly string[],
  label: string,
) {
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `${label} contains unsupported fields: ${unknownKeys.join(", ")}.`,
    );
  }
}

function readOptionalTrimmedString(
  value: unknown,
  fieldLabel: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${fieldLabel} must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredTrimmedString(value: unknown, fieldLabel: string): string {
  const parsed = readOptionalTrimmedString(value, fieldLabel);
  if (!parsed) {
    throw new Error(`${fieldLabel} is required.`);
  }
  return parsed;
}

function assertPhoneNumber(value: string, fieldLabel: string) {
  if (!E164_PHONE_PATTERN.test(value)) {
    throw new Error(`${fieldLabel} must be a valid E.164 phone number.`);
  }
}

function parsePatch(
  params: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string,
) {
  assertNoUnknownKeys(params, ["patch"], label);
  const patch = params.patch;
  assertPlainObject(patch, "Patch");

  const invalidPatchKeys = Object.keys(patch).filter(
    (key) => !allowedKeys.has(key),
  );
  if (invalidPatchKeys.length > 0) {
    throw new Error(
      `Patch contains unsupported fields: ${invalidPatchKeys.join(", ")}.`,
    );
  }

  return { patch };
}

export function parseConnectCloseParams(params: Record<string, unknown>) {
  assertNoUnknownKeys(params, ["apiKey"], "Connect Close request");
  const apiKey = readRequiredTrimmedString(params.apiKey, "Close API key");
  return { apiKey };
}

export function parseCreateVoiceAgentParams(params: Record<string, unknown>) {
  assertNoUnknownKeys(params, ["templateKey"], "Create voice agent request");
  const templateKey = readOptionalTrimmedString(
    params.templateKey,
    "templateKey",
  );

  return templateKey ? { templateKey } : {};
}

export function parseRetellConnectionParams(params: Record<string, unknown>) {
  assertNoUnknownKeys(
    params,
    [
      "apiKey",
      "retellAgentId",
      "fromNumberSource",
      "fromNumber",
      "closePhoneNumber",
    ],
    "Voice connection request",
  );

  const apiKey = readRequiredTrimmedString(params.apiKey, "API key");
  const retellAgentId = readRequiredTrimmedString(
    params.retellAgentId,
    "Voice runtime agent ID",
  );
  const fromNumberSourceRaw =
    readOptionalTrimmedString(params.fromNumberSource, "Caller ID source") ??
    "retell";

  if (fromNumberSourceRaw !== "retell" && fromNumberSourceRaw !== "close") {
    throw new Error("Caller ID source must be either 'retell' or 'close'.");
  }

  const fromNumber = readOptionalTrimmedString(
    params.fromNumber,
    "Managed voice number",
  );
  const closePhoneNumber = readOptionalTrimmedString(
    params.closePhoneNumber,
    "Close caller ID",
  );

  if (fromNumberSourceRaw === "retell" && fromNumber) {
    assertPhoneNumber(fromNumber, "Managed voice number");
  }

  if (fromNumberSourceRaw === "close") {
    if (!closePhoneNumber) {
      throw new Error(
        "Close caller ID is required when using Close caller ID.",
      );
    }
    assertPhoneNumber(closePhoneNumber, "Close caller ID");
  }

  return {
    apiKey,
    retellAgentId,
    fromNumberSource: fromNumberSourceRaw,
    ...(fromNumberSourceRaw === "retell" && fromNumber ? { fromNumber } : {}),
    ...(fromNumberSourceRaw === "close" && closePhoneNumber
      ? { closePhoneNumber }
      : {}),
  };
}

export function parseRetellSearchParams(params: Record<string, unknown>) {
  assertNoUnknownKeys(
    params,
    ["searchQuery", "voiceProvider"],
    "Voice search request",
  );

  const searchQuery = readRequiredTrimmedString(
    params.searchQuery,
    "Voice search query",
  );
  const voiceProvider =
    readOptionalTrimmedString(params.voiceProvider, "Voice provider") ??
    "elevenlabs";

  if (!VOICE_PROVIDER_SET.has(voiceProvider)) {
    throw new Error("Voice provider is not supported.");
  }

  return {
    searchQuery,
    voiceProvider,
  };
}

export function parseAddRetellVoiceParams(params: Record<string, unknown>) {
  assertNoUnknownKeys(
    params,
    ["providerVoiceId", "voiceName", "publicUserId", "voiceProvider"],
    "Add voice request",
  );

  const providerVoiceId = readRequiredTrimmedString(
    params.providerVoiceId,
    "Provider voice ID",
  );
  const voiceName = readRequiredTrimmedString(params.voiceName, "Voice name");
  const publicUserId = readOptionalTrimmedString(
    params.publicUserId,
    "Public user ID",
  );
  const voiceProvider =
    readOptionalTrimmedString(params.voiceProvider, "Voice provider") ??
    "elevenlabs";

  if (!VOICE_PROVIDER_SET.has(voiceProvider)) {
    throw new Error("Voice provider is not supported.");
  }

  return {
    providerVoiceId,
    voiceName,
    ...(publicUserId ? { publicUserId } : {}),
    voiceProvider,
  };
}

export function parseRetellAgentUpdateParams(params: Record<string, unknown>) {
  return parsePatch(
    params,
    RETELL_AGENT_PATCH_KEY_SET,
    "Voice draft update request",
  );
}

export function parseRetellLlmUpdateParams(params: Record<string, unknown>) {
  return parsePatch(
    params,
    RETELL_LLM_PATCH_KEY_SET,
    "Voice instructions update request",
  );
}

export function assertNoVoiceActionParams(
  params: Record<string, unknown>,
  label: string,
) {
  assertNoUnknownKeys(params, [], label);
}

export function isVoiceAgentProvisioningPending(status: unknown): boolean {
  return typeof status === "string"
    ? PENDING_VOICE_AGENT_STATUSES.has(status.trim().toLowerCase())
    : false;
}

export function isVoiceAgentProvisioned(status: unknown): boolean {
  return typeof status === "string"
    ? READY_VOICE_AGENT_STATUSES.has(status.trim().toLowerCase())
    : false;
}

export function parseUpdateConfigParams(params: Record<string, unknown>) {
  const invalidKeys = Object.keys(params).filter(
    (key) => !BOT_CONFIG_ALLOWED_KEYS.has(key),
  );
  if (invalidKeys.length > 0) {
    throw new Error(
      `Config update contains unsupported fields: ${invalidKeys.join(", ")}.`,
    );
  }
  return params;
}

// ─── Voice Clone Scripts ────────────────────────────────────────

const SCRIPT_ENTRY_ALLOWED_KEYS = new Set([
  "segmentIndex",
  "category",
  "title",
  "scriptText",
  "minDurationSeconds",
  "targetDurationSeconds",
  "optional",
]);

export interface VoiceCloneScriptEntry {
  segmentIndex: number;
  category: string;
  title: string;
  scriptText: string;
  minDurationSeconds: number;
  targetDurationSeconds: number;
  optional: boolean;
}

export function parseVoiceCloneScripts(
  scripts: unknown,
): VoiceCloneScriptEntry[] {
  if (!Array.isArray(scripts)) {
    throw new Error("scripts must be an array");
  }
  if (scripts.length < 15 || scripts.length > 25) {
    throw new Error(
      `scripts must contain 15-25 entries, received ${scripts.length}`,
    );
  }

  return scripts.map((entry: unknown, i: number) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`scripts[${i}] must be an object`);
    }
    const record = entry as Record<string, unknown>;

    // Reject unknown keys
    const invalidKeys = Object.keys(record).filter(
      (k) => !SCRIPT_ENTRY_ALLOWED_KEYS.has(k),
    );
    if (invalidKeys.length > 0) {
      throw new Error(
        `scripts[${i}] contains unsupported fields: ${invalidKeys.join(", ")}`,
      );
    }

    const segmentIndex = record.segmentIndex;
    if (typeof segmentIndex !== "number" || segmentIndex !== i) {
      throw new Error(
        `scripts[${i}].segmentIndex must be ${i} (sequential, 0-indexed)`,
      );
    }

    const category = record.category;
    if (typeof category !== "string" || !category.trim()) {
      throw new Error(`scripts[${i}].category is required`);
    }

    const title = record.title;
    if (typeof title !== "string" || !title.trim()) {
      throw new Error(`scripts[${i}].title is required`);
    }

    const scriptText = record.scriptText;
    if (typeof scriptText !== "string" || !scriptText.trim()) {
      throw new Error(`scripts[${i}].scriptText is required`);
    }
    if (scriptText.length > 10000) {
      throw new Error(`scripts[${i}].scriptText exceeds 10000 character limit`);
    }

    const minDuration = record.minDurationSeconds;
    if (typeof minDuration !== "number" || minDuration < 30) {
      throw new Error(`scripts[${i}].minDurationSeconds must be >= 30`);
    }

    const targetDuration = record.targetDurationSeconds;
    if (typeof targetDuration !== "number" || targetDuration < 30) {
      throw new Error(`scripts[${i}].targetDurationSeconds must be >= 30`);
    }
    if (targetDuration < minDuration) {
      throw new Error(
        `scripts[${i}].targetDurationSeconds must be >= minDurationSeconds`,
      );
    }

    if (typeof record.optional !== "boolean") {
      throw new Error(`scripts[${i}].optional must be a boolean`);
    }

    return {
      segmentIndex: i,
      category: category.trim(),
      title: title.trim(),
      scriptText: scriptText.trim(),
      minDurationSeconds: minDuration,
      targetDurationSeconds: targetDuration,
      optional: record.optional,
    };
  });
}
