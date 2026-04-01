// src/features/chat-bot/components/analytics/BotROI.tsx

import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotAttribution } from "../../hooks/useChatBotAnalytics";

export function BotROI({
  attributions,
  totalConversations,
  monthlyCost,
}: {
  attributions: BotAttribution[];
  totalConversations: number;
  monthlyCost: number;
}) {
  const totalPremium = attributions.reduce((sum, a) => {
    const annual = a.policies?.annual_premium;
    const monthly = a.policies?.monthly_premium;
    return sum + (annual ?? (monthly ? monthly * 12 : 0));
  }, 0);

  // Approximate agent commission as 70% of first year premium
  const estimatedRevenue = totalPremium * 0.7;
  const roiPercent =
    monthlyCost > 0
      ? ((estimatedRevenue - monthlyCost) / monthlyCost) * 100
      : 0;
  const revenuePerConvo =
    totalConversations > 0 ? estimatedRevenue / totalConversations : 0;
  const costPerConversion =
    attributions.length > 0 ? monthlyCost / attributions.length : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <DollarSign className="h-3 w-3 text-emerald-500" />
        <h4 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          ROI
        </h4>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Bot ROI
          </span>
          <span
            className={cn(
              "text-xs font-bold",
              roiPercent > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500",
            )}
          >
            {roiPercent > 0 ? "+" : ""}
            {roiPercent.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Est. Revenue
          </span>
          <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
            {fmt(estimatedRevenue)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Revenue / Convo
          </span>
          <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
            {fmt(revenuePerConvo)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Cost / Conversion
          </span>
          <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
            {costPerConversion > 0 ? fmt(costPerConversion) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
