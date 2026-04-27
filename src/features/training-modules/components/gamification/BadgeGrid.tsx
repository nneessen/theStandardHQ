import {
  useTrainingBadges,
  useUserBadges,
} from "../../hooks/useTrainingGamification";
import { BadgeCard } from "./BadgeCard";
import { Loader2 } from "lucide-react";

export function BadgeGrid() {
  const { data: allBadges = [], isLoading: loadingBadges } =
    useTrainingBadges();
  const { data: userBadges = [], isLoading: loadingUserBadges } =
    useUserBadges();

  if (loadingBadges || loadingUserBadges) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const earnedIds = new Set(userBadges.map((ub) => ub.badge_id));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {allBadges.map((badge) => (
        <BadgeCard
          key={badge.id}
          badge={badge}
          earned={earnedIds.has(badge.id)}
          earnedAt={
            userBadges.find((ub) => ub.badge_id === badge.id)?.earned_at
          }
        />
      ))}
      {allBadges.length === 0 && (
        <div className="col-span-full text-center py-6 text-xs text-v2-ink-subtle">
          No badges configured yet
        </div>
      )}
    </div>
  );
}
