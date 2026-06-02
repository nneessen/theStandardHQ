// Concrete UnderwritingRunner: the ONLY place in the tools/ layer that imports the
// authoritative edge engine + the real supabase client. index.ts builds it and
// injects it as ctx.underwriting, exactly like createCloseProvider — so the tool
// (getUnderwritingRecommendation.ts) stays engine-free, cast-free, and fully
// type-checked offline. This file is the esm/runtime zone (engine import pulls in
// src/ underwriting modules with the documented baseline type errors), so it is run
// under `deno test --no-check` like the engine's own suite.
//
// Responsibilities: assemble an UnderwritingRawPayload from flat model args, run the
// engine, and map each recommendation to the HONEST UnderwritingProductResult
// discriminated union (a non-assessable product gets NO class/likelihood/eligibility
// fields — the type makes fabrication impossible, not just discouraged).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import type { Database } from "../../../../src/types/database.types.ts";
// NOTE: the heavy engine is imported DYNAMICALLY inside run() (see below) so its
// module graph only parses on underwriting turns. A static import here would pull
// the whole engine into every orchestrator cold start, taxing the other 14 agents.
import type {
  JsonValue,
  UnderwritingRawPayload,
} from "../../_shared/underwriting/payload.ts";
import type {
  UnderwritingProductResult,
  UnderwritingRunner,
  UnderwritingRunResult,
} from "./types.ts";

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
// medicationCount / bloodPressureReading) are first-class because they are the only
// inputs that produce a visible curated outcome today; everything else flows through
// `details` verbatim (rule-less codes honestly abstain).
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

// Exported for unit testing the model-args → raw-payload seam (curated-rules.test.ts
// hands rule sets straight to the engine and so does NOT cover this assembly).
export function buildUnderwritingPayload(
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

  // Key by code. If the model sends the same condition twice, MERGE their responses
  // (later keys win) rather than letting the second silently drop the first's facts.
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

// True only when BOTH height and weight were supplied — the engine silently skips
// the build gate otherwise (it does NOT abstain), so the tool must disclose it.
function isBuildProvided(input: Record<string, unknown>): boolean {
  return (
    asNumber(input.heightInches) !== undefined &&
    asNumber(input.weightLbs) !== undefined
  );
}

export function createUnderwritingRunner(
  client: SupabaseClient<Database>,
): UnderwritingRunner {
  return {
    async run(
      input: Record<string, unknown>,
      imoId: string,
      requestId: string,
    ): Promise<UnderwritingRunResult | null> {
      const payload = buildUnderwritingPayload(input);
      if (!payload) return null;

      // Dynamic import: the engine's module graph loads only now, on an actual
      // underwriting turn — not at orchestrator cold start for every agent.
      const { computeAuthoritativeUnderwritingRun } =
        await import("../../_shared/underwriting/engine.ts");

      // May throw on a DB/engine failure — the tool catches and degrades honestly.
      const result = await computeAuthoritativeUnderwritingRun({
        client,
        payload,
        imoId,
        requestId,
      });

      const products: UnderwritingProductResult[] =
        result.decisionResult.recommendations.map((rec) => {
          if (!rec.assessable) {
            // Not graded — emit the non-assessable variant ONLY. No class, no
            // likelihood, no eligibilityStatus, no conditionDecisions can be set:
            // the discriminated union has no such fields on this branch.
            return {
              assessable: false,
              carrierName: rec.carrierName,
              productName: rec.productName,
              productType: rec.productType,
              eligibilityReasons: rec.eligibilityReasons,
            };
          }
          return {
            assessable: true,
            carrierName: rec.carrierName,
            productName: rec.productName,
            productType: rec.productType,
            healthClass: rec.healthClassResult,
            approvalLikelihood: rec.approvalLikelihood,
            eligibilityStatus: rec.eligibilityStatus,
            eligibilityReasons: rec.eligibilityReasons,
            concerns: rec.concerns,
            conditionDecisions: rec.conditionDecisions,
          };
        });

      return {
        totalProductsEvaluated: result.decisionResult.filtered.totalProducts,
        ineligibleProducts: result.decisionResult.filtered.ineligible,
        conditionsReported: payload.conditionsReported,
        buildProvided: isBuildProvided(input),
        products,
      };
    },
  };
}
