import { useState } from "react";
import { useTrainingLeaderboard } from "../../hooks/useTrainingGamification";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Zap, Loader2 } from "lucide-react";

const PERIODS = [
  { id: "all_time", label: "All Time" },
  { id: "month", label: "This Month" },
  { id: "week", label: "This Week" },
] as const;

interface LeaderboardTableProps {
  agencyId: string;
}

export function LeaderboardTable({ agencyId }: LeaderboardTableProps) {
  const [period, setPeriod] = useState<string>("all_time");
  const { data: entries = [], isLoading } = useTrainingLeaderboard(
    agencyId,
    period,
  );
  const { user } = useAuth();

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring">
      {/* Period selector */}
      <div className="flex items-center gap-1 p-2 border-b border-v2-ring dark:border-v2-ring">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              period === p.id
                ? "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink dark:text-v2-ink"
                : "text-v2-ink-muted hover:text-v2-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="divide-y divide-v2-ring dark:divide-v2-ring">
          {entries.map((entry) => {
            const isMe = entry.user_id === user?.id;
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 px-3 py-2 text-xs ${
                  isMe ? "bg-blue-50 dark:bg-blue-900/10" : ""
                }`}
              >
                <span
                  className={`w-6 text-center font-bold ${
                    entry.rank === 1
                      ? "text-amber-500"
                      : entry.rank === 2
                        ? "text-v2-ink-subtle"
                        : entry.rank === 3
                          ? "text-amber-700"
                          : "text-v2-ink-subtle"
                  }`}
                >
                  {Number(entry.rank) <= 3 ? (
                    <Trophy className="h-3.5 w-3.5 mx-auto" />
                  ) : (
                    entry.rank
                  )}
                </span>
                <span className={`flex-1 ${isMe ? "font-medium" : ""}`}>
                  {entry.full_name}{" "}
                  {isMe && (
                    <span className="text-[10px] text-blue-500">(you)</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span className="font-medium">
                    {(entry.total_xp ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="text-center py-6 text-xs text-v2-ink-subtle">
              No data yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
