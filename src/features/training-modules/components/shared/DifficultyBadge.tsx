import { Badge } from "@/components/ui/badge";
import { TINT } from "@/components/ui/StatusBadge";
import type { DifficultyLevel } from "../../types/training-module.types";

const DIFFICULTY_TINT: Record<DifficultyLevel, string> = {
  beginner: TINT.emerald,
  intermediate: TINT.amber,
  advanced: TINT.rose,
};

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  return (
    <Badge
      variant="outline"
      className={`text-[11px] px-1.5 py-0.5 capitalize ${DIFFICULTY_TINT[level]}`}
    >
      {level}
    </Badge>
  );
}
