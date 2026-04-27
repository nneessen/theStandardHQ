import { Award, Lock } from "lucide-react";
import type { TrainingBadge } from "../../types/training-module.types";

interface BadgeCardProps {
  badge: TrainingBadge;
  earned: boolean;
  earnedAt?: string;
}

export function BadgeCard({ badge, earned, earnedAt }: BadgeCardProps) {
  return (
    <div
      className={`relative flex flex-col items-center p-2.5 rounded-lg border text-center transition-all ${
        earned
          ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
          : "border-v2-ring dark:border-v2-ring bg-v2-canvas dark:bg-v2-card opacity-50"
      }`}
    >
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center mb-1.5 ${
          earned ? "" : "grayscale"
        }`}
        style={{ backgroundColor: earned ? badge.color + "20" : undefined }}
      >
        {earned ? (
          <Award className="h-4 w-4" style={{ color: badge.color }} />
        ) : (
          <Lock className="h-3.5 w-3.5 text-v2-ink-subtle" />
        )}
      </div>
      <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink line-clamp-1">
        {badge.name}
      </span>
      {badge.description && (
        <span className="text-[9px] text-v2-ink-muted line-clamp-2 mt-0.5">
          {badge.description}
        </span>
      )}
      {earned && earnedAt && (
        <span className="text-[9px] text-amber-600 dark:text-amber-400 mt-1">
          {new Date(earnedAt).toLocaleDateString()}
        </span>
      )}
      {!earned && (
        <span className="text-[9px] text-v2-ink-subtle mt-1">
          +{badge.xp_reward} XP
        </span>
      )}
    </div>
  );
}
