import { useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceCloneScript } from "@/features/chat-bot";

interface ScriptSidebarProps {
  scripts: VoiceCloneScript[];
  completedIndices: Set<number>;
  activeIndex: number;
  onSelectScript: (index: number) => void;
  completedSegments: number;
  totalSegments: number;
  totalAudioMinutes: number;
  minimumAudioMinutes: number;
}

interface ScriptGroup {
  category: string;
  scripts: VoiceCloneScript[];
}

export function ScriptSidebar({
  scripts,
  completedIndices,
  activeIndex,
  onSelectScript,
  completedSegments,
  totalSegments,
  totalAudioMinutes,
  minimumAudioMinutes,
}: ScriptSidebarProps) {
  const groups = useMemo(() => {
    const map = new Map<string, VoiceCloneScript[]>();
    for (const script of scripts) {
      const existing = map.get(script.category) || [];
      existing.push(script);
      map.set(script.category, existing);
    }
    const result: ScriptGroup[] = [];
    for (const [category, items] of map) {
      result.push({ category, scripts: items });
    }
    return result;
  }, [scripts]);

  const progressPct =
    totalSegments > 0
      ? Math.round((completedSegments / totalSegments) * 100)
      : 0;

  const audioPct =
    minimumAudioMinutes > 0
      ? Math.min(
          100,
          Math.round((totalAudioMinutes / minimumAudioMinutes) * 100),
        )
      : 0;

  return (
    <div className="flex h-full w-[264px] flex-shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/30">
      {/* Progress summary */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {completedSegments}/{totalSegments} recorded
          </span>
          <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
            {totalAudioMinutes.toFixed(1)} / {minimumAudioMinutes} min
          </span>
        </div>
        {/* Segment progress bar */}
        <div className="mt-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Audio minutes progress bar */}
        <div className="mt-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              audioPct >= 100
                ? "bg-emerald-500"
                : "bg-zinc-400 dark:bg-zinc-500",
            )}
            style={{ width: `${audioPct}%` }}
          />
        </div>
      </div>

      {/* Script list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {groups.map((group) => (
          <div key={group.category}>
            <div className="sticky top-0 z-10 bg-zinc-50/95 px-3 py-1.5 backdrop-blur-sm dark:bg-zinc-950/95">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {group.category}
              </span>
            </div>
            {group.scripts.map((script) => {
              const isCompleted = completedIndices.has(script.segmentIndex);
              const isActive = script.segmentIndex === activeIndex;
              return (
                <button
                  key={script.segmentIndex}
                  type="button"
                  onClick={() => onSelectScript(script.segmentIndex)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/30"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                  )}
                >
                  {/* Status indicator */}
                  {isCompleted ? (
                    <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <div
                      className={cn(
                        "h-2 w-2 flex-shrink-0 rounded-full",
                        isActive
                          ? "bg-indigo-500"
                          : "bg-zinc-300 dark:bg-zinc-600",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "flex-1 truncate text-[11px]",
                      isActive
                        ? "font-medium text-indigo-700 dark:text-indigo-300"
                        : isCompleted
                          ? "text-zinc-500 dark:text-zinc-400"
                          : "text-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    {script.title}
                  </span>
                  {script.optional && !isCompleted && (
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                      opt
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
