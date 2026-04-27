// src/features/messages/components/analytics/InstagramKpiCard.tsx
// Instagram KPI card showing sent, delivered, read rates

import { Instagram, CheckCheck, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { InstagramAnalytics } from "../../hooks/useMessagingAnalytics";

interface InstagramKpiCardProps {
  data?: InstagramAnalytics;
}

export function InstagramKpiCard({ data }: InstagramKpiCardProps) {
  return (
    <Card className="border-v2-ring">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 flex items-center justify-center">
              <Instagram className="h-3 w-3 text-pink-500" />
            </div>
            <span className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
              Instagram
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
              <CheckCheck className="h-2.5 w-2.5" />
              Delivered
            </span>
            <span className="text-[10px] font-medium text-v2-ink-muted">
              {data?.deliveryRate ?? 0}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-v2-ink-muted flex items-center gap-1">
              <Eye className="h-2.5 w-2.5" />
              Read
            </span>
            <span className="text-[10px] font-medium text-v2-ink-muted">
              {data?.readRate ?? 0}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
