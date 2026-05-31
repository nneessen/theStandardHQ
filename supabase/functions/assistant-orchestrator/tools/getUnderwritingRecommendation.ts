// Underwriting recommendation: rank carrier products for a prospect by PROBABILITY
// OF APPROVAL (not price), using the SAME authoritative edge engine the UW wizard
// runs (computeAuthoritativeUnderwritingRun, imported directly — no HTTP hop).
//
// The model supplies flat client facts + reported conditions; we assemble an
// UnderwritingRawPayload (version-2 health snapshot) and run it through the engine
// against the caller's RLS-scoped products + approved rule sets. Output is honest by
// construction: every product carries an `assessable` flag, and non-assessable
// products surface INSUFFICIENT_DATA_REASON instead of a fabricated class — so the
// agent asks for the missing facts rather than inventing an approval.
//
// IMPORTANT (offline-testability of the tools/ layer): the only engine import that
// is a *value* import is computeAuthoritativeUnderwritingRun + INSUFFICIENT_DATA_REASON.
// SupabaseClient/Database are type-only (erased at runtime). ctx.db is cast back UP
// to the full client at the boundary (index.ts narrows the real client DOWN to
// ToolDbClient at :149); this is RLS-scoped and breaks no invariant.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import type { Database } from "../../../../src/types/database.types.ts";
import {
  computeAuthoritativeUnderwritingRun,
  INSUFFICIENT_DATA_REASON,
  type AuthoritativeRunResult,
} from "../../_shared/underwriting/engine.ts";
import type {
  JsonValue,
  UnderwritingRawPayload,
} from "../../_shared/underwriting/payload.ts";
import type { AssistantToolContext, RegisteredTool } from "./types.ts";

// The conditions the engine can actually reason about today: the transformer-backed
// codes (which produce rule-compatible facts) plus atrial_fibrillation (pass-through,
// but covered by an approved AmAm decline rule). The full 142-code ontology is too
// large for an enum and most codes lack transformers/rules, so they would abstain
// anyway — see docs/underwriting-jarvis-engine-honesty-and-curation.md.
const CONDITION_CODES = [
  "diabetes",
  "heart_attack",
  "heart_disease",
  "stroke",
  "high_blood_pressure",
  "cancer",
  "copd",
  "depression",
  "anxiety",
  "bipolar",
  "atrial_fibrillation",
] as const;

const DEFAULT_FACE_AMOUNT = 100000;

interface ConditionInput {
  code: string;
  controlStatus?: string;
  medicationCount?: string;
  bloodPressureReading?: string;
  details?: Record<string, JsonValue>;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

// Build the raw follow-up responses for one condition in the EXACT vocabulary the
// src conditionResponseTransformer expects. The HBP gating fields (controlStatus /
// medicationCount / bloodPressureReading) are first-class + enum-constrained because
// they are the only inputs that produce a visible curated outcome today; everything
// else flows through `details` verbatim (rule-less codes honestly abstain).
function buildResponses(
  condition: ConditionInput,
): Record<string, string | number | string[]> {
  const responses: Record<string, string | number | string[]> = {};

  const details = condition.details;
  if (details && typeof details === "object") {
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === "string" && value.trim() !== "") {
        responses[key] = value;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        responses[key] = value;
      } else if (
        Array.isArray(value) &&
        value.every((item) => typeof item === "string")
      ) {
        responses[key] = value as string[];
      }
    }
  }

  if (condition.code === "high_blood_pressure") {
    const controlled = asString(condition.controlStatus);
    if (controlled !== undefined) responses.controlled = controlled;
    const medCount = asString(condition.medicationCount);
    if (medCount !== undefined) responses.medication_count = medCount;
    const reading = asString(condition.bloodPressureReading);
    if (reading !== undefined) responses.current_reading = reading;
  }

  return responses;
}

