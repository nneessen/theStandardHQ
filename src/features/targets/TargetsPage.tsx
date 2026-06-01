// src/features/targets/TargetsPage.tsx
// Re-skinned to "The Board" charcoal design system.
// ALL logic, hooks, computed values, Popover contents, and validation are
// preserved verbatim — only presentational chrome changed.

import { useState, useEffect, useRef } from "react";
import {
  useTargets,
  useUpdateTargets,
  useActualMetrics,
} from "../../hooks/targets";
import { useHistoricalAverages } from "../../hooks/targets/useHistoricalAverages";
import { useUserCommissionProfile } from "../../hooks/commissions/useUserCommissionProfile";
import { Input } from "@/components/ui/input";
import { PillButton, SectionShell } from "@/components/v2";
import {
  Edit2,
  AlertCircle,
  Info,
  SlidersHorizontal,
  Target,
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
import { WelcomeTargetCard } from "./components/WelcomeTargetCard";
import {
  Board,
  Cap,
  Pill,
  FlapTile,
  RadialProgress,
  AnimatedNumber,
  Bar,
  T,
} from "@/components/board";

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

// ── Board token colour helpers (replaces Tailwind semantic classes) ───────────
// Maps getProgressColor's 0-100 pct to board token colours for inline styles.
function progressColor(pct100: number): string {
  if (pct100 >= 100) return T.green;
  if (pct100 >= 75) return T.blue;
  if (pct100 >= 50) return T.amber;
  return T.red;
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
      <SectionShell className="dashboard-canvas">
        <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
          <div
            style={{
              font: `500 13px ${T.data}`,
              color: T.mut,
              textAlign: "center",
              paddingTop: 64,
              paddingBottom: 64,
            }}
          >
            Loading targets…
          </div>
        </div>
      </SectionShell>
    );
  }

  if (error) {
    return (
      <SectionShell className="dashboard-canvas">
        <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
          <div
            style={{
              font: `500 13px ${T.data}`,
              color: T.red,
              textAlign: "center",
              paddingTop: 64,
              paddingBottom: 64,
            }}
          >
            Error: {error.message}
          </div>
        </div>
      </SectionShell>
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
      <SectionShell className="dashboard-canvas">
        <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Board-style header */}
            <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Target style={{ width: 16, height: 16, color: T.blue }} />
              <Cap style={{ fontSize: 12 }}>INCOME PLAN</Cap>
              <h1
                style={{
                  font: `800 24px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                INCOME TARGETS {targetYear}
              </h1>
            </header>
            <Board pad={20}>
              <WelcomeTargetCard
                targetYear={targetYear}
                onGetStarted={() => setShowInputDialog(true)}
              />
            </Board>
          </div>
        </div>
        <TargetInputDialog
          open={showInputDialog}
          onClose={() => setShowInputDialog(false)}
          onSave={handleSaveTarget}
          currentTarget={annualTarget}
          isFirstTime={isFirstTime}
        />
      </SectionShell>
    );
  }

  // ── Hero band data ──────────────────────────────────────────────────────────
  const ytdPct =
    calculatedTargets.annualIncomeTarget > 0
      ? Math.min(
          actualMetrics.ytdIncome / calculatedTargets.annualIncomeTarget,
          1,
        )
      : 0;
  const ringTone =
    ytdPct >= 1
      ? "green"
      : ytdPct >= 0.75
        ? "blue"
        : ytdPct >= 0.5
          ? "amber"
          : "red";

  const confidenceTone =
    calculatedTargets.confidence === "high"
      ? "green"
      : calculatedTargets.confidence === "medium"
        ? "amber"
        : "red";

  // ── Validation (unchanged logic) ───────────────────────────────────────────
  const validation = targetsCalculationService.validateTargets(
    calculatedTargets,
    averages.hasData ? averages : undefined,
  );

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ── Page Header ─────────────────────────────────────────────────── */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {/* Left: eyebrow + title + data-basis subtitle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>INCOME PLAN</Cap>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <h1
                  style={{
                    font: `800 26px ${T.disp}`,
                    color: T.ink,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    margin: 0,
                  }}
                >
                  INCOME TARGETS {targetYear}
                </h1>
                <span
                  style={{
                    font: `500 12px ${T.data}`,
                    color: T.mut,
                  }}
                >
                  Based on{" "}
                  <span style={{ color: T.ink, fontWeight: 600 }}>
                    {calculatedTargets.calculationMethod === "historical"
                      ? "your historical data"
                      : "industry averages"}
                  </span>
                </span>
              </div>
            </div>

            {/* Right: inline annual target edit */}
            {!isEditingInline ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                  <Cap>NET Annual Target</Cap>
                  <div
                    style={{
                      font: `700 15px ${T.disp}`,
                      color: T.cream,
                      fontVariantNumeric: "tabular-nums",
                      marginTop: 2,
                    }}
                  >
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
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

          {/* ── Hero Band ───────────────────────────────────────────────────── */}
          <Board
            pad={26}
            rivets
            style={{
              background: `radial-gradient(130% 180% at 0% 0%, rgba(91,155,255,0.12), rgba(91,155,255,0.01)), ${T.panelGradient}`,
              border: "1px solid rgba(91,155,255,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 32,
                alignItems: "center",
              }}
            >
              {/* Radial ring: YTD income / annual target */}
              <div style={{ flexShrink: 0 }}>
                <RadialProgress
                  pct={ytdPct}
                  size={190}
                  thickness={16}
                  tone={ringTone}
                  caption="OF ANNUAL GOAL"
                />
              </div>

              {/* Verdict block */}
              <div style={{ flex: "1 1 260px", minWidth: 200 }}>
                <Cap style={{ marginBottom: 8 }}>
                  INCOME PLAN · {targetYear}
                </Cap>
                {/* Big lit NET annual target */}
                <AnimatedNumber
                  value={calculatedTargets.annualIncomeTarget}
                  prefix="$"
                  size="xl"
                  lit
                  style={{ display: "block", marginBottom: 8 }}
                />
                {/* Data confidence pill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <Pill tone={confidenceTone} dot>
                    {calculatedTargets.confidence.toUpperCase()} CONFIDENCE
                  </Pill>
                </div>
                <div
                  style={{
                    font: `500 12px ${T.data}`,
                    color: T.mut,
                  }}
                >
                  NET annual take-home goal ·{" "}
                  {calculatedTargets.calculationMethod} basis
                </div>
              </div>

              {/* 2×2 FlapTile grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  flexShrink: 0,
                  width: 340,
                  minWidth: 240,
                }}
              >
                <FlapTile
                  label="Realistic Apps/Yr"
                  value={String(calculatedTargets.realisticAnnualAppsToWrite)}
                  tone="amber"
                />
                <FlapTile
                  label="Monthly Income"
                  value={formatCurrency(calculatedTargets.monthlyIncomeTarget)}
                  tone="blue"
                />
                <FlapTile
                  label="YTD Income"
                  value={formatCurrency(actualMetrics.ytdIncome)}
                  tone={ytdPct >= 0.75 ? "green" : "default"}
                />
                <FlapTile
                  label="Policies Needed"
                  value={String(calculatedTargets.annualPoliciesTarget)}
                  tone="default"
                />
              </div>
            </div>
          </Board>

          {/* ── Realism Knobs ───────────────────────────────────────────────── */}
          <Board pad={20}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <SlidersHorizontal
                  style={{ width: 14, height: 14, color: T.mut }}
                />
                <Cap>Realism Settings</Cap>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      style={{ color: T.mut, lineHeight: 0 }}
                      aria-label="Explain realism settings"
                    >
                      <Info style={{ width: 12, height: 12 }} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[360px] p-3">
                    <div className="text-[12px] leading-relaxed space-y-1.5">
                      <div className="font-semibold text-foreground">
                        Why two plans?
                      </div>
                      <p className="text-muted-foreground">
                        The Optimistic plan is the raw math: gross commission ÷
                        first-year rate ÷ avg premium. It assumes every policy
                        sticks, no taxes, and every app issues.
                      </p>
                      <p className="text-muted-foreground">
                        The Realistic plan applies four haircuts so the headline
                        target reflects what you actually need to do to take
                        home your goal:
                      </p>
                      <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                        <li>
                          <strong>Persistency</strong> — share of policies that
                          stick. Rate × persistency = effective comp.
                        </li>
                        <li>
                          <strong>Tax reserve</strong> — gross-up so your "NET"
                          target is actual take-home, not pre-tax.
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
                style={{
                  font: `500 11px ${T.data}`,
                  color: T.mut,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
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
                <span className="text-[11px] text-muted-foreground">
                  Persistency
                  {averages.hasData && averages.persistency13Month > 0 && (
                    <span className="text-[11px] text-muted-foreground/70 ml-1">
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
                    className="h-7 text-[12px] font-mono px-2"
                  />
                  <span className="text-[11px] text-muted-foreground">%</span>
                </div>
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">
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
                    className="h-7 text-[12px] font-mono px-2"
                  />
                  <span className="text-[11px] text-muted-foreground">%</span>
                </div>
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">
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
                    className="h-7 text-[12px] font-mono px-2"
                  />
                  <span className="text-[11px] text-muted-foreground">%</span>
                </div>
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">
                  Premium Stat
                </span>
                <div className="flex h-7 rounded-v2-pill border border-border overflow-hidden">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 text-[11px] font-medium transition-colors",
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
                      "flex-1 text-[11px] font-medium transition-colors border-l border-border",
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
          </Board>

          {/* ── Optimistic vs Realistic Plans ──────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
              gap: 18,
              alignItems: "stretch",
            }}
            className="grid-cols-1 xl:grid-cols-2"
          >
            {/* Optimistic Plan */}
            <Board pad={20} style={{ height: "100%" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Cap>Optimistic Plan — Gross Math</Cap>
                <span style={{ font: `500 11px ${T.mono}`, color: T.mut }}>
                  No persistency / tax / NTO haircuts
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Col 1 */}
                <div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>
                        NET Income Target (Pre-Tax)
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.green }}
                      >
                        {formatCurrency(calculatedTargets.annualIncomeTarget)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span
                        style={{ color: T.mut }}
                        className="flex items-center gap-1"
                      >
                        + Annual Expenses
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              style={{ color: T.mut, lineHeight: 0 }}
                              aria-label="Show annual expense breakdown"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[360px] p-3"
                          >
                            <div className="text-[12px]">
                              <div className="font-semibold text-foreground mb-1.5">
                                Annual Expenses Breakdown
                              </div>
                              <div className="text-muted-foreground mb-2">
                                Year {new Date().getFullYear()} • projected from
                                recurring definitions + one-time rows
                              </div>

                              {averages.annualExpenseBreakdown.recurring
                                .length > 0 && (
                                <div className="mb-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
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

                              {averages.annualExpenseBreakdown.oneTime.length >
                                0 && (
                                <div className="mb-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
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
                      <span className="font-mono" style={{ color: T.ink }}>
                        {formatCurrency(calculatedTargets.annualExpenses)}
                      </span>
                    </div>
                    <div className="h-px bg-muted my-1" />
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }} className="font-semibold">
                        = GROSS Commission Needed
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.ink }}
                      >
                        {formatCurrency(
                          calculatedTargets.annualIncomeTarget +
                            calculatedTargets.annualExpenses,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Col 2 */}
                <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>Gross Commission</span>
                      <span className="font-mono" style={{ color: T.ink }}>
                        {formatCurrency(
                          calculatedTargets.annualIncomeTarget +
                            calculatedTargets.annualExpenses,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span
                        style={{ color: T.mut }}
                        className="flex items-center gap-1"
                      >
                        ÷ Commission Rate
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              style={{ color: T.mut, lineHeight: 0 }}
                              aria-label="Show commission rate breakdown"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[380px] p-3"
                          >
                            <div className="text-[12px]">
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
                                      calculatedTargets.avgCommissionRate * 100
                                    ).toFixed(1)}
                                    %
                                  </span>
                                </div>
                              </div>

                              {commissionProfile?.productBreakdown &&
                              commissionProfile.productBreakdown.length > 0 ? (
                                <>
                                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-2">
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
                                              {(p.premiumWeight * 100).toFixed(
                                                0,
                                              )}
                                              % wt · {p.policyCount}p
                                            </span>
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="text-muted-foreground text-[11px] mt-1">
                                  No per-product mix data — rate is the carrier
                                  base for your contract level.
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </span>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: T.ink }}
                      >
                        {(calculatedTargets.avgCommissionRate * 100).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="h-px bg-muted my-1" />
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }} className="font-semibold">
                        = Premium Needed
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.ink }}
                      >
                        {formatCurrency(calculatedTargets.totalPremiumNeeded)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Col 3 */}
                <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>Premium Needed</span>
                      <span className="font-mono" style={{ color: T.ink }}>
                        {formatCurrency(calculatedTargets.totalPremiumNeeded)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span
                        style={{ color: T.mut }}
                        className="flex items-center gap-1"
                      >
                        ÷ Avg Premium
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              style={{ color: T.mut, lineHeight: 0 }}
                              aria-label="Show avg premium breakdown"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[420px] p-3"
                          >
                            <div className="text-[12px]">
                              <div className="font-semibold text-foreground mb-1.5">
                                Avg Premium Breakdown
                              </div>

                              {/* Agency cohort — used for the calc */}
                              <div className="rounded border border-border p-2 mb-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                                    Agency-wide (used)
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {(() => {
                                      const b =
                                        averages.agencyAvgPolicyPremiumBreakdown;
                                      switch (b.source) {
                                        case "current-year":
                                          return `${b.policyCount} ${b.policyCount === 1 ? "policy" : "policies"} this year`;
                                        case "active-policies-fallback":
                                          return `${b.policyCount} active ${b.policyCount === 1 ? "policy" : "policies"} (fallback)`;
                                        case "all-policies-fallback":
                                          return `${b.policyCount} total ${b.policyCount === 1 ? "policy" : "policies"} (fallback)`;
                                        case "no-data":
                                          return "no agency data";
                                      }
                                    })()}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Mean
                                    </span>
                                    <span className="font-mono text-foreground font-semibold">
                                      {formatCurrency(
                                        averages.agencyAvgPolicyPremiumBreakdown
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
                                        averages.agencyAvgPolicyPremiumBreakdown
                                          .median,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Personal cohort — comparison only */}
                              {averages.avgPolicyPremiumBreakdown.policyCount >
                                0 && (
                                <div className="rounded border border-border/50 p-2 mb-2 bg-muted/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                      Your book (comparison)
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                      {
                                        averages.avgPolicyPremiumBreakdown
                                          .policyCount
                                      }{" "}
                                      {averages.avgPolicyPremiumBreakdown
                                        .policyCount === 1
                                        ? "policy"
                                        : "policies"}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-1">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Mean
                                      </span>
                                      <span className="font-mono text-foreground">
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
                                  </div>
                                  {(() => {
                                    const personalMean =
                                      averages.avgPolicyPremiumBreakdown.mean;
                                    const agencyMean =
                                      averages.agencyAvgPolicyPremiumBreakdown
                                        .mean;
                                    if (agencyMean === 0) return null;
                                    const diffPct =
                                      ((personalMean - agencyMean) /
                                        agencyMean) *
                                      100;
                                    if (Math.abs(diffPct) < 5) return null;
                                    const sign = diffPct > 0 ? "+" : "";
                                    return (
                                      <div className="text-[11px] text-muted-foreground">
                                        Your mean is{" "}
                                        <span
                                          style={{
                                            color:
                                              diffPct > 0 ? T.green : T.amber,
                                          }}
                                        >
                                          {sign}
                                          {diffPct.toFixed(0)}%
                                        </span>{" "}
                                        {diffPct > 0 ? "above" : "below"} the
                                        agency average.
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              <div className="text-[11px] text-muted-foreground">
                                Realistic plan uses the agency cohort so new
                                agents and skewed personal books get a stable
                                baseline. Toggle Mean/Median in Realism
                                Settings.
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </span>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: T.ink }}
                      >
                        {formatCurrency(calculatedTargets.avgPolicyPremium)}
                      </span>
                    </div>
                    <div className="h-px bg-muted my-1" />
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }} className="font-semibold">
                        = Policies Needed
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.blue }}
                      >
                        {calculatedTargets.annualPoliciesTarget} policies
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Board>

            {/* Realistic Plan */}
            <Board
              pad={16}
              style={{
                height: "100%",
                border: `2px solid ${T.amber}40`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Cap style={{ color: T.amber }}>
                  Realistic Plan — Take-Home Math
                </Cap>
                <span style={{ font: `500 11px ${T.mono}`, color: T.mut }}>
                  Persistency × tax × NTO applied
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>
                        Actual Take-Home Goal
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.green }}
                      >
                        {formatCurrency(calculatedTargets.annualIncomeTarget)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>
                        + Tax Reserve (
                        {(realism.taxReserveRate * 100).toFixed(0)}%)
                      </span>
                      <span className="font-mono" style={{ color: T.amber }}>
                        {formatCurrency(calculatedTargets.taxReserveAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>+ Annual Expenses</span>
                      <span className="font-mono" style={{ color: T.ink }}>
                        {formatCurrency(calculatedTargets.annualExpenses)}
                      </span>
                    </div>
                    <div className="h-px bg-muted my-1" />
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }} className="font-semibold">
                        = Realistic Gross Needed
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.ink }}
                      >
                        {formatCurrency(
                          calculatedTargets.realisticGrossCommissionNeeded,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>Realistic Gross</span>
                      <span className="font-mono" style={{ color: T.ink }}>
                        {formatCurrency(
                          calculatedTargets.realisticGrossCommissionNeeded,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span
                        style={{ color: T.mut }}
                        className="flex items-center gap-1"
                      >
                        ÷ Effective Rate
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              style={{ color: T.mut, lineHeight: 0 }}
                              aria-label="Explain effective rate"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[320px] p-3"
                          >
                            <div className="text-[12px] space-y-1">
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
                      <span
                        className="font-mono font-semibold"
                        style={{ color: T.amber }}
                      >
                        {(
                          calculatedTargets.effectiveCommissionRate * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="h-px bg-muted my-1" />
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }} className="font-semibold">
                        = Realistic Premium
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.ink }}
                      >
                        {formatCurrency(
                          calculatedTargets.realisticTotalPremiumNeeded,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-4 border-border">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>Realistic Premium</span>
                      <span className="font-mono" style={{ color: T.ink }}>
                        {formatCurrency(
                          calculatedTargets.realisticTotalPremiumNeeded,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>
                        ÷ Avg Premium ({realism.premiumStat})
                      </span>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: T.ink }}
                      >
                        {formatCurrency(calculatedTargets.avgPolicyPremium)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>= Policies Issued</span>
                      <span className="font-mono" style={{ color: T.ink }}>
                        {calculatedTargets.realisticAnnualPoliciesIssued}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span style={{ color: T.mut }}>
                        × (1 + {(realism.ntoBufferRate * 100).toFixed(0)}% NTO)
                      </span>
                      <span className="font-mono" style={{ color: T.amber }}>
                        ×{(1 + realism.ntoBufferRate).toFixed(2)}
                      </span>
                    </div>
                    <div className="h-px bg-muted my-1" />
                    <div className="flex justify-between text-[12px]">
                      <span
                        className="font-semibold"
                        style={{ color: T.amber }}
                      >
                        = Apps to Write
                      </span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: T.amber }}
                      >
                        {calculatedTargets.realisticAnnualAppsToWrite} apps
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Realistic vs Optimistic delta */}
              {calculatedTargets.realisticVsOptimisticDelta > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1px solid ${T.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                  className="text-[12px]"
                >
                  <span style={{ color: T.mut }}>Realistic vs Optimistic</span>
                  <span className="font-mono" style={{ color: T.amber }}>
                    +{calculatedTargets.realisticVsOptimisticDelta} apps/year (
                    {(
                      (calculatedTargets.realisticVsOptimisticDelta /
                        Math.max(calculatedTargets.annualPoliciesTarget, 1)) *
                      100
                    ).toFixed(0)}
                    % more than the gross math suggests)
                  </span>
                </div>
              )}
            </Board>
          </div>

          {/* ── Income Targets + Policy Targets ────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
              gap: 18,
              alignItems: "stretch",
            }}
            className="grid-cols-1 sm:grid-cols-2"
          >
            {/* NET Income Targets */}
            <Board pad={20} style={{ height: "100%" }}>
              <Cap style={{ marginBottom: 10 }}>NET Income Targets</Cap>
              <div className="space-y-1">
                {/* Annual */}
                <div className="flex justify-between items-center text-[12px]">
                  <span style={{ color: T.mut }}>Annual</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono font-bold"
                      style={{ color: T.ink }}
                    >
                      {formatCurrency(calculatedTargets.annualIncomeTarget)}
                    </span>
                    <span
                      className="font-mono text-[11px]"
                      style={{
                        color: progressColor(
                          (actualMetrics.ytdIncome /
                            calculatedTargets.annualIncomeTarget) *
                            100,
                        ),
                      }}
                    >
                      ({formatCurrency(actualMetrics.ytdIncome)} YTD)
                    </span>
                  </div>
                </div>
                <Bar
                  pct={Math.min(
                    actualMetrics.ytdIncome /
                      calculatedTargets.annualIncomeTarget,
                    1,
                  )}
                  tone={
                    ytdPct >= 1
                      ? "green"
                      : ytdPct >= 0.75
                        ? "blue"
                        : ytdPct >= 0.5
                          ? "amber"
                          : "red"
                  }
                  height={3}
                />

                {/* Quarterly */}
                <div className="flex justify-between items-center text-[12px]">
                  <span style={{ color: T.mut }}>Quarterly</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono font-bold"
                      style={{ color: T.ink }}
                    >
                      {formatCurrency(calculatedTargets.quarterlyIncomeTarget)}
                    </span>
                    <span
                      className="font-mono text-[11px]"
                      style={{
                        color: progressColor(
                          (actualMetrics.qtdIncome /
                            calculatedTargets.quarterlyIncomeTarget) *
                            100,
                        ),
                      }}
                    >
                      ({formatCurrency(actualMetrics.qtdIncome)} QTD)
                    </span>
                  </div>
                </div>

                {/* Monthly */}
                <div className="flex justify-between items-center text-[12px]">
                  <span style={{ color: T.mut }}>Monthly</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono font-bold"
                      style={{ color: T.ink }}
                    >
                      {formatCurrency(calculatedTargets.monthlyIncomeTarget)}
                    </span>
                    <span
                      className="font-mono text-[11px]"
                      style={{
                        color: progressColor(
                          (actualMetrics.mtdIncome /
                            calculatedTargets.monthlyIncomeTarget) *
                            100,
                        ),
                      }}
                    >
                      ({formatCurrency(actualMetrics.mtdIncome)} MTD)
                    </span>
                  </div>
                </div>

                <div className="h-px bg-muted my-1" />

                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Weekly</span>
                  <span className="font-mono" style={{ color: T.ink }}>
                    {formatCurrency(calculatedTargets.weeklyIncomeTarget)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Daily</span>
                  <span className="font-mono" style={{ color: T.ink }}>
                    {formatCurrency(calculatedTargets.dailyIncomeTarget)}
                  </span>
                </div>
              </div>
            </Board>

            {/* Policy Targets */}
            <Board pad={20} style={{ height: "100%" }}>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center">
                <Cap>Policy Targets</Cap>
                <span
                  style={{
                    font: `700 11px ${T.mono}`,
                    color: T.mut,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    textAlign: "right",
                  }}
                >
                  Optimistic
                </span>
                <span
                  style={{
                    font: `700 11px ${T.mono}`,
                    color: T.amber,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    textAlign: "right",
                  }}
                >
                  Realistic
                </span>

                <span className="text-[12px]" style={{ color: T.mut }}>
                  Annual
                </span>
                <div className="flex items-center gap-1.5 justify-end">
                  <span
                    className="font-mono font-bold text-[12px]"
                    style={{ color: T.ink }}
                  >
                    {calculatedTargets.annualPoliciesTarget}
                  </span>
                  <span
                    className="font-mono text-[11px]"
                    style={{
                      color: progressColor(
                        (actualMetrics.ytdPolicies /
                          calculatedTargets.annualPoliciesTarget) *
                          100,
                      ),
                    }}
                  >
                    ({actualMetrics.ytdPolicies} YTD)
                  </span>
                </div>
                <span
                  className="font-mono font-bold text-[12px] text-right"
                  style={{ color: T.amber }}
                >
                  {calculatedTargets.realisticAnnualAppsToWrite}
                </span>

                <span className="text-[12px]" style={{ color: T.mut }}>
                  Quarterly
                </span>
                <span
                  className="font-mono font-bold text-[12px] text-right"
                  style={{ color: T.ink }}
                >
                  {calculatedTargets.quarterlyPoliciesTarget}
                </span>
                <span
                  className="font-mono font-bold text-[12px] text-right"
                  style={{ color: T.amber }}
                >
                  {calculatedTargets.realisticQuarterlyAppsToWrite}
                </span>

                <span className="text-[12px]" style={{ color: T.mut }}>
                  Monthly
                </span>
                <div className="flex items-center gap-1.5 justify-end">
                  <span
                    className="font-mono font-bold text-[12px]"
                    style={{ color: T.ink }}
                  >
                    {calculatedTargets.monthlyPoliciesTarget}
                  </span>
                  <span
                    className="font-mono text-[11px]"
                    style={{
                      color: progressColor(
                        (actualMetrics.mtdPolicies /
                          calculatedTargets.monthlyPoliciesTarget) *
                          100,
                      ),
                    }}
                  >
                    ({actualMetrics.mtdPolicies} MTD)
                  </span>
                </div>
                <span
                  className="font-mono font-bold text-[12px] text-right"
                  style={{ color: T.amber }}
                >
                  {calculatedTargets.realisticMonthlyAppsToWrite}
                </span>

                <span className="text-[12px]" style={{ color: T.mut }}>
                  Weekly
                </span>
                <span
                  className="font-mono text-[12px] text-right"
                  style={{ color: T.ink }}
                >
                  {calculatedTargets.weeklyPoliciesTarget}
                </span>
                <span
                  className="font-mono text-[12px] text-right"
                  style={{ color: T.amber }}
                >
                  {calculatedTargets.realisticWeeklyAppsToWrite}
                </span>

                <span className="text-[12px]" style={{ color: T.mut }}>
                  Daily
                </span>
                <span
                  className="font-mono text-[12px] text-right"
                  style={{ color: T.ink }}
                >
                  {calculatedTargets.dailyPoliciesTarget}
                </span>
                <span
                  className="font-mono text-[12px] text-right"
                  style={{ color: T.amber }}
                >
                  {calculatedTargets.realisticDailyAppsToWrite}
                </span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: `1px solid ${T.line}`,
                  font: `500 11px ${T.data}`,
                  color: T.mut,
                }}
              >
                <span>Optimistic =</span> policies issued (gross math).{" "}
                <span style={{ color: T.amber }}>Realistic =</span> apps to
                write to take home the goal after persistency, taxes &amp; NTO.
              </div>
            </Board>
          </div>

          {/* ── Expense Analysis, Key Metrics, Persistency ─────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
              gap: 18,
              alignItems: "stretch",
            }}
            className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {/* Expense Analysis */}
            <Board pad={20} style={{ height: "100%" }}>
              <Cap style={{ marginBottom: 10 }}>Expense Analysis</Cap>
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Monthly Target</span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: T.ink }}
                  >
                    {formatCurrency(calculatedTargets.monthlyExpenseTarget)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>MTD Actual</span>
                  <span
                    className="font-mono"
                    style={{
                      color:
                        actualMetrics.mtdExpenses >
                        calculatedTargets.monthlyExpenseTarget
                          ? T.red
                          : T.green,
                    }}
                  >
                    {formatCurrency(actualMetrics.mtdExpenses)}
                  </span>
                </div>
                <div className="h-px bg-muted my-1" />
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Annual Total</span>
                  <span className="font-mono" style={{ color: T.ink }}>
                    {formatCurrency(calculatedTargets.annualExpenses)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Expense Ratio</span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: T.ink }}
                  >
                    {formatPercent(calculatedTargets.expenseRatio * 100)}
                  </span>
                </div>
                <div className="h-px bg-muted my-1" />
                <div
                  style={{
                    font: `500 11px ${T.data}`,
                    color:
                      calculatedTargets.expenseRatio > 0.3 ? T.amber : T.green,
                  }}
                >
                  {calculatedTargets.expenseRatio > 0.3
                    ? "High expense ratio"
                    : "Healthy expense ratio"}
                </div>
              </div>
            </Board>

            {/* Key Metrics */}
            <Board pad={20} style={{ height: "100%" }}>
              <Cap style={{ marginBottom: 10 }}>Key Metrics</Cap>
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <span
                    style={{ color: T.mut }}
                    className="flex items-center gap-1"
                  >
                    Commission Rate
                    {commissionProfile?.dataQuality === "HIGH" && (
                      <span
                        className="text-[11px]"
                        style={{ color: T.green }}
                        title="Based on your sales mix - high confidence (20+ policies)"
                      >
                        ✓
                      </span>
                    )}
                    {commissionProfile?.dataQuality === "MEDIUM" && (
                      <span
                        className="text-[11px]"
                        style={{ color: T.blue }}
                        title="Based on limited sales data - moderate confidence (10-19 policies)"
                      >
                        ℹ️
                      </span>
                    )}
                    {commissionProfile?.dataQuality === "LOW" && (
                      <span
                        className="text-[11px]"
                        style={{ color: T.amber }}
                        title="Based on very limited sales data - low confidence (1-9 policies)"
                      >
                        ⚠
                      </span>
                    )}
                    {commissionProfile?.dataQuality === "DEFAULT" && (
                      <span
                        className="text-[11px]"
                        style={{ color: T.amber }}
                        title="Using default rate - no recent policies found"
                      >
                        ⚠
                      </span>
                    )}
                    {commissionProfile?.dataQuality === "NONE" && (
                      <span
                        className="text-[11px]"
                        style={{ color: T.red }}
                        title="No commission data available"
                      >
                        ❌
                      </span>
                    )}
                  </span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: T.ink }}
                  >
                    {(calculatedTargets.avgCommissionRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Avg Premium</span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: T.ink }}
                  >
                    {formatCurrency(calculatedTargets.avgPolicyPremium)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Current Avg</span>
                  <span
                    className="font-mono"
                    style={{
                      color:
                        actualMetrics.currentAvgPremium <
                        calculatedTargets.avgPolicyPremium
                          ? T.amber
                          : T.green,
                    }}
                  >
                    {formatCurrency(actualMetrics.currentAvgPremium)}
                  </span>
                </div>
                <div className="h-px bg-muted my-1" />
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Data Confidence</span>
                  <span
                    className="font-semibold text-[11px]"
                    style={{
                      color:
                        confidenceTone === "green"
                          ? T.green
                          : confidenceTone === "amber"
                            ? T.amber
                            : T.red,
                    }}
                  >
                    {calculatedTargets.confidence.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.mut }}>Method</span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: T.ink }}
                  >
                    {calculatedTargets.calculationMethod}
                  </span>
                </div>
                {commissionProfile?.dataQuality === "HIGH" && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: `1px solid ${T.line}`,
                    }}
                  >
                    <div className="text-[11px]" style={{ color: T.green }}>
                      ✓ Commission rate calculated from your sales mix (high
                      confidence)
                    </div>
                  </div>
                )}
                {commissionProfile?.dataQuality === "MEDIUM" && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: `1px solid ${T.line}`,
                    }}
                  >
                    <div className="text-[11px]" style={{ color: T.blue }}>
                      ℹ️ Commission rate based on limited data. Add more
                      policies for better accuracy.
                    </div>
                  </div>
                )}
                {commissionProfile?.dataQuality === "LOW" && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: `1px solid ${T.line}`,
                    }}
                  >
                    <div className="text-[11px]" style={{ color: T.amber }}>
                      ⚠ Commission rate based on very limited data. Add more
                      policies for accuracy.
                    </div>
                  </div>
                )}
                {commissionProfile?.dataQuality === "DEFAULT" && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: `1px solid ${T.line}`,
                    }}
                  >
                    <div className="text-[11px]" style={{ color: T.amber }}>
                      ⚠ Commission rate is using defaults. Add policies to get
                      your actual rate.
                    </div>
                  </div>
                )}
                {commissionProfile?.dataQuality === "NONE" && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: `1px solid ${T.line}`,
                    }}
                  >
                    <div className="text-[11px]" style={{ color: T.red }}>
                      ❌ No commission data available. Contact admin to
                      configure rates.
                    </div>
                  </div>
                )}
              </div>
            </Board>

            {/* Persistency Rates */}
            <Board pad={20} style={{ height: "100%" }}>
              <Cap style={{ marginBottom: 10 }}>Persistency Rates</Cap>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: T.mut }}>13-Month Target</span>
                    <span className="font-mono" style={{ color: T.ink }}>
                      {formatPercent(
                        calculatedTargets.persistency13MonthTarget * 100,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: T.mut }}>13-Month Actual</span>
                    <span
                      className="font-mono font-semibold"
                      style={{
                        color: progressColor(
                          (actualMetrics.persistency13Month /
                            calculatedTargets.persistency13MonthTarget) *
                            100,
                        ),
                      }}
                    >
                      {formatPercent(actualMetrics.persistency13Month * 100)}
                    </span>
                  </div>
                </div>
                <div className="h-px bg-muted my-1" />
                <div>
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: T.mut }}>25-Month Target</span>
                    <span className="font-mono" style={{ color: T.ink }}>
                      {formatPercent(
                        calculatedTargets.persistency25MonthTarget * 100,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: T.mut }}>25-Month Actual</span>
                    <span
                      className="font-mono font-semibold"
                      style={{
                        color: progressColor(
                          (actualMetrics.persistency25Month /
                            calculatedTargets.persistency25MonthTarget) *
                            100,
                        ),
                      }}
                    >
                      {formatPercent(actualMetrics.persistency25Month * 100)}
                    </span>
                  </div>
                </div>
              </div>
            </Board>
          </div>

          {/* ── Validation Warnings ─────────────────────────────────────────── */}
          {(validation.warnings.length > 0 ||
            validation.recommendations.length > 0) && (
            <Board
              pad={12}
              style={{
                background: `${T.amber}10`,
                border: `1px solid ${T.amber}30`,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "flex-start", gap: 8 }}
              >
                <AlertCircle
                  style={{
                    width: 12,
                    height: 12,
                    color: T.amber,
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                />
                <div className="space-y-0.5">
                  {validation.warnings.map((warning, i) => (
                    <p
                      key={i}
                      className="text-[12px] font-medium"
                      style={{ color: T.amber }}
                    >
                      {warning}
                    </p>
                  ))}
                  {validation.recommendations.map((rec, i) => (
                    <p
                      key={i}
                      className="text-[11px]"
                      style={{ color: T.amber }}
                    >
                      {rec}
                    </p>
                  ))}
                </div>
              </div>
            </Board>
          )}
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
    </SectionShell>
  );
}
