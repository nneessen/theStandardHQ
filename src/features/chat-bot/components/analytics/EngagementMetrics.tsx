// src/features/chat-bot/components/analytics/EngagementMetrics.tsx

import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBotAnalytics } from "../../hooks/useChatBotAnalytics";

export function EngagementMetrics({
  data,
  messagePerformance,
}: {
  data: ChatBotAnalytics["engagement"];
  messagePerformance: ChatBotAnalytics["messagePerformance"];
}) {
  const responseRate = Math.min(data.responseRate ?? 0, 1);
  const multiTurnRate = Math.min(data.multiTurnRate ?? 0, 1);
  const avgFirstResponseMin = data.avgFirstResponseMin ?? 0;
  const avgObjectionCount = data.avgObjectionCount ?? 0;
  const hardNoRate = Math.min(data.hardNoRate ?? 0, 1);
  const positiveRate = Math.min(messagePerformance.positiveRate ?? 0, 1);
  const negativeRate = Math.min(messagePerformance.negativeRate ?? 0, 1);
  const topReplyCategories = messagePerformance.topReplyCategories ?? [];

  const rows = [
    {
      label: "Response Rate",
      value: `${(responseRate * 100).toFixed(1)}%`,
      good: responseRate > 0.5,
    },
    {
      label: "Multi-turn Rate",
      value: `${(multiTurnRate * 100).toFixed(1)}%`,
      good: multiTurnRate > 0.3,
    },
    {
      label: "Avg First Response",
      value: `${avgFirstResponseMin.toFixed(0)} min`,
      good: avgFirstResponseMin < 5,
    },
    {
      label: "Avg Objections",
      value: avgObjectionCount.toFixed(1),
      good: true,
    },
    {
      label: "Hard No Rate",
      value: `${(hardNoRate * 100).toFixed(1)}%`,
      good: hardNoRate < 0.2,
    },
    {
      label: "Positive Outcome",
      value: `${(positiveRate * 100).toFixed(1)}%`,
      good: positiveRate >= 0.3,
    },
    {
      label: "Negative Outcome",
      value: `${(negativeRate * 100).toFixed(1)}%`,
      good: negativeRate < 0.25,
    },
  ];

  return (
    <div className="p-2.5 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="h-3 w-3 text-warning" />
        <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
          Engagement
        </h4>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {r.label}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium",
                r.good ? "text-v2-ink dark:text-v2-ink" : "text-warning",
              )}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {topReplyCategories.length > 0 ? (
        <div className="mt-2 border-t border-v2-ring dark:border-v2-ring pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Top Reply Types
            </span>
            <span className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted">
              Pos / Neg
            </span>
          </div>
          {topReplyCategories.slice(0, 3).map((row) => (
            <div
              key={row.category}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-[10px] text-v2-ink dark:text-v2-ink-muted truncate">
                {row.category.replace(/_/g, " ")}
              </span>
              <span className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle whitespace-nowrap">
                {Math.round((row.positiveRate ?? 0) * 100)}% /{" "}
                {Math.round((row.negativeRate ?? 0) * 100)}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
