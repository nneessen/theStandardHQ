import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "../shared/ProgressBar";
import type { TrainingChallenge } from "../../types/training-module.types";

interface ChallengeCardProps {
  challenge: TrainingChallenge;
  currentValue?: number;
  isParticipating: boolean;
  onJoin?: () => void;
}

export function ChallengeCard({
  challenge,
  currentValue = 0,
  isParticipating,
  onJoin,
}: ChallengeCardProps) {
  const now = new Date();
  const end = new Date(challenge.end_date);
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const isActive = now >= new Date(challenge.start_date) && now <= end;

  return (
    <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg p-2.5 space-y-2 bg-v2-card">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-xs font-medium text-v2-ink dark:text-v2-ink">
            {challenge.title}
          </h4>
          {challenge.description && (
            <p className="text-[10px] text-v2-ink-muted mt-0.5">
              {challenge.description}
            </p>
          )}
        </div>
        <span className="text-[10px] bg-warning/20 dark:bg-warning/30 text-warning px-1.5 rounded">
          +{challenge.xp_reward} XP
        </span>
      </div>

      {isParticipating && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-v2-ink-muted">
            <span>
              {currentValue}/{challenge.target_value}
            </span>
            <span>
              {Math.round((currentValue / challenge.target_value) * 100)}%
            </span>
          </div>
          <ProgressBar value={currentValue} max={challenge.target_value} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-v2-ink-subtle">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {daysLeft}d left
          </span>
        </div>
        {!isParticipating && isActive && onJoin && (
          <Button
            variant="outline"
            size="sm"
            className="h-5 text-[10px] px-2"
            onClick={onJoin}
          >
            Join
          </Button>
        )}
      </div>
    </div>
  );
}
