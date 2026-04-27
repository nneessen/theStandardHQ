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
    <div className="flex h-full w-[264px] flex-shrink-0 flex-col border-r border-v2-ring bg-v2-canvas/50 dark:border-v2-ring dark:bg-v2-canvas/30">
      {/* Progress summary */}
      <div className="border-b border-v2-ring p-3 dark:border-v2-ring">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
            {completedSegments}/{totalSegments} recorded
          </span>
          <span className="text-[10px] tabular-nums text-v2-ink-subtle dark:text-v2-ink-muted">
            {totalAudioMinutes.toFixed(1)} / {minimumAudioMinutes} min
          </span>
        </div>
        {/* Segment progress bar */}
        <div className="mt-1.5 h-1.5 rounded-full bg-v2-ring dark:bg-v2-ring-strong">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Audio minutes progress bar */}
        <div className="mt-1 h-1 rounded-full bg-v2-ring dark:bg-v2-ring-strong">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              audioPct >= 100 ? "bg-emerald-500" : "bg-v2-ink-subtle",
            )}
            style={{ width: `${audioPct}%` }}
          />
        </div>
      </div>

      {/* Script list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {groups.map((group) => (
          <div key={group.category}>
            <div className="sticky top-0 z-10 bg-v2-canvas/95 px-3 py-1.5 backdrop-blur-sm dark:bg-v2-canvas/95">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-v2-ink-subtle dark:text-v2-ink-muted">
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
                      : "hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted/50",
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
                          : "bg-v2-ring-strong dark:bg-v2-ring-strong",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "flex-1 truncate text-[11px]",
                      isActive
                        ? "font-medium text-indigo-700 dark:text-indigo-300"
                        : isCompleted
                          ? "text-v2-ink-muted dark:text-v2-ink-subtle"
                          : "text-v2-ink dark:text-v2-ink-muted",
                    )}
                  >
                    {script.title}
                  </span>
                  {script.optional && !isCompleted && (
                    <span className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted">
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
