// src/features/chat-bot/components/TeamAppointmentsTab.tsx
// Team-level appointment monitoring — compact data-dense table view.

import { AlertTriangle, Calendar, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTeamAppointments,
  teamAppointmentKeys,
  type TeamAgentAppointments,
} from "../hooks/useTeamAppointments";

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Agent row ──────────────────────────────────────────────────

function AgentRow({ agent }: { agent: TeamAgentAppointments }) {
  const hasFetchError = !!agent.fetchError;

  // Find next upcoming appointment (today, status=scheduled, not yet passed)
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const upcoming = agent.items
    .filter(
      (a) =>
        a.scheduledAt &&
        a.scheduledAt.slice(0, 10) === todayStr &&
        a.status === "scheduled" &&
        new Date(a.scheduledAt) > now,
    )
    .sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""));

  const nextAppt = upcoming[0];

  return (
    <TableRow>
      {/* Agent name */}
      <TableCell className="py-1.5">
        <span className="text-[11px] font-medium text-foreground">
          {agent.name}
        </span>
        {hasFetchError && (
          <AlertTriangle className="h-2.5 w-2.5 text-amber-500 inline ml-1" />
        )}
      </TableCell>

      {/* Today count */}
      <TableCell className="py-1.5 text-center">
        {hasFetchError ? (
          <span className="text-[10px] text-muted-foreground">—</span>
        ) : (
          <span
            className={`text-[12px] font-bold tabular-nums ${
              agent.today > 0
                ? "text-foreground"
                : "text-zinc-300 dark:text-zinc-600"
            }`}
          >
            {agent.today}
          </span>
        )}
      </TableCell>

      {/* Week count */}
      <TableCell className="py-1.5 text-center">
        {hasFetchError ? (
          <span className="text-[10px] text-muted-foreground">—</span>
        ) : (
          <span
            className={`text-[11px] font-semibold tabular-nums ${
              agent.thisWeek > 0
                ? "text-foreground"
                : "text-zinc-300 dark:text-zinc-600"
            }`}
          >
            {agent.thisWeek}
          </span>
        )}
      </TableCell>

      {/* Next appointment — the most actionable column */}
      <TableCell className="py-1.5">
        {hasFetchError ? (
          <span className="text-[10px] text-amber-500 truncate block max-w-[200px]">
            {agent.fetchError}
          </span>
        ) : nextAppt ? (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1 font-mono tabular-nums border-blue-200 text-blue-700 bg-blue-50/50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/30 flex-shrink-0"
            >
              {formatTime(nextAppt.scheduledAt)}
            </Badge>
            <span className="text-[10px] text-muted-foreground truncate">
              {nextAppt.leadName}
            </span>
          </div>
        ) : agent.today > 0 ? (
          <span className="text-[10px] text-muted-foreground">
            All done for today
          </span>
        ) : (
          <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
            —
          </span>
        )}
      </TableCell>

      {/* Status breakdown — compact inline */}
      <TableCell className="py-1.5">
        {hasFetchError ? (
          <span className="text-[10px] text-muted-foreground">—</span>
        ) : agent.thisWeek > 0 ? (
          <div className="flex items-center gap-1.5 text-[10px] tabular-nums">
            {agent.byStatus.completed > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {agent.byStatus.completed}
                <span className="text-[8px] ml-px">done</span>
              </span>
            )}
            {agent.byStatus.scheduled > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {agent.byStatus.scheduled}
                <span className="text-[8px] ml-px">sched</span>
              </span>
            )}
            {agent.byStatus.cancelled > 0 && (
              <span className="text-zinc-400">
                {agent.byStatus.cancelled}
                <span className="text-[8px] ml-px">canc</span>
              </span>
            )}
            {agent.byStatus.noShow > 0 && (
              <span className="text-red-500">
                {agent.byStatus.noShow}
                <span className="text-[8px] ml-px">ns</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
            —
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Main ───────────────────────────────────────────────────────

export function TeamAppointmentsTab() {
  const { data, isLoading, error } = useTeamAppointments(true);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: teamAppointmentKeys.byDate(today),
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-28 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Team appointments temporarily unavailable
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 ml-auto"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        {error && (
          <pre className="mt-2 text-[9px] text-red-500 bg-zinc-100 dark:bg-zinc-900 rounded p-2 overflow-auto max-h-40">
            {String(error)}
          </pre>
        )}
      </div>
    );
  }

  if (data.agents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center">
        <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-[11px] text-muted-foreground">
          No team members with active bots found
        </p>
      </div>
    );
  }

  const { summary, errors: fetchErrors } = data;

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">
          Team Appointments
        </span>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-[11px] font-bold text-foreground tabular-nums">
            {summary.todayTotal}
          </span>
          <span className="text-[9px] text-muted-foreground">today</span>
          <span className="text-[9px] text-muted-foreground/50">|</span>
          <span className="text-[11px] font-semibold text-foreground tabular-nums">
            {summary.thisWeekTotal}
          </span>
          <span className="text-[9px] text-muted-foreground">this week</span>
        </div>
        {fetchErrors && fetchErrors.length > 0 && (
          <Badge
            variant="outline"
            className="text-[8px] h-3.5 px-1 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400 ml-1"
          >
            {fetchErrors.length} error{fetchErrors.length > 1 ? "s" : ""}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 ml-auto text-muted-foreground hover:text-foreground"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[9px] uppercase tracking-wider font-medium h-7">
              Agent
            </TableHead>
            <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center h-7 w-14">
              Today
            </TableHead>
            <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center h-7 w-14">
              Week
            </TableHead>
            <TableHead className="text-[9px] uppercase tracking-wider font-medium h-7">
              Next Appt
            </TableHead>
            <TableHead className="text-[9px] uppercase tracking-wider font-medium h-7">
              Breakdown
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.agents.map((agent) => (
            <AgentRow key={agent.userId} agent={agent} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
