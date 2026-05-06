import React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Lock,
  Plus,
  Receipt,
  Trophy,
  Crown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { QuickAction } from "@/types/dashboard.types";
import { cn } from "@/lib/utils";

interface QuickActionsPanelProps {
  actions: QuickAction[];
  onActionClick: (action: string) => void;
  isCreating: boolean;
}

const ACTION_META: Record<
  string,
  { icon: React.ElementType; helper: string; tone: "primary" | "muted" }
> = {
  "Add Policy": {
    icon: Plus,
    helper: "Log a new sale",
    tone: "primary",
  },
  "Add Expense": {
    icon: Receipt,
    helper: "Track a business cost",
    tone: "muted",
  },
  Leaderboard: {
    icon: Trophy,
    helper: "See where you rank",
    tone: "muted",
  },
};

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  actions,
  onActionClick,
  isCreating,
}) => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col h-full">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
          Quick Actions
        </h2>
        <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">
          {actions.filter((a) => a.hasAccess !== false).length} available
        </span>
      </div>

      <div className="flex-1 flex flex-col gap-1.5">
        {actions.map((action) => {
          const meta = ACTION_META[action.action] ?? {
            icon: Plus,
            helper: "",
            tone: "muted" as const,
          };
          const Icon = meta.icon;
          const isLocked = action.hasAccess === false;
          const isPrimary = meta.tone === "primary";

          if (isLocked) {
            return (
              <TooltipProvider key={action.action}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/billing" })}
                      className="group flex items-center gap-3 rounded-md border border-dashed border-border/70 bg-card-tinted/40 px-3 py-2.5 text-left transition-all hover:border-warning/50 hover:bg-warning/5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground/70">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-muted-foreground">
                            {action.label}
                          </span>
                          <span className="text-[9px] uppercase tracking-[0.18em] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                            {action.requiredTier ?? "Pro"}
                          </span>
                        </span>
                        <span className="block text-[11px] text-muted-foreground/70 truncate">
                          {meta.helper}
                        </span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-warning" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs max-w-[220px]">
                    <div className="flex items-start gap-1.5">
                      <Crown className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">
                          {action.lockedTooltip ??
                            `Upgrade to ${action.requiredTier ?? "Pro"} to unlock`}
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          Click to view plans
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return (
            <button
              key={action.action}
              type="button"
              onClick={() => onActionClick(action.action)}
              disabled={isCreating}
              className={cn(
                "group relative flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all",
                isPrimary
                  ? "border-foreground/15 bg-foreground/[0.04] hover:bg-foreground/[0.08] hover:border-foreground/25 dark:bg-foreground/[0.06] dark:hover:bg-foreground/[0.10]"
                  : "border-border/60 bg-card hover:bg-card-tinted hover:border-border",
                isCreating && "opacity-60 cursor-not-allowed",
              )}
            >
              {isPrimary && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />
              )}
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                  isPrimary
                    ? "bg-accent/15 text-accent"
                    : "bg-muted text-muted-foreground group-hover:bg-foreground/10 group-hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold tracking-tight",
                    isPrimary ? "text-foreground" : "text-foreground",
                  )}
                >
                  {isCreating && action.action !== "Leaderboard"
                    ? `${action.label}…`
                    : action.label}
                </span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {meta.helper}
                </span>
              </span>
              <ArrowRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-all",
                  isPrimary
                    ? "text-accent group-hover:translate-x-0.5"
                    : "text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5",
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
};
