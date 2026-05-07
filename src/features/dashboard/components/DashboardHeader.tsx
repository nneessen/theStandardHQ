import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  Trophy,
  Lock,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { PillNav, type PillNavItem } from "@/components/v2";
import { TimePeriod } from "../../../utils/dateRange";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardHeaderProps {
  periodTitle: string;
  daysSubtitle?: string;
  timePeriod: TimePeriod;
  onTimePeriodChange: (p: TimePeriod) => void;
  periodOffset: number;
  onOffsetChange: (n: number) => void;
  onAddPolicy: () => void;
  onAddExpense: () => void;
  canAddExpense: boolean;
  isCreating: boolean;
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

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  periodTitle,
  daysSubtitle,
  timePeriod,
  onTimePeriodChange,
  periodOffset,
  onOffsetChange,
  onAddPolicy,
  onAddExpense,
  canAddExpense,
  isCreating,
}) => {
  const navigate = useNavigate();
  const isCurrent = periodOffset === 0;
  const currentPeriodLabel = CURRENT_PERIOD_LABELS[timePeriod];

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4 pb-4 border-b border-v2-ring">
      <div className="flex items-baseline gap-3 flex-wrap min-w-0">
        <h1 className="font-semibold text-v2-ink text-base lg:text-lg tracking-tight tabular-nums whitespace-nowrap">
          {periodTitle}
        </h1>
        {daysSubtitle && (
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle font-mono tabular-nums">
            {daysSubtitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
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
              "h-7 px-3 text-[11px] font-semibold uppercase tracking-wider rounded-v2-pill transition-colors whitespace-nowrap",
              isCurrent
                ? "text-v2-ink-subtle cursor-default"
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
                ? "text-v2-ink-subtle/60 cursor-default"
                : "text-v2-ink-muted hover:bg-v2-accent-soft hover:text-v2-ink",
            )}
            aria-label="Next period"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          <button
            type="button"
            onClick={() => navigate({ to: "/leaderboard" })}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-v2-pill text-[12px] font-semibold text-v2-ink-muted hover:text-v2-ink hover:bg-v2-accent-soft transition-colors"
          >
            <Trophy className="h-3.5 w-3.5" />
            Leaderboard
          </button>

          {canAddExpense ? (
            <button
              type="button"
              onClick={onAddExpense}
              disabled={isCreating}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-v2-pill text-[12px] font-semibold border border-v2-ring transition-colors whitespace-nowrap",
                "bg-v2-card text-v2-ink-muted hover:bg-v2-card-tinted hover:text-v2-ink",
                isCreating && "opacity-60 cursor-not-allowed",
              )}
            >
              <Receipt className="h-3.5 w-3.5" />
              Expense
            </button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/billing" })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-v2-pill text-[12px] font-semibold text-v2-ink-subtle hover:text-warning hover:bg-warning/5 border border-dashed border-v2-ring transition-colors whitespace-nowrap"
                  >
                    <Lock className="h-3 w-3" />
                    Expense
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  Upgrade to Pro to track expenses
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <button
            type="button"
            onClick={onAddPolicy}
            disabled={isCreating}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-v2-pill text-[12px] font-semibold transition-colors whitespace-nowrap",
              "bg-v2-ink text-v2-canvas hover:bg-v2-ink/90",
              isCreating && "opacity-60 cursor-not-allowed",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Policy
          </button>
        </div>
      </div>
    </header>
  );
};
