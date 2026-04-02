// src/features/chat-bot/components/TeamAppointmentsTab.tsx
// Team-level appointment monitoring — daily focus view for upline managers.

import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Users,
} from "lucide-react";
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
  type TeamAppointmentItem,
} from "../hooks/useTeamAppointments";

// ─── Status badge ───────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: "Scheduled",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
  no_show: {
    label: "No-Show",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.scheduled;
  return (
    <Badge
      variant="secondary"
      className={`text-[9px] h-4 px-1.5 font-medium ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}

// ─── Date formatting ────────────────────────────────────────────

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Expanded row: agent's individual appointments ──────────────

function AgentDetailRows({ items }: { items: TeamAppointmentItem[] }) {
  if (items.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={7}
          className="text-[10px] text-muted-foreground text-center py-2 bg-zinc-50/50 dark:bg-zinc-900/30"
        >
          No appointments this week
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {items.map((appt) => (
        <TableRow key={appt.id} className="bg-zinc-50/50 dark:bg-zinc-900/30">
          <TableCell className="pl-8 text-[10px] text-muted-foreground">
            &nbsp;
          </TableCell>
          <TableCell
            colSpan={2}
            className="text-[10px] text-foreground font-medium"
          >
            {appt.leadName}
          </TableCell>
          <TableCell className="text-[10px] text-muted-foreground">
            {formatDateTime(appt.scheduledAt)}
          </TableCell>
          <TableCell>
            <StatusBadge status={appt.status} />
          </TableCell>
          <TableCell className="text-[10px] text-muted-foreground">
            {appt.source === "bot"
              ? "Bot"
              : appt.source === "calendar_sync"
                ? "Cal Sync"
                : "—"}
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

// ─── Agent row (expandable) ─────────────────────────────────────

function AgentRow({ agent }: { agent: TeamAgentAppointments }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-[200px]">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-[11px] font-medium text-foreground truncate">
              {agent.name}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-center">
          <span
            className={`text-[11px] font-bold ${
              agent.today > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {agent.today}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <span className="text-[11px] font-semibold text-foreground">
            {agent.thisWeek}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <span className="text-[10px] text-blue-600 dark:text-blue-400">
            {agent.byStatus.scheduled}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            {agent.byStatus.completed}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <span className="text-[10px] text-zinc-500">
            {agent.byStatus.cancelled}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <span
            className={`text-[10px] ${
              agent.byStatus.noShow > 0
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-zinc-500"
            }`}
          >
            {agent.byStatus.noShow}
          </span>
        </TableCell>
      </TableRow>
      {expanded && <AgentDetailRows items={agent.items} />}
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────

export function TeamAppointmentsTab() {
  const { data, isLoading, error } = useTeamAppointments(true);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: teamAppointmentKeys.byDate(today),
    });
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              Team Appointments
            </span>
          </div>
          <div className="flex items-center divide-x divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-1 px-3 first:pl-0 last:pr-0">
                <div className="h-2.5 w-16 bg-muted rounded animate-pulse mb-1" />
                <div className="h-5 w-8 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 bg-muted rounded animate-pulse mb-1.5 last:mb-0"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
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

  // Empty state
  if (data.agents.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debug = (data as any)?._debug as Record<string, unknown> | undefined;
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center">
        <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-[11px] text-muted-foreground">
          No team members with active bots found
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          Team members need active bot subscriptions to appear here
        </p>
        {debug && (
          <pre className="mt-4 text-left text-[9px] text-muted-foreground bg-zinc-100 dark:bg-zinc-900 rounded p-2 overflow-auto max-h-40">
            {JSON.stringify(debug, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  const { summary, errors: fetchErrors } = data;

  return (
    <div className="space-y-3">
      {/* ── Summary Strip ─────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
            Team Appointments
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 ml-auto text-[9px] text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center divide-x divide-border">
          <div className="flex-1 px-3 first:pl-0">
            <div className="text-[9px] text-muted-foreground">Today</div>
            <div className="text-lg font-bold text-foreground">
              {summary.todayTotal}
            </div>
            <div className="text-[8px] text-muted-foreground/70">
              appointments
            </div>
          </div>
          <div className="flex-1 px-3">
            <div className="text-[9px] text-muted-foreground">This Week</div>
            <div className="text-lg font-bold text-foreground">
              {summary.thisWeekTotal}
            </div>
            <div className="text-[8px] text-muted-foreground/70">
              appointments
            </div>
          </div>
          <div className="flex-1 px-3 last:pr-0">
            <div className="text-[9px] text-muted-foreground">Agents</div>
            <div className="text-lg font-bold text-foreground">
              {summary.totalAgents}
            </div>
            <div className="text-[8px] text-muted-foreground/70">
              with active bots
            </div>
          </div>
        </div>
      </div>

      {/* ── Partial error warning ──────────────────────────────── */}
      {fetchErrors && fetchErrors.length > 0 && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-700 dark:text-amber-300">
            Some agents&apos; data couldn&apos;t be loaded ({fetchErrors.length}{" "}
            failed)
          </span>
        </div>
      )}

      {/* ── Agent Table ────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[9px] uppercase tracking-wider font-medium w-[200px]">
                Agent
              </TableHead>
              <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center">
                Today
              </TableHead>
              <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center">
                Week
              </TableHead>
              <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center">
                Sched.
              </TableHead>
              <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center">
                Done
              </TableHead>
              <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center">
                Cancel
              </TableHead>
              <TableHead className="text-[9px] uppercase tracking-wider font-medium text-center">
                No-Show
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
    </div>
  );
}
