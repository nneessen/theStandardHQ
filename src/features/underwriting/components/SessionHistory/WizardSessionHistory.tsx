// src/features/underwriting/components/SessionHistory/WizardSessionHistory.tsx

import { useState, useDeferredValue } from "react";
import {
  ArrowLeft,
  Calendar,
  User,
  Activity,
  Upload,
  Eye,
  AlertTriangle,
  Building2,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchUnderwritingSession,
  useUnderwritingSession,
  useUserSessionsPaginated,
} from "../../hooks/sessions/useUnderwritingSessions";
import type {
  UnderwritingSession,
  CarrierRecommendation,
  RateTableRecommendation,
} from "../../types/underwriting.types";
import { getHealthTierLabel } from "../../types/underwriting.types";
import {
  formatSessionDate,
  formatSessionDateLong,
  formatCurrency,
  getHealthTierBadgeColor,
  isValidHealthTier,
  capitalizeFirst,
  formatProductType,
  safeParseJsonArray,
} from "../../utils/shared/formatters";
import { parseSessionHealthSnapshot } from "../../utils/sessions/session-health-snapshot";
import { formatRequestedFaceAmounts } from "../../utils/sessions/session-persistence";
import { underwritingQueryKeys } from "../../hooks/shared/query-keys";

const PAGE_SIZE = 15;

interface WizardSessionHistoryProps {
  onClose: () => void;
  onLoadSession: (session: UnderwritingSession) => void;
}

