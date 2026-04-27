import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HeroSummaryProps {
  /** Period label, e.g. "MTD", "April 2026". */
  periodLabel: string;
  /** The hero number — typically commissions paid for the period. */
  primaryValue: number;
  /** Net (surplus/deficit) — surfaced inline with status color. */
  net: number;
  /** Number of policies sold this period. */
  policies: number;
  /** Policies still needed to hit pace. */
  policiesNeeded: number;
  /** Active alerts count. */
  alertsCount: number;
  /** True when the period is in surplus / above breakeven. */
  isAboveBreakeven: boolean;
}

function formatCompactCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    const v = n / 1_000_000;
    const s = v.toFixed(v < 10 ? 2 : 1);
    return `${n < 0 ? "−" : ""}$${Math.abs(parseFloat(s))}M`;
  }
  if (Math.abs(n) >= 100_000) {
    return `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n / 1000))}k`;
  }
  return formatCurrency(n);
}

function formatNet(n: number): string {
  const abs = Math.abs(n);
  return `${n >= 0 ? "+" : "−"}${formatCurrency(abs)}`;
}

export const HeroSummary: React.FC<HeroSummaryProps> = ({
  periodLabel,
  primaryValue,
  net,
  policies,
  policiesNeeded,
  alertsCount,
  isAboveBreakeven,
}) => {
  const TrendIcon = isAboveBreakeven ? ArrowUpRight : ArrowDownRight;
  const netToneClass = isAboveBreakeven
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-red-700 dark:text-red-400";

  // Editorial caption is composed inline so the status fragment can carry
  // its own color while the surrounding prose stays muted.
  const policiesStatement =
    policiesNeeded > 0
      ? `${policies.toLocaleString()} of ${(policies + Math.ceil(policiesNeeded)).toLocaleString()} policies`
      : `${policies.toLocaleString()} policies (target hit)`;
  const alertsStatement =
    alertsCount === 0
      ? "no alerts pending"
      : `${alertsCount} alert${alertsCount === 1 ? "" : "s"} flagged`;

  return (
    <section className="py-6 sm:py-8">
      {/* Tiny eyebrow label */}
      <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle">
        {periodLabel} · Commissions Paid
      </div>

      {/* The headline number */}
      <div className="mt-1.5 flex items-end gap-3 sm:gap-5 flex-wrap">
        <span className="font-mono tabular-nums text-5xl sm:text-7xl font-medium tracking-tight leading-none text-v2-ink dark:text-v2-ink">
          {formatCompactCurrency(primaryValue)}
        </span>

        {/* Inline net delta — sized smaller, color-coded */}
        <span
          className={cn(
            "inline-flex items-baseline gap-1 font-mono tabular-nums text-xl sm:text-2xl font-medium pb-1",
            netToneClass,
          )}
        >
          <TrendIcon
            className="h-4 w-4 sm:h-5 sm:w-5 self-center"
            strokeWidth={2.5}
          />
          {formatNet(net)}
        </span>
      </div>

      {/* Thick accent rule — only as wide as visual emphasis */}
      <div className="mt-4 h-[3px] w-16 bg-v2-ink dark:bg-v2-card-tinted" />

      {/* Italic editorial caption */}
      <p className="mt-3 text-[13px] leading-relaxed italic text-v2-ink-muted dark:text-v2-ink-subtle max-w-3xl">
        <span
          className={cn(
            "not-italic font-mono tabular-nums font-semibold",
            netToneClass,
          )}
        >
          {isAboveBreakeven
            ? `${formatCurrency(Math.abs(net))} above breakeven`
            : `${formatCurrency(Math.abs(net))} below breakeven`}
        </span>
        {" · "}
        <span className="not-italic font-mono tabular-nums">
          {policiesStatement}
        </span>
        {" · "}
        <span
          className={cn(
            "not-italic font-mono tabular-nums",
            alertsCount > 0 &&
              "text-amber-700 dark:text-amber-400 font-semibold",
          )}
        >
          {alertsStatement}
        </span>
        .
      </p>
    </section>
  );
};
