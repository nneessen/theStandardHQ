// src/features/targets/components/SimpleTargetsView.tsx
//
// The DEFAULT, simplified Targets view. Answers the one question an agent
// actually has — "how many apps do I need to write?" — then a little context
// (goal progress, income pace) and the two inputs that change the answer
// (their own avg premium + the realism knobs). The full auditor-grade math
// cascade lives in the Advanced view (toggle in the page header).
//
// Presentation only: all state + handlers live in TargetsPage and arrive as
// props, so Simple and Advanced share one source of truth.

import {
  Board,
  Cap,
  Pill,
  FlapTile,
  RadialProgress,
  AnimatedNumber,
  T,
} from "@/components/board";
import { AlertCircle } from "lucide-react";
import { formatCurrency } from "../../../lib/format";
import type {
  CalculatedTargets,
  RealismOptions,
} from "../../../services/targets/targetsCalculationService";
import { PercentInput } from "./PercentInput";
import { AvgPremiumField } from "./AvgPremiumField";

interface SimpleTargetsViewProps {
  calculatedTargets: CalculatedTargets;
  /** Only the actuals the simple view reads. */
  actualMetrics: {
    ytdIncome: number;
    mtdIncome: number;
    ytdPolicies: number;
    mtdPolicies: number;
  };
  ytdPct: number;
  ringTone: "green" | "blue" | "amber" | "red";
  realism: RealismOptions;
  setRealism: React.Dispatch<React.SetStateAction<RealismOptions>>;
  hasPersistencyData: boolean;
  persistency13Month: number;
  /** Active per-agent override (> 0) or undefined. */
  avgPremiumOverride: number | undefined;
  onSaveAvgPremium: (value: number | null) => void;
  validation: { warnings: string[]; recommendations: string[] };
}

export function SimpleTargetsView({
  calculatedTargets: ct,
  actualMetrics,
  ytdPct,
  ringTone,
  realism,
  setRealism,
  hasPersistencyData,
  persistency13Month,
  avgPremiumOverride,
  onSaveAvgPremium,
  validation,
}: SimpleTargetsViewProps) {
  // Simple "on pace" read: compare YTD goal progress to the share of the year
  // elapsed. Keeps the headline honest without the full Realism cascade.
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearFrac = Math.min(
    1,
    (now.getTime() - yearStart.getTime()) / (365 * 86_400_000),
  );
  const paceTone: "green" | "amber" | "red" =
    ytdPct >= yearFrac ? "green" : ytdPct >= yearFrac * 0.75 ? "amber" : "red";
  const paceLabel = ytdPct >= yearFrac ? "ON PACE" : "BEHIND PACE";

  const hasWarnings =
    validation.warnings.length > 0 || validation.recommendations.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Headline: ring + apps to write ─────────────────────────────────── */}
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
            gap: 28,
            alignItems: "center",
          }}
        >
          {/* Goal progress ring */}
          <div style={{ flexShrink: 0 }}>
            <RadialProgress
              pct={ytdPct}
              size={170}
              thickness={15}
              tone={ringTone}
              caption="OF ANNUAL GOAL"
            />
          </div>

          {/* PRIMARY · the destination: NET annual income goal */}
          <div style={{ flex: "1 1 230px", minWidth: 210 }}>
            <Cap style={{ marginBottom: 6 }}>NET Annual Goal</Cap>
            <AnimatedNumber
              value={ct.annualIncomeTarget}
              prefix="$"
              size="xl"
              lit
              style={{ display: "block", marginBottom: 8 }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Pill tone={paceTone} dot>
                {paceLabel}
              </Pill>
              <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>
                {formatCurrency(actualMetrics.ytdIncome)} YTD ·{" "}
                {formatCurrency(ct.monthlyIncomeTarget)}/mo
              </span>
            </div>
          </div>

          {/* PRIMARY · the activity ask: apps to write this month */}
          <div
            style={{
              flex: "1 1 230px",
              minWidth: 210,
              borderLeft: `1px solid ${T.line}`,
              paddingLeft: 24,
            }}
          >
            <Cap style={{ marginBottom: 6 }}>Apps to Write · This Month</Cap>
            <AnimatedNumber
              value={ct.realisticMonthlyAppsToWrite}
              size="xl"
              lit
              style={{ display: "block", marginBottom: 8 }}
            />
            <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>
              {ct.realisticAnnualAppsToWrite} apps/yr · after persistency, tax
              &amp; NTO
            </span>
          </div>
        </div>
      </Board>

      {/* ── A little context (the numbers in between) ──────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <FlapTile
          label="Apps/Yr (Realistic)"
          value={String(ct.realisticAnnualAppsToWrite)}
          tone="amber"
        />
        <FlapTile
          label="Policies Needed/Yr"
          value={String(ct.annualPoliciesTarget)}
          tone="default"
        />
        <FlapTile
          label="Monthly Income Goal"
          value={formatCurrency(ct.monthlyIncomeTarget)}
          tone="blue"
        />
        <FlapTile
          label="YTD Income"
          value={formatCurrency(actualMetrics.ytdIncome)}
          tone={ytdPct >= 0.75 ? "green" : "default"}
        />
      </div>

      {/* ── Your numbers (the inputs that change the answer) ───────────────── */}
      <Board pad={18}>
        <Cap style={{ marginBottom: 10 }}>Your Numbers</Cap>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <AvgPremiumField
            override={avgPremiumOverride}
            premiumStat={realism.premiumStat}
            onPremiumStatChange={(stat) =>
              setRealism((r) => ({ ...r, premiumStat: stat }))
            }
            onSaveOverride={onSaveAvgPremium}
          />

          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">
              Persistency
              {hasPersistencyData && persistency13Month > 0 && (
                <span className="text-[11px] text-muted-foreground/70 ml-1">
                  (13-mo: {(persistency13Month * 100).toFixed(0)}%)
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
                className="h-7 text-[13px] font-mono px-2"
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
                className="h-7 text-[13px] font-mono px-2"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
            </div>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">NTO Drag</span>
            <div className="flex items-center gap-1">
              <PercentInput
                min={0}
                max={50}
                value={realism.ntoBufferRate}
                onChange={(v) =>
                  setRealism((r) => ({ ...r, ntoBufferRate: v }))
                }
                aria-label="NTO drag percent"
                className="h-7 text-[13px] font-mono px-2"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
            </div>
          </label>
        </div>
        <div
          style={{ font: `500 11px ${T.data}`, color: T.mut, marginTop: 10 }}
        >
          Switch to{" "}
          <span style={{ color: T.ink, fontWeight: 600 }}>Advanced</span> for
          the full optimistic vs. realistic breakdown, expenses, commission rate
          and persistency detail.
        </div>
      </Board>

      {/* ── Validation warnings ────────────────────────────────────────────── */}
      {hasWarnings && (
        <Board
          pad={12}
          style={{
            background: `${T.amber}10`,
            border: `1px solid ${T.amber}30`,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertCircle
              style={{
                width: 12,
                height: 12,
                color: T.amber,
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <div className="divide-y divide-v2-ring">
              {validation.warnings.map((warning, i) => (
                <p
                  key={`w-${i}`}
                  className="text-[13px] font-medium py-2"
                  style={{ color: T.amber }}
                >
                  {warning}
                </p>
              ))}
              {validation.recommendations.map((rec, i) => (
                <p
                  key={`r-${i}`}
                  className="text-[13px] py-2"
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
  );
}
