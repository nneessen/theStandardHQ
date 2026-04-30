// src/features/dashboard/DashboardHome.tsx
//
// Editorial dashboard. Drops bordered-card-per-section in favor of a
// publication-style layout: typography, hairline rules, generous whitespace.
//
//   Masthead → HeroSummary → SecondaryMetricsRow → PaceLines
//      → EditorialAlertsActions → DetailsSection
//      → Org / Team (legacy)

import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useConstants,
  useMyHierarchyStats,
  useRecruitingStats,
} from "../../hooks";
import { useMetricsWithDateRange } from "@/hooks";
import { useUnreadCount } from "@/components/notifications/useNotifications";
import { useUnreadMessageCount } from "../../hooks/messaging/useMessages";
import { useFeatureAccess } from "../../hooks/subscription/useFeatureAccess";
import { useCreateExpense } from "../../hooks/expenses/useCreateExpense";
import { useCreatePolicy } from "../../hooks/policies";
import { useChargebackSummary } from "../../hooks/commissions/useChargebackSummary";
import { useAuth } from "../../contexts/AuthContext";
import { useDashboardFeatures } from "../../hooks/dashboard";
import { TimePeriod } from "../../utils/dateRange";
import type { DateRange } from "../../utils/dateRange";
import { toast } from "sonner";
import type { CreateExpenseData } from "../../types/expense.types";
import type { NewPolicyForm } from "../../types/policy.types";
import { transformFormToCreateData } from "../policies/utils/policyFormTransformer";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";

// New editorial components (kept for the lower sections)
import { PaceLines, type PaceLine } from "./components/PaceLines";
import { EditorialAlertsActions } from "./components/EditorialAlertsActions";
import { DetailsSection } from "./components/DetailsSection";
import { OrgMetricsSection } from "./components/OrgMetricsSection";
import { TeamRecruitingSection } from "./components/TeamRecruitingSection";

// V2 hero + shell
import { DashboardHeroV2 } from "./components/DashboardHeroV2";
import { SectionShell, SoftCard } from "@/components/v2";

// Dialogs
import { ExpenseDialogCompact as ExpenseDialog } from "../expenses/components/ExpenseDialogCompact";
import { PolicyDialog } from "../policies/components/PolicyDialog";

// Configuration
import { generateKPIConfig } from "./config/kpiConfig";
import { generateAlertsConfig } from "./config/alertsConfig";

// Utils
import {
  calculateDerivedMetrics,
  getBreakevenDisplay,
  getPoliciesNeededDisplay,
  getPeriodSuffix,
} from "../../utils/dashboardCalculations";
import { useCreateOrFindClient } from "@/hooks/clients";
import { ValidationError } from "@/errors/ServiceErrors";

/**
 * Compute calendar-aware "where we are in the period." For MTD/monthly,
 * uses the actual day-in-month against days-in-month — so day 25 of April
 * reads as 83%. For weekly/yearly/daily, falls back to dateRange-based
 * elapsed time.
 */
function periodElapsed(
  period: TimePeriod,
  dateRange: DateRange,
  periodOffset: number,
): { pct: number; daysElapsed: number; daysTotal: number } {
  const now = new Date();
  const start = dateRange.startDate;

  if (period === "MTD" || period === "monthly") {
    const totalDays = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    if (periodOffset === 0) {
      const elapsed = Math.min(now.getDate(), totalDays);
      return {
        pct: elapsed / totalDays,
        daysElapsed: elapsed,
        daysTotal: totalDays,
      };
    }
    return { pct: 1, daysElapsed: totalDays, daysTotal: totalDays };
  }

  if (period === "yearly") {
    const startOfYear = new Date(start.getFullYear(), 0, 1);
    const endOfYear = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
    const totalDays =
      Math.round((endOfYear.getTime() - startOfYear.getTime()) / 86_400_000) +
      1;
    if (periodOffset === 0) {
      const elapsedDays =
        Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
      const clamped = Math.max(1, Math.min(totalDays, elapsedDays));
      return {
        pct: clamped / totalDays,
        daysElapsed: clamped,
        daysTotal: totalDays,
      };
    }
    return { pct: 1, daysElapsed: totalDays, daysTotal: totalDays };
  }

  if (period === "weekly") {
    if (periodOffset === 0) {
      const dow = now.getDay() === 0 ? 7 : now.getDay();
      return { pct: dow / 7, daysElapsed: dow, daysTotal: 7 };
    }
    return { pct: 1, daysElapsed: 7, daysTotal: 7 };
  }

  // daily — period is just one day; treat as fully elapsed.
  return { pct: 1, daysElapsed: 1, daysTotal: 1 };
}

