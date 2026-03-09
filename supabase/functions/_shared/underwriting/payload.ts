export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface ConditionResponse {
  conditionCode: string;
  conditionName: string;
  responses: Record<string, string | number | string[]>;
}

export interface TobaccoInfo {
  currentUse: boolean;
  type?: string;
  frequency?: string;
  lastUseDate?: string;
}

export interface MedicationInfo {
  bpMedCount: number;
  bloodThinners: boolean;
  heartMeds: boolean;
  cholesterolMedCount: number;
  insulinUse: boolean;
  oralDiabetesMeds: boolean;
  antidepressants: boolean;
  antianxiety: boolean;
  antipsychotics: boolean;
  moodStabilizers: boolean;
  sleepAids: boolean;
  adhdMeds: boolean;
  painMedications: "none" | "otc_only" | "prescribed_non_opioid" | "opioid";
  seizureMeds: boolean;
  migraineMeds: boolean;
  inhalers: boolean;
  copdMeds: boolean;
  thyroidMeds: boolean;
  hormonalTherapy: boolean;
  steroids: boolean;
  immunosuppressants: boolean;
  biologics: boolean;
  dmards: boolean;
  cancerTreatment: boolean;
  antivirals: boolean;
  osteoporosisMeds: boolean;
  kidneyMeds: boolean;
  liverMeds: boolean;
  otherMedications?: string[];
}

export interface ParsedHealthSnapshot {
  conditionsByCode: Record<string, ConditionResponse>;
  conditions: ConditionResponse[];
  medications?: MedicationInfo;
}

export interface UnderwritingRawPayload {
  clientName: string | null;
  clientDob: string | null;
  clientAge: number;
  clientGender: string;
  clientState: string;
  clientHeightInches: number;
  clientWeightLbs: number;
  healthResponses: Record<string, JsonValue>;
  conditionsReported: string[];
  tobaccoUse: boolean;
  tobaccoDetails: Record<string, JsonValue> | null;
  requestedFaceAmounts: number[];
  requestedProductTypes: string[];
  decisionTreeId: string | null;
  sessionDurationSeconds: number | null;
  notes: string | null;
  selectedTermYears: 10 | 15 | 20 | 25 | 30 | null;
  runKey: string | null;
}

const BASE_ALLOWED_KEYS = new Set([
  "clientName",
  "clientDob",
  "clientAge",
  "clientGender",
  "clientState",
  "clientHeightInches",
  "clientWeightLbs",
  "healthResponses",
  "conditionsReported",
  "tobaccoUse",
  "tobaccoDetails",
  "requestedFaceAmounts",
  "requestedProductTypes",
  "decisionTreeId",
  "sessionDurationSeconds",
  "notes",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Expected string value");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRequiredString(value: unknown, field: string): string {
  const parsed = asOptionalString(value);
  if (!parsed) {
    throw new Error(`${field} is required`);
  }

  return parsed;
}

function asOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Expected finite number value");
  }

  return value;
}

function asRequiredNumber(value: unknown, field: string): number {
  const parsed = asOptionalNumber(value);
  if (parsed === null) {
    throw new Error(`${field} is required`);
  }

  return parsed;
}

function asRequiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }

  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`${field} must be an array of strings`);
  }

  return value;
}

function asNumberArray(value: unknown, field: string): number[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    throw new Error(`${field} must be an array of numbers`);
  }

  return value;
}

function asObject(value: unknown, field: string): Record<string, JsonValue> {
  if (!isPlainObject(value)) {
    throw new Error(`${field} must be an object`);
  }

  return value as Record<string, JsonValue>;
}

function asOptionalObject(value: unknown): Record<string, JsonValue> | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw new Error("Expected object value");
  }

  return value as Record<string, JsonValue>;
}

function asOptionalTermYears(value: unknown): 10 | 15 | 20 | 25 | 30 | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    value === 10 ||
    value === 15 ||
    value === 20 ||
    value === 25 ||
    value === 30
  ) {
    return value;
  }

  throw new Error("selectedTermYears must be one of 10, 15, 20, 25, or 30");
}

