// src/features/chat-bot/components/analytics/AttributionTable.tsx

import { useState } from "react";
import { Link2, Unlink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BotAttribution } from "../../hooks/useChatBotAnalytics";
import { useUnlinkAttribution } from "../../hooks/useChatBotAnalytics";

export function AttributionTable({
  attributions,
}: {
  attributions: BotAttribution[];
}) {
  const unlinkMutation = useUnlinkAttribution();
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const handleUnlink = async (id: string) => {
    setUnlinkingId(id);
    try {
      await unlinkMutation.mutateAsync(id);
    } finally {
      setUnlinkingId(null);
    }
  };

  if (attributions.length === 0) {
    return (
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg text-center">
        <Link2 className="h-5 w-5 text-v2-ink-subtle dark:text-v2-ink-muted mx-auto mb-1" />
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          No attributed policies yet
        </p>
        <p className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted mt-0.5">
          Policies are automatically linked when a bot conversation matches a
          sale
        </p>
      </div>
    );
  }

  return (
    <div className="border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-v2-ring dark:border-v2-ring flex items-center gap-1.5">
        <Link2 className="h-3 w-3 text-v2-ink-subtle" />
        <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
          Attributed Policies
        </h4>
        <span className="text-[10px] text-v2-ink-subtle ml-auto">
          {attributions.length} total
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-v2-ring dark:border-v2-ring text-v2-ink-muted dark:text-v2-ink-subtle">
              <th className="text-left px-2 py-1 font-medium">Client</th>
              <th className="text-left px-2 py-1 font-medium">Policy</th>
              <th className="text-right px-2 py-1 font-medium">Premium</th>
              <th className="text-center px-2 py-1 font-medium">Type</th>
              <th className="text-center px-2 py-1 font-medium">Match</th>
              <th className="text-center px-2 py-1 font-medium">Confidence</th>
              <th className="text-right px-2 py-1 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {attributions.map((a) => {
              const clientName =
                a.policies?.clients?.name || a.lead_name || "Unknown";
              const premium =
                a.policies?.annual_premium ?? a.policies?.monthly_premium ?? 0;

              return (
                <tr
                  key={a.id}
                  className="border-b border-v2-ring dark:border-v2-ring/50 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30"
                >
                  <td className="px-2 py-1.5 text-v2-ink dark:text-v2-ink font-medium">
                    {clientName}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                      {a.policies?.policy_number || "—"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-v2-ink dark:text-v2-ink">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(premium)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1 py-0",
                        a.attribution_type === "bot_converted"
                          ? "border-success/40 text-success dark:border-success dark:text-success"
                          : "border-info/40 text-info dark:border-info dark:text-info",
                      )}
                    >
                      {a.attribution_type === "bot_converted"
                        ? "Converted"
                        : "Assisted"}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-v2-ink-muted dark:text-v2-ink-subtle capitalize">
                      {a.match_method.replace("auto_", "")}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <ConfidenceBadge score={a.confidence_score} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => handleUnlink(a.id)}
                      disabled={unlinkingId === a.id}
                      className="inline-flex items-center gap-0.5 text-[9px] text-destructive hover:text-destructive disabled:opacity-50"
                      title="Remove attribution"
                    >
                      {unlinkingId === a.id ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Unlink className="h-2.5 w-2.5" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span
      className={cn(
        "text-[9px] font-medium",
        pct >= 90
          ? "text-success"
          : pct >= 60
            ? "text-warning"
            : "text-destructive",
      )}
    >
      {pct}%
    </span>
  );
}
