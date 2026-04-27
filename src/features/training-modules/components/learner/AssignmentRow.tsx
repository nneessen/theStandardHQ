// src/features/training-modules/components/learner/AssignmentRow.tsx
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { DifficultyBadge } from "../shared/DifficultyBadge";
import { ProgressBar } from "../shared/ProgressBar";
import type { TrainingAssignment } from "../../types/training-module.types";
import { useModuleProgressSummary } from "../../hooks/useTrainingProgress";

interface AssignmentRowProps {
  assignment: TrainingAssignment;
}

export function AssignmentRow({ assignment }: AssignmentRowProps) {
  const module = assignment.module;
  const { data: progress = [] } = useModuleProgressSummary(
    assignment.module_id,
  );

  if (!module) return null;

  const totalLessons = progress.length;
  const completedLessons = progress.filter(
    (p) => p.status === "completed",
  ).length;
  const pct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isComplete = totalLessons > 0 && completedLessons === totalLessons;
  const isOverdue =
    !isComplete &&
    assignment.due_date &&
    new Date(assignment.due_date) < new Date();
  const isHighPriority =
    assignment.priority === "high" || assignment.priority === "urgent";

  const formatDueDate = () => {
    if (!assignment.due_date) return "—";
    if (isComplete) return "Done";
    return new Date(assignment.due_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Link
      to={"/my-training/$moduleId" as string}
      params={{ moduleId: module.id } as Record<string, string>}
      className="block"
    >
      <div
        className={`flex items-center gap-3 px-2.5 py-1.5 rounded hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 transition-colors cursor-pointer text-[11px] ${
          isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""
        }`}
      >
        {/* Priority dot */}
        <div className="w-1.5 flex-shrink-0">
          {isHighPriority && (
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                assignment.priority === "urgent" ? "bg-red-500" : "bg-amber-500"
              }`}
            />
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <span className="text-v2-ink dark:text-v2-ink font-medium truncate block">
            {module.title}
          </span>
        </div>

        {/* Difficulty */}
        <div className="w-20 flex-shrink-0 hidden sm:block">
          <DifficultyBadge level={module.difficulty_level} />
        </div>

        {/* Progress bar + percentage */}
        <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
          <ProgressBar
            value={completedLessons}
            max={totalLessons}
            className="w-16"
          />
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle w-7 text-right tabular-nums">
            {pct}%
          </span>
        </div>

        {/* Lessons */}
        <div className="w-12 flex-shrink-0 text-v2-ink-muted dark:text-v2-ink-subtle text-right tabular-nums hidden md:block">
          {completedLessons}/{totalLessons}
        </div>

        {/* Due date */}
        <div
          className={`w-16 flex-shrink-0 text-right ${
            isOverdue
              ? "text-red-500 font-medium"
              : "text-v2-ink-muted dark:text-v2-ink-subtle"
          }`}
        >
          {isOverdue ? "Overdue" : formatDueDate()}
        </div>

        {/* XP */}
        <div className="w-10 flex-shrink-0 text-right text-v2-ink-muted dark:text-v2-ink-subtle tabular-nums hidden lg:block">
          {module.xp_reward}
        </div>

        {/* Chevron */}
        <ChevronRight className="h-3 w-3 text-v2-ink-subtle dark:text-v2-ink-muted flex-shrink-0" />
      </div>
    </Link>
  );
}