export function sanitizeUnderwritingPayload(
  body: unknown,
  options: {
    allowRunKey?: boolean;
    requireRunKey?: boolean;
    allowSelectedTermYears?: boolean;
  } = {},
): UnderwritingRawPayload {
  const payload = asObject(body, "body");
  const allowedKeys = new Set(BASE_ALLOWED_KEYS);

  if (options.allowRunKey) {
    allowedKeys.add("runKey");
  }
  if (options.allowSelectedTermYears) {
    allowedKeys.add("selectedTermYears");
  }

  const unexpectedKeys = Object.keys(payload).filter(
    (key) => !allowedKeys.has(key),
  );
  if (unexpectedKeys.length > 0) {
    throw new Error("Only raw wizard inputs may be processed");
  }

  const requestedFaceAmounts = asNumberArray(
    payload.requestedFaceAmounts,
    "requestedFaceAmounts",
  );
  if (
    requestedFaceAmounts.length === 0 ||
    requestedFaceAmounts.some((amount) => amount <= 0)
  ) {
    throw new Error(
      "requestedFaceAmounts must include at least one positive face amount",
    );
  }

  const runKey = options.allowRunKey ? asOptionalString(payload.runKey) : null;
  if (options.requireRunKey && !runKey) {
    throw new Error("runKey is required");
  }

  return {
    clientName: asOptionalString(payload.clientName),
    clientDob: asOptionalString(payload.clientDob),
    clientAge: asRequiredNumber(payload.clientAge, "clientAge"),
    clientGender: asRequiredString(payload.clientGender, "clientGender"),
    clientState: asRequiredString(payload.clientState, "clientState"),
    clientHeightInches: asRequiredNumber(
      payload.clientHeightInches,
      "clientHeightInches",
    ),
    clientWeightLbs: asRequiredNumber(
      payload.clientWeightLbs,
      "clientWeightLbs",
    ),
    healthResponses: asObject(payload.healthResponses, "healthResponses"),
    conditionsReported: asStringArray(
      payload.conditionsReported ?? [],
      "conditionsReported",
    ),
    tobaccoUse: asRequiredBoolean(payload.tobaccoUse, "tobaccoUse"),
    tobaccoDetails: asOptionalObject(payload.tobaccoDetails),
    requestedFaceAmounts,
    requestedProductTypes: asStringArray(
      payload.requestedProductTypes ?? [],
      "requestedProductTypes",
    ),
    decisionTreeId: asOptionalString(payload.decisionTreeId),
    sessionDurationSeconds: asOptionalNumber(payload.sessionDurationSeconds),
    notes: asOptionalString(payload.notes),
    selectedTermYears: options.allowSelectedTermYears
      ? asOptionalTermYears(payload.selectedTermYears)
      : null,
    runKey,
  };
}

function isConditionResponse(value: unknown): value is ConditionResponse {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.conditionCode === "string" &&
    typeof value.conditionName === "string" &&
    isPlainObject(value.responses)
  );
}

function isMedicationInfo(value: unknown): value is MedicationInfo {
  if (!isPlainObject(value)) {
    return false;
  }

  const maybe = value as Partial<MedicationInfo>;
  return (
    typeof maybe.bpMedCount === "number" &&
    typeof maybe.cholesterolMedCount === "number" &&
    typeof maybe.bloodThinners === "boolean" &&
    typeof maybe.heartMeds === "boolean" &&
    typeof maybe.insulinUse === "boolean" &&
    typeof maybe.oralDiabetesMeds === "boolean" &&
    typeof maybe.antidepressants === "boolean" &&
    typeof maybe.antianxiety === "boolean" &&
    typeof maybe.antipsychotics === "boolean" &&
    typeof maybe.moodStabilizers === "boolean" &&
    typeof maybe.sleepAids === "boolean" &&
    typeof maybe.adhdMeds === "boolean" &&
    typeof maybe.painMedications === "string" &&
    typeof maybe.seizureMeds === "boolean" &&
    typeof maybe.migraineMeds === "boolean" &&
    typeof maybe.inhalers === "boolean" &&
    typeof maybe.copdMeds === "boolean" &&
    typeof maybe.thyroidMeds === "boolean" &&
    typeof maybe.hormonalTherapy === "boolean" &&
    typeof maybe.steroids === "boolean" &&
    typeof maybe.immunosuppressants === "boolean" &&
    typeof maybe.biologics === "boolean" &&
    typeof maybe.dmards === "boolean" &&
    typeof maybe.cancerTreatment === "boolean" &&
    typeof maybe.antivirals === "boolean" &&
    typeof maybe.osteoporosisMeds === "boolean" &&
    typeof maybe.kidneyMeds === "boolean" &&
    typeof maybe.liverMeds === "boolean"
  );
}

export function parseHealthSnapshot(
  value: Record<string, JsonValue>,
): ParsedHealthSnapshot {
  const version = value.version;
  const rawConditionsByCode =
    version === 2 && isPlainObject(value.conditionsByCode)
      ? value.conditionsByCode
      : value;

  const conditionsByCode = Object.fromEntries(
    Object.entries(rawConditionsByCode).filter(([, entry]) =>
      isConditionResponse(entry),
    ),
  ) as Record<string, ConditionResponse>;

  return {
    conditionsByCode,
    conditions: Object.values(conditionsByCode),
    medications: isMedicationInfo(value.medications)
      ? value.medications
      : undefined,
  };
}

export function splitHeight(totalHeightInches: number): {
  feet: number;
  inches: number;
} {
  const normalized = Math.max(0, Math.floor(totalHeightInches));
  return {
    feet: Math.floor(normalized / 12),
    inches: normalized % 12,
  };
}
