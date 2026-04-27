// src/features/leaderboard/components/LeaderboardTable.tsx
// Unified leaderboard table supporting all three modes

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RankBadge } from "@/components/ui/rank-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { getInitials } from "@/lib/string";
import { Building2, Users, Trophy } from "lucide-react";
import type {
  LeaderboardScope,
  AgentLeaderboardEntry,
  AgencyLeaderboardEntry,
  TeamLeaderboardEntry,
  SubmitLeaderboardEntry,
} from "@/types/leaderboard.types";

type AnyEntry =
  | AgentLeaderboardEntry
  | AgencyLeaderboardEntry
  | TeamLeaderboardEntry
  | SubmitLeaderboardEntry;

interface LeaderboardTableProps {
  scope: LeaderboardScope;
  entries: AnyEntry[];
  isLoading?: boolean;
  error?: Error | null;
}

// Loading skeleton
function TableSkeleton({
  rows = 15,
  isSubmit = false,
}: {
  rows?: number;
  isSubmit?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-v2-ring/60 last:border-0">
          <td className="px-2 py-1.5 w-10">
            <Skeleton className="h-5 w-5 rounded-full" />
          </td>
          <td className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2 w-20" />
              </div>
            </div>
          </td>
          <td className="px-2 py-1.5">
            <Skeleton className="h-3 w-16" />
          </td>
          <td className="px-2 py-1.5">
            <Skeleton className="h-3 w-14" />
          </td>
          {!isSubmit && (
            <>
              <td className="px-2 py-1.5">
                <Skeleton className="h-3 w-10" />
              </td>
              <td className="px-2 py-1.5">
                <Skeleton className="h-3 w-8" />
              </td>
              <td className="px-2 py-1.5">
                <Skeleton className="h-3 w-8" />
              </td>
            </>
          )}
        </tr>
      ))}
    </>
  );
}

// Empty state
function EmptyState({ isSubmit = false }: { isSubmit?: boolean }) {
  return (
    <tr>
      <td
        colSpan={isSubmit ? 4 : 7}
        className="px-4 py-12 text-center text-v2-ink-subtle"
      >
        <div className="flex flex-col items-center gap-2">
          <Trophy className="h-8 w-8 opacity-30" />
          <p className="text-xs">
            {isSubmit
              ? "No submissions in this period"
              : "No leaderboard data available"}
          </p>
          <p className="text-[10px]">
            {isSubmit
              ? "Try adjusting the date range"
              : "Adjust filters or check back later"}
          </p>
        </div>
      </td>
    </tr>
  );
}

// Error state
function ErrorState({
  message,
  isSubmit = false,
}: {
  message: string;
  isSubmit?: boolean;
}) {
  return (
    <tr>
      <td
        colSpan={isSubmit ? 4 : 7}
        className="px-4 py-8 text-center text-red-500 dark:text-red-400"
      >
        <p className="text-xs font-medium">Error loading leaderboard</p>
        <p className="text-[10px] mt-1">{message}</p>
      </td>
    </tr>
  );
}

