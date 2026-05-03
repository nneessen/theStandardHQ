// src/features/underwriting/components/SessionHistory/SessionDetailDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Building2,
  FileText,
} from "lucide-react";
import type { CarrierRecommendation } from "../../types/underwriting.types";
import { useUnderwritingSession } from "../../hooks/sessions/useUnderwritingSessions";
import { getHealthTierLabel } from "../../types/underwriting.types";
import {
  formatSessionDateLong,
  getHealthTierBadgeColor,
  capitalizeFirst,
  formatProductType,
  isValidHealthTier,
  safeParseJsonArray,
} from "../../utils/shared/formatters";
import { parseSessionHealthSnapshot } from "../../utils/sessions/session-health-snapshot";
import { formatRequestedFaceAmounts } from "../../utils/sessions/session-persistence";

interface SessionDetailDialogProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDetailDialog({
  sessionId,
  open,
  onOpenChange,
}: SessionDetailDialogProps) {
  const {
    data: session,
    isLoading,
    error,
  } = useUnderwritingSession(sessionId || "");

  if (!sessionId) {
    return null;
  }

  // Safely parse JSON fields from database
  const riskFactors = session
    ? safeParseJsonArray<string>(session.risk_factors)
    : [];
  const recommendations = session
    ? safeParseJsonArray<CarrierRecommendation>(session.recommendations)
    : [];
  const conditionsReported = session
    ? safeParseJsonArray<string>(session.conditions_reported)
    : [];
  const healthSnapshot = session
    ? parseSessionHealthSnapshot(session.health_responses)
    : { conditionsByCode: {}, conditions: [] };
  const healthResponses = healthSnapshot.conditionsByCode;
  const productTypes = session
    ? safeParseJsonArray<string>(session.requested_product_types)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Session Details
          </DialogTitle>
          {session && (
            <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              {formatSessionDateLong(session.created_at)}
            </div>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="py-6 text-center text-[11px] text-muted-foreground dark:text-muted-foreground">
            Loading session details...
          </div>
        )}

        {error && (
          <div className="py-6 text-center text-[11px] text-destructive">
            Failed to load session details: {error.message}
          </div>
        )}

        {!session || isLoading || error ? null : (
          <div className="space-y-4 pt-2">
            {/* Client Information */}
            <Section
              title="Client Information"
              icon={<User className="h-3.5 w-3.5" />}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
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
                  valueClassName={session.tobacco_use ? "text-warning" : ""}
                />
              </div>
            </Section>

            <Separator />

            {/* Health Assessment */}
            <Section
              title="Health Assessment"
              icon={<Activity className="h-3.5 w-3.5" />}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    Health Tier:
                  </span>
                  <Badge
                    className={`text-[10px] px-2 py-0.5 ${getHealthTierBadgeColor(session.health_tier)}`}
                  >
                    {isValidHealthTier(session.health_tier)
                      ? getHealthTierLabel(session.health_tier)
                      : "N/A"}
                  </Badge>
                </div>

                {conditionsReported.length > 0 && (
                  <div>
                    <div className="text-[10px] font-medium text-foreground dark:text-muted-foreground mb-1">
                      Conditions Reported ({conditionsReported.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {conditionsReported.map((condition) => (
                        <Badge
                          key={condition}
                          variant="outline"
                          className="text-[9px] px-1.5 py-0"
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
                    <div className="text-[10px] font-medium text-foreground dark:text-muted-foreground mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-warning" />
                      Risk Factors ({riskFactors.length})
                    </div>
                    <ul className="space-y-0.5">
                      {riskFactors.map((factor, i) => (
                        <li
                          key={i}
                          className="text-[10px] text-muted-foreground dark:text-muted-foreground flex items-start gap-1.5"
                        >
                          <span className="text-warning mt-0.5">•</span>
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
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
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

                {/* Recommendations */}
                <Section
                  title="AI Recommendations"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                >
                  <div className="space-y-2">
                    {recommendations
                      .sort((a, b) => a.priority - b.priority)
                      .slice(0, 5)
                      .map((rec, i) => (
                        <div
                          key={i}
                          className="bg-background dark:bg-card-tinted/50 rounded-md p-2 border border-border dark:border-border"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-medium text-foreground dark:text-foreground">
                                {rec.carrierName}
                              </div>
                              <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                                {rec.productName}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0"
                              >
                                {rec.expectedRating}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground dark:text-muted-foreground">
                                {(rec.confidence * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                          </div>
                          {rec.keyFactors.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {rec.keyFactors.map((factor, j) => (
                                <span
                                  key={j}
                                  className="text-[9px] text-success bg-success/10 px-1 rounded"
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
                                  className="text-[9px] text-warning bg-warning/10 px-1 rounded"
                                >
                                  ! {concern}
                                </span>
                              ))}
                            </div>
                          )}
                          {rec.notes && (
                            <div className="mt-1.5 text-[9px] text-muted-foreground dark:text-muted-foreground italic">
                              {rec.notes}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </Section>
              </>
            )}

            {session.notes && (
              <>
                <Separator />
                <Section
                  title="Notes"
                  icon={<FileText className="h-3.5 w-3.5" />}
                >
                  <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    {session.notes}
                  </p>
                </Section>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
      <div className="flex items-center gap-1.5 mb-2">
        {icon && (
          <span className="text-muted-foreground dark:text-muted-foreground">
            {icon}
          </span>
        )}
        <h3 className="text-[11px] font-semibold text-foreground dark:text-foreground">
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
      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-[11px] text-foreground dark:text-foreground ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}
