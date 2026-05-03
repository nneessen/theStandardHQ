// src/features/messages/components/analytics/SlackKpiCard.tsx
// Slack KPI card showing sent and success rate

import { MessageSquare, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SlackAnalytics } from "../../hooks/useMessagingAnalytics";

interface SlackKpiCardProps {
  data?: SlackAnalytics;
}

export function SlackKpiCard({ data }: SlackKpiCardProps) {
  return (
    <Card className="border-v2-ring">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-6 rounded bg-info/10 flex items-center justify-center">
              <MessageSquare className="h-3 w-3 text-info" />
            </div>
            <span className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
              Slack
            </span>
          </div>
        </div>

        {/* Main Metric */}
        <div className="mb-2">
          <p className="text-lg font-semibold text-v2-ink">
            {data?.totalSent ?? 0}
          </p>
          <p className="text-[10px] text-v2-ink-muted">messages sent</p>
        </div>

        {/* Sub Metrics */}
        <div className="space-y-1 pt-2 border-t border-v2-ring/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-v2-ink-muted flex items-center gap-1">
              <CheckCircle className="h-2.5 w-2.5" />
              Success rate
            </span>
            <span className="text-[10px] font-medium text-v2-ink-muted">
              {data?.successRate ?? 0}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-v2-ink-muted flex items-center gap-1">
              <XCircle className="h-2.5 w-2.5" />
              Failed
            </span>
            <span className="text-[10px] font-medium text-v2-ink-muted">
              {data?.failed ?? 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
