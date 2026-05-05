import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  DollarSign,
  Users,
  Plus,
  BarChart3,
  Receipt,
} from "lucide-react";
import {
  ArcGauge,
  MetricBar,
  PillNav,
  SoftCard,
  type PillNavItem,
} from "@/components/v2";
import { TimePeriod } from "../../../utils/dateRange";
import { formatCompactCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  action: string;
  hasAccess: boolean;
  lockedTooltip?: string;
  requiredTier?: string;
}

interface DashboardHeroV2Props {
  greetingName: string;
  periodTitle: string;
  daysSubtitle?: string;
  timePeriod: TimePeriod;
  onTimePeriodChange: (p: TimePeriod) => void;
  periodOffset: number;
  onOffsetChange: (n: number) => void;

  apMtdPct: number;
  apMtdDisplay: string;
  apYtdPct: number;
  apYtdDisplay: string;
  commMtdPct: number;
  commMtdDisplay: string;
  commYtdPct: number;
  commYtdDisplay: string;

  policiesCount: number;
  premiumWritten: number;
  pendingPipeline: number;

  quickActions?: QuickAction[];
  onQuickActionClick?: (action: string) => void;
  isCreating?: boolean;
}

const PERIODS: PillNavItem[] = [
  { label: "Day", value: "daily" },
  { label: "Week", value: "weekly" },
  { label: "MTD", value: "MTD" },
  { label: "Month", value: "monthly" },
  { label: "Year", value: "yearly" },
];

const CURRENT_PERIOD_LABELS: Record<TimePeriod, string> = {
  daily: "Today",
  weekly: "This Week",
  MTD: "MTD",
  monthly: "This Month",
  yearly: "This Year",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  "Add Policy": <Plus className="h-3.5 w-3.5" />,
  "Add Expense": <Receipt className="h-3.5 w-3.5" />,
  "View Reports": <BarChart3 className="h-3.5 w-3.5" />,
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct?: number;
  pctTone?: "yellow" | "ink" | "muted";
}

const KpiCard: React.FC<KpiCardProps> = ({
  icon,
  label,
  value,
  pct,
  pctTone = "yellow",
}) => {
  const fillColor =
    pctTone === "yellow"
      ? "var(--v2-accent-strong)"
      : pctTone === "ink"
        ? "var(--v2-ink)"
        : "var(--v2-ink-subtle)";

  return (
    <SoftCard
      variant="glass"
      radius="lg"
      padding="md"
      className="min-h-[148px]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-v2-pill bg-v2-accent-soft text-v2-ink">
          {icon}
        </span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-v2-ink-muted font-semibold">
          {label}
        </span>
      </div>
      <div className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-none text-v2-ink mb-3">
        {value}
      </div>
      {typeof pct === "number" && (
        <div className="h-1 w-full rounded-full bg-v2-ring overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, pct * 100))}%`,
              backgroundColor: fillColor,
            }}
          />
        </div>
      )}
    </SoftCard>
  );
};

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
  quickActions,
  onQuickActionClick,
  isCreating,
}) => {
  const isCurrent = periodOffset === 0;
  const currentPeriodLabel = CURRENT_PERIOD_LABELS[timePeriod];
  const gaugePct = Math.max(0, Math.min(1, commMtdPct));
  const gaugePctLabel = Math.round(gaugePct * 100);

  return (
    <section className="v2-hero-backdrop pt-2 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-5">
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
          <div className="inline-flex items-center gap-1 v2-glass-pill rounded-v2-pill p-1">
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
                "h-7 px-3 text-[11px] font-semibold uppercase tracking-wider rounded-v2-pill transition-colors whitespace-nowrap",
                isCurrent
                  ? "text-v2-ink-subtle"
                  : "text-v2-ink-muted hover:bg-v2-accent-soft hover:text-v2-ink",
              )}
            >
              {currentPeriodLabel}
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

      {quickActions && quickActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {quickActions.map((qa) => {
            const disabled = !qa.hasAccess || isCreating;
            return (
              <button
                key={qa.action}
                type="button"
                disabled={disabled}
                onClick={() => onQuickActionClick?.(qa.action)}
                title={!qa.hasAccess ? qa.lockedTooltip : undefined}
                className={cn(
                  "v2-glass-pill rounded-v2-pill px-4 h-9 gap-2 text-xs font-semibold tracking-tight",
                  "text-v2-ink",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                {ACTION_ICONS[qa.action] ?? <Plus className="h-3.5 w-3.5" />}
                <span>{qa.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Policies"
          value={policiesCount.toLocaleString()}
          pct={apMtdPct}
          pctTone="yellow"
        />
        <KpiCard
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Premium"
          value={formatCompactCurrency(premiumWritten)}
          pct={apMtdPct}
          pctTone="ink"
        />
        <KpiCard
          icon={<Users className="h-3.5 w-3.5" />}
          label="Pipeline"
          value={formatCompactCurrency(pendingPipeline)}
          pct={undefined}
        />
        <SoftCard
          variant="glass"
          radius="lg"
          padding="md"
          className="flex flex-col items-center justify-between min-h-[148px]"
        >
          <div className="flex items-center gap-2 self-start mb-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-v2-ink-muted font-semibold">
              Comm Pace
            </span>
          </div>
          <ArcGauge
            value={gaugePct}
            size={170}
            thickness={11}
            centerLabel={
              <div className="flex flex-col items-center -mt-1">
                <span className="font-display text-3xl font-semibold leading-none text-v2-ink">
                  {gaugePctLabel}%
                </span>
                <span className="text-[9px] uppercase tracking-[0.16em] text-v2-ink-subtle mt-1">
                  vs target
                </span>
              </div>
            }
          />
        </SoftCard>
      </div>

      <SoftCard
        variant="glass"
        radius="lg"
        padding="lg"
        className="space-y-2.5"
      >
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
      </SoftCard>
    </section>
  );
};
