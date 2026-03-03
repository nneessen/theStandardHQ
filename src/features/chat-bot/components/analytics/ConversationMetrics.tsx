// src/features/chat-bot/components/analytics/ConversationMetrics.tsx

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBotAnalytics } from "../../hooks/useChatBotAnalytics";

export function ConversationMetrics({
  data,
}: {
  data: ChatBotAnalytics["conversations"];
}) {
  const openCount = data.byStatus?.open ?? 0;
  const total = Math.max(0, (data.total ?? 0) - openCount);
  const avgMsgs = data.avgMessagesPerConvo ?? 0;
  const suppression = data.suppressionRate ?? 0;
  const stale = data.staleRate ?? 0;
  const statusEntries = Object.entries(data.byStatus || {}).sort(
    ([, a], [, b]) => b - a,
  );
  const channelEntries = Object.entries(data.byChannel || {}).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="h-3 w-3 text-blue-500" />
        <h4 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          Conversations
        </h4>
        <span className="ml-auto text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {total.toLocaleString()}
        </span>
      </div>

      {/* Status Breakdown */}
      {statusEntries.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">
            By Status
          </p>
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600 dark:text-zinc-400 capitalize">
                {status.replace(/_/g, " ")}
              </span>
              <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Channel Mix */}
      {channelEntries.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">
            By Channel
          </p>
          {channelEntries.map(([channel, count]) => (
            <div key={channel} className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600 dark:text-zinc-400 uppercase">
                {channel}
              </span>
              <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Rates */}
      <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
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
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={cn(
          "text-[10px] font-medium",
          warn
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {value}
      </span>
    </div>
  );
}
