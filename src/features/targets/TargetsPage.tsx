// src/features/targets/TargetsPage.tsx

import { useState, useEffect, useRef } from "react";
import {
  useTargets,
  useUpdateTargets,
  useActualMetrics,
} from "../../hooks/targets";
import { useHistoricalAverages } from "../../hooks/targets/useHistoricalAverages";
import { useUserCommissionProfile } from "../../hooks/commissions/useUserCommissionProfile";
import { Input } from "@/components/ui/input";
import { PillButton } from "@/components/v2";
import {
  Edit2,
  Target,
  AlertCircle,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "../../lib/format";
import { toast } from "sonner";
import {
  targetsCalculationService,
  DEFAULT_REALISM_OPTIONS,
  type RealismOptions,
} from "../../services/targets/targetsCalculationService";
import { TargetInputDialog } from "./components/TargetInputDialog";
import { PersistencyScenarios } from "./components/PersistencyScenarios";
import { WelcomeTargetCard } from "./components/WelcomeTargetCard";

/**
 * Number input for a 0–100 percent value backed by a 0–1 decimal in parent
 * state. Holds its own local string state so the user can fully clear the
 * field while editing — controlled-input parsing (`parseFloat("")` → NaN)
 * would otherwise refuse to commit an empty string and the last char would
 * pop right back in. On blur, falls back to the parent's saved value if
 * the string is empty or out of range.
 */
function PercentInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  "aria-label": ariaLabel,
}: {
  value: number; // decimal 0-1
  onChange: (next: number) => void; // decimal 0-1
  min: number; // percent (e.g. 0)
  max: number; // percent (e.g. 100)
  step?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [local, setLocal] = useState(() => (value * 100).toFixed(0));
  const isFocusedRef = useRef(false);

  // Sync from parent only while NOT focused, so external resets (e.g. the
  // "Reset to defaults" button or DB hydration) propagate without stomping
  // on in-flight typing.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocal((value * 100).toFixed(0));
    }
  }, [value]);

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={local}
      aria-label={ariaLabel}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        const str = e.target.value;
        setLocal(str); // always reflect what user typed, including ""
        if (str === "") return; // allow temporary empty state
        const v = parseFloat(str);
        if (!isNaN(v) && v >= min && v <= max) {
          onChange(v / 100);
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        const v = parseFloat(local);
        if (isNaN(v) || v < min || v > max) {
          setLocal((value * 100).toFixed(0));
        } else {
          setLocal((value * 100).toFixed(0));
        }
      }}
      className={className}
    />
  );
}

