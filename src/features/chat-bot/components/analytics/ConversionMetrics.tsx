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
    <div className="p-2.5 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp className="h-3 w-3 text-success" />
        <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
          Attribution
        </h4>
        <span className="ml-auto text-sm font-bold text-v2-ink dark:text-v2-ink">
          {attributions.length}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Bot Converted
          </span>
          <span className="text-[10px] font-medium text-success">
            {botConverted}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Bot Assisted
          </span>
          <span className="text-[10px] font-medium text-info">
            {botAssisted}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Conversion Rate
          </span>
          <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink">
            {conversionRate}%
          </span>
        </div>
        <div className="pt-1.5 border-t border-v2-ring dark:border-v2-ring flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Attributed Premium
          </span>
          <span className="text-xs font-bold text-success">
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
