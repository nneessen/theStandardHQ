// src/features/chat-bot/components/TeamAppointmentsTab.tsx
// Team-level appointment monitoring — daily focus view for upline managers.

import {
  AlertTriangle,
  Calendar,
  RefreshCw,
  Users,
  Clock,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTeamAppointments,
  teamAppointmentKeys,
  type TeamAgentAppointments,
  type TeamAppointmentItem,
} from "../hooks/useTeamAppointments";

// ─── Helpers ────────────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  scheduled:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  completed:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  cancelled:
    "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
  no_show:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-Show",
};

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

// ─── Appointment row ────────────────────────────────────────────

function AppointmentRow({ appt }: { appt: TeamAppointmentItem }) {
  const style = statusStyles[appt.status] || statusStyles.scheduled;
  const label = statusLabels[appt.status] || appt.status;

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
      <div className="flex items-center gap-1.5 w-[72px] flex-shrink-0">
        <Clock className="h-3 w-3 text-zinc-400" />
        <span className="text-[11px] font-medium text-foreground tabular-nums">
          {formatTime(appt.scheduledAt) || "TBD"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-foreground truncate block">
          {appt.leadName}
        </span>
      </div>
      <Badge
        variant="outline"
        className={`text-[9px] h-4 px-1.5 font-medium border ${style}`}
      >
        {label}
      </Badge>
    </div>
  );
}

// ─── Agent section ──────────────────────────────────────────────

function AgentSection({ agent }: { agent: TeamAgentAppointments }) {
  const hasFetchError = !!agent.fetchError;

  // Split items into today vs rest-of-week
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayItems = agent.items.filter(
    (a) => a.scheduledAt && a.scheduledAt.slice(0, 10) === todayStr,
  );
  const restOfWeek = agent.items.filter(
    (a) => a.scheduledAt && a.scheduledAt.slice(0, 10) !== todayStr,
  );

  // Sort by time
  const sortByTime = (a: TeamAppointmentItem, b: TeamAppointmentItem) =>
    (a.scheduledAt || "").localeCompare(b.scheduledAt || "");
  todayItems.sort(sortByTime);
  restOfWeek.sort(sortByTime);

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* Agent header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
          <User className="h-3 w-3 text-zinc-500" />
        </div>
        <span className="text-[12px] font-semibold text-foreground flex-1 truncate">
          {agent.name}
        </span>
        {hasFetchError ? (
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
          >
            Error
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Today</span>
              <span
                className={`text-[12px] font-bold tabular-nums ${
                  agent.today > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-400"
                }`}
              >
                {agent.today}
              </span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Week</span>
              <span className="text-[12px] font-bold tabular-nums text-foreground">
                {agent.thisWeek}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-1 py-1">
        {hasFetchError ? (
          <div className="flex items-center gap-2 px-2 py-2">
            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              {agent.fetchError}
            </span>
          </div>
        ) : todayItems.length === 0 && restOfWeek.length === 0 ? (
          <div className="px-2 py-3 text-center">
            <span className="text-[10px] text-muted-foreground">
              No appointments this week
            </span>
          </div>
        ) : (
          <>
            {todayItems.length > 0 && (
              <div>
                <div className="px-2 pt-1 pb-0.5">
                  <span className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">
                    Today
                  </span>
                </div>
                {todayItems.map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} />
                ))}
              </div>
            )}
            {restOfWeek.length > 0 && (
              <div>
                <div className="px-2 pt-1.5 pb-0.5">
                  <span className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">
                    Earlier this week
                  </span>
                </div>
                {restOfWeek.map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-background p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              <div className="ml-auto h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-1.5 pl-8">
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
            </div>
          </div>
        ))}
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debug = (data as any)?._debug;
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
    <div className="space-y-2">
      {/* ── Header bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex items-center gap-3 flex-1">
          <span className="text-[11px] font-semibold text-foreground">
            {summary.todayTotal} today
          </span>
          <span className="text-[10px] text-muted-foreground">
            {summary.thisWeekTotal} this week
          </span>
          <span className="text-[10px] text-muted-foreground">
            {summary.totalAgents} agents
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* ── Partial error warning ─────────────────────────────── */}
      {fetchErrors && fetchErrors.length > 0 && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-700 dark:text-amber-300">
            {fetchErrors.length} agent(s) couldn&apos;t load appointment data
          </span>
        </div>
      )}

      {/* ── Agent sections ────────────────────────────────────── */}
      {data.agents.map((agent) => (
        <AgentSection key={agent.userId} agent={agent} />
      ))}
    </div>
  );
}
