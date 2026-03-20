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
  const responseRate = data.responseRate ?? 0;
  const multiTurnRate = data.multiTurnRate ?? 0;
  const avgFirstResponseMin = data.avgFirstResponseMin ?? 0;
  const avgObjectionCount = data.avgObjectionCount ?? 0;
  const hardNoRate = data.hardNoRate ?? 0;
  const positiveRate = messagePerformance.positiveRate ?? 0;
  const negativeRate = messagePerformance.negativeRate ?? 0;
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
    <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="h-3 w-3 text-amber-500" />
        <h4 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          Engagement
        </h4>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {r.label}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium",
                r.good
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {topReplyCategories.length > 0 ? (
        <div className="mt-2 border-t border-zinc-200 dark:border-zinc-800 pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Top Reply Types
            </span>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
              Pos / Neg
            </span>
          </div>
          {topReplyCategories.slice(0, 3).map((row) => (
            <div
              key={row.category}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-[10px] text-zinc-700 dark:text-zinc-300 truncate">
                {row.category.replace(/_/g, " ")}
              </span>
              <span className="text-[9px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
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
