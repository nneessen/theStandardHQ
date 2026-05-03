// src/features/underwriting/components/WizardSteps/RecommendationsStep.tsx

import { useState } from "react";
import {
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  Sparkles,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AIAnalysisResult,
  ClientInfo,
  HealthTier,
  HealthInfo,
  CoverageRequest,
} from "../../../types/underwriting.types";
import { getHealthTierLabel } from "../../../types/underwriting.types";
// eslint-disable-next-line no-restricted-imports
import type {
  DecisionEngineResult,
  Recommendation as DecisionEngineRecommendation,
} from "@/services/underwriting/workflows/decisionEngine";
// eslint-disable-next-line no-restricted-imports
import { formatCurrency as formatDECurrency } from "@/services/underwriting/workflows/decisionEngine";
import { BUILD_RATING_CLASS_LABELS } from "../../../types/build-table.types";
import { formatCurrency } from "../../../utils/shared/formatters";

interface RecommendationsStepProps {
  aiResult: AIAnalysisResult | null;
  decisionEngineResult: DecisionEngineResult | null;
  isDecisionEngineLoading: boolean;
  isAILoading: boolean;
  clientInfo: ClientInfo;
  healthInfo: HealthInfo;
  coverageRequest: CoverageRequest;
  /** Currently selected term length (null = use longest available) */
  selectedTermYears?: number | null;
  /** Handler for term selection changes */
  onTermChange?: (termYears: number | null) => void;
}

const HEALTH_TIER_CONFIG: Record<
  HealthTier,
  { color: string; bgColor: string; borderColor: string; icon: typeof Award }
> = {
  preferred_plus: {
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    icon: Award,
  },
  preferred: {
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    icon: Award,
  },
  standard_plus: {
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/30",
    icon: CheckCircle,
  },
  standard: {
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/30",
    icon: CheckCircle,
  },
  substandard: {
    color: "text-warning",
    bgColor: "bg-warning/10 dark:bg-warning/20",
    borderColor: "border-warning/30",
    icon: AlertTriangle,
  },
  table_rated: {
    color: "text-warning",
    bgColor: "bg-warning/10 dark:bg-warning/20",
    borderColor: "border-warning/30",
    icon: AlertTriangle,
  },
  decline: {
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    icon: XCircle,
  },
};

