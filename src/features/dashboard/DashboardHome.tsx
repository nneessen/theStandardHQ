// src/features/dashboard/DashboardHome.tsx
//
// Dense data-first dashboard. Top header (period + actions), then a
// 5-column hero stat strip (no card chrome), one Pace+Alerts card,
// one full-width Details table, then Org / Team & Recruiting.

import React, { useState } from "react";
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
import { useCalculatedTargets } from "../../hooks/targets";
import { useHistoricalAverages } from "../../hooks/targets/useHistoricalAverages";
import { TimePeriod } from "../../utils/dateRange";
import type { DateRange } from "../../utils/dateRange";
import { toast } from "sonner";
import type { CreateExpenseData } from "../../types/expense.types";
import type { NewPolicyForm } from "../../types/policy.types";
import { transformFormToCreateData } from "../policies/utils/policyFormTransformer";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";

import { PaceLines, type PaceLine } from "./components/PaceLines";
import { EditorialAlerts } from "./components/EditorialAlerts";
import { DashboardHeader } from "./components/DashboardHeader";
import { HeroStatStrip, type HeroStat } from "./components/HeroStatStrip";
import { DetailsTable } from "./components/DetailsTable";
import { OrgMetricsSection } from "./components/OrgMetricsSection";
import { TeamRecruitingSection } from "./components/TeamRecruitingSection";

import { SectionShell, SoftCard } from "@/components/v2";

import { ExpenseDialogCompact as ExpenseDialog } from "../expenses/components/ExpenseDialogCompact";
import { PolicyDialog } from "../policies/components/PolicyDialog";