// Exported for unit testing the model-args → raw-payload seam (the new code that
// curated-rules.test.ts does NOT cover — it hands rule sets straight to the engine).
export function buildPayload(
  input: Record<string, unknown>,
): UnderwritingRawPayload | null {
  const age = asNumber(input.age);
  if (age === undefined) return null;

  const genderRaw = asString(input.gender)?.toLowerCase();
  const gender = genderRaw === "female" ? "female" : "male";

  const rawConditions = Array.isArray(input.conditions)
    ? (input.conditions as unknown[])
    : [];
  const conditions: ConditionInput[] = [];
  for (const entry of rawConditions) {
    if (typeof entry !== "object" || entry === null) continue;
    const obj = entry as Record<string, unknown>;
    const code = asString(obj.code);
    if (code === undefined) continue;
    conditions.push({
      code,
      controlStatus: asString(obj.controlStatus),
      medicationCount: asString(obj.medicationCount),
      bloodPressureReading: asString(obj.bloodPressureReading),
      details:
        typeof obj.details === "object" && obj.details !== null
          ? (obj.details as Record<string, JsonValue>)
          : undefined,
    });
  }

  // Key by code. If the model sends the same condition twice, MERGE their
  // responses (later keys win) rather than letting the second silently drop the
  // first's facts — a dropped disqualifying fact would inflate the outcome.
  const conditionsByCode: Record<string, JsonValue> = {};
  for (const condition of conditions) {
    const existing = conditionsByCode[condition.code] as
      | { responses?: Record<string, JsonValue> }
      | undefined;
    conditionsByCode[condition.code] = {
      conditionCode: condition.code,
      conditionName: condition.code,
      responses: {
        ...(existing?.responses ?? {}),
        ...(buildResponses(condition) as Record<string, JsonValue>),
      },
    };
  }

  const healthResponses: Record<string, JsonValue> = {
    version: 2,
    conditionsByCode,
  };

  const faceAmount = asNumber(input.faceAmount) ?? DEFAULT_FACE_AMOUNT;
  const productType = asString(input.productType);

  return {
    clientName: null,
    clientDob: null,
    clientAge: age,
    clientGender: gender,
    clientState: asString(input.state) ?? "",
    clientHeightInches: asNumber(input.heightInches) ?? 0,
    clientWeightLbs: asNumber(input.weightLbs) ?? 0,
    healthResponses,
    conditionsReported: [...new Set(conditions.map((c) => c.code))],
    tobaccoUse: input.tobacco === true,
    tobaccoDetails: null,
    requestedFaceAmounts: [faceAmount > 0 ? faceAmount : DEFAULT_FACE_AMOUNT],
    requestedProductTypes: productType ? [productType] : [],
    decisionTreeId: null,
    sessionDurationSeconds: null,
    notes: null,
    selectedTermYears: null,
    runKey: null,
  };
}

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  // Early, honest abstention: without an IMO we cannot scope to any product set.
  if (!ctx.imoId) {
    return {
      available: false,
      reason: "no_imo_scope",
    };
  }

  const payload = buildPayload(input);
  if (!payload) {
    return {
      available: false,
      reason: "insufficient_client_facts",
    };
  }

  // Cast ctx.db back UP to the full client (index.ts narrowed it DOWN to ToolDbClient
  // at the boundary). RLS-scoped to the signed-in user; no invariant broken.
  const client = ctx.db as unknown as SupabaseClient<Database>;

  let result: AuthoritativeRunResult;
  try {
    result = await computeAuthoritativeUnderwritingRun({
      client,
      payload,
      imoId: ctx.imoId,
      requestId: ctx.conversationId,
    });
  } catch (_error) {
    return { available: false, reason: "evaluation_failed" };
  }

  // Build (height/weight) is a primary mortality factor. If it wasn't provided we
  // ran without it; disclose that so the agent never presents a build-blind class
  // as final. (The engine simply skips the build gate when build is absent — it
  // does NOT abstain — so without this warning an obese client could read as a
  // clean Standard purely because build was omitted.)
  const buildProvided =
    asNumber(input.heightInches) !== undefined &&
    asNumber(input.weightLbs) !== undefined;
  const dataWarning = buildProvided
    ? undefined
    : "Height and weight were not provided, so build/BMI was NOT assessed. Build can lower the class or cause a decline — confirm the client's height and weight before relying on any class below.";

  const filtered = result.decisionResult.filtered;
  const recommendations = result.decisionResult.recommendations;

  if (recommendations.length === 0) {
    // No product survived to a recommendation. This is ambiguous by design: the
    // engine DROPS declined products (likelihood 0) the same way it omits products
    // with no rule coverage, and it returns nothing when the IMO has no products.
    // Do NOT imply "merely not assessable" — surface the filter counts and let the
    // agent state the honest range of possibilities.
    return {
      available: false,
      reason: "no_recommendations",
      data: {
        note: "No carrier product produced a recommendation for this profile. Products may have been declined by an approved carrier rule, may lack the rule coverage to assess, or none may be configured for this IMO — this result cannot distinguish those.",
        totalProductsEvaluated: filtered.totalProducts,
        ineligibleProducts: filtered.ineligible,
        insufficientDataReason: INSUFFICIENT_DATA_REASON,
        dataWarning,
      },
    };
  }

  const products = recommendations.map((rec) => {
    // Fields that are ALWAYS safe to surface — they carry no approval signal.
    const base = {
      carrierName: rec.carrierName,
      productName: rec.productName,
      productType: rec.productType,
      assessable: rec.assessable,
      // Carries INSUFFICIENT_DATA_REASON when not assessable.
      eligibilityReasons: rec.eligibilityReasons,
    };
    if (!rec.assessable) {
      // The engine did NOT grade this product. OMIT every favorable-looking
      // field entirely — not just healthClass/approvalLikelihood, but also
      // eligibilityStatus (engine "eligible" only means the age/state/coverage
      // gate passed, NOT that conditions were assessed) and conditionDecisions
      // (which can carry a per-condition decision:"approved"/class). Surfacing
      // any of them lets the model quote a favorable half of a contradictory
      // record. Honest shape = "couldn't assess; here's why" + nothing else.
      return base;
    }
    return {
      ...base,
      healthClass: rec.healthClassResult,
      approvalLikelihood: rec.approvalLikelihood,
      eligibilityStatus: rec.eligibilityStatus,
      concerns: rec.concerns,
      conditionDecisions: rec.conditionDecisions,
    };
  });

  const assessableCount = products.filter((p) => p.assessable).length;

  const summary = {
    totalProductsEvaluated: filtered.totalProducts,
    recommendationCount: products.length,
    assessableCount,
    abstainedCount: products.length - assessableCount,
    insufficientDataReason: INSUFFICIENT_DATA_REASON,
    dataWarning,
  };

  // Nothing could actually be assessed — every product abstained for lack of rule
  // coverage. Signal unavailable so the agent asks for the missing facts instead of
  // presenting abstaining products as if they were graded recommendations.
  if (assessableCount === 0) {
    return {
      available: false,
      reason: "insufficient_data_to_assess",
      data: {
        summary,
        conditionsConsidered: payload.conditionsReported,
        products,
      },
    };
  }

  return {
    available: true,
    data: {
      summary,
      conditionsConsidered: payload.conditionsReported,
      products,
    },
  };
}

