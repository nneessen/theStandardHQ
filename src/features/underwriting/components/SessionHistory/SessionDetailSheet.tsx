// src/features/underwriting/components/SessionHistory/SessionDetailSheet.tsx

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  Activity,
  AlertTriangle,
  Building2,
  FileText,
  DollarSign,
} from "lucide-react";
import type {
  UnderwritingSession,
  CarrierRecommendation,
  RateTableRecommendation,
} from "../../types/underwriting.types";
import { getHealthTierLabel } from "../../types/underwriting.types";
import {
  formatSessionDateLong,
  formatCurrency,
  getHealthTierBadgeColor,
  capitalizeFirst,
  formatProductType,
  isValidHealthTier,
  safeParseJsonArray,
} from "../../utils/formatters";
import { parseSessionHealthSnapshot } from "../../utils/session-health-snapshot";
import { formatRequestedFaceAmounts } from "../../utils/session-persistence";

interface SessionDetailSheetProps {
  session: UnderwritingSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDetailSheet({
  session,
  open,
  onOpenChange,
}: SessionDetailSheetProps) {
  if (!session) return null;

  // Safely parse JSON fields from database
  const riskFactors = safeParseJsonArray<string>(session.risk_factors);
  const recommendations = safeParseJsonArray<
    CarrierRecommendation | RateTableRecommendation
  >(session.recommendations);
  const conditionsReported = safeParseJsonArray<string>(
    session.conditions_reported,
  );
  const healthSnapshot = parseSessionHealthSnapshot(session.health_responses);
  const healthResponses = healthSnapshot.conditionsByCode;
  const productTypes = safeParseJsonArray<string>(
    session.requested_product_types,
  );

  // Check if recommendations are rate table format (new) or AI format (old)
  const isRateTableFormat =
    recommendations.length > 0 && "faceAmount" in recommendations[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:w-[540px] p-0">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Session Details
          </SheetTitle>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {formatSessionDateLong(session.created_at)}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-6 space-y-5">
            {/* Client Information */}
            <Section
              title="Client Information"
              icon={<User className="h-3.5 w-3.5" />}
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <InfoRow
                  label="Name"
                  value={session.client_name || "Not provided"}
                />
                <InfoRow
                  label="Age"
                  value={
                    session.client_age != null
                      ? `${session.client_age} years old`
                      : "N/A"
                  }
                />
                <InfoRow
                  label="Gender"
                  value={capitalizeFirst(session.client_gender || "Unknown")}
                />
                <InfoRow
                  label="State"
                  value={session.client_state || "Unknown"}
                />
                <InfoRow
                  label="BMI"
                  value={session.client_bmi?.toFixed(1) || "N/A"}
                />
                <InfoRow
                  label="Tobacco Use"
                  value={session.tobacco_use ? "Yes" : "No"}
                  valueClassName={
                    session.tobacco_use
                      ? "text-amber-600 dark:text-amber-400"
                      : ""
                  }
                />
              </div>
            </Section>

            <Separator />

            {/* Health Assessment */}
            <Section
              title="Health Assessment"
              icon={<Activity className="h-3.5 w-3.5" />}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Health Tier:
                  </span>
                  <Badge
                    className={`text-[10px] px-2.5 py-0.5 ${getHealthTierBadgeColor(session.health_tier)}`}
                  >
                    {isValidHealthTier(session.health_tier)
                      ? getHealthTierLabel(session.health_tier)
                      : "N/A"}
                  </Badge>
                </div>

                {conditionsReported.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Conditions Reported ({conditionsReported.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {conditionsReported.map((condition) => (
                        <Badge
                          key={condition}
                          variant="outline"
                          className="text-[10px] px-2 py-0.5"
                        >
                          {healthResponses[condition]?.conditionName ||
                            condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {riskFactors.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Risk Factors ({riskFactors.length})
                    </div>
                    <ul className="space-y-1">
                      {riskFactors.map((factor, i) => (
                        <li
                          key={i}
                          className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-start gap-2"
                        >
                          <span className="text-amber-500 mt-0.5">•</span>
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>

            <Separator />

            {/* Coverage Request */}
            <Section
              title="Coverage Request"
              icon={<Building2 className="h-3.5 w-3.5" />}
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <InfoRow
                  label="Face Amounts"
                  value={formatRequestedFaceAmounts(session)}
                  valueClassName="font-semibold"
                />
                <InfoRow
                  label="Product Types"
                  value={
                    productTypes.map(formatProductType).join(", ") ||
                    "None specified"
                  }
                />
              </div>
            </Section>

            {recommendations.length > 0 && (
              <>
                <Separator />

                {/* Rate Table Recommendations (new format) */}
                {isRateTableFormat ? (
                  <Section
                    title="Top Recommendations"
                    icon={<DollarSign className="h-3.5 w-3.5" />}
                  >
                    <div className="space-y-3">
                      {(recommendations as RateTableRecommendation[]).map(
                        (rec, i) => (
                          <div
                            key={i}
                            className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                                  {rec.carrierName}
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {rec.productName}
                                  {rec.termYears
                                    ? ` (${rec.termYears} Year)`
                                    : ""}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0.5"
                              >
                                {rec.quotedHealthClass || rec.healthClass}
                              </Badge>
                            </div>
                            {(rec.quoteClassNote ||
                              (rec.underwritingHealthClass &&
                                rec.underwritingHealthClass !==
                                  (rec.quotedHealthClass ||
                                    rec.healthClass))) && (
                              <div className="mt-1 text-[10px] text-zinc-400">
                                {rec.quoteClassNote ||
                                  `UW ${rec.underwritingHealthClass} -> Quote ${rec.quotedHealthClass || rec.healthClass}`}
                              </div>
                            )}
                            <div className="mt-2 flex items-center justify-between text-[11px]">
                              <span className="text-zinc-500 dark:text-zinc-400">
                                Face Amount
                              </span>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(rec.faceAmount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-zinc-500 dark:text-zinc-400">
                                Monthly Premium
                              </span>
                              {rec.monthlyPremium !== null ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(rec.monthlyPremium)}/mo
                                </span>
                              ) : (
                                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                                  TBD
                                </span>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </Section>
                ) : (
                  /* AI Recommendations (old format) */
                  <Section
                    title="AI Recommendations"
                    icon={<Activity className="h-3.5 w-3.5" />}
                  >
                    <div className="space-y-3">
                      {(recommendations as CarrierRecommendation[])
                        .sort((a, b) => a.priority - b.priority)
                        .slice(0, 5)
                        .map((rec, i) => (
                          <div
                            key={i}
                            className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                                  {rec.carrierName}
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {rec.productName}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-2 py-0.5"
                                >
                                  {rec.expectedRating}
                                </Badge>
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                  {(rec.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            {rec.keyFactors.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {rec.keyFactors.map((factor, j) => (
                                  <span
                                    key={j}
                                    className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded"
                                  >
                                    + {factor}
                                  </span>
                                ))}
                              </div>
                            )}
                            {rec.concerns.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rec.concerns.map((concern, j) => (
                                  <span
                                    key={j}
                                    className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded"
                                  >
                                    ! {concern}
                                  </span>
                                ))}
                              </div>
                            )}
                            {rec.notes && (
                              <div className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                                {rec.notes}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </Section>
                )}
              </>
            )}

            {session.notes && (
              <>
                <Separator />
                <Section
                  title="Notes"
                  icon={<FileText className="h-3.5 w-3.5" />}
                >
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    {session.notes}
                  </p>
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Helper Components
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon && (
          <span className="text-zinc-500 dark:text-zinc-400">{icon}</span>
        )}
        <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={`text-[12px] text-zinc-900 dark:text-zinc-100 ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}
