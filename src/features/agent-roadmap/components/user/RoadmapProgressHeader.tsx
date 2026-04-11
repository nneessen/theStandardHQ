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
    <div className="border-b border-border bg-card shadow-sm sticky top-0 z-10 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-6 py-5">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={() => navigate({ to: "/agent-roadmap" })}
            aria-label="Back to roadmap list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate tracking-tight">
              {roadmap.title}
            </h1>
            {roadmap.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {roadmap.description}
              </p>
            )}
          </div>
          {allDone && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success border border-success/20">
              <Sparkles className="h-3.5 w-3.5" />
              COMPLETE
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {stats.requiredDone} of {stats.requiredTotal} required items done
            </span>
            <span className="text-base font-bold text-foreground tabular-nums">
              {stats.percent}%
            </span>
          </div>
          <Progress value={stats.percent} className="h-2" />
          {stats.optionalTotal > 0 && (
            <div className="text-[11px] text-muted-foreground pt-0.5">
              Plus {stats.optionalDone} of {stats.optionalTotal} bonus items
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
