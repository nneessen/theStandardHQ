// src/features/chat-bot/components/analytics/TimelineChart.tsx
// Simple ASCII-style bar chart for daily trends (no external chart library dependency)

import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  date: string;
  conversations: number;
  appointments: number;
  conversions: number;
}

export function TimelineChart({ data }: { data: TimelineEntry[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-2.5 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <BarChart3 className="h-3 w-3 text-v2-ink-subtle" />
          <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
            Timeline
          </h4>
        </div>
        <p className="text-[10px] text-v2-ink-subtle text-center py-4">
          No timeline data available
        </p>
      </div>
    );
  }

  const maxConvo = Math.max(...data.map((d) => d.conversations), 1);

  return (
    <div className="p-2.5 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="h-3 w-3 text-blue-500" />
        <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
          Daily Trend
        </h4>
        <div className="ml-auto flex items-center gap-2">
          <Legend color="bg-blue-400" label="Conversations" />
          <Legend color="bg-violet-400" label="Appointments" />
          <Legend color="bg-emerald-400" label="Conversions" />
        </div>
      </div>

      <div className="flex items-end gap-px h-20">
        {data.map((d, i) => {
          const convoH = (d.conversations / maxConvo) * 100;
          const apptH = (d.appointments / maxConvo) * 100;
          const convH = (d.conversions / maxConvo) * 100;
          const dateLabel = new Date(d.date).toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
          });

          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-px group relative"
              title={`${dateLabel}: ${d.conversations} convos, ${d.appointments} appts, ${d.conversions} conv`}
            >
              <div className="flex items-end gap-px w-full h-16">
                <div
                  className="flex-1 bg-blue-400/70 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(convoH, 2)}%` }}
                />
                <div
                  className="flex-1 bg-violet-400/70 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(apptH, 0)}%` }}
                />
                <div
                  className="flex-1 bg-emerald-400/70 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(convH, 0)}%` }}
                />
              </div>
              {/* Show date labels for every 7th bar or first/last */}
              {(i === 0 || i === data.length - 1 || i % 7 === 0) && (
                <span className="text-[8px] text-v2-ink-subtle mt-0.5">
                  {dateLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <div className={cn("w-1.5 h-1.5 rounded-sm", color)} />
      <span className="text-[8px] text-v2-ink-subtle">{label}</span>
    </div>
  );
}
