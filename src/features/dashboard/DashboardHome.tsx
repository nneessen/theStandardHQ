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

/**
 * Calendar-progress helpers used by the YTD bars on the hero strip:
 * the bar fills as the *year* progresses, so the user has a visual
 * anchor for "where am I in the year vs. what I've earned so far."
 */
function calendarProgress(now: Date) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  ).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const month =
    (now.getTime() - startOfMonth) / (startOfNextMonth - startOfMonth);
  const year = (now.getTime() - startOfYear) / (startOfNextYear - startOfYear);
  return {
    month: Math.max(0, Math.min(1, month)),
    year: Math.max(0, Math.min(1, year)),
  };
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

  // Hero MTD/YTD totals always anchor on "today" when current period; on
  // the end of the selected period when navigating back. This keeps the
  // strip honest about historical context without flickering past values.
  const heroAnchorEnd =
    periodOffset === 0
      ? new Date()
      : new Date(
          dateRange.endDate.getFullYear(),
          dateRange.endDate.getMonth(),
          dateRange.endDate.getDate(),
          23,
          59,
          59,
          999,
        );
  const heroMtdRange: DateRange = {
    startDate: new Date(
      heroAnchorEnd.getFullYear(),
      heroAnchorEnd.getMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
    endDate: heroAnchorEnd,
  };
  const heroYtdRange: DateRange = {
    startDate: new Date(heroAnchorEnd.getFullYear(), 0, 1, 0, 0, 0, 0),
    endDate: heroAnchorEnd,
  };
  const mtdMetrics = useMetricsWithDateRange({
    timePeriod: "monthly",
    periodOffset: 0,
    customRange: heroMtdRange,
  });
  const ytdMetrics = useMetricsWithDateRange({
    timePeriod: "yearly",
    periodOffset: 0,
    customRange: heroYtdRange,
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

  const commissionTarget = periodAnalytics.paceMetrics.monthlyTarget || null;
  const policyTarget =
    periodPolicies.newCount + Math.max(0, Math.ceil(policiesNeededDisplay));

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

  // Compute pace ratios for the hero strip. MTD bars track against
  // monthly targets; YTD bars use calendar position so they tell the
  // user "you're X% through the year and have earned $N."
  const monthlyCommTarget =
    mtdMetrics.periodAnalytics?.paceMetrics?.monthlyTarget ?? 0;
  const calProgress = calendarProgress(new Date());

  const apMtdPct =
    ytdAPTotal > 0
      ? Math.min(1, mtdAPTotal / (ytdAPTotal / 12))
      : mtdAPTotal > 0
        ? 1
        : 0;
  const commMtdPct =
    monthlyCommTarget > 0
      ? Math.min(1, mtdCommissionTotal / monthlyCommTarget)
      : mtdCommissionTotal > 0
        ? 1
        : 0;
  const policiesPct =
    policyTarget > 0
      ? Math.min(1, periodPolicies.newCount / policyTarget)
      : periodPolicies.newCount > 0
        ? 1
        : 0;

  const heroStats: HeroStat[] = [
    {
      label: "Premium MTD",
      value: formatCompactCurrency(mtdAPTotal),
      pct: apMtdPct,
      expectedPct: periodOffset === 0 ? calProgress.month : undefined,
      hint:
        ytdAPTotal > 0
          ? `${Math.round(apMtdPct * 100)}% of ${formatCompactCurrency(ytdAPTotal / 12)} pace`
          : "no pace yet",
      tone: "ink",
    },
    {
      label: "Premium YTD",
      value: formatCompactCurrency(ytdAPTotal),
      pct: calProgress.year,
      hint: `${Math.round(calProgress.year * 100)}% through year`,
      tone: "muted",
      secondary: true,
    },
    {
      label: "Commissions MTD",
      value: formatCompactCurrency(mtdCommissionTotal),
      pct: commMtdPct,
      expectedPct: periodOffset === 0 ? calProgress.month : undefined,
      hint:
        monthlyCommTarget > 0
          ? `${Math.round(commMtdPct * 100)}% of ${formatCompactCurrency(monthlyCommTarget)} target`
          : "no target set",
      tone: "accent",
    },
    {
      label: "Commissions YTD",
      value: formatCompactCurrency(ytdCommissionTotal),
      pct: calProgress.year,
      hint: `${Math.round(calProgress.year * 100)}% through year`,
      tone: "muted",
      secondary: true,
    },
    {
      label: "Policies",
      value: periodPolicies.newCount.toLocaleString(),
      pct: policiesPct,
      expectedPct: periodOffset === 0 ? expectedPct : undefined,
      hint:
        policyTarget > 0
          ? `${periodPolicies.newCount} of ${policyTarget} target`
          : `${periodPolicies.newCount} written`,
      tone: "ink",
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
