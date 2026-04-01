// src/features/chat-bot/components/analytics/ConversionMetrics.tsx

import { TrendingUp } from "lucide-react";
import type { BotAttribution } from "../../hooks/useChatBotAnalytics";

export function ConversionMetrics({
  attributions,
  totalConversations,
}: {
  attributions: BotAttribution[];
  totalConversations: number;
}) {
  const botConverted = attributions.filter(
    (a) => a.attribution_type === "bot_converted",
  ).length;
  const botAssisted = attributions.filter(
    (a) => a.attribution_type === "bot_assisted",
  ).length;
  const totalPremium = attributions.reduce((sum, a) => {
    const annual = a.policies?.annual_premium;
    const monthly = a.policies?.monthly_premium;
    return sum + (annual ?? (monthly ? monthly * 12 : 0));
  }, 0);
  const conversionRate =
    totalConversations > 0
      ? ((attributions.length / totalConversations) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp className="h-3 w-3 text-emerald-500" />
        <h4 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          Attribution
        </h4>
        <span className="ml-auto text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {attributions.length}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Bot Converted
          </span>
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            {botConverted}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Bot Assisted
          </span>
          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
            {botAssisted}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Conversion Rate
          </span>
          <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
            {conversionRate}%
          </span>
        </div>
        <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Attributed Premium
          </span>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(totalPremium)}
          </span>
        </div>
      </div>
    </div>
  );
}