/** Format the masthead title from the period and dateRange. */
function periodTitle(period: TimePeriod, dr: DateRange): string {
  const start = dr.startDate;
  const end = dr.endDate;
  if (period === "daily") {
    return start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (period === "weekly") {
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = sameMonth
      ? end.toLocaleDateString("en-US", { day: "numeric" })
      : end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${startStr} – ${endStr}`;
  }
  if (period === "yearly") {
    return String(start.getFullYear());
  }
  // MTD / monthly
  return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const DashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: constants } = useConstants();
  const dashboardFeatures = useDashboardFeatures();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("MTD");
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [activeDialog, setActiveDialog] = useState<"policy" | "expense" | null>(
    null,
  );
  const [policyFormErrors, setPolicyFormErrors] = useState<
    Record<string, string>
  >({});

  const handleTimePeriodChange = (newPeriod: TimePeriod) => {
    setTimePeriod(newPeriod);
    setPeriodOffset(0);
  };

  const {
    periodCommissions,
    periodExpenses,
    periodPolicies,
    periodClients,
    currentState,
    periodAnalytics,
    dateRange,
  } = useMetricsWithDateRange({
    timePeriod,
    periodOffset,
    targetAvgPremium: constants?.avgAP || 1500,
  });

  // Always-on MTD and YTD metrics for the hero pace bars (independent of
  // the selected period switcher). Sum of paid + pending so the value is
  // never artificially $0 just because the carrier hasn't disbursed yet.
  const mtdMetrics = useMetricsWithDateRange({
    timePeriod: "monthly",
    periodOffset: 0,
  });
  const ytdMetrics = useMetricsWithDateRange({
    timePeriod: "yearly",
    periodOffset: 0,
  });
  const mtdCommissionTotal =
    (mtdMetrics.periodCommissions.paid ?? 0) +
    (mtdMetrics.periodCommissions.pending ?? 0);
  const ytdCommissionTotal =
    (ytdMetrics.periodCommissions.paid ?? 0) +
    (ytdMetrics.periodCommissions.pending ?? 0);
  const mtdAPTotal = mtdMetrics.periodPolicies.premiumWritten;
  const ytdAPTotal = ytdMetrics.periodPolicies.premiumWritten;

  const createExpense = useCreateExpense();
  const createPolicy = useCreatePolicy();
  const createOrFindClient = useCreateOrFindClient();
  const { data: chargebackSummary } = useChargebackSummary();

  const { hasAccess: hasTeamAccess } = useFeatureAccess("hierarchy");
  const { hasAccess: hasRecruitingAccess } = useFeatureAccess("recruiting");
  const { hasAccess: hasBasicRecruiting } =
    useFeatureAccess("recruiting_basic");
  const shouldIncludeProspects = hasBasicRecruiting && !hasRecruitingAccess;

  const { data: hierarchyStats } = useMyHierarchyStats({
    enabled: hasTeamAccess || dashboardFeatures.isAdmin,
  });
  const { data: recruitingStats } = useRecruitingStats({
    enabled:
      hasRecruitingAccess || hasBasicRecruiting || dashboardFeatures.isAdmin,
    includeProspects: shouldIncludeProspects,
  });

  const { data: unreadNotifications } = useUnreadCount();
  const { data: unreadMessages } = useUnreadMessageCount();

  const derivedMetrics = calculateDerivedMetrics(periodPolicies, periodClients);
  const breakevenDisplay = getBreakevenDisplay(
    periodAnalytics.breakevenNeeded,
    timePeriod,
  );
  const policiesNeededDisplay = getPoliciesNeededDisplay(
    periodAnalytics.paceMetrics,
    periodAnalytics.policiesNeeded,
    timePeriod,
  );
  const periodSuffix = getPeriodSuffix(timePeriod);
  const isCreating = createPolicy.isPending || createExpense.isPending;

  const elapsed = periodElapsed(timePeriod, dateRange, periodOffset);
  const expectedPct = elapsed.pct;
  const title = periodTitle(timePeriod, dateRange);
  const showDaysSubtitle = elapsed.daysTotal > 1;

  const kpiConfig = generateKPIConfig({
    timePeriod,
    periodCommissions,
    periodExpenses,
    periodPolicies,
    periodClients,
    periodAnalytics,
    currentState,
    derivedMetrics,
    breakevenDisplay,
    policiesNeededDisplay,
    features: dashboardFeatures,
  });

  const alertsConfig = generateAlertsConfig({
    timePeriod,
    periodCommissions,
    periodPolicies,
    periodExpenses,
    periodAnalytics,
    currentState,
    lapsedRate: derivedMetrics.lapsedRate,
    policiesNeeded: policiesNeededDisplay,
    periodSuffix,
  });

  // Pace lines — full-width labelled progress bars
  const commissionTarget = periodAnalytics.paceMetrics.monthlyTarget || null;
  const policyTarget =
    periodPolicies.newCount + Math.max(0, Math.ceil(policiesNeededDisplay));
  const _premiumTarget =
    constants?.avgAP && policyTarget > 0
      ? constants.avgAP * policyTarget
      : null;

  const paceLines: PaceLine[] = [
    {
      label: "Commissions",
      current: (periodCommissions.paid ?? 0) + (periodCommissions.pending ?? 0),
      target: commissionTarget,
      unit: "$",
    },
    {
      label: "Policies",
      current: periodPolicies.newCount,
      target: policyTarget > 0 ? policyTarget : null,
      unit: "#",
    },
  ];

  const quickActions = [
    { label: "Add Policy", action: "Add Policy", hasAccess: true },
    {
      label: "Add Expense",
      action: "Add Expense",
      hasAccess: dashboardFeatures.canAddExpense,
      lockedTooltip: "Upgrade to Pro to track expenses",
      requiredTier: "Pro",
    },
    {
      label: "View Reports",
      action: "View Reports",
      hasAccess: dashboardFeatures.canViewReports,
      lockedTooltip: "Upgrade to Pro to view reports",
      requiredTier: "Pro",
    },
  ];

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "Add Policy":
        setActiveDialog("policy");
        break;
      case "Add Expense":
        setActiveDialog("expense");
        break;
      case "View Reports":
        navigate({ to: "/reports" });
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  };

  const handleSaveExpense = async (data: CreateExpenseData) => {
    try {
      await createExpense.mutateAsync(data);
      toast.success("Expense created successfully!");
      setActiveDialog(null);
    } catch (error) {
      toast.error("Failed to create expense. Please try again.");
      console.error("Error creating expense:", error);
    }
  };

  const handleAddPolicy = async (formData: NewPolicyForm) => {
    setPolicyFormErrors({});
    try {
      if (!user?.id) {
        throw new Error("You must be logged in to create a policy");
      }
      const client = await createOrFindClient.mutateAsync({
        clientData: {
          name: formData.clientName,
          email: formData.clientEmail || undefined,
          phone: formData.clientPhone || undefined,
          address: JSON.stringify({
            state: formData.clientState,
            street: formData.clientStreet || undefined,
            city: formData.clientCity || undefined,
            zipCode: formData.clientZipCode || undefined,
          }),
          date_of_birth: formData.clientDOB,
        },
        userId: user.id,
      });
      const policyData = transformFormToCreateData(
        formData,
        client.id,
        user.id,
      );
      const result = await createPolicy.mutateAsync(policyData);
      toast.success(`Policy ${result.policyNumber} created successfully!`);
      setActiveDialog(null);
      return result;
    } catch (error) {
      if (error instanceof ValidationError && error.validationErrors) {
        const fieldErrors: Record<string, string> = {};
        error.validationErrors.forEach((ve) => {
          fieldErrors[ve.field] = ve.message;
        });
        setPolicyFormErrors(fieldErrors);
      } else {
        setPolicyFormErrors({});
      }
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create policy. Please try again.";
      toast.error(errorMessage);
      console.error("Error creating policy:", error);
      throw error;
    }
  };

  const augmentedAlerts =
    chargebackSummary && chargebackSummary.totalChargebacks > 0
      ? [
          ...alertsConfig,
          {
            type: "danger" as const,
            title: `${chargebackSummary.totalChargebacks} chargeback${chargebackSummary.totalChargebacks === 1 ? "" : "s"}`,
            message: `${formatCurrency(chargebackSummary.totalChargebackAmount)} clawed back this period`,
            condition: true,
          },
        ]
      : alertsConfig;

  const showOrg =
    dashboardFeatures.isAdmin ||
    dashboardFeatures.isImoAdmin ||
    dashboardFeatures.isAgencyOwner;

  // Hero pace bars — always show MTD and YTD totals.
  // Bar fill ratio = current value vs. period target where one is configured.
  // Commission target comes from paceMetrics.monthlyTarget. AP target is
  // not directly tracked — proxy via the highest YTD AP seen so each new
  // month's bar grows naturally; if YTD is 0, show the bar full so the
  // chip ($ value) reads cleanly.
  const monthlyCommTarget =
    mtdMetrics.periodAnalytics?.paceMetrics?.monthlyTarget ?? 0;
  const yearlyCommTarget = monthlyCommTarget > 0 ? monthlyCommTarget * 12 : 0;

  const apMtdPct =
    ytdAPTotal > 0
      ? Math.min(1, mtdAPTotal / (ytdAPTotal / 12))
      : mtdAPTotal > 0
        ? 1
        : 0;
  const apYtdPct = ytdAPTotal > 0 ? 1 : 0;
  const commMtdPct =
    monthlyCommTarget > 0
      ? Math.min(1, mtdCommissionTotal / monthlyCommTarget)
      : mtdCommissionTotal > 0
        ? 1
        : 0;
  const commYtdPct =
    yearlyCommTarget > 0
      ? Math.min(1, ytdCommissionTotal / yearlyCommTarget)
      : ytdCommissionTotal > 0
        ? 1
        : 0;

  const greetingName =
    user?.email
      ?.split("@")[0]
      ?.split(".")[0]
      ?.replace(/^./, (c) => c.toUpperCase()) || "there";

  return (
    <>
      <SectionShell>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-12 py-4 sm:py-6">
          <DashboardHeroV2
            greetingName={greetingName}
            periodTitle={title}
            daysSubtitle={
              showDaysSubtitle
                ? `Day ${elapsed.daysElapsed} of ${elapsed.daysTotal}`
                : undefined
            }
            timePeriod={timePeriod}
            onTimePeriodChange={handleTimePeriodChange}
            periodOffset={periodOffset}
            onOffsetChange={setPeriodOffset}
            apMtdPct={apMtdPct}
            apMtdDisplay={formatCompactCurrency(mtdAPTotal)}
            apYtdPct={apYtdPct}
            apYtdDisplay={formatCompactCurrency(ytdAPTotal)}
            commMtdPct={commMtdPct}
            commMtdDisplay={formatCompactCurrency(mtdCommissionTotal)}
            commYtdPct={commYtdPct}
            commYtdDisplay={formatCompactCurrency(ytdCommissionTotal)}
            policiesCount={periodPolicies.newCount}
            premiumWritten={periodPolicies.premiumWritten}
            pendingPipeline={currentState.pendingPipeline}
          />

          {/* Pace bars — full width (it's already a wide horizontal list) */}
          <SoftCard padding="lg" className="mb-4">
            <PaceLines
              lines={paceLines}
              daysElapsed={showDaysSubtitle ? elapsed.daysElapsed : undefined}
              daysTotal={showDaysSubtitle ? elapsed.daysTotal : undefined}
              expectedPct={expectedPct}
            />
          </SoftCard>

          {/* Alerts + Details side-by-side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <SoftCard padding="lg">
              <EditorialAlertsActions
                alerts={augmentedAlerts}
                actions={quickActions}
                onActionClick={handleQuickAction}
                isCreating={isCreating}
              />
            </SoftCard>

            <SoftCard padding="lg">
              <DetailsSection sections={kpiConfig} />
            </SoftCard>
          </div>

          {/* Org + Team — kept full-width because both sections have
              internal 3-col grids with fixed-pixel column widths
              (260/280/300px) that overflow if squeezed into half-columns. */}
          {showOrg && (
            <SoftCard padding="lg" className="mb-4">
              <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle mb-3">
                Organization
              </h2>
              <OrgMetricsSection
                isImoAdmin={
                  dashboardFeatures.isAdmin || dashboardFeatures.isImoAdmin
                }
                isAgencyOwner={dashboardFeatures.isAgencyOwner}
                dateRange={dateRange}
              />
            </SoftCard>
          )}

          <SoftCard padding="lg" className="mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle mb-3">
              Team & Recruiting
            </h2>
            <TeamRecruitingSection
              hierarchyStats={hierarchyStats}
              recruitingStats={recruitingStats}
              unreadNotifications={unreadNotifications ?? 0}
              unreadMessages={unreadMessages ?? 0}
              hasAccess={hasTeamAccess || dashboardFeatures.isAdmin}
            />
          </SoftCard>
        </div>
      </SectionShell>

      <ExpenseDialog
        open={activeDialog === "expense"}
        onOpenChange={(open: boolean) =>
          setActiveDialog(open ? "expense" : null)
        }
        onSave={handleSaveExpense}
        isSubmitting={createExpense.isPending}
      />

      <PolicyDialog
        open={activeDialog === "policy"}
        onOpenChange={(open) => {
          setActiveDialog(open ? "policy" : null);
          if (!open) {
            setPolicyFormErrors({});
          }
        }}
        onSave={handleAddPolicy}
        externalErrors={policyFormErrors}
      />
    </>
  );
};
