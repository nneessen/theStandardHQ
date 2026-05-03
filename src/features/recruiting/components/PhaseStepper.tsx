// src/features/recruiting/components/PhaseStepper.tsx
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Clock, Ban, AlertCircle, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhaseStepperProps {
  sortedPhases: Array<{
    id: string;
    phase_name: string;
    phase_order: number;
    visible_to_recruit?: boolean;
    checklist_items?: unknown[];
  }>;
  progressMap: Map<string, { status: string; phase_id: string }>;
  completedCount: number;
  currentPhaseId: string | undefined;
  viewingPhaseId: string | undefined;
  onPhaseClick: (phaseId: string) => void;
}

export function PhaseStepper({
  sortedPhases,
  progressMap,
  completedCount,
  currentPhaseId,
  viewingPhaseId,
  onPhaseClick,
}: PhaseStepperProps) {
  const viewingPhase = sortedPhases.find((p) => p.id === viewingPhaseId);

  return (
    <div className="px-3 py-2 bg-card border-b border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Pipeline Progress
        </span>
        <span className="text-[10px] text-muted-foreground">
          {completedCount}/{sortedPhases.length} complete
        </span>
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-0.5">
          {sortedPhases.map((phase) => {
            const progress = progressMap.get(phase.id);
            const status = progress?.status || "not_started";
            const isActive = phase.id === viewingPhaseId;
            const isCurrent = phase.id === currentPhaseId;
            const isHidden = phase.visible_to_recruit === false;

            return (
              <Tooltip key={phase.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onPhaseClick(phase.id)}
                    className={cn(
                      "flex-1 h-7 rounded transition-all relative group",
                      "flex items-center justify-center",
                      status === "completed" && "bg-success hover:bg-success",
                      status === "in_progress" && "bg-warning hover:bg-warning",
                      status === "blocked" &&
                        "bg-destructive hover:bg-destructive",
                      status === "not_started" && "bg-muted hover:bg-muted ",
                      isActive && "ring-2 ring-foreground  ring-offset-1",
                      isHidden &&
                        "ring-1 ring-dashed ring-warning dark:ring-warning",
                    )}
                  >
                    {status === "completed" ? (
                      <Check className="h-3.5 w-3.5 text-white" />
                    ) : status === "in_progress" ? (
                      <Clock className="h-3 w-3 text-white" />
                    ) : status === "blocked" ? (
                      <Ban className="h-3 w-3 text-white" />
                    ) : null}
                    {isCurrent && status !== "completed" && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-warning" />
                    )}
                    {isHidden && (
                      <span className="absolute -top-1 -right-1">
                        <EyeOff className="h-2.5 w-2.5 text-warning" />
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{phase.phase_name}</p>
                  <p className="text-muted-foreground capitalize">
                    {status.replace("_", " ")}
                  </p>
                  {isHidden && (
                    <p className="text-warning text-[10px] mt-0.5">
                      Hidden from recruit
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      {viewingPhase && (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            {viewingPhase.phase_name}
          </span>
          {viewingPhaseId &&
            progressMap.get(viewingPhaseId)?.status === "blocked" && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                Blocked
              </Badge>
            )}
        </div>
      )}
    </div>
  );
}
