// src/features/targets/TargetsPage.tsx

import { useState, useEffect } from "react";
import {
  useTargets,
  useUpdateTargets,
  useActualMetrics,
} from "../../hooks/targets";
import { useHistoricalAverages } from "../../hooks/targets/useHistoricalAverages";
import { useUserCommissionProfile } from "../../hooks/commissions/useUserCommissionProfile";
import { Input } from "@/components/ui/input";
import { PillButton } from "@/components/v2";
import { Edit2, Target, AlertCircle, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "../../lib/format";
import { toast } from "sonner";
import { targetsCalculationService } from "../../services/targets/targetsCalculationService";
import { TargetInputDialog } from "./components/TargetInputDialog";
import { PersistencyScenarios } from "./components/PersistencyScenarios";
import { WelcomeTargetCard } from "./components/WelcomeTargetCard";

export function TargetsPage() {
  const { data: targets, isLoading, error } = useTargets();
  const actualMetrics = useActualMetrics();
  const updateTargets = useUpdateTargets();
  const { averages, isLoading: averagesLoading } = useHistoricalAverages();
  const { data: commissionProfile } = useUserCommissionProfile();

  const [showInputDialog, setShowInputDialog] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineEditValue, setInlineEditValue] = useState<string>("");

  // Check if this is the first visit (no target set)
  const isFirstTime = targets && targets.annualIncomeTarget === 0;

  // Derived values — recalculate every render from latest data
  const annualTarget = targets?.annualIncomeTarget ?? 0;

  const calculatedTargets =
    targets && targets.annualIncomeTarget > 0 && !averagesLoading
      ? targetsCalculationService.calculateTargets({
          annualIncomeTarget: targets.annualIncomeTarget,
          historicalAverages: averages,
          overrides: undefined,
        })
      : null;

  // Show welcome dialog on first visit
  useEffect(() => {
    if (isFirstTime && !isLoading) {
      setShowInputDialog(true);
    }
  }, [isFirstTime, isLoading]);

  const handleSaveTarget = async (newAnnualTarget: number) => {
    try {
      // Calculate all derived values
      const calculated = targetsCalculationService.calculateTargets({
        annualIncomeTarget: newAnnualTarget,
        historicalAverages: averages,
      });

      // Save to database
      // NOTE: avgPremiumTarget removed - always calculated from actual policies
      await updateTargets.mutateAsync({
        annualIncomeTarget: newAnnualTarget,
        quarterlyIncomeTarget: calculated.quarterlyIncomeTarget,
        monthlyIncomeTarget: calculated.monthlyIncomeTarget,
        annualPoliciesTarget: calculated.annualPoliciesTarget,
        monthlyPoliciesTarget: calculated.monthlyPoliciesTarget,
        // REMOVED: avgPremiumTarget - always calculated from actual policies
        persistency13MonthTarget: calculated.persistency13MonthTarget,
        persistency25MonthTarget: calculated.persistency25MonthTarget,
        monthlyExpenseTarget: calculated.monthlyExpenseTarget,
        expenseRatioTarget: calculated.expenseRatio,
      });

      toast.success("Target updated successfully");
    } catch (err) {
      toast.error("Failed to update target");
      throw err;
    }
  };

  const handleInlineEdit = () => {
    setInlineEditValue(annualTarget.toString());
    setIsEditingInline(true);
  };

  const handleInlineSave = async () => {
    const value = parseFloat(inlineEditValue.replace(/,/g, ""));

    if (isNaN(value) || value <= 0) {
      toast.error("Please enter a valid target amount");
      return;
    }

    await handleSaveTarget(value);
    setIsEditingInline(false);
  };

  const handleInlineCancel = () => {
    setIsEditingInline(false);
    setInlineEditValue("");
  };

  if (isLoading || averagesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-v2-ink-muted text-sm">Loading targets…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-red-600 dark:text-red-400 text-sm">
          Error: {error.message}
        </div>
      </div>
    );
  }

  // If targets exist but annual target is 0 (first time), show dialog only
  if (!targets) {
    return null;
  }

  // Calculate target year (next year if in Q4)
  const now = new Date();
  const currentMonth = now.getMonth();
  const isQ4 = currentMonth >= 9;
  const targetYear = isQ4 ? now.getFullYear() + 1 : now.getFullYear();

  // First-time users: show only the dialog to set their initial target
  if (isFirstTime || !calculatedTargets) {
    return (
      <>
        <div className="flex flex-col gap-3">
          <header className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-v2-ink" />
              <h1 className="text-base font-semibold tracking-tight text-v2-ink">
                Income Targets {targetYear}
              </h1>
            </div>
          </header>
          <WelcomeTargetCard
            targetYear={targetYear}
            onGetStarted={() => setShowInputDialog(true)}
          />
        </div>
        <TargetInputDialog
          open={showInputDialog}
          onClose={() => setShowInputDialog(false)}
          onSave={handleSaveTarget}
          currentTarget={annualTarget}
          isFirstTime={isFirstTime}
        />
      </>
    );
  }

  const _getProgress = (actual: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, (actual / target) * 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "text-emerald-600 dark:text-emerald-400";
    if (progress >= 75) return "text-blue-600 dark:text-blue-400";
    if (progress >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Compact header — title + inline annual target chip + edit */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Target className="h-4 w-4 text-v2-ink" />
              <h1 className="text-base font-semibold tracking-tight text-v2-ink">
                Income Targets {targetYear}
              </h1>
            </div>
            <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
              <span>
                Based on{" "}
                <span className="text-v2-ink font-semibold">
                  {calculatedTargets.calculationMethod === "historical"
                    ? "your historical data"
                    : "industry averages"}
                </span>
              </span>
            </div>
          </div>
          {!isEditingInline ? (
            <div className="flex items-center gap-2">
              <div className="text-right leading-tight">
                <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
                  NET Annual Target
                </div>
                <div className="text-base font-semibold font-mono text-v2-ink">
                  {formatCurrency(calculatedTargets.annualIncomeTarget)}
                </div>
              </div>
              <PillButton
                tone="ghost"
                size="sm"
                onClick={handleInlineEdit}
                className="h-7 w-7 px-0"
                aria-label="Edit annual target"
              >
                <Edit2 className="h-3 w-3" />
              </PillButton>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={inlineEditValue}
                onChange={(e) => setInlineEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInlineSave();
                  if (e.key === "Escape") handleInlineCancel();
                }}
                className="w-32 h-8 text-sm font-bold bg-v2-card border-v2-ring focus-visible:ring-v2-accent rounded-v2-pill"
                autoFocus
              />
              <PillButton tone="black" size="sm" onClick={handleInlineSave}>
                Save
              </PillButton>
              <PillButton tone="ghost" size="sm" onClick={handleInlineCancel}>
                Cancel
              </PillButton>
            </div>
          )}
        </header>

        {/* Main Content */}
        <div className="flex-1">
          <div className="space-y-2.5">
            {/* NET vs GROSS Breakdown - New Section */}
            <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
              <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
                Income Calculation Breakdown
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">
                        NET Income Target (Take Home)
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(calculatedTargets.annualIncomeTarget)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted flex items-center gap-1">
                        + Annual Expenses
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="text-v2-ink-subtle hover:text-v2-ink transition-colors"
                              aria-label="Show annual expense breakdown"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[360px] p-3"
                          >
                            <div className="text-[11px]">
                              <div className="font-semibold text-v2-ink mb-1.5">
                                Annual Expenses Breakdown
                              </div>
                              <div className="text-v2-ink-subtle mb-2">
                                Year {new Date().getFullYear()} • projected from
                                recurring definitions + one-time rows
                              </div>

                              {averages.annualExpenseBreakdown.recurring
                                .length > 0 && (
                                <div className="mb-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted mb-1">
                                    Recurring (
                                    {formatCurrency(
                                      averages.annualExpenseBreakdown
                                        .recurringTotal,
                                    )}
                                    )
                                  </div>
                                  <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                                    {averages.annualExpenseBreakdown.recurring.map(
                                      (g) => (
                                        <div
                                          key={g.groupId}
                                          className="flex justify-between gap-2"
                                        >
                                          <span
                                            className="text-v2-ink truncate"
                                            title={g.name}
                                          >
                                            {g.name}
                                          </span>
                                          <span className="font-mono text-v2-ink-subtle whitespace-nowrap">
                                            {formatCurrency(g.latestAmount)} ×{" "}
                                            {g.occurrences} {g.frequency}
                                            {g.endDate
                                              ? ` (ends ${g.endDate})`
                                              : ""}{" "}
                                            ={" "}
                                            <span className="text-v2-ink font-semibold">
                                              {formatCurrency(g.total)}
                                            </span>
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                              {averages.annualExpenseBreakdown.oneTime.length >
                                0 && (
                                <div className="mb-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted mb-1">
                                    One-time (
                                    {formatCurrency(
                                      averages.annualExpenseBreakdown
                                        .oneTimeTotal,
                                    )}
                                    )
                                  </div>
                                  <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                                    {averages.annualExpenseBreakdown.oneTime.map(
                                      (e) => (
                                        <div
                                          key={e.id}
                                          className="flex justify-between gap-2"
                                        >
                                          <span
                                            className="text-v2-ink truncate"
                                            title={e.name}
                                          >
                                            {e.name}{" "}
                                            <span className="text-v2-ink-subtle">
                                              ({e.date})
                                            </span>
                                          </span>
                                          <span className="font-mono text-v2-ink font-semibold whitespace-nowrap">
                                            {formatCurrency(e.amount)}
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="border-t border-v2-ring pt-1.5 flex justify-between font-semibold">
                                <span className="text-v2-ink">Total</span>
                                <span className="font-mono text-v2-ink">
                                  {formatCurrency(
                                    averages.annualExpenseBreakdown.total,
                                  )}
                                </span>
                              </div>

                              {averages.annualExpenseBreakdown.recurring
                                .length === 0 &&
                                averages.annualExpenseBreakdown.oneTime
                                  .length === 0 && (
                                  <div className="text-v2-ink-subtle">
                                    No expenses recorded for this year.
                                  </div>
                                )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </span>
                      <span className="font-mono text-v2-ink">
                        {formatCurrency(calculatedTargets.annualExpenses)}
                      </span>
                    </div>
                    <div className="h-px bg-v2-ring my-1" />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted font-semibold">
                        = GROSS Commission Needed
                      </span>
                      <span className="font-mono font-bold text-v2-ink">
                        {formatCurrency(
                          calculatedTargets.annualIncomeTarget +
                            calculatedTargets.annualExpenses,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-v2-ring">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">
                        Gross Commission
                      </span>
                      <span className="font-mono text-v2-ink">
                        {formatCurrency(
                          calculatedTargets.annualIncomeTarget +
                            calculatedTargets.annualExpenses,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">
                        ÷ Commission Rate
                      </span>
                      <span className="font-mono font-semibold text-v2-ink">
                        {(calculatedTargets.avgCommissionRate * 100).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="h-px bg-v2-ring my-1" />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted font-semibold">
                        = Premium Needed
                      </span>
                      <span className="font-mono font-bold text-v2-ink">
                        {formatCurrency(calculatedTargets.totalPremiumNeeded)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-v2-ring">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">Premium Needed</span>
                      <span className="font-mono text-v2-ink">
                        {formatCurrency(calculatedTargets.totalPremiumNeeded)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">÷ Avg Premium</span>
                      <span className="font-mono font-semibold text-v2-ink">
                        {formatCurrency(calculatedTargets.avgPolicyPremium)}
                      </span>
                    </div>
                    <div className="h-px bg-v2-ring my-1" />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted font-semibold">
                        = Policies Needed
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {calculatedTargets.annualPoliciesTarget} policies
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Section: Income & Policy Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Income Targets - Compact */}
              <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
                  NET Income Targets
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-v2-ink-muted">Annual</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-v2-ink">
                        {formatCurrency(calculatedTargets.annualIncomeTarget)}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          getProgressColor(
                            (actualMetrics.ytdIncome /
                              calculatedTargets.annualIncomeTarget) *
                              100,
                          ),
                        )}
                      >
                        ({formatCurrency(actualMetrics.ytdIncome)} YTD)
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-v2-ink-muted">Quarterly</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-v2-ink">
                        {formatCurrency(
                          calculatedTargets.quarterlyIncomeTarget,
                        )}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          getProgressColor(
                            (actualMetrics.qtdIncome /
                              calculatedTargets.quarterlyIncomeTarget) *
                              100,
                          ),
                        )}
                      >
                        ({formatCurrency(actualMetrics.qtdIncome)} QTD)
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-v2-ink-muted">Monthly</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-v2-ink">
                        {formatCurrency(calculatedTargets.monthlyIncomeTarget)}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          getProgressColor(
                            (actualMetrics.mtdIncome /
                              calculatedTargets.monthlyIncomeTarget) *
                              100,
                          ),
                        )}
                      >
                        ({formatCurrency(actualMetrics.mtdIncome)} MTD)
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-v2-ring my-1" />

                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Weekly</span>
                    <span className="font-mono text-v2-ink">
                      {formatCurrency(calculatedTargets.weeklyIncomeTarget)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Daily</span>
                    <span className="font-mono text-v2-ink">
                      {formatCurrency(calculatedTargets.dailyIncomeTarget)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Targets - Compact */}
              <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
                  Policy Targets
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-v2-ink-muted">Annual</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-v2-ink">
                        {calculatedTargets.annualPoliciesTarget}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          getProgressColor(
                            (actualMetrics.ytdPolicies /
                              calculatedTargets.annualPoliciesTarget) *
                              100,
                          ),
                        )}
                      >
                        ({actualMetrics.ytdPolicies} YTD)
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-v2-ink-muted">Quarterly</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-v2-ink">
                        {calculatedTargets.quarterlyPoliciesTarget}
                      </span>
                      <span className="font-mono text-[10px] text-v2-ink-subtle">
                        ({Math.floor(actualMetrics.ytdPolicies / 4)} avg)
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-v2-ink-muted">Monthly</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-v2-ink">
                        {calculatedTargets.monthlyPoliciesTarget}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          getProgressColor(
                            (actualMetrics.mtdPolicies /
                              calculatedTargets.monthlyPoliciesTarget) *
                              100,
                          ),
                        )}
                      >
                        ({actualMetrics.mtdPolicies} MTD)
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-v2-ring my-1" />

                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Weekly</span>
                    <span className="font-mono text-v2-ink">
                      {calculatedTargets.weeklyPoliciesTarget}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Daily</span>
                    <span className="font-mono text-v2-ink">
                      {calculatedTargets.dailyPoliciesTarget}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Expenses Breakdown, Metrics, Persistency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* Expense Breakdown - More Detail */}
              <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
                  Expense Analysis
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Monthly Target</span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(calculatedTargets.monthlyExpenseTarget)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">MTD Actual</span>
                    <span
                      className={cn(
                        "font-mono",
                        actualMetrics.mtdExpenses >
                          calculatedTargets.monthlyExpenseTarget
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {formatCurrency(actualMetrics.mtdExpenses)}
                    </span>
                  </div>
                  <div className="h-px bg-v2-ring my-1" />
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Annual Total</span>
                    <span className="font-mono text-v2-ink">
                      {formatCurrency(calculatedTargets.annualExpenses)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Expense Ratio</span>
                    <span className="font-mono font-bold text-v2-ink">
                      {formatPercent(calculatedTargets.expenseRatio * 100)}
                    </span>
                  </div>
                  <div className="h-px bg-v2-ring my-1" />
                  <div
                    className={cn(
                      "text-[10px]",
                      calculatedTargets.expenseRatio > 0.3
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {calculatedTargets.expenseRatio > 0.3
                      ? "⚠️ High expense ratio"
                      : "✓ Healthy expense ratio"}
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
                  Key Metrics
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted flex items-center gap-1">
                      Commission Rate
                      {commissionProfile?.dataQuality === "HIGH" && (
                        <span
                          className="text-[9px] text-emerald-600 dark:text-emerald-400"
                          title="Based on your sales mix - high confidence (20+ policies)"
                        >
                          ✓
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "MEDIUM" && (
                        <span
                          className="text-[9px] text-blue-600 dark:text-blue-400"
                          title="Based on limited sales data - moderate confidence (10-19 policies)"
                        >
                          ℹ️
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "LOW" && (
                        <span
                          className="text-[9px] text-amber-600 dark:text-amber-400"
                          title="Based on very limited sales data - low confidence (1-9 policies)"
                        >
                          ⚠
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "DEFAULT" && (
                        <span
                          className="text-[9px] text-amber-600 dark:text-amber-400"
                          title="Using default rate - no recent policies found"
                        >
                          ⚠
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "NONE" && (
                        <span
                          className="text-[9px] text-red-600 dark:text-red-400"
                          title="No commission data available"
                        >
                          ❌
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {(calculatedTargets.avgCommissionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Avg Premium</span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(calculatedTargets.avgPolicyPremium)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Current Avg</span>
                    <span
                      className={cn(
                        "font-mono",
                        actualMetrics.currentAvgPremium <
                          calculatedTargets.avgPolicyPremium
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {formatCurrency(actualMetrics.currentAvgPremium)}
                    </span>
                  </div>
                  <div className="h-px bg-v2-ring my-1" />
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Data Confidence</span>
                    <span
                      className={cn(
                        "font-semibold text-[10px]",
                        calculatedTargets.confidence === "high"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : calculatedTargets.confidence === "medium"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {calculatedTargets.confidence.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-v2-ink-muted">Method</span>
                    <span className="text-[10px] font-medium text-v2-ink">
                      {calculatedTargets.calculationMethod}
                    </span>
                  </div>
                  {commissionProfile?.dataQuality === "HIGH" && (
                    <div className="mt-2 pt-2 border-t border-v2-ring">
                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400">
                        ✓ Commission rate calculated from your sales mix (high
                        confidence)
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "MEDIUM" && (
                    <div className="mt-2 pt-2 border-t border-v2-ring">
                      <div className="text-[9px] text-blue-600 dark:text-blue-400">
                        ℹ️ Commission rate based on limited data. Add more
                        policies for better accuracy.
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "LOW" && (
                    <div className="mt-2 pt-2 border-t border-v2-ring">
                      <div className="text-[9px] text-amber-600 dark:text-amber-400">
                        ⚠ Commission rate based on very limited data. Add more
                        policies for accuracy.
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "DEFAULT" && (
                    <div className="mt-2 pt-2 border-t border-v2-ring">
                      <div className="text-[9px] text-amber-600 dark:text-amber-400">
                        ⚠ Commission rate is using defaults. Add policies to get
                        your actual rate.
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "NONE" && (
                    <div className="mt-2 pt-2 border-t border-v2-ring">
                      <div className="text-[9px] text-red-600 dark:text-red-400">
                        ❌ No commission data available. Contact admin to
                        configure rates.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Persistency */}
              <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
                  Persistency Rates
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">13-Month Target</span>
                      <span className="font-mono text-v2-ink">
                        {formatPercent(
                          calculatedTargets.persistency13MonthTarget * 100,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">13-Month Actual</span>
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          getProgressColor(
                            (actualMetrics.persistency13Month /
                              calculatedTargets.persistency13MonthTarget) *
                              100,
                          ),
                        )}
                      >
                        {formatPercent(actualMetrics.persistency13Month * 100)}
                      </span>
                    </div>
                  </div>
                  <div className="h-px bg-v2-ring my-1" />
                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">25-Month Target</span>
                      <span className="font-mono text-v2-ink">
                        {formatPercent(
                          calculatedTargets.persistency25MonthTarget * 100,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-v2-ink-muted">25-Month Actual</span>
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          getProgressColor(
                            (actualMetrics.persistency25Month /
                              calculatedTargets.persistency25MonthTarget) *
                              100,
                          ),
                        )}
                      >
                        {formatPercent(actualMetrics.persistency25Month * 100)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What-If Persistency Scenarios */}
            <PersistencyScenarios
              baseAnnualPolicies={calculatedTargets.annualPoliciesTarget}
              totalPremiumNeeded={calculatedTargets.totalPremiumNeeded}
              avgPolicyPremium={calculatedTargets.avgPolicyPremium}
              currentPersistency={actualMetrics.persistency13Month || 0.85}
              avgCommissionRate={calculatedTargets.avgCommissionRate}
              annualIncomeTarget={calculatedTargets.annualIncomeTarget}
              monthlyExpenseTarget={calculatedTargets.monthlyExpenseTarget}
            />

            {/* Validation Warnings - Compact */}
            {(() => {
              const validation = targetsCalculationService.validateTargets(
                calculatedTargets,
                averages.hasData ? averages : undefined,
              );

              if (
                validation.warnings.length > 0 ||
                validation.recommendations.length > 0
              ) {
                return (
                  <div className="bg-v2-accent-soft border border-v2-accent-strong/20 rounded-lg p-2 flex items-start gap-2">
                    <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-0.5">
                      {validation.warnings.map((warning, i) => (
                        <p
                          key={i}
                          className="text-[11px] font-medium text-amber-700 dark:text-amber-300"
                        >
                          {warning}
                        </p>
                      ))}
                      {validation.recommendations.map((rec, i) => (
                        <p
                          key={i}
                          className="text-[10px] text-amber-600 dark:text-amber-400"
                        >
                          {rec}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      {/* Target Input Dialog */}
      <TargetInputDialog
        open={showInputDialog}
        onClose={() => setShowInputDialog(false)}
        onSave={handleSaveTarget}
        currentTarget={annualTarget}
        isFirstTime={isFirstTime}
      />
    </>
  );
}
