// src/features/messages/components/analytics/QuotaUsageCard.tsx
// Daily quota usage card

import { Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface QuotaUsageCardProps {
  dailyUsed: number;
  dailyLimit: number;
  remaining: number;
}

export function QuotaUsageCard({
  dailyUsed,
  dailyLimit,
  remaining,
}: QuotaUsageCardProps) {
  const percentUsed = dailyLimit > 0 ? (dailyUsed / dailyLimit) * 100 : 0;
  const isWarning = percentUsed >= 80;
  const isCritical = percentUsed >= 95;

  return (
    <Card className="border-v2-ring">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-6 rounded bg-warning/10 flex items-center justify-center">
              <Gauge className="h-3 w-3 text-warning" />
            </div>
            <span className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
              Quota
            </span>
          </div>
        </div>

        {/* Main Metric */}
        <div className="mb-2">
          <p className="text-lg font-semibold text-v2-ink">
            {dailyUsed}/{dailyLimit}
          </p>
          <p className="text-[10px] text-v2-ink-muted">daily emails</p>
        </div>

        {/* Progress Bar */}
        <div className="pt-2 border-t border-v2-ring/60">
          <div className="h-1.5 bg-v2-ring rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isCritical
                  ? "bg-destructive"
                  : isWarning
                    ? "bg-warning"
                    : "bg-success"
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          <p
            className={`text-[10px] mt-1 ${
              isCritical
                ? "text-destructive"
                : isWarning
                  ? "text-warning"
                  : "text-v2-ink-muted"
            }`}
          >
            {remaining} remaining today
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
