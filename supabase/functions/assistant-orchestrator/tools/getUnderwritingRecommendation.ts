// Underwriting recommendation: rank carrier products for a prospect by PROBABILITY
// OF APPROVAL (not price), using the SAME authoritative edge engine the UW wizard
// runs. The engine + payload assembly live behind ctx.underwriting (an injected
// UnderwritingRunner built in index.ts) — exactly like ctx.close — so THIS file stays
// free of esm.sh/engine imports and is fully type-checked offline.
//
// Output is honest by construction: the runner returns a discriminated union where a
// non-assessable product has NO class/likelihood/eligibility fields, and this tool
// signals available:false when nothing could actually be assessed — so the agent asks
// for the missing facts rather than inventing an approval.

import type {
  AssistantToolContext,
  RegisteredTool,
  UnderwritingRunResult,
} from "./types.ts";

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

const BUILD_NOT_ASSESSED_WARNING =
  "Height and weight were not provided, so build/BMI was NOT assessed. Build can lower the class or cause a decline — confirm the client's height and weight before relying on any class below.";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  // Early, honest abstention: without an IMO we cannot scope to any product set.
  if (!ctx.imoId) {
    return { available: false, reason: "no_imo_scope" };
  }

  let result: UnderwritingRunResult | null;
  try {
    result = await ctx.underwriting.run(input, ctx.imoId, ctx.conversationId);
  } catch (_error) {
    return { available: false, reason: "evaluation_failed" };
  }

  // null => the model args lacked the required client facts (e.g. no age).
  if (!result) {
    return { available: false, reason: "insufficient_client_facts" };
  }

  const dataWarning = result.buildProvided
    ? undefined
    : BUILD_NOT_ASSESSED_WARNING;

  if (result.products.length === 0) {
    // No product survived to a recommendation. Ambiguous BY DESIGN: the engine
    // DROPS declined products (likelihood 0) the same way it omits products with no
    // rule coverage, and returns nothing when the IMO has no products. Do NOT imply
    // "merely not assessable" — surface the counts and let the agent state the range.
    return {
      available: false,
      reason: "no_recommendations",
      data: {
        note: "No carrier product produced a recommendation for this profile. Products may have been declined by an approved carrier rule, may lack the rule coverage to assess, or none may be configured for this IMO — this result cannot distinguish those.",
        totalProductsEvaluated: result.totalProductsEvaluated,
        ineligibleProducts: result.ineligibleProducts,
        dataWarning,
      },
    };
  }

  const assessableCount = result.products.filter((p) => p.assessable).length;
  const summary = {
    totalProductsEvaluated: result.totalProductsEvaluated,
    recommendationCount: result.products.length,
    assessableCount,
    abstainedCount: result.products.length - assessableCount,
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
        conditionsConsidered: result.conditionsReported,
        products: result.products,
      },
    };
  }

  return {
    available: true,
    data: {
      summary,
      conditionsConsidered: result.conditionsReported,
      products: result.products,
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
