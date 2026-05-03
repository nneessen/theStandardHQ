import React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lock,
  Crown,
  Plus,
  Receipt,
  ArrowRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AlertConfig, QuickAction } from "../../../types/dashboard.types";
import { cn } from "@/lib/utils";

interface EditorialAlertsActionsProps {
  alerts: AlertConfig[];
  actions: QuickAction[];
  onActionClick: (action: string) => void;
  isCreating: boolean;
}

const ALERT_ICON: Record<AlertConfig["type"], React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
  error: AlertCircle,
};

const ALERT_TONE: Record<AlertConfig["type"], string> = {
  info: "text-info",
  warning: "text-warning",
  danger: "text-destructive",
  error: "text-destructive",
};

const ACTION_ICON: Record<string, React.ElementType> = {
  "Add Policy": Plus,
  "Add Expense": Receipt,
  "View Reports": ArrowRight,
};

export const EditorialAlertsActions: React.FC<EditorialAlertsActionsProps> = ({
  alerts,
  actions,
  onActionClick,
  isCreating,
}) => {
  const navigate = useNavigate();
  const activeAlerts = alerts.filter((a) => a.condition);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 py-6 border-t border-border">
      {/* ALERTS column */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Alerts
          </h2>
          {activeAlerts.length > 0 && (
            <span className="font-mono tabular-nums text-[11px] font-semibold text-warning">
              {activeAlerts.length} flagged
            </span>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <p className="text-[12px] italic text-muted-foreground">
            All clear — nothing flagged this period.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeAlerts.map((alert, i) => {
              const Icon = ALERT_ICON[alert.type] ?? Info;
              return (
                <li key={i} className="flex items-start gap-2">
                  <Icon
                    className={cn(
                      "h-3 w-3 mt-1 shrink-0",
                      ALERT_TONE[alert.type],
                    )}
                  />
                  <div className="min-w-0">
                    <span
                      className={cn(
                        "text-[12px] font-semibold",
                        ALERT_TONE[alert.type],
                      )}
                    >
                      {alert.title}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {" — "}
                      <span className="italic">{alert.message}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* QUICK ACTIONS column */}
      <div>
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-col gap-1.5">
          {actions.map((action, i) => {
            const Icon = ACTION_ICON[action.action] ?? Plus;
            const isLocked = action.hasAccess === false;

            if (isLocked) {
              return (
                <TooltipProvider key={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/billing" })}
                        className="group flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors text-left w-fit"
                      >
                        <Lock className="h-3 w-3 shrink-0" />
                        <span>{action.label}</span>
                        <span className="text-[9px] uppercase tracking-[0.18em] italic text-warning">
                          Upgrade
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="text-xs max-w-[220px]"
                    >
                      <div className="flex items-start gap-1.5">
                        <Crown className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">
                            {action.lockedTooltip ??
                              `Upgrade to ${action.requiredTier ?? "Starter"} to unlock`}
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
                key={i}
                type="button"
                onClick={() => onActionClick(action.action)}
                disabled={isCreating}
                className={cn(
                  "group flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors text-left w-fit",
                  isCreating && "opacity-60 cursor-not-allowed",
                )}
              >
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="border-b border-transparent group-hover:border-current">
                  {isCreating && action.label !== "View Reports"
                    ? `${action.label}...`
                    : action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