export function WizardSessionHistory({
  onClose,
  onLoadSession,
}: WizardSessionHistoryProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const deferredSearch = useDeferredValue(search);

  const {
    data: result,
    isLoading,
    error,
    isFetching,
  } = useUserSessionsPaginated(page, PAGE_SIZE, deferredSearch);

  const sessions = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  const loadSessionById = async (sessionId: string) => {
    const session = await queryClient.fetchQuery({
      queryKey: underwritingQueryKeys.session(sessionId),
      queryFn: () => fetchUnderwritingSession(sessionId),
      staleTime: 60 * 1000,
    });

    onLoadSession(session);
  };

  // Reset to page 0 when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  // Show session detail view
  if (viewingSessionId) {
    return (
      <SessionDetailView
        sessionId={viewingSessionId}
        onBack={() => setViewingSessionId(null)}
        onLoad={() => loadSessionById(viewingSessionId)}
      />
    );
  }

  // Show session list
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 -ml-1"
          onClick={onClose}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Session History
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {totalCount} session{totalCount !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border/30 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by client name, state, or health tier..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {error ? (
            <div className="text-center py-8 text-destructive text-xs">
              Failed to load sessions: {error.message}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sessions.length > 0 ? (
            <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-v2-canvas dark:bg-v2-card-tinted/50 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50">
                    <TableHead className="h-9 px-3 text-[10px] font-semibold">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date
                      </div>
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Client
                      </div>
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Activity className="h-3 w-3" />
                        Health Tier
                      </div>
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold text-right">
                      Face Amounts
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold w-[130px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow
                      key={session.session_id}
                      className="hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30"
                    >
                      <TableCell className="px-3 py-2 text-[10px] text-muted-foreground">
                        {formatSessionDate(session.created_at)}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div>
                          <div className="text-[11px] font-medium text-foreground">
                            {session.client_name || "Unnamed Client"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {session.client_age} y/o {session.client_gender} •{" "}
                            {session.client_state}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-center">
                        <Badge
                          className={`text-[9px] px-1.5 py-0 ${getHealthTierBadgeColor(session.health_tier)}`}
                        >
                          {isValidHealthTier(session.health_tier)
                            ? getHealthTierLabel(session.health_tier)
                            : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-[11px] text-foreground text-right font-medium">
                        {formatRequestedFaceAmounts(session)}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              setViewingSessionId(session.session_id)
                            }
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-warning hover:text-warning hover:bg-warning/10 dark:hover:bg-warning/20"
                            onClick={() => loadSessionById(session.session_id)}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Load
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">
                {search
                  ? "No sessions match your search."
                  : "No sessions found. Complete the wizard and save to create your first session."}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 flex-shrink-0 bg-card/80">
          <span className="text-[10px] text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={page >= totalPages - 1 || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Session Detail View - displays inline in the dialog
function SessionDetailView({
  sessionId,
  onBack,
  onLoad,
}: {
  sessionId: string;
  onBack: () => void;
  onLoad: () => void;
}) {
  const { data: session, isLoading, error } = useUnderwritingSession(sessionId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-1"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Loading session
            </h3>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          Loading session details...
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-1"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Session unavailable
            </h3>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-xs text-destructive text-center">
          {error?.message || "Failed to load session details."}
        </div>
      </div>
    );
  }

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

  const isRateTableFormat =
    recommendations.length > 0 && "faceAmount" in recommendations[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-1"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {session.client_name || "Unnamed Client"}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {formatSessionDateLong(session.created_at)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-7 px-3 text-[10px] bg-warning hover:bg-warning text-white"
          onClick={onLoad}
        >
          <Upload className="h-3 w-3 mr-1.5" />
          Load & Edit
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Client Info */}
          <Section
            title="Client Information"
            icon={<User className="h-3.5 w-3.5" />}
          >
            <div className="grid grid-cols-3 gap-x-6 gap-y-2">
              <InfoItem label="Age" value={`${session.client_age} years old`} />
              <InfoItem
                label="Gender"
                value={capitalizeFirst(session.client_gender || "Unknown")}
              />
              <InfoItem
                label="State"
                value={session.client_state || "Unknown"}
              />
              <InfoItem
                label="BMI"
                value={session.client_bmi?.toFixed(1) || "N/A"}
              />
              <InfoItem
                label="Tobacco"
                value={session.tobacco_use ? "Yes" : "No"}
                highlight={session.tobacco_use || false}
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
                <span className="text-[10px] text-muted-foreground">
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
                  <div className="text-[10px] font-medium text-foreground mb-1.5">
                    Conditions ({conditionsReported.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {conditionsReported.map((condition) => (
                      <Badge
                        key={condition}
                        variant="outline"
                        className="text-[9px] px-1.5 py-0"
                      >
                        {healthResponses[condition]?.conditionName || condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {riskFactors.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-foreground mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-warning" />
                    Risk Factors ({riskFactors.length})
                  </div>
                  <ul className="space-y-0.5">
                    {riskFactors.map((factor, i) => (
                      <li
                        key={i}
                        className="text-[10px] text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-warning">•</span>
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
              <InfoItem
                label="Face Amounts"
                value={formatRequestedFaceAmounts(session)}
                bold
              />
              <InfoItem
                label="Product Types"
                value={productTypes.map(formatProductType).join(", ") || "None"}
              />
            </div>
          </Section>

          {recommendations.length > 0 && (
            <>
              <Separator />

              {/* Recommendations */}
              <Section
                title={
                  isRateTableFormat
                    ? "Top Recommendations"
                    : "AI Recommendations"
                }
                icon={<DollarSign className="h-3.5 w-3.5" />}
              >
                <div className="space-y-2">
                  {isRateTableFormat
                    ? (recommendations as RateTableRecommendation[]).map(
                        (rec, i) => (
                          <div
                            key={i}
                            className="bg-v2-card rounded-lg p-3 border border-v2-ring dark:border-v2-ring-strong shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-medium text-foreground">
                                  {rec.carrierName}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {rec.productName}
                                  {rec.termYears
                                    ? ` (${rec.termYears} Year)`
                                    : ""}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0"
                              >
                                {rec.quotedHealthClass || rec.healthClass}
                              </Badge>
                            </div>
                            {(rec.quoteClassNote ||
                              (rec.underwritingHealthClass &&
                                rec.underwritingHealthClass !==
                                  (rec.quotedHealthClass ||
                                    rec.healthClass))) && (
                              <div className="mt-1 text-[9px] text-muted-foreground">
                                {rec.quoteClassNote ||
                                  `UW ${rec.underwritingHealthClass} -> Quote ${rec.quotedHealthClass || rec.healthClass}`}
                              </div>
                            )}
                            <div className="mt-2 flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">
                                Face Amount
                              </span>
                              <span className="font-medium">
                                {formatCurrency(rec.faceAmount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">
                                Monthly Premium
                              </span>
                              {rec.monthlyPremium !== null ? (
                                <span className="font-semibold text-success">
                                  {formatCurrency(rec.monthlyPremium)}/mo
                                </span>
                              ) : (
                                <span className="font-medium text-muted-foreground">
                                  TBD
                                </span>
                              )}
                            </div>
                          </div>
                        ),
                      )
                    : (recommendations as CarrierRecommendation[])
                        .sort((a, b) => a.priority - b.priority)
                        .slice(0, 5)
                        .map((rec, i) => (
                          <div
                            key={i}
                            className="bg-v2-card rounded-lg p-3 border border-v2-ring dark:border-v2-ring-strong shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-medium text-foreground">
                                  {rec.carrierName}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {rec.productName}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0"
                                >
                                  {rec.expectedRating}
                                </Badge>
                                <span className="text-[9px] text-muted-foreground">
                                  {(rec.confidence * 100).toFixed(0)}%
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
                          </div>
                        ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper components
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
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h4 className="text-[11px] font-semibold text-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function InfoItem({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        className={`text-[11px] ${bold ? "font-semibold" : ""} ${highlight ? "text-warning" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}