import { generateKPIConfig } from "./config/kpiConfig";
import { generateAlertsConfig } from "./config/alertsConfig";

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
  return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const DashboardHome: React.FC = () => {
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

  // Realistic target plan — same source the Targets page tunes via Realism
  // Settings. Falls back to breakeven-based pace if no target set yet.
  const { calculated: calculatedTargets } = useCalculatedTargets();
  // Historical averages exposes both agency-wide and personal premium stats.
  // Used below to compute the highest-available avg AP for the Premium target,
  // so the dashboard never anchors to whichever signal is lowest.
  const { averages: historicalAverages } = useHistoricalAverages();

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

  // Pace targets pull from the realistic plan when set: gross commission
  // needed monthly (i.e. what you must earn pre-tax/pre-expense to take home
  // the goal) and apps to write monthly. When no target is set, fall back to
  // the legacy breakeven-derived pace so the dashboard still has SOMETHING to
  // pace against.
  const realisticMonthlyCommission =
    calculatedTargets && calculatedTargets.realisticGrossCommissionNeeded > 0
      ? calculatedTargets.realisticGrossCommissionNeeded / 12
      : null;
  const commissionTarget =
    realisticMonthlyCommission ??
    periodAnalytics.paceMetrics.monthlyTarget ??
    null;
  const policyTarget =
    calculatedTargets && calculatedTargets.realisticMonthlyAppsToWrite > 0
      ? calculatedTargets.realisticMonthlyAppsToWrite
      : periodPolicies.newCount + Math.max(0, Math.ceil(policiesNeededDisplay));

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

  // Hero strip is fully period-aware — every cell reads from the same
  // period-scoped queries the rest of the page uses, so flipping the
  // Day/Week/MTD/Month/Year picker (or prev/next) updates all values
  // together. Targets scale to match the selected period.
  //
  // When a realistic plan is set, scale the annual realistic gross commission
  // to the selected period (yearly/30/52/365). Otherwise fall back to the
  // breakeven-derived pace from useMetricsWithDateRange.
  const periodCommTarget = (() => {
    if (
      calculatedTargets &&
      calculatedTargets.realisticGrossCommissionNeeded > 0
    ) {
      const annual = calculatedTargets.realisticGrossCommissionNeeded;
      if (timePeriod === "yearly") return annual;
      if (timePeriod === "daily") return annual / 365;
      if (timePeriod === "weekly") return annual / 52;
      return annual / 12; // MTD / monthly
    }
    const m = periodAnalytics.paceMetrics;
    if (timePeriod === "daily") return m.dailyTarget;
    if (timePeriod === "weekly") return m.weeklyTarget;
    if (timePeriod === "yearly") return m.monthlyTarget * 12;
    return m.monthlyTarget;
  })();

  const periodCommTotal =
    (periodCommissions.paid ?? 0) + (periodCommissions.pending ?? 0);
  // Avg AP for the Premium hero target: take the HIGHEST of all known
  // signals so the dashboard frames the goal aspirationally rather than
  // anchoring to whichever number happens to be lowest.
  // - constants.avgAP: org-set baseline
  // - agency mean / median: stable cohort signal
  // - personal mean / median: the user's own book, if higher than agency
  const dashboardAvgAP = Math.max(
    constants?.avgAP ?? 0,
    historicalAverages.avgPolicyPremium ?? 0,
    historicalAverages.medianPolicyPremium ?? 0,
    historicalAverages.personalAvgPolicyPremium ?? 0,
    historicalAverages.personalMedianPolicyPremium ?? 0,
  );
  const premiumTarget =
    dashboardAvgAP > 0 && policyTarget > 0 ? dashboardAvgAP * policyTarget : 0;

  const safePct = (current: number, target: number): number =>
    target > 0 ? Math.min(1, current / target) : current > 0 ? 1 : 0;

  const heroStats: HeroStat[] = [
    {
      label: "Premium",
      value: formatCompactCurrency(periodPolicies.premiumWritten),
      pct: safePct(periodPolicies.premiumWritten, premiumTarget),
      expectedPct: periodOffset === 0 ? expectedPct : undefined,
      hint:
        premiumTarget > 0
          ? `${Math.round(safePct(periodPolicies.premiumWritten, premiumTarget) * 100)}% of ${formatCompactCurrency(premiumTarget)} target`
          : `${formatCompactCurrency(periodPolicies.premiumWritten)} written`,
      tone: "ink",
    },
    {
      label: "Commissions",
      value: formatCompactCurrency(periodCommTotal),
      pct: safePct(periodCommTotal, periodCommTarget),
      expectedPct: periodOffset === 0 ? expectedPct : undefined,
      hint:
        periodCommTarget > 0
          ? `${Math.round(safePct(periodCommTotal, periodCommTarget) * 100)}% of ${formatCompactCurrency(periodCommTarget)} target`
          : "no target set",
      tone: "accent",
    },
    {
      label: "Policies",
      value: periodPolicies.newCount.toLocaleString(),
      pct: safePct(periodPolicies.newCount, policyTarget),
      expectedPct: periodOffset === 0 ? expectedPct : undefined,
      hint:
        policyTarget > 0
          ? `${periodPolicies.newCount} of ${policyTarget} target`
          : `${periodPolicies.newCount} written`,
      tone: "ink",
    },
    {
      label: "Pipeline",
      value: formatCompactCurrency(currentState.pendingPipeline),
      // pct omitted — pipeline is a current snapshot, not pace toward a target.
      hint: "current pending",
      tone: "muted",
      secondary: true,
    },
  ];

  return (
    <>
      <SectionShell className="dashboard-canvas">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-12 py-4 sm:py-6">
          <DashboardHeader
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
            onAddPolicy={() => setActiveDialog("policy")}
            onAddExpense={() => setActiveDialog("expense")}
            canAddExpense={dashboardFeatures.canAddExpense}
            isCreating={isCreating}
          />

          <HeroStatStrip stats={heroStats} />

          <SoftCard padding="lg" className="mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-4 lg:gap-x-8 lg:divide-x lg:divide-v2-ring">
              <div className="lg:pr-8">
                <PaceLines
                  lines={paceLines}
                  daysElapsed={
                    showDaysSubtitle ? elapsed.daysElapsed : undefined
                  }
                  daysTotal={showDaysSubtitle ? elapsed.daysTotal : undefined}
                  expectedPct={expectedPct}
                />
              </div>
              <div className="lg:pl-8">
                <EditorialAlerts alerts={augmentedAlerts} />
              </div>
            </div>
          </SoftCard>

          <SoftCard padding="lg" className="mb-4">
            <DetailsTable sections={kpiConfig} />
          </SoftCard>

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
