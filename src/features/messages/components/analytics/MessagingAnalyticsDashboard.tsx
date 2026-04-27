// src/features/messages/components/analytics/MessagingAnalyticsDashboard.tsx
// Main analytics dashboard showing KPIs across all messaging platforms

import { useState } from "react";
import { Loader2, BarChart3, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessagingAnalytics } from "../../hooks/useMessagingAnalytics";
import { useEmailQuota } from "../../hooks/useSendEmail";
import { EmailKpiCard } from "./EmailKpiCard";
import { InstagramKpiCard } from "./InstagramKpiCard";
import { SlackKpiCard } from "./SlackKpiCard";
import { QuotaUsageCard } from "./QuotaUsageCard";

type Period = "7d" | "30d" | "90d";

export function MessagingAnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>("30d");
  const {
    data: analytics,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useMessagingAnalytics(period);
  const { remainingDaily, quota } = useEmailQuota();

  const periods: { value: Period; label: string }[] = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
  ];

  return (
    <div className="h-full flex flex-col bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-v2-ring flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-v2-ink-muted" />
            <h2 className="text-sm font-semibold text-v2-ink">
              Messaging Analytics
            </h2>
            {/* Loading indicator for background refetches */}
            {isFetching && !isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle" />
            )}
          </div>
          <p className="text-[10px] text-v2-ink-muted mt-0.5">
            Performance overview across all platforms
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-v2-ring rounded-md p-0.5">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "ghost"}
              size="sm"
              className={`h-6 px-2 text-[10px] ${
                period === p.value
                  ? "bg-white dark:bg-v2-card-dark shadow-sm"
                  : "hover:bg-v2-ring/50 dark:hover:bg-v2-card-dark/50"
              }`}
              onClick={() => setPeriod(p.value)}
              disabled={isFetching}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-[11px] font-medium text-v2-ink-muted">
              Failed to load analytics
            </p>
            <p className="text-[10px] text-v2-ink-muted mt-1 max-w-xs">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] mt-3"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <EmailKpiCard data={analytics?.email} />
              <InstagramKpiCard data={analytics?.instagram} />
              <SlackKpiCard data={analytics?.slack} />
              <QuotaUsageCard
                dailyUsed={quota?.dailyUsed ?? 0}
                dailyLimit={quota?.dailyLimit ?? 50}
                remaining={remainingDaily}
              />
            </div>

            {/* Info Note */}
            <p className="text-[10px] text-v2-ink-subtle text-center pt-2">
              Data shown for the last{" "}
              {period === "7d" ? "7" : period === "30d" ? "30" : "90"} days
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
