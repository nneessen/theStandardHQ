import type {
  ConditionResponse,
  MedicationInfo,
  SessionHealthSnapshot,
} from "../../types/underwriting.types";
import { safeParseJsonObject } from "../shared/formatters";

export interface ParsedSessionHealthSnapshot {
  conditionsByCode: Record<string, ConditionResponse>;
  conditions: ConditionResponse[];
  medications?: MedicationInfo;
}

function isConditionResponse(value: unknown): value is ConditionResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const maybe = value as Partial<ConditionResponse>;
  return (
    typeof maybe.conditionCode === "string" &&
    typeof maybe.conditionName === "string" &&
    typeof maybe.responses === "object" &&
    maybe.responses !== null &&
    !Array.isArray(maybe.responses)
  );
}

function normalizeConditionsByCode(
  value: unknown,
): Record<string, ConditionResponse> {
  const raw = safeParseJsonObject<Record<string, unknown>>(value);
  return Object.fromEntries(
    Object.entries(raw).filter(([, entry]) => isConditionResponse(entry)),
  ) as Record<string, ConditionResponse>;
}

function isMedicationInfo(value: unknown): value is MedicationInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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
    typeof maybe.painMedications === "string"
  );
}

export function buildSessionHealthSnapshot(
  conditions: ConditionResponse[],
  medications: MedicationInfo,
): SessionHealthSnapshot {
  return {
    version: 2,
    conditionsByCode: conditions.reduce(
      (acc, condition) => {
        acc[condition.conditionCode] = condition;
        return acc;
      },
      {} as Record<string, ConditionResponse>,
    ),
    medications,
  };
}

export function parseSessionHealthSnapshot(
  value: unknown,
): ParsedSessionHealthSnapshot {
  const raw = safeParseJsonObject<Record<string, unknown>>(value);

  if (
    raw.version === 2 &&
    "conditionsByCode" in raw &&
    typeof raw.conditionsByCode === "object" &&
    raw.conditionsByCode !== null &&
    !Array.isArray(raw.conditionsByCode)
  ) {
    const conditionsByCode = normalizeConditionsByCode(raw.conditionsByCode);
    return {
      conditionsByCode,
      conditions: Object.values(conditionsByCode),
      medications: isMedicationInfo(raw.medications)
        ? raw.medications
        : undefined,
    };
  }

  const conditionsByCode = normalizeConditionsByCode(raw);
  return {
    conditionsByCode,
    conditions: Object.values(conditionsByCode),
  };
}
