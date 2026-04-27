import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  DollarSign,
  Users,
} from "lucide-react";
import {
  MetricBar,
  StatTile,
  PillNav,
  type PillNavItem,
} from "@/components/v2";
import { TimePeriod } from "../../../utils/dateRange";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DashboardHeroV2Props {
  greetingName: string;
  periodTitle: string;
  daysSubtitle?: string;
  timePeriod: TimePeriod;
  onTimePeriodChange: (p: TimePeriod) => void;
  periodOffset: number;
  onOffsetChange: (n: number) => void;

  /** Always-on pace bars showing AP submitted + Commissions for both MTD and YTD.
   *  pct values 0..1 control bar fill (vs. monthly/yearly target where available),
   *  display values are the formatted $ amount shown in the chip. */
  apMtdPct: number;
  apMtdDisplay: string;
  apYtdPct: number;
  apYtdDisplay: string;
  commMtdPct: number;
  commMtdDisplay: string;
  commYtdPct: number;
  commYtdDisplay: string;

  /** stat tiles (right column) */
  policiesCount: number;
  premiumWritten: number;
  pendingPipeline: number;
}

const PERIODS: PillNavItem[] = [
  { label: "Day", value: "daily" },
  { label: "Week", value: "weekly" },
  { label: "MTD", value: "MTD" },
  { label: "Month", value: "monthly" },
  { label: "Year", value: "yearly" },
];

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${(v < 10 ? v.toFixed(1) : Math.round(v)).toString()}M`;
  }
  if (Math.abs(n) >= 1_000) {
    const v = n / 1_000;
    return `$${(v < 10 ? v.toFixed(1) : Math.round(v)).toString()}k`;
  }
  return formatCurrency(n);
}

/**
 * Crextio-inspired dashboard hero: large welcome heading, period nav,
 * a 4-row MetricBar column on the left and 3 StatTiles on the right.
 * Replaces Masthead + HeroSummary + SecondaryMetricsRow when v2 is on.
 */
export const DashboardHeroV2: React.FC<DashboardHeroV2Props> = ({
  greetingName,
  periodTitle,
  daysSubtitle,
  timePeriod,
  onTimePeriodChange,
  periodOffset,
  onOffsetChange,
  apMtdPct,
  apMtdDisplay,
  apYtdPct,
  apYtdDisplay,
  commMtdPct,
  commMtdDisplay,
  commYtdPct,
  commYtdDisplay,
  policiesCount,
  premiumWritten,
  pendingPipeline,
}) => {
  const isCurrent = periodOffset === 0;

  return (
    <section className="pt-2 pb-8">
      {/* Top row: welcome + period controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-7">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle mb-2">
            {periodTitle}
            {daysSubtitle && (
              <span className="ml-2 normal-case tracking-normal text-v2-ink-muted">
                · {daysSubtitle}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.05] text-v2-ink">
            Welcome back,{" "}
            <span className="text-v2-ink-muted">{greetingName}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PillNav
            items={PERIODS}
            activeValue={timePeriod}
            onChange={(v) => onTimePeriodChange(v as TimePeriod)}
            size="sm"
          />
          <div className="inline-flex items-center gap-1 rounded-v2-pill bg-v2-card border border-v2-ring p-1 shadow-v2-soft">
            <button
              type="button"
              onClick={() => onOffsetChange(periodOffset - 1)}
              className="h-7 w-7 inline-flex items-center justify-center rounded-v2-pill text-v2-ink-muted hover:bg-v2-accent-soft hover:text-v2-ink transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOffsetChange(0)}
              disabled={isCurrent}
              className={cn(
                "h-7 px-3 text-[11px] font-semibold uppercase tracking-wider rounded-v2-pill transition-colors",
                isCurrent
                  ? "text-v2-ink-subtle"
                  : "text-v2-ink-muted hover:bg-v2-accent-soft hover:text-v2-ink",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onOffsetChange(periodOffset + 1)}
              disabled={isCurrent}
              className={cn(
                "h-7 w-7 inline-flex items-center justify-center rounded-v2-pill transition-colors",
                isCurrent
                  ? "text-v2-ink-subtle"
                  : "text-v2-ink-muted hover:bg-v2-accent-soft hover:text-v2-ink",
              )}
              aria-label="Next period"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Metric strip: bars left, stat tiles right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-2.5">
          <MetricBar
            label="AP MTD"
            value={apMtdPct}
            tone="ink"
            display={apMtdDisplay}
          />
          <MetricBar
            label="AP YTD"
            value={apYtdPct}
            tone="muted"
            display={apYtdDisplay}
          />
          <MetricBar
            label="Commissions MTD"
            value={commMtdPct}
            tone="yellow"
            display={commMtdDisplay}
          />
          <MetricBar
            label="Commissions YTD"
            value={commYtdPct}
            tone="muted"
            display={commYtdDisplay}
          />
        </div>
        <div className="lg:col-span-5 flex flex-col gap-3">
          <StatTile
            icon={<FileText className="h-4 w-4" />}
            value={policiesCount.toLocaleString()}
            caption="Policies"
          />
          <StatTile
            icon={<DollarSign className="h-4 w-4" />}
            value={formatCompact(premiumWritten)}
            caption="Premium"
          />
          <StatTile
            icon={<Users className="h-4 w-4" />}
            value={formatCompact(pendingPipeline)}
            caption="Pipeline"
          />
        </div>
      </div>
    </section>
  );
};
