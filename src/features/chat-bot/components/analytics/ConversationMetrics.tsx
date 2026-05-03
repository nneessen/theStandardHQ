// src/features/chat-bot/components/analytics/ConversationMetrics.tsx

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBotAnalytics } from "../../hooks/useChatBotAnalytics";

export function ConversationMetrics({
  data,
}: {
  data: ChatBotAnalytics["conversations"];
}) {
  // Backend now buckets raw statuses into {active, completed, stale} —
  // there is no raw "open" key to subtract, so we display the full total.
  const total = data.total ?? 0;
  const avgMsgs = data.avgMessagesPerConvo ?? 0;
  const suppression = Math.min(data.suppressionRate ?? 0, 1);
  const stale = Math.min(data.staleRate ?? 0, 1);
  const statusEntries = Object.entries(data.byStatus || {}).sort(
    ([, a], [, b]) => b - a,
  );
  const channelEntries = Object.entries(data.byChannel || {}).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="p-2.5 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="h-3 w-3 text-info" />
        <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
          Conversations
        </h4>
        <span className="ml-auto text-sm font-bold text-v2-ink dark:text-v2-ink">
          {total.toLocaleString()}
        </span>
      </div>

      {/* Status Breakdown */}
      {statusEntries.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-[9px] font-medium text-v2-ink-subtle uppercase tracking-wider">
            By Status
          </p>
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle capitalize">
                {status.replace(/_/g, " ")}
              </span>
              <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Channel Mix */}
      {channelEntries.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-[9px] font-medium text-v2-ink-subtle uppercase tracking-wider">
            By Channel
          </p>
          {channelEntries.map(([channel, count]) => (
            <div key={channel} className="flex items-center justify-between">
              <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase">
                {channel}
              </span>
              <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Rates */}
      <div className="pt-1.5 border-t border-v2-ring dark:border-v2-ring space-y-1">
        <RateRow label="Avg msgs/convo" value={avgMsgs.toFixed(1)} />
        <RateRow
          label="Suppression rate"
          value={`${(suppression * 100).toFixed(1)}%`}
          warn={suppression > 0.3}
        />
        <RateRow
          label="Stale rate"
          value={`${(stale * 100).toFixed(1)}%`}
          warn={stale > 0.4}
        />
      </div>
    </div>
  );
}

function RateRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        {label}
      </span>
      <span
        className={cn(
          "text-[10px] font-medium",
          warn ? "text-warning" : "text-v2-ink dark:text-v2-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
