// src/features/admin/components/BotHealthPage.tsx
// Admin-only monitoring dashboard for the standard-chat-bot service.
// Polls GET /api/external/monitoring/system every 30s via the existing
// chat-bot-api edge function proxy. No websockets, no history, no alerts.

import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  ServerCrash,
  TimerReset,
  Users,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SystemMonitoringResponse } from "@/types/chat-bot-monitoring";
import {
  useBotSystemHealth,
  ChatBotApiError,
  DB_LATENCY_MS_THRESHOLD,
  TOTAL_FAILED_24H_THRESHOLD,
  evaluateThreshold,
  getQueueThreshold,
  worstLevel,
  type ThresholdLevel,
} from "@/features/chat-bot";

// ─── Small presentation helpers ────────────────────────────────

function levelBadgeVariant(
  level: ThresholdLevel,
): "success" | "warning" | "destructive" {
  switch (level) {
    case "critical":
      return "destructive";
    case "warn":
      return "warning";
    default:
      return "success";
  }
}

function overallStatusVariant(
  status: SystemMonitoringResponse["status"],
): "success" | "warning" | "destructive" {
  switch (status) {
    case "unhealthy":
      return "destructive";
    case "degraded":
      return "warning";
    default:
      return "success";
  }
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

// Tailwind class for a "hero number" whose color encodes the threshold level.
function heroNumberClass(level: ThresholdLevel): string {
  switch (level) {
    case "critical":
      return "text-destructive";
    case "warn":
      return "text-warning";
    default:
      return "text-success";
  }
}

// ─── Page ───────────────────────────────────────────────────────

export function BotHealthPage() {
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } =
    useBotSystemHealth();

  const isServiceError =
    error instanceof ChatBotApiError &&
    (error.isServiceError || error.isTransportError);

  // Pre-compute per-queue threshold levels once per render so the rollup
  // below and the table render share the same evaluation.
  const queueRows = useMemo(() => {
    if (!data) return [];
    return data.jobQueue.queueBreakdown.map((q) => ({
      ...q,
      threshold: getQueueThreshold(q.queue),
      level: evaluateThreshold(q.pending, getQueueThreshold(q.queue)),
    }));
  }, [data]);

  const failedLevel = data
    ? evaluateThreshold(
        data.jobQueue.totalFailed24h,
        TOTAL_FAILED_24H_THRESHOLD,
      )
    : "ok";

  const dbLatencyLevel = data
    ? evaluateThreshold(data.database.latencyMs, DB_LATENCY_MS_THRESHOLD)
    : "ok";

  // Overall "computed" level combines queue + failures + db latency.
  // The upstream `status` field from the API takes precedence when it's
  // worse than our own rollup — we never want to appear healthier than
  // the service claims.
  const computedLevel = worstLevel([
    ...queueRows.map((q) => q.level),
    failedLevel,
    dbLatencyLevel,
  ]);

  const lastUpdatedLabel = dataUpdatedAt
    ? formatDistanceToNowStrict(new Date(dataUpdatedAt), { addSuffix: true })
    : "never";

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-3 overflow-y-auto">
      {/* Header row */}
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-v2-ink" />
            <h1 className="text-sm font-semibold text-v2-ink">Bot Health</h1>
          </div>
          <span className="text-[10px] text-v2-ink-muted">
            standard-chat-bot · system-wide monitoring
          </span>
        </div>

        <div className="flex items-center gap-2">
          {data && (
            <Badge
              variant={overallStatusVariant(data.status)}
              className="capitalize"
            >
              {data.status}
            </Badge>
          )}
          {data && computedLevel !== "ok" && (
            <Badge variant={levelBadgeVariant(computedLevel)}>
              computed: {computedLevel}
            </Badge>
          )}
          <span className="text-[10px] text-v2-ink-muted hidden sm:inline">
            updated {lastUpdatedLabel}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-7 gap-1 text-[11px]"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Unreachable banner — stacks ON TOP of stale data */}
      {isServiceError && (
        <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Bot API unreachable</AlertTitle>
          <AlertDescription>
            Could not reach standard-chat-bot.{" "}
            {data
              ? `Showing last-known snapshot from ${lastUpdatedLabel}.`
              : "No data has been received yet."}{" "}
            {error?.message && (
              <span className="font-mono text-[11px] opacity-80">
                ({error.message})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Non-service error (e.g. 400 / auth) */}
      {error && !isServiceError && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Monitoring request failed</AlertTitle>
          <AlertDescription className="font-mono text-[11px]">
            {error.message || "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {/* Initial loading state */}
      {isLoading && !data && (
        <Card variant="outlined">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-v2-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading bot health…</span>
          </CardContent>
        </Card>
      )}

      {/* Data-driven sections. Keep rendering even during an error
          refetch — TanStack Query v5 keeps `data` populated so users
          can still see the last-known state behind the banner. */}
      {data && (
        <div
          className={cn(
            "space-y-3",
            isServiceError && "opacity-60", // dim stale data behind the banner
          )}
        >
          {/* Hero cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <HeroCard
              icon={<Gauge className="h-4 w-4" />}
              label="Queue depth"
              primary={formatNumber(data.jobQueue.totalPending)}
              primaryLevel={computedLevel}
              secondary={`${formatNumber(data.jobQueue.totalActive)} active`}
              footer={
                data.jobQueue.running ? "worker running" : "worker STOPPED"
              }
              footerLevel={data.jobQueue.running ? "ok" : "critical"}
            />
            <HeroCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Failed (24h)"
              primary={formatNumber(data.jobQueue.totalFailed24h)}
              primaryLevel={failedLevel}
              secondary={`warn > ${TOTAL_FAILED_24H_THRESHOLD.warn} · crit > ${TOTAL_FAILED_24H_THRESHOLD.critical}`}
            />
            <HeroCard
              icon={<Database className="h-4 w-4" />}
              label="DB latency"
              primary={`${data.database.latencyMs.toFixed(1)} ms`}
              primaryLevel={dbLatencyLevel}
              secondary={data.database.connected ? "connected" : "DISCONNECTED"}
              secondaryLevel={data.database.connected ? "ok" : "critical"}
            />
            <HeroCard
              icon={<Activity className="h-4 w-4" />}
              label="Throughput"
              primary={formatNumber(data.throughput.messagesLastHour)}
              primaryLevel="ok"
              secondary={`${formatNumber(
                data.throughput.messagesLast24h,
              )} msgs / 24h`}
              footer={`${formatNumber(
                data.throughput.conversationsLast24h,
              )} convos / 24h`}
            />
          </div>

          {/* Per-queue breakdown */}
          <Card variant="outlined">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-v2-ink-muted">
                Queue breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-[11px]">Queue</TableHead>
                    <TableHead className="h-8 text-[11px] text-right">
                      Pending
                    </TableHead>
                    <TableHead className="h-8 text-[11px] text-right">
                      Active
                    </TableHead>
                    <TableHead className="h-8 text-[11px] text-right">
                      Failed 24h
                    </TableHead>
                    <TableHead className="h-8 text-[11px] text-right">
                      Threshold
                    </TableHead>
                    <TableHead className="h-8 text-[11px] text-right">
                      Level
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-[11px] text-v2-ink-muted py-4"
                      >
                        No queues reported.
                      </TableCell>
                    </TableRow>
                  )}
                  {queueRows.map((q) => (
                    <TableRow
                      key={q.queue}
                      className={cn(
                        q.level === "critical" &&
                          "bg-destructive/10/50 dark:bg-destructive/10",
                        q.level === "warn" &&
                          "bg-warning/10/50 dark:bg-warning/10",
                      )}
                    >
                      <TableCell className="py-1.5 text-xs font-mono">
                        {q.queue}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "py-1.5 text-xs text-right font-semibold",
                          heroNumberClass(q.level),
                        )}
                      >
                        {formatNumber(q.pending)}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-right">
                        {formatNumber(q.active)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "py-1.5 text-xs text-right",
                          q.failed24h > 0 && "text-destructive font-semibold",
                        )}
                      >
                        {formatNumber(q.failed24h)}
                      </TableCell>
                      <TableCell className="py-1.5 text-[10px] text-right text-v2-ink-muted font-mono">
                        {q.threshold.warn} / {q.threshold.critical}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        <Badge
                          variant={levelBadgeVariant(q.level)}
                          size="sm"
                          className="capitalize"
                        >
                          {q.level}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Process + agents footer row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card variant="outlined">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-v2-ink-muted flex items-center gap-1.5">
                  <TimerReset className="h-3.5 w-3.5" />
                  Process
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 grid grid-cols-3 gap-2 text-xs">
                <StatPair
                  label="Uptime"
                  value={formatUptime(data.process.uptimeSeconds)}
                />
                <StatPair
                  label="RSS"
                  value={`${data.process.memoryUsageMb.rss} MB`}
                />
                <StatPair
                  label="Heap"
                  value={`${data.process.memoryUsageMb.heapUsed}/${data.process.memoryUsageMb.heapTotal} MB`}
                />
                <StatPair
                  label="Node"
                  value={data.process.nodeVersion}
                  className="col-span-3"
                />
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-v2-ink-muted flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Agents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 grid grid-cols-3 gap-2 text-xs">
                <StatPair
                  label="Total"
                  value={formatNumber(data.agents.totalAgents)}
                />
                <StatPair
                  label="Active"
                  value={formatNumber(data.agents.activeAgents)}
                />
                <StatPair
                  label="Bot enabled"
                  value={formatNumber(data.agents.botEnabledAgents)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Full-width timestamp footer */}
          <div className="text-[10px] text-v2-ink-muted text-center pt-1">
            Last snapshot:{" "}
            <span className="font-mono">
              {new Date(data.timestamp).toLocaleString()}
            </span>
            {" · "}
            polling every 30s
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-presentational components (kept local — single-use only) ──

interface HeroCardProps {
  icon: React.ReactNode;
  label: string;
  primary: string;
  primaryLevel: ThresholdLevel;
  secondary?: string;
  secondaryLevel?: ThresholdLevel;
  footer?: string;
  footerLevel?: ThresholdLevel;
}

function HeroCard({
  icon,
  label,
  primary,
  primaryLevel,
  secondary,
  secondaryLevel,
  footer,
  footerLevel,
}: HeroCardProps) {
  return (
    <Card variant="outlined">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-v2-ink-muted">
          {icon}
          {label}
        </div>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            heroNumberClass(primaryLevel),
          )}
        >
          {primary}
        </div>
        {secondary && (
          <div
            className={cn(
              "text-[11px] text-v2-ink-muted",
              secondaryLevel && heroNumberClass(secondaryLevel),
            )}
          >
            {secondary}
          </div>
        )}
        {footer && (
          <div
            className={cn(
              "text-[10px] text-v2-ink-subtle",
              footerLevel && heroNumberClass(footerLevel),
            )}
          >
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatPair({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-v2-ink-muted">
        {label}
      </span>
      <span className="font-mono text-xs text-v2-ink truncate">{value}</span>
    </div>
  );
}

export default BotHealthPage;
