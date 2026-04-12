// src/features/agent-roadmap/components/user/RoadmapProgressHeader.tsx
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
  const allDone = stats.requiredTotal > 0 && stats.percent === 100;

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
        onClick={() => navigate({ to: "/agent-roadmap" })}
        aria-label="Back to roadmaps"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate min-w-0">
        {roadmap.title}
      </h1>

      {allDone && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="h-3 w-3" />
          DONE
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 w-32">
          <Progress value={stats.percent} className="h-1.5 flex-1" />
          <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tabular-nums w-8 text-right">
            {stats.percent}%
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
          {stats.requiredDone}/{stats.requiredTotal} required
          {stats.optionalTotal > 0 && (
            <>
              {" "}
              · {stats.optionalDone}/{stats.optionalTotal} bonus
            </>
          )}
        </div>
      </div>
    </div>
  );
}
