import React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { AlertConfig } from "@/types/dashboard.types";
import { cn } from "@/lib/utils";

interface EditorialAlertsProps {
  alerts: AlertConfig[];
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

export const EditorialAlerts: React.FC<EditorialAlertsProps> = ({ alerts }) => {
  const activeAlerts = alerts.filter((a) => a.condition);

  return (
    <section>
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
    </section>
  );
};