export function TargetsPage() {
  const { data: targets, isLoading, error } = useTargets();
  const actualMetrics = useActualMetrics();
  const updateTargets = useUpdateTargets();
  const { averages, isLoading: averagesLoading } = useHistoricalAverages();
  const { data: commissionProfile } = useUserCommissionProfile();

  const [showInputDialog, setShowInputDialog] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineEditValue, setInlineEditValue] = useState<string>("");

  // Realism knobs — initialized from defaults, hydrated from saved DB values
  // once `targets` loads, then user edits flow forward to DB via debounced save.
  const historicalPersistency =
    averages.hasData && averages.persistency13Month > 0
      ? averages.persistency13Month
      : DEFAULT_REALISM_OPTIONS.persistencyRate;
  const [realism, setRealism] = useState<RealismOptions>({
    persistencyRate: historicalPersistency,
    taxReserveRate: DEFAULT_REALISM_OPTIONS.taxReserveRate,
    ntoBufferRate: DEFAULT_REALISM_OPTIONS.ntoBufferRate,
    premiumStat: DEFAULT_REALISM_OPTIONS.premiumStat,
  });
  const knobsHydratedRef = useRef(false);

  // Hydrate realism state from saved DB targets on first load. The ref guard
  // prevents the post-mutation refetch from clobbering in-flight user edits.
  useEffect(() => {
    if (!targets || knobsHydratedRef.current) return;
    setRealism({
      persistencyRate: targets.persistencyAssumption,
      taxReserveRate: targets.taxReserveRate,
      ntoBufferRate: targets.ntoBufferRate,
      premiumStat: targets.premiumStatPreference,
    });
    knobsHydratedRef.current = true;
  }, [targets]);

  // Debounce-save knob changes to DB so all dashboard surfaces see the same
  // realistic plan. 500ms settle window keeps number-input typing smooth.
  useEffect(() => {
    if (!knobsHydratedRef.current) return;
    const timer = setTimeout(() => {
      updateTargets.mutate({
        persistencyAssumption: realism.persistencyRate,
        taxReserveRate: realism.taxReserveRate,
        ntoBufferRate: realism.ntoBufferRate,
        premiumStatPreference: realism.premiumStat,
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateTargets is a stable mutation hook; we only want to fire on knob changes
  }, [
    realism.persistencyRate,
    realism.taxReserveRate,
    realism.ntoBufferRate,
    realism.premiumStat,
  ]);

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
          realism,
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
        <div className="text-muted-foreground text-sm">Loading targets…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-destructive text-sm">Error: {error.message}</div>
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
              <Target className="h-4 w-4 text-foreground" />
              <h1 className="text-base font-semibold tracking-tight text-foreground">
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

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "text-success";
    if (progress >= 75) return "text-info";
    if (progress >= 50) return "text-warning";
    return "text-destructive";
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Compact header — title + inline annual target chip + edit */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Target className="h-4 w-4 text-foreground" />
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Income Targets {targetYear}
              </h1>
            </div>
            <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground flex-wrap leading-tight">
              <span>
                Based on{" "}
                <span className="text-foreground font-semibold">
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
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                  NET Annual Target
                </div>
                <div className="text-base font-semibold font-mono text-foreground">
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
                className="w-32 h-8 text-sm font-bold bg-card border-border focus-visible:ring-accent rounded-v2-pill"
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
            {/* Realism Knobs — tune the assumptions that drive the Realistic plan */}
            <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                    Realism Settings
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Explain realism settings"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[360px] p-3">
                      <div className="text-[11px] leading-relaxed space-y-1.5">
                        <div className="font-semibold text-foreground">
                          Why two plans?
                        </div>
                        <p className="text-muted-foreground">
                          The Optimistic plan is the raw math: gross commission
                          ÷ first-year rate ÷ avg premium. It assumes every
                          policy sticks, no taxes, and every app issues.
                        </p>
                        <p className="text-muted-foreground">
                          The Realistic plan applies four haircuts so the
                          headline target reflects what you actually need to do
                          to take home your goal:
                        </p>
                        <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                          <li>
                            <strong>Persistency</strong> — share of policies
                            that stick. Rate × persistency = effective comp.
                          </li>
                          <li>
                            <strong>Tax reserve</strong> — gross-up so your
                            "NET" target is actual take-home, not pre-tax.
                          </li>
                          <li>
                            <strong>NTO drag</strong> — apps that don't issue.
                            Apps to write = issued × (1 + drag).
                          </li>
                          <li>
                            <strong>Premium stat</strong> — median is robust
                            against one big case skewing the avg.
                          </li>
                        </ul>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() =>
                    setRealism({
                      persistencyRate: historicalPersistency,
                      taxReserveRate: DEFAULT_REALISM_OPTIONS.taxReserveRate,
                      ntoBufferRate: DEFAULT_REALISM_OPTIONS.ntoBufferRate,
                      premiumStat: DEFAULT_REALISM_OPTIONS.premiumStat,
                    })
                  }
                >
                  Reset to defaults
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Persistency
                    {averages.hasData && averages.persistency13Month > 0 && (
                      <span className="text-[9px] text-muted-foreground/70 ml-1">
                        (13-mo: {(averages.persistency13Month * 100).toFixed(0)}
                        %)
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <PercentInput
                      min={30}
                      max={100}
                      value={realism.persistencyRate}
                      onChange={(v) =>
                        setRealism((r) => ({ ...r, persistencyRate: v }))
                      }
                      aria-label="Persistency percent"
                      className="h-7 text-[11px] font-mono px-2"
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                </label>

                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Tax Reserve
                  </span>
                  <div className="flex items-center gap-1">
                    <PercentInput
                      min={0}
                      max={70}
                      value={realism.taxReserveRate}
                      onChange={(v) =>
                        setRealism((r) => ({ ...r, taxReserveRate: v }))
                      }
                      aria-label="Tax reserve percent"
                      className="h-7 text-[11px] font-mono px-2"
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                </label>

                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    NTO Drag
                  </span>
                  <div className="flex items-center gap-1">
                    <PercentInput
                      min={0}
                      max={50}
                      value={realism.ntoBufferRate}
                      onChange={(v) =>
                        setRealism((r) => ({ ...r, ntoBufferRate: v }))
                      }
                      aria-label="NTO drag percent"
                      className="h-7 text-[11px] font-mono px-2"
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                </label>

                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Premium Stat
                  </span>
                  <div className="flex h-7 rounded-v2-pill border border-border overflow-hidden">
                    <button
                      type="button"
                      className={cn(
                        "flex-1 text-[10px] font-medium transition-colors",
                        realism.premiumStat === "median"
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() =>
                        setRealism((r) => ({ ...r, premiumStat: "median" }))
                      }
                    >
                      Median
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex-1 text-[10px] font-medium transition-colors border-l border-border",
                        realism.premiumStat === "mean"
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() =>
                        setRealism((r) => ({ ...r, premiumStat: "mean" }))
                      }
                    >
                      Mean
                    </button>
                  </div>
                </label>
              </div>
            </div>

            {/* Side-by-side: Optimistic vs Realistic plans */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {/* Optimistic Plan — Gross Math (existing breakdown rebranded) */}
              <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                    Optimistic Plan — Gross Math
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    No persistency / tax / NTO haircuts
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          NET Income Target (Pre-Tax)
                        </span>
                        <span className="font-mono font-bold text-success">
                          {formatCurrency(calculatedTargets.annualIncomeTarget)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          + Annual Expenses
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground transition-colors"
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
                                <div className="font-semibold text-foreground mb-1.5">
                                  Annual Expenses Breakdown
                                </div>
                                <div className="text-muted-foreground mb-2">
                                  Year {new Date().getFullYear()} • projected
                                  from recurring definitions + one-time rows
                                </div>

                                {averages.annualExpenseBreakdown.recurring
                                  .length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
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
                                              className="text-foreground truncate"
                                              title={g.name}
                                            >
                                              {g.name}
                                            </span>
                                            <span className="font-mono text-muted-foreground whitespace-nowrap">
                                              {formatCurrency(g.latestAmount)} ×{" "}
                                              {g.occurrences} {g.frequency}
                                              {g.endDate
                                                ? ` (ends ${g.endDate})`
                                                : ""}{" "}
                                              ={" "}
                                              <span className="text-foreground font-semibold">
                                                {formatCurrency(g.total)}
                                              </span>
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {averages.annualExpenseBreakdown.oneTime
                                  .length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
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
                                              className="text-foreground truncate"
                                              title={e.name}
                                            >
                                              {e.name}{" "}
                                              <span className="text-muted-foreground">
                                                ({e.date})
                                              </span>
                                            </span>
                                            <span className="font-mono text-foreground font-semibold whitespace-nowrap">
                                              {formatCurrency(e.amount)}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                                  <span className="text-foreground">Total</span>
                                  <span className="font-mono text-foreground">
                                    {formatCurrency(
                                      averages.annualExpenseBreakdown.total,
                                    )}
                                  </span>
                                </div>

                                {averages.annualExpenseBreakdown.recurring
                                  .length === 0 &&
                                  averages.annualExpenseBreakdown.oneTime
                                    .length === 0 && (
                                    <div className="text-muted-foreground">
                                      No expenses recorded for this year.
                                    </div>
                                  )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </span>
                        <span className="font-mono text-foreground">
                          {formatCurrency(calculatedTargets.annualExpenses)}
                        </span>
                      </div>
                      <div className="h-px bg-muted my-1" />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-semibold">
                          = GROSS Commission Needed
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(
                            calculatedTargets.annualIncomeTarget +
                              calculatedTargets.annualExpenses,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Gross Commission
                        </span>
                        <span className="font-mono text-foreground">
                          {formatCurrency(
                            calculatedTargets.annualIncomeTarget +
                              calculatedTargets.annualExpenses,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          ÷ Commission Rate
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Show commission rate breakdown"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-[380px] p-3"
                            >
                              <div className="text-[11px]">
                                <div className="font-semibold text-foreground mb-1.5">
                                  Commission Rate Breakdown
                                </div>
                                <div className="space-y-0.5 mb-2">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Contract Level
                                    </span>
                                    <span className="font-mono text-foreground font-semibold">
                                      {commissionProfile?.contractLevel ?? "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Premium-Weighted Avg
                                    </span>
                                    <span className="font-mono text-foreground">
                                      {commissionProfile
                                        ? `${(commissionProfile.weightedAverageRate * 100).toFixed(1)}%`
                                        : "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Simple Avg (across products)
                                    </span>
                                    <span className="font-mono text-foreground">
                                      {commissionProfile
                                        ? `${(commissionProfile.simpleAverageRate * 100).toFixed(1)}%`
                                        : "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Data Quality
                                    </span>
                                    <span className="font-mono text-foreground uppercase">
                                      {commissionProfile?.dataQuality ?? "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                                    <span className="text-foreground font-semibold">
                                      Used for Targets
                                    </span>
                                    <span className="font-mono font-bold text-foreground">
                                      {(
                                        calculatedTargets.avgCommissionRate *
                                        100
                                      ).toFixed(1)}
                                      %
                                    </span>
                                  </div>
                                </div>

                                {commissionProfile?.productBreakdown &&
                                commissionProfile.productBreakdown.length >
                                  0 ? (
                                  <>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-2">
                                      Per Product (last{" "}
                                      {commissionProfile.lookbackMonths} mo)
                                    </div>
                                    <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                                      {commissionProfile.productBreakdown.map(
                                        (p) => (
                                          <div
                                            key={p.productId}
                                            className="flex justify-between gap-2"
                                          >
                                            <span
                                              className="text-foreground truncate"
                                              title={`${p.productName} • ${p.carrierName}`}
                                            >
                                              {p.productName}
                                            </span>
                                            <span className="font-mono text-muted-foreground whitespace-nowrap">
                                              {(p.commissionRate * 100).toFixed(
                                                1,
                                              )}
                                              %
                                              <span className="text-muted-foreground">
                                                {" "}
                                                ·{" "}
                                                {(
                                                  p.premiumWeight * 100
                                                ).toFixed(0)}
                                                % wt · {p.policyCount}p
                                              </span>
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-muted-foreground text-[10px] mt-1">
                                    No per-product mix data — rate is the
                                    carrier base for your contract level.
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {(calculatedTargets.avgCommissionRate * 100).toFixed(
                            1,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-px bg-muted my-1" />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-semibold">
                          = Premium Needed
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(calculatedTargets.totalPremiumNeeded)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Premium Needed
                        </span>
                        <span className="font-mono text-foreground">
                          {formatCurrency(calculatedTargets.totalPremiumNeeded)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          ÷ Avg Premium
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Show avg premium breakdown"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-[400px] p-3"
                            >
                              <div className="text-[11px]">
                                <div className="font-semibold text-foreground mb-1.5">
                                  Avg Premium Breakdown
                                </div>
                                <div className="text-muted-foreground mb-2">
                                  {(() => {
                                    const b =
                                      averages.avgPolicyPremiumBreakdown;
                                    switch (b.source) {
                                      case "current-year":
                                        return `Mean of ${b.policyCount} ${b.policyCount === 1 ? "policy" : "policies"} written this year`;
                                      case "active-policies-fallback":
                                        return `No policies yet this year — using ${b.policyCount} active ${b.policyCount === 1 ? "policy" : "policies"} (fallback)`;
                                      case "all-policies-fallback":
                                        return `Using ${b.policyCount} total ${b.policyCount === 1 ? "policy" : "policies"} (fallback — no current-year or active data)`;
                                      case "no-data":
                                        return "No policy data yet.";
                                    }
                                  })()}
                                </div>

                                {averages.avgPolicyPremiumBreakdown
                                  .policyCount > 0 && (
                                  <>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Mean
                                        </span>
                                        <span className="font-mono text-foreground font-semibold">
                                          {formatCurrency(
                                            averages.avgPolicyPremiumBreakdown
                                              .mean,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Median
                                        </span>
                                        <span className="font-mono text-foreground">
                                          {formatCurrency(
                                            averages.avgPolicyPremiumBreakdown
                                              .median,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Min
                                        </span>
                                        <span className="font-mono text-foreground">
                                          {formatCurrency(
                                            averages.avgPolicyPremiumBreakdown
                                              .min,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Max
                                        </span>
                                        <span className="font-mono text-foreground">
                                          {formatCurrency(
                                            averages.avgPolicyPremiumBreakdown
                                              .max,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    {Math.abs(
                                      averages.avgPolicyPremiumBreakdown.mean -
                                        averages.avgPolicyPremiumBreakdown
                                          .median,
                                    ) /
                                      Math.max(
                                        averages.avgPolicyPremiumBreakdown
                                          .median,
                                        1,
                                      ) >
                                      0.25 && (
                                      <div className="text-warning text-[10px] mb-2">
                                        ⚠ Mean is {">"}25% above median — your
                                        target is being driven by a few large
                                        outliers. Consider using median for
                                        planning.
                                      </div>
                                    )}

                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                      Policies (largest first)
                                    </div>
                                    <div className="space-y-0.5 max-h-[220px] overflow-y-auto">
                                      {averages.avgPolicyPremiumBreakdown.policies.map(
                                        (p) => (
                                          <div
                                            key={p.id}
                                            className="flex justify-between gap-2"
                                          >
                                            <span
                                              className="text-foreground truncate"
                                              title={`${p.clientName} • ${p.productName} • ${p.effectiveDate}`}
                                            >
                                              {p.clientName}{" "}
                                              <span className="text-muted-foreground">
                                                ({p.productName})
                                              </span>
                                            </span>
                                            <span className="font-mono text-foreground font-semibold whitespace-nowrap">
                                              {formatCurrency(p.annualPremium)}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatCurrency(calculatedTargets.avgPolicyPremium)}
                        </span>
                      </div>
                      <div className="h-px bg-muted my-1" />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-semibold">
                          = Policies Needed
                        </span>
                        <span className="font-mono font-bold text-info">
                          {calculatedTargets.annualPoliciesTarget} policies
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Realistic Plan — Take-Home Math (with persistency, taxes, NTO) */}
              <div className="bg-card rounded-v2-md border-2 border-warning/40 shadow-v2-soft p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-semibold text-warning uppercase tracking-[0.18em]">
                    Realistic Plan — Take-Home Math
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    Persistency × tax × NTO applied
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1: Take-Home → Realistic Gross */}
                  <div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Actual Take-Home Goal
                        </span>
                        <span className="font-mono font-bold text-success">
                          {formatCurrency(calculatedTargets.annualIncomeTarget)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          + Tax Reserve (
                          {(realism.taxReserveRate * 100).toFixed(0)}%)
                        </span>
                        <span className="font-mono text-warning">
                          {formatCurrency(calculatedTargets.taxReserveAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          + Annual Expenses
                        </span>
                        <span className="font-mono text-foreground">
                          {formatCurrency(calculatedTargets.annualExpenses)}
                        </span>
                      </div>
                      <div className="h-px bg-muted my-1" />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-semibold">
                          = Realistic Gross Needed
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(
                            calculatedTargets.realisticGrossCommissionNeeded,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: ÷ Effective Rate → Realistic Premium */}
                  <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Realistic Gross
                        </span>
                        <span className="font-mono text-foreground">
                          {formatCurrency(
                            calculatedTargets.realisticGrossCommissionNeeded,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          ÷ Effective Rate
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Explain effective rate"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-[320px] p-3"
                            >
                              <div className="text-[11px] space-y-1">
                                <div className="font-semibold text-foreground">
                                  Effective Commission Rate
                                </div>
                                <div className="font-mono text-muted-foreground">
                                  First-year rate ×&nbsp;persistency
                                </div>
                                <div className="font-mono text-foreground">
                                  {(
                                    calculatedTargets.avgCommissionRate * 100
                                  ).toFixed(1)}
                                  % ×&nbsp;
                                  {(realism.persistencyRate * 100).toFixed(0)}%
                                  =&nbsp;
                                  <strong>
                                    {(
                                      calculatedTargets.effectiveCommissionRate *
                                      100
                                    ).toFixed(1)}
                                    %
                                  </strong>
                                </div>
                                <p className="text-muted-foreground pt-1">
                                  Policies that lapse in year 1 contribute ~zero
                                  durable income (chargeback). Multiplying by
                                  persistency converts the first-year comp rate
                                  into the share you keep.
                                </p>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </span>
                        <span className="font-mono font-semibold text-warning">
                          {(
                            calculatedTargets.effectiveCommissionRate * 100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="h-px bg-muted my-1" />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-semibold">
                          = Realistic Premium
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(
                            calculatedTargets.realisticTotalPremiumNeeded,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: ÷ Avg Premium → Issued Policies → Apps to Write */}
                  <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Realistic Premium
                        </span>
                        <span className="font-mono text-foreground">
                          {formatCurrency(
                            calculatedTargets.realisticTotalPremiumNeeded,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          ÷ Avg Premium ({realism.premiumStat})
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatCurrency(calculatedTargets.avgPolicyPremium)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          = Policies Issued
                        </span>
                        <span className="font-mono text-foreground">
                          {calculatedTargets.realisticAnnualPoliciesIssued}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          × (1 + {(realism.ntoBufferRate * 100).toFixed(0)}%
                          NTO)
                        </span>
                        <span className="font-mono text-warning">
                          ×{(1 + realism.ntoBufferRate).toFixed(2)}
                        </span>
                      </div>
                      <div className="h-px bg-muted my-1" />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-warning font-semibold">
                          = Apps to Write
                        </span>
                        <span className="font-mono font-bold text-warning">
                          {calculatedTargets.realisticAnnualAppsToWrite} apps
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: Realistic vs Optimistic delta callout */}
                {calculatedTargets.realisticVsOptimisticDelta > 0 && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">
                      Realistic vs Optimistic
                    </span>
                    <span className="font-mono text-warning">
                      +{calculatedTargets.realisticVsOptimisticDelta} apps/year
                      (
                      {(
                        (calculatedTargets.realisticVsOptimisticDelta /
                          Math.max(calculatedTargets.annualPoliciesTarget, 1)) *
                        100
                      ).toFixed(0)}
                      % more than the gross math suggests)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Top Section: Income & Policy Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Income Targets - Compact */}
              <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2">
                  NET Income Targets
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Annual</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
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
                    <span className="text-muted-foreground">Quarterly</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
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
                    <span className="text-muted-foreground">Monthly</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
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

                  <div className="h-px bg-muted my-1" />

                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Weekly</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(calculatedTargets.weeklyIncomeTarget)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Daily</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(calculatedTargets.dailyIncomeTarget)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Targets - Optimistic vs Realistic side-by-side */}
              <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-4">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                    Policy Targets
                  </div>
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
                    Optimistic
                  </div>
                  <div className="text-[9px] font-semibold text-warning uppercase tracking-wider text-right">
                    Realistic
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    Annual
                  </span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-mono font-bold text-foreground text-[11px]">
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
                  <span className="font-mono font-bold text-warning text-[11px] text-right">
                    {calculatedTargets.realisticAnnualAppsToWrite}
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    Quarterly
                  </span>
                  <span className="font-mono font-bold text-foreground text-[11px] text-right">
                    {calculatedTargets.quarterlyPoliciesTarget}
                  </span>
                  <span className="font-mono font-bold text-warning text-[11px] text-right">
                    {calculatedTargets.realisticQuarterlyAppsToWrite}
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    Monthly
                  </span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-mono font-bold text-foreground text-[11px]">
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
                  <span className="font-mono font-bold text-warning text-[11px] text-right">
                    {calculatedTargets.realisticMonthlyAppsToWrite}
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    Weekly
                  </span>
                  <span className="font-mono text-foreground text-[11px] text-right">
                    {calculatedTargets.weeklyPoliciesTarget}
                  </span>
                  <span className="font-mono text-warning text-[11px] text-right">
                    {calculatedTargets.realisticWeeklyAppsToWrite}
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    Daily
                  </span>
                  <span className="font-mono text-foreground text-[11px] text-right">
                    {calculatedTargets.dailyPoliciesTarget}
                  </span>
                  <span className="font-mono text-warning text-[11px] text-right">
                    {calculatedTargets.realisticDailyAppsToWrite}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
                  <span className="text-muted-foreground">Optimistic =</span>{" "}
                  policies issued (gross math).{" "}
                  <span className="text-warning">Realistic =</span> apps to
                  write to take home the goal after persistency, taxes & NTO.
                </div>
              </div>
            </div>

            {/* Bottom Section: Expenses Breakdown, Metrics, Persistency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* Expense Breakdown - More Detail */}
              <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2">
                  Expense Analysis
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Monthly Target
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatCurrency(calculatedTargets.monthlyExpenseTarget)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">MTD Actual</span>
                    <span
                      className={cn(
                        "font-mono",
                        actualMetrics.mtdExpenses >
                          calculatedTargets.monthlyExpenseTarget
                          ? "text-destructive"
                          : "text-success",
                      )}
                    >
                      {formatCurrency(actualMetrics.mtdExpenses)}
                    </span>
                  </div>
                  <div className="h-px bg-muted my-1" />
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Annual Total</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(calculatedTargets.annualExpenses)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Expense Ratio</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatPercent(calculatedTargets.expenseRatio * 100)}
                    </span>
                  </div>
                  <div className="h-px bg-muted my-1" />
                  <div
                    className={cn(
                      "text-[10px]",
                      calculatedTargets.expenseRatio > 0.3
                        ? "text-warning"
                        : "text-success",
                    )}
                  >
                    {calculatedTargets.expenseRatio > 0.3
                      ? "⚠️ High expense ratio"
                      : "✓ Healthy expense ratio"}
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2">
                  Key Metrics
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Commission Rate
                      {commissionProfile?.dataQuality === "HIGH" && (
                        <span
                          className="text-[9px] text-success"
                          title="Based on your sales mix - high confidence (20+ policies)"
                        >
                          ✓
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "MEDIUM" && (
                        <span
                          className="text-[9px] text-info"
                          title="Based on limited sales data - moderate confidence (10-19 policies)"
                        >
                          ℹ️
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "LOW" && (
                        <span
                          className="text-[9px] text-warning"
                          title="Based on very limited sales data - low confidence (1-9 policies)"
                        >
                          ⚠
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "DEFAULT" && (
                        <span
                          className="text-[9px] text-warning"
                          title="Using default rate - no recent policies found"
                        >
                          ⚠
                        </span>
                      )}
                      {commissionProfile?.dataQuality === "NONE" && (
                        <span
                          className="text-[9px] text-destructive"
                          title="No commission data available"
                        >
                          ❌
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {(calculatedTargets.avgCommissionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Avg Premium</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatCurrency(calculatedTargets.avgPolicyPremium)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Current Avg</span>
                    <span
                      className={cn(
                        "font-mono",
                        actualMetrics.currentAvgPremium <
                          calculatedTargets.avgPolicyPremium
                          ? "text-warning"
                          : "text-success",
                      )}
                    >
                      {formatCurrency(actualMetrics.currentAvgPremium)}
                    </span>
                  </div>
                  <div className="h-px bg-muted my-1" />
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Data Confidence
                    </span>
                    <span
                      className={cn(
                        "font-semibold text-[10px]",
                        calculatedTargets.confidence === "high"
                          ? "text-success"
                          : calculatedTargets.confidence === "medium"
                            ? "text-warning"
                            : "text-destructive",
                      )}
                    >
                      {calculatedTargets.confidence.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Method</span>
                    <span className="text-[10px] font-medium text-foreground">
                      {calculatedTargets.calculationMethod}
                    </span>
                  </div>
                  {commissionProfile?.dataQuality === "HIGH" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-[9px] text-success">
                        ✓ Commission rate calculated from your sales mix (high
                        confidence)
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "MEDIUM" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-[9px] text-info">
                        ℹ️ Commission rate based on limited data. Add more
                        policies for better accuracy.
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "LOW" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-[9px] text-warning">
                        ⚠ Commission rate based on very limited data. Add more
                        policies for accuracy.
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "DEFAULT" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-[9px] text-warning">
                        ⚠ Commission rate is using defaults. Add policies to get
                        your actual rate.
                      </div>
                    </div>
                  )}
                  {commissionProfile?.dataQuality === "NONE" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-[9px] text-destructive">
                        ❌ No commission data available. Contact admin to
                        configure rates.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Persistency */}
              <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-4">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2">
                  Persistency Rates
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        13-Month Target
                      </span>
                      <span className="font-mono text-foreground">
                        {formatPercent(
                          calculatedTargets.persistency13MonthTarget * 100,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        13-Month Actual
                      </span>
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
                  <div className="h-px bg-muted my-1" />
                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        25-Month Target
                      </span>
                      <span className="font-mono text-foreground">
                        {formatPercent(
                          calculatedTargets.persistency25MonthTarget * 100,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        25-Month Actual
                      </span>
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
                  <div className="bg-accent/40 border border-accent/20 rounded-lg p-2 flex items-start gap-2">
                    <AlertCircle className="h-3 w-3 text-warning mt-0.5 flex-shrink-0" />
                    <div className="space-y-0.5">
                      {validation.warnings.map((warning, i) => (
                        <p
                          key={i}
                          className="text-[11px] font-medium text-warning"
                        >
                          {warning}
                        </p>
                      ))}
                      {validation.recommendations.map((rec, i) => (
                        <p key={i} className="text-[10px] text-warning">
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
