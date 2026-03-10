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
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    icon: Award,
  },
  preferred: {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    icon: Award,
  },
  standard_plus: {
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: CheckCircle,
  },
  standard: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: CheckCircle,
  },
  substandard: {
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    icon: AlertTriangle,
  },
  table_rated: {
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-orange-200 dark:border-orange-800",
    icon: AlertTriangle,
  },
  decline: {
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
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
        <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-zinc-500">
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
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                AI analyzing health classification...
              </div>
              <p className="text-xs text-zinc-500 mt-1">
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
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
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
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-1">
                Risk Factors Considered
              </div>
              <div className="flex flex-wrap gap-1">
                {aiResult.riskFactors.map((factor, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px] text-zinc-600 dark:text-zinc-400"
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
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
          <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            Rate Table Recommendations
          </span>
          <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-auto">
            Based on your rate data
          </span>
        </div>

        {/* Term Length Selector */}
        {hasTermOptions && onTermChange && (
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
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
                        ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                        : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                      isDecisionEngineLoading &&
                        "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {term} Year
                  </button>
                ))}
              </div>
              {isDecisionEngineLoading && (
                <div className="ml-2 h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        )}

        <div className="p-4">
          {isDecisionEngineLoading ? (
            <div className="flex items-center gap-3 p-6 justify-center">
              <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-zinc-500">
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
              <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center gap-3">
                <span>
                  Searched {decisionEngineResult.filtered.totalProducts}{" "}
                  products
                </span>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {decisionEngineResult.filtered.passedEligibility} eligible
                </span>
                {decisionEngineResult.filtered.unknownEligibility > 0 && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600">•</span>
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                      {decisionEngineResult.filtered.unknownEligibility} need
                      verification
                    </span>
                  </>
                )}
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span>
                  {decisionEngineResult.filtered.withPremiums} with rates
                </span>
                <span className="ml-auto text-zinc-400">
                  {decisionEngineResult.processingTime}ms
                </span>
              </div>
            </div>
          ) : decisionEngineResult ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-amber-500" />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  No Quoted Products Available
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mb-3">
                We evaluated {decisionEngineResult.filtered.totalProducts}{" "}
                products but couldn't generate pricing for any of them.
              </p>

              {/* Pipeline breakdown */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded p-2 mb-3">
                <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Pipeline Breakdown:
                </p>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">
                      Stage 1 (Eligibility):
                    </span>
                    <span
                      className={
                        decisionEngineResult.filtered.passedEligibility > 0
                          ? "text-emerald-600"
                          : "text-red-500"
                      }
                    >
                      {decisionEngineResult.filtered.passedEligibility} passed
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Stage 2 (Approval):</span>
                    <span
                      className={
                        decisionEngineResult.filtered.passedAcceptance > 0
                          ? "text-emerald-600"
                          : "text-red-500"
                      }
                    >
                      {decisionEngineResult.filtered.passedAcceptance} passed
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">
                      Stage 3 (Premium Lookup):
                    </span>
                    <span
                      className={
                        decisionEngineResult.filtered.withPremiums > 0
                          ? "text-emerald-600"
                          : "text-red-500 font-medium"
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
                  <div className="text-[10px] text-zinc-500 space-y-1">
                    <p className="font-medium text-zinc-600 dark:text-zinc-400">
                      Likely causes:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-zinc-400">
                      <li>Premium rates not yet loaded for these products</li>
                      <li>Health class not available in rate tables</li>
                      <li>Gender or tobacco class mismatch</li>
                      <li>Age/face amount outside rate grid</li>
                    </ul>
                    <p className="mt-2 text-zinc-400 italic">
                      Check browser console for detailed diagnostics.
                    </p>
                  </div>
                )}

              {decisionEngineResult.filtered.passedEligibility === 0 && (
                <div className="text-[10px] text-zinc-500 space-y-1">
                  <p className="font-medium text-zinc-600 dark:text-zinc-400">
                    All products failed eligibility:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-400">
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
              <XCircle className="h-6 w-6 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">
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
      <div className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-2">
          <div className="h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-zinc-500">AI analyzing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
      >
        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          AI Analysis Summary
        </span>
        {processingTimeMs && (
          <span className="text-xs text-purple-400 ml-auto mr-2">
            {(processingTimeMs / 1000).toFixed(1)}s
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-purple-500 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && (
        <div className="p-4 border-t border-purple-200 dark:border-purple-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
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
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-zinc-200 dark:border-zinc-700 text-left bg-zinc-50 dark:bg-zinc-800/50">
            <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
              Product
            </th>
            <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">
              Monthly Premium
            </th>
            <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-center">
              Quoted Class
            </th>
            <th className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
              Coverage Options
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
          "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
      };
    case "preferred":
      return {
        label: "Preferred",
        className:
          "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
      };
    case "standard_plus":
      return {
        label: "Standard Plus",
        className:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700",
      };
    case "standard":
      return {
        label: "Standard",
        className:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700",
      };
    case "table_rated":
      return {
        label: "Table Rated",
        className:
          "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700",
      };
    case "graded":
      return {
        label: "Graded",
        className:
          "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700",
      };
    case "modified":
      return {
        label: "Modified",
        className:
          "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700",
      };
    case "guaranteed_issue":
      return {
        label: "Guaranteed Issue",
        className:
          "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700",
      };
    default:
      return {
        label: healthClass
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        className:
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
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
    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
      {BUILD_RATING_CLASS_LABELS[recommendation.buildRating!] ?? "Table Rated"}
    </span>
  ) : hasNoRateMatrix ? (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-block rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        No rates loaded
      </span>
      <span className="text-[9px] text-zinc-400 text-center leading-tight">
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
          <span className="text-[9px] text-zinc-400 text-center leading-tight">
            UW {requestedBadge.label}
            <span className="mx-0.5">→</span>
            Quote {badge.label}
          </span>
        )}
      {isSingleRateClass && (
        <span className="text-[9px] text-zinc-400 text-center leading-tight">
          Single rate class product
        </span>
      )}
      {isSI && (
        <span className="text-[9px] text-zinc-400">Premium: Standard</span>
      )}
    </div>
  );

  return (
    <tr
      className={cn(
        "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors bg-white dark:bg-zinc-900",
        isUnknown && "bg-yellow-50 dark:bg-yellow-900/20",
      )}
    >
      {/* Product Column */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {isUnknown && (
            <HelpCircle className="h-4 w-4 text-yellow-500 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate text-sm">
              {recommendation.carrierName}
            </div>
            <div className="text-xs text-zinc-500 truncate">
              {recommendation.productName}
              {recommendation.termYears !== null &&
                recommendation.termYears !== undefined && (
                  <span className="text-indigo-500 ml-1.5 font-medium">
                    {recommendation.termYears} Year
                  </span>
                )}
              {recommendation.termYears === null && (
                <span className="text-emerald-500 ml-1.5 font-medium">
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
            <span className="font-bold text-base text-zinc-800 dark:text-zinc-200">
              {formatDECurrency(recommendation.monthlyPremium)}
            </span>
            <span className="text-xs text-zinc-400 ml-0.5">/mo</span>
          </div>
        ) : recommendation.buildRating?.startsWith("table_") ? (
          <div>
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
              Substandard
            </span>
            <div className="text-[9px] text-zinc-400 mt-0.5">
              Call UW for rating
            </div>
          </div>
        ) : (
          <span className="text-zinc-400 text-sm">TBD</span>
        )}
      </td>

      {/* Health Class Column */}
      <td className="py-3 px-4 text-center">
        <div className="inline-flex min-w-[112px] items-center justify-center rounded-md bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
          {healthClassDisplay}
        </div>
      </td>

      {/* Coverage Options Column - Mini Table */}
      <td className="py-2 px-3">
        {recommendation.alternativeQuotes &&
        recommendation.alternativeQuotes.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-1 px-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Face Amount
                </th>
                <th className="py-1 px-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
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
                      "border-b border-zinc-100 dark:border-zinc-800 last:border-0",
                      isRequested && "bg-indigo-50 dark:bg-indigo-900/30",
                    )}
                  >
                    <td
                      className={cn(
                        "py-1.5 px-2",
                        isRequested
                          ? "font-semibold text-indigo-600 dark:text-indigo-400"
                          : "text-zinc-700 dark:text-zinc-300",
                      )}
                    >
                      {formatDECurrency(quote.faceAmount)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 px-2 text-right",
                        isRequested
                          ? "font-semibold text-indigo-600 dark:text-indigo-400"
                          : "text-zinc-600 dark:text-zinc-400",
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
          <span className="text-xs text-zinc-400">—</span>
        )}
      </td>
    </tr>
  );
}
