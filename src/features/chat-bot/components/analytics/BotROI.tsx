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
    <div className="p-2.5 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <DollarSign className="h-3 w-3 text-success" />
        <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
          ROI
        </h4>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Bot ROI
          </span>
          <span
            className={cn(
              "text-xs font-bold",
              roiPercent > 0 ? "text-success" : "text-destructive",
            )}
          >
            {roiPercent > 0 ? "+" : ""}
            {roiPercent.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Est. Revenue
          </span>
          <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink">
            {fmt(estimatedRevenue)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Revenue / Convo
          </span>
          <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink">
            {fmt(revenuePerConvo)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Cost / Conversion
          </span>
          <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink">
            {costPerConversion > 0 ? fmt(costPerConversion) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
