import type {
  SessionEligibilitySummary,
  SessionRecommendationInput,
  UnderwritingSession,
} from "../../types/underwriting.types";
// eslint-disable-next-line no-restricted-imports
import type { DecisionEngineResult } from "@/services/underwriting/workflows/decisionEngine";
import { formatCurrency, safeParseJsonArray } from "../shared/formatters";

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function calculateAnnualPremium(monthlyPremium: number | null): number | null {
  if (monthlyPremium === null) {
    return null;
  }

  return roundTo(monthlyPremium * 12, 2);
}

function calculateCostPerThousand(
  annualPremium: number | null,
  faceAmount: number,
): number | null {
  if (annualPremium === null || faceAmount <= 0) {
    return null;
  }

  return roundTo(annualPremium / (faceAmount / 1000), 4);
}

export function buildEligibilitySummary(
  decisionResult: DecisionEngineResult,
): SessionEligibilitySummary {
  return {
    eligible: decisionResult.eligibleProducts.length,
    unknown: decisionResult.unknownEligibility.length,
    ineligible: decisionResult.filtered.ineligible,
  };
}

export function buildSessionRecommendations(
  decisionResult: DecisionEngineResult,
): SessionRecommendationInput[] {
  const recommendationReasonByProductId = new Map(
    decisionResult.recommendations
      .filter((recommendation) => recommendation.reason !== null)
      .map((recommendation) => [
        recommendation.productId,
        recommendation.reason,
      ]),
  );

  const orderedRecommendations = [
    ...decisionResult.eligibleProducts,
    ...decisionResult.unknownEligibility,
  ];

  return orderedRecommendations.map((recommendation, index) => {
    const annualPremium = calculateAnnualPremium(recommendation.monthlyPremium);

    return {
      productId: recommendation.productId,
      carrierId: recommendation.carrierId,
      eligibilityStatus: recommendation.eligibilityStatus,
      eligibilityReasons: recommendation.eligibilityReasons,
      missingFields: recommendation.missingFields,
      confidence: recommendation.confidence,
      approvalLikelihood: recommendation.approvalLikelihood,
      healthClassResult: recommendation.healthClassResult,
      conditionDecisions: recommendation.conditionDecisions,
      monthlyPremium: recommendation.monthlyPremium,
      annualPremium,
      costPerThousand: calculateCostPerThousand(
        annualPremium,
        recommendation.maxCoverage,
      ),
      score: roundTo(recommendation.score, 4),
      scoreComponents: recommendation.scoreComponents,
      recommendationReason:
        recommendationReasonByProductId.get(recommendation.productId) ?? null,
      recommendationRank: index + 1,
      draftRulesFyi: recommendation.draftRulesFyi,
    };
  });
}

type SessionFaceAmountFields = Pick<
  UnderwritingSession,
  "requested_face_amount" | "requested_face_amounts"
>;

export function getRequestedFaceAmounts(
  session: SessionFaceAmountFields,
): number[] {
  const exactAmounts = safeParseJsonArray<unknown>(
    session.requested_face_amounts,
  )
    .filter((value): value is number => typeof value === "number")
    .filter((value) => Number.isFinite(value) && value > 0);

  if (exactAmounts.length > 0) {
    return exactAmounts;
  }

  return typeof session.requested_face_amount === "number" &&
    Number.isFinite(session.requested_face_amount) &&
    session.requested_face_amount > 0
    ? [session.requested_face_amount]
    : [];
}

export function formatRequestedFaceAmounts(
  session: SessionFaceAmountFields,
): string {
  const amounts = getRequestedFaceAmounts(session);

  if (amounts.length === 0) {
    return "$0";
  }

  return amounts.map((amount) => formatCurrency(amount)).join(", ");
}
