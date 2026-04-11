// src/features/agent-roadmap/components/user/RoadmapProgressHeader.tsx
import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { RoadmapTree, RoadmapCompletionStats } from "../../types/roadmap";

interface RoadmapProgressHeaderProps {
  roadmap: RoadmapTree;
  stats: RoadmapCompletionStats;
}

export function RoadmapProgressHeader({
  roadmap,
  stats,
}: RoadmapProgressHeaderProps) {
  const navigate = useNavigate();
  const allDone = stats.percent === 100;

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigate({ to: "/agent-roadmap" })}
            aria-label="Back to roadmap list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {roadmap.title}
            </h1>
            {roadmap.description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {roadmap.description}
              </p>
            )}
          </div>
          {allDone && (
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Complete
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">
              {stats.requiredDone} of {stats.requiredTotal} required items done
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {stats.percent}%
            </span>
          </div>
          <Progress value={stats.percent} className="h-1.5" />
          {stats.optionalTotal > 0 && (
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {stats.optionalDone} of {stats.optionalTotal} bonus items done
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
