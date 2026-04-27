// src/components/ui/rank-badge.tsx
// Reusable rank badge component for leaderboards and rankings

import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: number;
  /** Size variant - affects icon and container size */
  size?: "sm" | "md";
  /** Whether to highlight top 10 ranks with accent color */
  highlightTop10?: boolean;
}

/**
 * Displays a rank badge with special styling for top 3 positions
 * - 1st place: Gold trophy
 * - 2nd place: Silver medal
 * - 3rd place: Bronze award
 * - 4+: Numeric display
 */
export function RankBadge({
  rank,
  size = "sm",
  highlightTop10 = true,
}: RankBadgeProps) {
  const containerSize = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  if (rank === 1) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm",
          containerSize,
        )}
      >
        <Trophy className={cn(iconSize, "text-amber-900")} />
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 shadow-sm",
          containerSize,
        )}
      >
        <Medal className={cn(iconSize, "text-v2-ink")} />
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm",
          containerSize,
        )}
      >
        <Award className={cn(iconSize, "text-orange-900")} />
      </div>
    );
  }

  return (
    <span
      className={cn(
        "font-mono font-semibold w-6 text-center",
        textSize,
        highlightTop10 && rank <= 10
          ? "text-amber-600 dark:text-amber-400"
          : "text-v2-ink-subtle",
      )}
    >
      {rank}
    </span>
  );
}
