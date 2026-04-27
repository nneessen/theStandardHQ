import {
  useTrainingChallenges,
  useJoinChallenge,
} from "../../hooks/useTrainingGamification";
import { ChallengeCard } from "./ChallengeCard";
import { useImo } from "@/contexts/ImoContext";
import { Loader2 } from "lucide-react";

export function ChallengeList() {
  const { agency } = useImo();
  const { data: challenges = [], isLoading } = useTrainingChallenges(
    agency?.id,
  );
  const joinChallenge = useJoinChallenge();

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {challenges.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          challenge={challenge}
          isParticipating={false}
          onJoin={() => joinChallenge.mutate(challenge.id)}
        />
      ))}
      {challenges.length === 0 && (
        <div className="text-center py-6 text-xs text-v2-ink-subtle">
          No active challenges
        </div>
      )}
    </div>
  );
}