export default function RecommendationsStep({
  aiResult,
  decisionEngineResult,
  isDecisionEngineLoading,
  isAILoading,
  clientInfo,
  // healthInfo kept in interface for future use / parent compat
  coverageRequest,
  selectedTermYears,
  onTermChange,
}: RecommendationsStepProps) {
  const maxFaceAmount = Math.max(...(coverageRequest.faceAmounts || [0]));

  const tierConfig = aiResult
    ? HEALTH_TIER_CONFIG[aiResult.healthTier] || HEALTH_TIER_CONFIG.standard
    : null;

  // Calculate available terms from all decision engine recommendations
  const allAvailableTerms = new Set<number>();
  if (decisionEngineResult) {
    for (const rec of [
      ...decisionEngineResult.eligibleProducts,
      ...decisionEngineResult.unknownEligibility,
    ]) {
      if (rec.availableTerms) {
        for (const term of rec.availableTerms) {
          allAvailableTerms.add(term);
        }
      }
    }
  }
  const sortedTerms = Array.from(allAvailableTerms).sort((a, b) => a - b);
  const hasTermOptions = sortedTerms.length > 1;

  // Determine the currently displayed term
  const displayedTerm =
    selectedTermYears ??
    decisionEngineResult?.recommendations[0]?.termYears ??
    decisionEngineResult?.eligibleProducts[0]?.termYears ??
    decisionEngineResult?.unknownEligibility[0]?.termYears ??
    null;

  // Both loading - show initial loading state
  if (
    isDecisionEngineLoading &&
    isAILoading &&
    !decisionEngineResult &&
    !aiResult
  ) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-3">
        <div className="h-6 w-6 border-2 border-info border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-v2-ink-muted">
          Analyzing client profile...
        </span>
      </div>
    );
  }

  const TierIcon = tierConfig?.icon || CheckCircle;

  return (
    <div className="space-y-4 p-1">
      {/* Health Tier Summary (from AI) */}
      {isAILoading && !aiResult ? (
        <div className="p-4 rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-canvas dark:bg-v2-card-tinted/50">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-info border-t-transparent rounded-full animate-spin" />
            <div className="flex-1">
              <div className="text-sm font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                AI analyzing health classification...
              </div>
              <p className="text-xs text-v2-ink-muted mt-1">
                For {clientInfo.name || "this client"}, age {clientInfo.age}
              </p>
            </div>
          </div>
        </div>
      ) : aiResult ? (
        <div
          className={cn(
            "p-4 rounded-lg border",
            tierConfig?.bgColor,
            tierConfig?.borderColor,
          )}
        >
          <div className="flex items-start gap-3">
            <TierIcon className={cn("h-5 w-5 mt-0.5", tierConfig?.color)} />
            <div className="flex-1">
              <div className={cn("text-sm font-semibold", tierConfig?.color)}>
                Estimated Health Classification:{" "}
                {getHealthTierLabel(aiResult.healthTier)}
              </div>
              <p className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle mt-1">
                For {clientInfo.name || "this client"}, age {clientInfo.age}
                {maxFaceAmount > 0 && (
                  <>
                    {" "}
                    • Requested:{" "}
                    {(coverageRequest.faceAmounts || [])
                      .filter((a) => a >= 10000)
                      .map((a) => formatCurrency(a))
                      .join(", ")}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Risk Factors */}
          {aiResult.riskFactors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-v2-ring dark:border-v2-ring-strong">
              <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide mb-1">
                Risk Factors Considered
              </div>
              <div className="flex flex-wrap gap-1">
                {aiResult.riskFactors.map((factor, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-v2-card-tinted border border-v2-ring dark:border-v2-ring-strong rounded text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle"
                  >
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ========== SECTION 1: Decision Engine (Rate Table) Results ========== */}
      <div className="border border-v2-ring dark:border-v2-ring rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-info/10 dark:bg-info/20 border-b border-info/30 flex items-center gap-2">
          <Database className="h-5 w-5 text-info" />
          <span className="text-sm font-semibold text-info">
            Rate Table Recommendations
          </span>
          <span className="text-xs text-info dark:text-info ml-auto">
            Based on your rate data
          </span>
        </div>

        {/* Term Length Selector */}
        {hasTermOptions && onTermChange && (
          <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring-strong bg-v2-canvas dark:bg-v2-card-tinted/50">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
                Term Length:
              </span>
              <div className="flex items-center gap-1">
                {sortedTerms.map((term) => (
                  <button
                    key={term}
                    onClick={() => onTermChange(term)}
                    disabled={isDecisionEngineLoading}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                      "border",
                      displayedTerm === term ||
                        (displayedTerm === null &&
                          term === sortedTerms[sortedTerms.length - 1])
                        ? "bg-info/20 dark:bg-info/40 border-info dark:border-info text-info"
                        : "bg-v2-card-tinted border-v2-ring-strong dark:border-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-subtle hover:bg-v2-card-tinted dark:hover:bg-v2-ring-strong",
                      isDecisionEngineLoading &&
                        "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {term} Year
                  </button>
                ))}
              </div>
              {isDecisionEngineLoading && (
                <div className="ml-2 h-3 w-3 border-2 border-info border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        )}

        <div className="p-4">
          {isDecisionEngineLoading ? (
            <div className="flex items-center gap-3 p-6 justify-center">
              <div className="h-5 w-5 border-2 border-info border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-v2-ink-muted">
                Searching rate tables...
              </span>
            </div>
          ) : decisionEngineResult &&
            (decisionEngineResult.recommendations.length > 0 ||
              decisionEngineResult.eligibleProducts.length > 0 ||
              decisionEngineResult.unknownEligibility.length > 0) ? (
            <div className="space-y-2">
              {/* Compact Table for All Recommendations */}
              <DecisionEngineTable
                eligibleProducts={decisionEngineResult.eligibleProducts}
                unknownEligibility={decisionEngineResult.unknownEligibility}
              />

              {/* Stats Footer */}
              <div className="pt-3 mt-3 border-t border-v2-ring dark:border-v2-ring-strong text-xs text-v2-ink-muted dark:text-v2-ink-subtle flex flex-wrap items-center gap-3">
                <span>
                  Searched {decisionEngineResult.filtered.totalProducts}{" "}
                  products
                </span>
                <span className="text-v2-ink-subtle dark:text-v2-ink-muted">
                  •
                </span>
                <span className="text-success font-medium">
                  {decisionEngineResult.filtered.passedEligibility} eligible
                </span>
                {decisionEngineResult.filtered.unknownEligibility > 0 && (
                  <>
                    <span className="text-v2-ink-subtle dark:text-v2-ink-muted">
                      •
                    </span>
                    <span className="text-warning font-medium">
                      {decisionEngineResult.filtered.unknownEligibility} need
                      verification
                    </span>
                  </>
                )}
                <span className="text-v2-ink-subtle dark:text-v2-ink-muted">
                  •
                </span>
                <span>
                  {decisionEngineResult.filtered.withPremiums} with rates
                </span>
                <span className="ml-auto text-v2-ink-subtle">
                  {decisionEngineResult.processingTime}ms
                </span>
              </div>
            </div>
          ) : decisionEngineResult ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-warning" />
                <span className="text-xs font-medium text-v2-ink dark:text-v2-ink-muted">
                  No Quoted Products Available
                </span>
              </div>
              <p className="text-[11px] text-v2-ink-muted mb-3">
                We evaluated {decisionEngineResult.filtered.totalProducts}{" "}
                products but couldn't generate pricing for any of them.
              </p>

              {/* Pipeline breakdown */}
              <div className="bg-v2-canvas dark:bg-v2-card-tinted/50 rounded p-2 mb-3">
                <p className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-1.5">
                  Pipeline Breakdown:
                </p>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-v2-ink-muted">
                      Stage 1 (Eligibility):
                    </span>
                    <span
                      className={
                        decisionEngineResult.filtered.passedEligibility > 0
                          ? "text-success"
                          : "text-destructive"
                      }
                    >
                      {decisionEngineResult.filtered.passedEligibility} passed
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-v2-ink-muted">
                      Stage 2 (Approval):
                    </span>
                    <span
                      className={
                        decisionEngineResult.filtered.passedAcceptance > 0
                          ? "text-success"
                          : "text-destructive"
                      }
                    >
                      {decisionEngineResult.filtered.passedAcceptance} passed
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-v2-ink-muted">
                      Stage 3 (Premium Lookup):
                    </span>
                    <span
                      className={
                        decisionEngineResult.filtered.withPremiums > 0
                          ? "text-success"
                          : "text-destructive font-medium"
                      }
                    >
                      {decisionEngineResult.filtered.withPremiums} found
                      {decisionEngineResult.filtered.withPremiums === 0 &&
                        " ← Issue here"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Likely causes */}
              {decisionEngineResult.filtered.withPremiums === 0 &&
                decisionEngineResult.filtered.passedAcceptance > 0 && (
                  <div className="text-[10px] text-v2-ink-muted space-y-1">
                    <p className="font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                      Likely causes:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-v2-ink-subtle">
                      <li>Premium rates not yet loaded for these products</li>
                      <li>Health class not available in rate tables</li>
                      <li>Gender or tobacco class mismatch</li>
                      <li>Age/face amount outside rate grid</li>
                    </ul>
                    <p className="mt-2 text-v2-ink-subtle italic">
                      Check browser console for detailed diagnostics.
                    </p>
                  </div>
                )}

              {decisionEngineResult.filtered.passedEligibility === 0 && (
                <div className="text-[10px] text-v2-ink-muted space-y-1">
                  <p className="font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                    All products failed eligibility:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-v2-ink-subtle">
                    <li>Client age may be outside product age limits</li>
                    <li>Requested face amount may exceed product maximums</li>
                    <li>Client may have a knockout health condition</li>
                    <li>State may not be available for these products</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center">
              <XCircle className="h-6 w-6 text-v2-ink-subtle dark:text-v2-ink-muted mx-auto mb-2" />
              <p className="text-xs text-v2-ink-muted">
                Decision engine unavailable.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========== SECTION 2: AI Analysis Summary (collapsible) ========== */}
      {aiResult?.reasoning && (
        <AIAnalysisSummary
          reasoning={aiResult.reasoning}
          processingTimeMs={aiResult.processingTimeMs}
          isLoading={isAILoading}
        />
      )}
    </div>
  );
}

// ============================================================================
// AI Analysis Summary Component (Collapsible)
// ============================================================================

interface AIAnalysisSummaryProps {
  reasoning: string;
  processingTimeMs?: number;
  isLoading: boolean;
}

function AIAnalysisSummary({
  reasoning,
  processingTimeMs,
  isLoading,
}: AIAnalysisSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="border border-info/30 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-info/10 dark:bg-info/20 flex items-center gap-2">
          <div className="h-4 w-4 border-2 border-info border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-v2-ink-muted">AI analyzing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-info/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-info/10 dark:bg-info/20 flex items-center gap-2 hover:bg-info/20 dark:hover:bg-info/15 transition-colors text-left"
      >
        <Sparkles className="h-4 w-4 text-info" />
        <span className="text-sm font-medium text-info">
          AI Analysis Summary
        </span>
        {processingTimeMs && (
          <span className="text-xs text-info ml-auto mr-2">
            {(processingTimeMs / 1000).toFixed(1)}s
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-info transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && (
        <div className="p-4 border-t border-info/30">
          <p className="text-sm text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed whitespace-pre-wrap">
            {reasoning}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Decision Engine Table Component (Compact Display)
// ============================================================================

interface DecisionEngineTableProps {
  eligibleProducts: DecisionEngineRecommendation[];
  unknownEligibility: DecisionEngineRecommendation[];
}

function DecisionEngineTable({
  eligibleProducts,
  unknownEligibility,
}: DecisionEngineTableProps) {
  // Sort by premium (low to high), with nulls at the end
  const sortByPremium = (
    a: DecisionEngineRecommendation,
    b: DecisionEngineRecommendation,
  ) => {
    if (a.monthlyPremium === null && b.monthlyPremium === null) return 0;
    if (a.monthlyPremium === null) return 1;
    if (b.monthlyPremium === null) return -1;
    return a.monthlyPremium - b.monthlyPremium;
  };

  const sortedRecommendations = [...eligibleProducts].sort(sortByPremium);
  const sortedUnknown = [...unknownEligibility].sort(sortByPremium);

  const allRecs = [
    ...sortedRecommendations.map((r) => ({ ...r, isUnknown: false })),
    ...sortedUnknown.map((r) => ({ ...r, isUnknown: true })),
  ];

  if (allRecs.length === 0) return null;

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring-strong">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-v2-ring dark:border-v2-ring-strong text-left bg-v2-canvas dark:bg-v2-card-tinted/50">
            <th className="py-3 px-4 font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
              Product
            </th>
            <th className="py-3 px-4 font-semibold text-v2-ink-muted dark:text-v2-ink-muted text-right">
              Monthly Premium
            </th>
            <th className="py-3 px-4 font-semibold text-v2-ink-muted dark:text-v2-ink-muted text-center">
              Quoted Class
            </th>
            <th className="py-3 px-4 font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
              Coverage Options
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-v2-ring dark:divide-v2-ring">
          {allRecs.map((rec) => (
            <DecisionEngineRow
              key={`${rec.carrierId}-${rec.productId}`}
              recommendation={rec}
              isUnknown={rec.isUnknown}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Decision Engine Row Component (Compact Table Row)
// ============================================================================

interface DecisionEngineRowProps {
  recommendation: DecisionEngineRecommendation & { isUnknown?: boolean };
  isUnknown: boolean;
}

/** Maps a health class string to color-coded badge styles */
function getHealthClassBadge(healthClass: string): {
  label: string;
  className: string;
} {
  switch (healthClass) {
    case "preferred_plus":
      return {
        label: "Preferred Plus",
        className:
          "bg-success/20 dark:bg-success/30 text-success border-success/30 dark:border-success",
      };
    case "preferred":
      return {
        label: "Preferred",
        className:
          "bg-success/20 dark:bg-success/30 text-success border-success/30 dark:border-success",
      };
    case "standard_plus":
      return {
        label: "Standard Plus",
        className: "bg-info/15 text-info border-info/30 dark:border-info",
      };
    case "standard":
      return {
        label: "Standard",
        className: "bg-info/15 text-info border-info/30 dark:border-info",
      };
    case "table_rated":
      return {
        label: "Table Rated",
        className:
          "bg-warning/20 dark:bg-warning/30 text-warning border-warning/30 dark:border-warning",
      };
    case "graded":
      return {
        label: "Graded",
        className:
          "bg-warning/20 dark:bg-warning/30 text-warning border-warning/30 dark:border-warning",
      };
    case "modified":
      return {
        label: "Modified",
        className:
          "bg-warning/20 dark:bg-warning/30 text-warning border-warning/30 dark:border-warning",
      };
    case "guaranteed_issue":
      return {
        label: "Guaranteed Issue",
        className:
          "bg-destructive/20 dark:bg-destructive/30 text-destructive dark:text-destructive border-destructive dark:border-destructive",
      };
    default:
      return {
        label: healthClass
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        className:
          "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink-muted dark:text-v2-ink-subtle border-v2-ring dark:border-v2-ring-strong",
      };
  }
}

/** Check if this health class uses standard-rate premiums despite different UW classification */
function isSimplifiedIssuance(healthClass: string): boolean {
  return (
    healthClass === "graded" ||
    healthClass === "modified" ||
    healthClass === "guaranteed_issue"
  );
}

function DecisionEngineRow({
  recommendation,
  isUnknown,
}: DecisionEngineRowProps) {
  const isTableRated = recommendation.buildRating?.startsWith("table_");
  const uwHealthClass = recommendation.healthClassResult;
  const quotedHealthClass =
    recommendation.healthClassUsed ??
    recommendation.healthClassRequested ??
    uwHealthClass;
  const badge = getHealthClassBadge(quotedHealthClass);
  const isSI = isSimplifiedIssuance(uwHealthClass);
  const isSingleRateClass = recommendation.availableRateClasses?.length === 1;
  const hasAvailableRateClasses =
    (recommendation.availableRateClasses?.length ?? 0) > 0;
  const hasNoRateMatrix =
    !hasAvailableRateClasses &&
    recommendation.monthlyPremium === null &&
    !isTableRated;
  const requestedBadge = recommendation.healthClassRequested
    ? getHealthClassBadge(recommendation.healthClassRequested)
    : null;
  const uwBadge = getHealthClassBadge(uwHealthClass);

  const healthClassDisplay = isTableRated ? (
    <span className="text-xs text-warning font-medium">
      {BUILD_RATING_CLASS_LABELS[recommendation.buildRating!] ?? "Table Rated"}
    </span>
  ) : hasNoRateMatrix ? (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-block rounded border border-v2-ring bg-v2-card-tinted px-2 py-0.5 text-xs font-medium text-v2-ink-muted dark:border-v2-ring-strong dark:bg-v2-card-tinted dark:text-v2-ink-muted">
        No rates loaded
      </span>
      <span className="text-[9px] text-v2-ink-subtle text-center leading-tight">
        UW {uwBadge.label}
      </span>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "inline-block px-2 py-0.5 rounded text-xs font-medium border",
          badge.className,
        )}
      >
        {badge.label}
      </span>
      {recommendation.wasFallback &&
        requestedBadge &&
        recommendation.healthClassUsed && (
          <span className="text-[9px] text-v2-ink-subtle text-center leading-tight">
            UW {requestedBadge.label}
            <span className="mx-0.5">→</span>
            Quote {badge.label}
          </span>
        )}
      {isSingleRateClass && (
        <span className="text-[9px] text-v2-ink-subtle text-center leading-tight">
          Single rate class product
        </span>
      )}
      {isSI && (
        <span className="text-[9px] text-v2-ink-subtle">Premium: Standard</span>
      )}
    </div>
  );

  return (
    <tr
      className={cn(
        "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 transition-colors bg-v2-card",
        isUnknown && "bg-warning/10 dark:bg-warning/20",
      )}
    >
      {/* Product Column */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {isUnknown && (
            <HelpCircle className="h-4 w-4 text-warning shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-v2-ink dark:text-v2-ink truncate text-sm">
              {recommendation.carrierName}
            </div>
            <div className="text-xs text-v2-ink-muted truncate">
              {recommendation.productName}
              {recommendation.termYears !== null &&
                recommendation.termYears !== undefined && (
                  <span className="text-info ml-1.5 font-medium">
                    {recommendation.termYears} Year
                  </span>
                )}
              {recommendation.termYears === null && (
                <span className="text-success ml-1.5 font-medium">
                  Permanent
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Premium Column */}
      <td className="py-3 px-4 text-right">
        {recommendation.monthlyPremium !== null ? (
          <div>
            <span className="font-bold text-base text-v2-ink dark:text-v2-ink">
              {formatDECurrency(recommendation.monthlyPremium)}
            </span>
            <span className="text-xs text-v2-ink-subtle ml-0.5">/mo</span>
          </div>
        ) : recommendation.buildRating?.startsWith("table_") ? (
          <div>
            <span className="text-xs font-medium text-warning">
              Substandard
            </span>
            <div className="text-[9px] text-v2-ink-subtle mt-0.5">
              Call UW for rating
            </div>
          </div>
        ) : (
          <span className="text-v2-ink-subtle text-sm">TBD</span>
        )}
      </td>

      {/* Health Class Column */}
      <td className="py-3 px-4 text-center">
        <div className="inline-flex min-w-[112px] items-center justify-center rounded-md bg-v2-card-tinted px-2.5 py-1 dark:bg-v2-card-tinted">
          {healthClassDisplay}
        </div>
      </td>

      {/* Coverage Options Column - Mini Table */}
      <td className="py-2 px-3">
        {recommendation.alternativeQuotes &&
        recommendation.alternativeQuotes.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-v2-ring dark:border-v2-ring-strong">
                <th className="py-1 px-2 text-left font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                  Face Amount
                </th>
                <th className="py-1 px-2 text-right font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                  Monthly
                </th>
              </tr>
            </thead>
            <tbody>
              {recommendation.alternativeQuotes.map((quote, idx) => {
                const isRequested =
                  quote.faceAmount === recommendation.maxCoverage;
                return (
                  <tr
                    key={idx}
                    className={cn(
                      "border-b border-v2-ring dark:border-v2-ring last:border-0",
                      isRequested && "bg-info/10 dark:bg-info/30",
                    )}
                  >
                    <td
                      className={cn(
                        "py-1.5 px-2",
                        isRequested
                          ? "font-semibold text-info"
                          : "text-v2-ink dark:text-v2-ink-muted",
                      )}
                    >
                      {formatDECurrency(quote.faceAmount)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 px-2 text-right",
                        isRequested
                          ? "font-semibold text-info"
                          : "text-v2-ink-muted dark:text-v2-ink-subtle",
                      )}
                    >
                      {formatDECurrency(quote.monthlyPremium)}/mo
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <span className="text-xs text-v2-ink-subtle">—</span>
        )}
      </td>
    </tr>
  );
}