// Agent row component
function AgentRow({
  entry,
  rank,
}: {
  entry: AgentLeaderboardEntry;
  rank: number;
}) {
  const isTop3 = rank <= 3;
  const isTop10 = rank <= 10;

  return (
    <tr
      className={cn(
        "border-b border-v2-ring/60 last:border-0 transition-colors",
        isTop3 && "bg-amber-50/50 dark:bg-amber-950/20",
        !isTop3 && isTop10 && "bg-amber-50/30 dark:bg-amber-950/10",
        "hover:bg-v2-canvas",
      )}
    >
      <td className="px-2 py-1.5 w-10">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 border border-v2-ring">
            <AvatarImage
              src={entry.profilePhotoUrl || undefined}
              alt={entry.agentName}
            />
            <AvatarFallback className="text-[10px] bg-v2-ring">
              {getInitials(entry.agentName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-medium truncate",
                isTop3 ? "text-amber-700 dark:text-amber-300" : "text-v2-ink",
              )}
            >
              {entry.agentName}
            </p>
            <p className="text-[10px] text-v2-ink-subtle truncate">
              {entry.agencyName || "No agency"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right">
        <span
          className={cn(
            "font-mono text-xs font-semibold",
            entry.ipTotal > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-v2-ink-subtle",
          )}
        >
          {formatCurrency(entry.ipTotal)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right">
        <span className="font-mono text-xs text-v2-ink-muted">
          {formatCurrency(entry.apTotal)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-muted">
          {entry.policyCount}
        </span>
        {entry.pendingPolicyCount > 0 && (
          <span className="text-[10px] text-v2-ink-subtle ml-0.5">
            +{entry.pendingPolicyCount}
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-subtle">
          {entry.prospectCount}
        </span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-subtle">
          {entry.pipelineCount}
        </span>
      </td>
    </tr>
  );
}

// Agency row component
function AgencyRow({
  entry,
  rank,
}: {
  entry: AgencyLeaderboardEntry;
  rank: number;
}) {
  const isTop3 = rank <= 3;
  const isTop10 = rank <= 10;

  return (
    <tr
      className={cn(
        "border-b border-v2-ring/60 last:border-0 transition-colors",
        isTop3 && "bg-amber-50/50 dark:bg-amber-950/20",
        !isTop3 && isTop10 && "bg-amber-50/30 dark:bg-amber-950/10",
        "hover:bg-v2-canvas",
      )}
    >
      <td className="px-2 py-1.5 w-10">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded bg-v2-ring border border-v2-ring">
            <Building2 className="h-3.5 w-3.5 text-v2-ink-muted" />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-medium truncate",
                isTop3 ? "text-amber-700 dark:text-amber-300" : "text-v2-ink",
              )}
            >
              {entry.agencyName}
            </p>
            <p className="text-[10px] text-v2-ink-subtle truncate">
              {entry.ownerName} · {entry.agentCount} agent
              {entry.agentCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right">
        <span
          className={cn(
            "font-mono text-xs font-semibold",
            entry.ipTotal > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-v2-ink-subtle",
          )}
        >
          {formatCurrency(entry.ipTotal)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right">
        <span className="font-mono text-xs text-v2-ink-muted">
          {formatCurrency(entry.apTotal)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-muted">
          {entry.policyCount}
        </span>
        {entry.pendingPolicyCount > 0 && (
          <span className="text-[10px] text-v2-ink-subtle ml-0.5">
            +{entry.pendingPolicyCount}
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-subtle">
          {entry.prospectCount}
        </span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-subtle">
          {entry.pipelineCount}
        </span>
      </td>
    </tr>
  );
}

// Submit row component (simplified: only AP and policy count)
function SubmitRow({
  entry,
  rank,
}: {
  entry: SubmitLeaderboardEntry;
  rank: number;
}) {
  const isTop3 = rank <= 3;
  const isTop10 = rank <= 10;

  return (
    <tr
      className={cn(
        "border-b border-v2-ring/60 last:border-0 transition-colors",
        isTop3 && "bg-amber-50/50 dark:bg-amber-950/20",
        !isTop3 && isTop10 && "bg-amber-50/30 dark:bg-amber-950/10",
        "hover:bg-v2-canvas",
      )}
    >
      <td className="px-2 py-1.5 w-10">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 border border-v2-ring">
            <AvatarImage
              src={entry.profilePhotoUrl || undefined}
              alt={entry.agentName}
            />
            <AvatarFallback className="text-[10px] bg-v2-ring">
              {getInitials(entry.agentName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-medium truncate",
                isTop3 ? "text-amber-700 dark:text-amber-300" : "text-v2-ink",
              )}
            >
              {entry.agentName}
            </p>
            <p className="text-[10px] text-v2-ink-subtle truncate">
              {entry.agencyName || "No agency"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right">
        <span
          className={cn(
            "font-mono text-xs font-semibold",
            entry.apTotal > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-v2-ink-subtle",
          )}
        >
          {formatCurrency(entry.apTotal)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-muted">
          {entry.policyCount}
        </span>
      </td>
    </tr>
  );
}

// Team row component
function TeamRow({
  entry,
  rank,
}: {
  entry: TeamLeaderboardEntry;
  rank: number;
}) {
  const isTop3 = rank <= 3;
  const isTop10 = rank <= 10;

  return (
    <tr
      className={cn(
        "border-b border-v2-ring/60 last:border-0 transition-colors",
        isTop3 && "bg-amber-50/50 dark:bg-amber-950/20",
        !isTop3 && isTop10 && "bg-amber-50/30 dark:bg-amber-950/10",
        "hover:bg-v2-canvas",
      )}
    >
      <td className="px-2 py-1.5 w-10">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="h-6 w-6 border border-v2-ring">
              <AvatarImage
                src={entry.leaderProfilePhotoUrl || undefined}
                alt={entry.leaderName}
              />
              <AvatarFallback className="text-[10px] bg-v2-ring">
                {getInitials(entry.leaderName)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-blue-500 border border-v2-card">
              <Users className="h-2 w-2 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-medium truncate",
                isTop3 ? "text-amber-700 dark:text-amber-300" : "text-v2-ink",
              )}
            >
              {entry.leaderName}'s Team
            </p>
            <p className="text-[10px] text-v2-ink-subtle truncate">
              {entry.teamSize} member{entry.teamSize !== 1 ? "s" : ""} ·{" "}
              {entry.agencyName || "No agency"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right">
        <span
          className={cn(
            "font-mono text-xs font-semibold",
            entry.ipTotal > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-v2-ink-subtle",
          )}
        >
          {formatCurrency(entry.ipTotal)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right">
        <span className="font-mono text-xs text-v2-ink-muted">
          {formatCurrency(entry.apTotal)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-muted">
          {entry.policyCount}
        </span>
        {entry.pendingPolicyCount > 0 && (
          <span className="text-[10px] text-v2-ink-subtle ml-0.5">
            +{entry.pendingPolicyCount}
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-subtle">
          {entry.prospectCount}
        </span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs tabular-nums text-v2-ink-subtle">
          {entry.pipelineCount}
        </span>
      </td>
    </tr>
  );
}

export function LeaderboardTable({
  scope,
  entries,
  isLoading,
  error,
}: LeaderboardTableProps) {
  const isSubmit = scope === "submit";

  // Determine column headers based on scope
  const nameHeader =
    scope === "agency" ? "Agency" : scope === "team" ? "Team" : "Agent";

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-v2-canvas/80 backdrop-blur-sm z-10 border-b border-v2-ring">
          {isSubmit ? (
            // Simplified headers for submit scope (4 columns)
            <tr>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider w-10">
                #
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider">
                Agent
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-right">
                AP
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider text-center">
                Submitted
              </th>
            </tr>
          ) : (
            // Standard headers (7 columns)
            <tr>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider w-10">
                #
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider">
                {nameHeader}
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-right">
                IP
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider text-right">
                AP
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider text-center">
                Policies
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider text-center">
                Prospects
              </th>
              <th className="px-2 py-2 text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wider text-center">
                Pipeline
              </th>
            </tr>
          )}
        </thead>
        <tbody>
          {isLoading ? (
            <TableSkeleton isSubmit={isSubmit} />
          ) : error ? (
            <ErrorState message={error.message} isSubmit={isSubmit} />
          ) : entries.length === 0 ? (
            <EmptyState isSubmit={isSubmit} />
          ) : scope === "submit" ? (
            (entries as SubmitLeaderboardEntry[]).map((entry) => (
              <SubmitRow
                key={entry.agentId}
                entry={entry}
                rank={entry.rankOverall}
              />
            ))
          ) : scope === "agency" ? (
            (entries as AgencyLeaderboardEntry[]).map((entry) => (
              <AgencyRow
                key={entry.agencyId}
                entry={entry}
                rank={entry.rankOverall}
              />
            ))
          ) : scope === "team" ? (
            (entries as TeamLeaderboardEntry[]).map((entry) => (
              <TeamRow
                key={entry.leaderId}
                entry={entry}
                rank={entry.rankOverall}
              />
            ))
          ) : (
            (entries as AgentLeaderboardEntry[]).map((entry) => (
              <AgentRow
                key={entry.agentId}
                entry={entry}
                rank={entry.rankOverall}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