export const getUnderwritingRecommendation: RegisteredTool = {
  name: "getUnderwritingRecommendation",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      age: {
        type: "integer",
        minimum: 18,
        maximum: 90,
        description: "Client's age in years.",
      },
      gender: {
        type: "string",
        enum: ["male", "female"],
        description: "Client's underwriting gender.",
      },
      state: {
        type: "string",
        description: "2-letter US state code (e.g. 'TX').",
      },
      heightInches: {
        type: "integer",
        description: "Total height in inches (e.g. 70 for 5'10\").",
      },
      weightLbs: { type: "integer", description: "Weight in pounds." },
      tobacco: {
        type: "boolean",
        description: "True if the client currently uses tobacco/nicotine.",
      },
      faceAmount: {
        type: "integer",
        description:
          "Requested coverage amount in dollars. Defaults to 100000 if unknown.",
      },
      productType: {
        type: "string",
        description:
          "Optional product type filter (e.g. 'term_life', 'whole_life'). Omit to consider all.",
      },
      conditions: {
        type: "array",
        description:
          "Reported health conditions. Only include a condition the client actually has. For each, fill the follow-up answers using the carrier-intake wording VERBATIM.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code"],
          properties: {
            code: {
              type: "string",
              enum: [...CONDITION_CODES],
              description: "The condition code.",
            },
            controlStatus: {
              type: "string",
              enum: [
                "Yes, consistently normal",
                "Mostly controlled",
                "Poorly controlled",
              ],
              description:
                "high_blood_pressure ONLY: how well-controlled the blood pressure is (verbatim).",
            },
            medicationCount: {
              type: "string",
              enum: ["0 (diet/lifestyle only)", "1", "2", "3 or more"],
              description:
                "high_blood_pressure ONLY: number of BP medications (verbatim).",
            },
            bloodPressureReading: {
              type: "string",
              description:
                "high_blood_pressure ONLY: most recent reading like '120/78'. REQUIRED to assess HBP — without it the engine abstains.",
            },
            details: {
              type: "object",
              additionalProperties: true,
              description:
                "Any other follow-up answers for this condition as { field: value }, using the carrier-intake option strings verbatim (e.g. diabetes: { a1c_level: 6.4, treatment: 'Oral medication only' }).",
            },
          },
        },
      },
    },
    required: ["age", "gender", "conditions"],
  },
  run,
};
