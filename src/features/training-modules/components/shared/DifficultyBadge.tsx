import { Badge } from "@/components/ui/badge";
import type { DifficultyLevel } from "../../types/training-module.types";

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  beginner: "bg-success/20 text-success dark:bg-success/15 dark:text-success",
  intermediate:
    "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning",
  advanced:
    "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
};

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] px-1.5 py-0 h-4 capitalize ${DIFFICULTY_COLORS[level]}`}
    >
      {level}
    </Badge>
  );
}
