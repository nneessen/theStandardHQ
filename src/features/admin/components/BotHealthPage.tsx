// src/features/admin/components/BotHealthPage.tsx
// Admin-only monitoring dashboard for the standard-chat-bot service.
// Polls GET /api/external/monitoring/system every 30s via the existing
// chat-bot-api edge function proxy. No websockets, no history, no alerts.

import { useMemo } from "react";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  ServerCrash,
  TimerReset,
  Users,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/v2";
import { Board, Cap, FlapTile, Pill, T } from "@/components/board";
import type { FlapTileTone, PillTone } from "@/components/board";
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

// ThresholdLevel (ok|warn|critical) → Board accent tones.
function levelTone(level: ThresholdLevel): FlapTileTone {
  return level === "critical" ? "red" : level === "warn" ? "amber" : "green";
}
function levelPill(level: ThresholdLevel): PillTone {
  return level === "critical" ? "red" : level === "warn" ? "amber" : "green";
}

function statusPill(status: SystemMonitoringResponse["status"]): PillTone {
  return status === "unhealthy"
    ? "red"
    : status === "degraded"
      ? "amber"
      : "green";
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
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <header
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>BOT HEALTH · MONITORING</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Bot Health
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {data && (
                <Pill tone={statusPill(data.status)} dot>
                  {data.status}
                </Pill>
              )}
              {data && computedLevel !== "ok" && (
                <Pill tone={levelPill(computedLevel)}>
                  computed: {computedLevel}
                </Pill>
              )}
              <span className="text-[11px] text-v2-ink-muted hidden sm:inline">
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
          </header>

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
            <Board pad={40}>
              <div className="flex items-center justify-center gap-2 text-v2-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading bot health…</span>
              </div>
            </Board>
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
              {/* Hero stat band — big legible FlapTiles + status pills */}
              <Board pad={18}>
                <Cap style={{ marginBottom: 14 }}>System</Cap>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                    gap: 10,
                  }}
                >
                  <FlapTile
                    label="Queue Depth"
                    value={formatNumber(data.jobQueue.totalPending)}
                    tone={levelTone(computedLevel)}
                  />
                  <FlapTile
                    label="Failed · 24h"
                    value={formatNumber(data.jobQueue.totalFailed24h)}
                    tone={levelTone(failedLevel)}
                  />
                  <FlapTile
                    label="DB Latency"
                    value={`${data.database.latencyMs.toFixed(1)} ms`}
                    tone={levelTone(dbLatencyLevel)}
                  />
                  <FlapTile
                    label="Msgs · Last Hr"
                    value={formatNumber(data.throughput.messagesLastHour)}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  <Pill tone={data.jobQueue.running ? "green" : "red"} dot>
                    {data.jobQueue.running
                      ? "Worker Running"
                      : "Worker Stopped"}
                  </Pill>
                  <Pill tone={data.database.connected ? "green" : "red"} dot>
                    {data.database.connected
                      ? "DB Connected"
                      : "DB Disconnected"}
                  </Pill>
                  <Pill tone="blue">
                    {formatNumber(data.jobQueue.totalActive)} Active
                  </Pill>
                  <Pill tone="blue">
                    {formatNumber(data.throughput.messagesLast24h)} Msgs / 24h
                  </Pill>
                  <Pill tone="blue">
                    {formatNumber(data.throughput.conversationsLast24h)} Convos
                    / 24h
                  </Pill>
                </div>
              </Board>

              {/* Per-queue breakdown */}
              <Board pad={0} style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 16px 8px" }}>
                  <Cap>Queue Breakdown</Cap>
                </div>
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
                            "bg-destructive/10 dark:bg-destructive/10",
                          q.level === "warn" &&
                            "bg-warning/10 dark:bg-warning/10",
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
                        <TableCell className="py-1.5 text-[11px] text-right text-v2-ink-muted font-mono">
                          {q.threshold.warn} / {q.threshold.critical}
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="flex justify-end">
                            <Pill tone={levelPill(q.level)} dot>
                              {q.level}
                            </Pill>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Board>

              {/* Process + agents footer row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Board pad={18}>
                  <Cap
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <TimerReset className="h-3.5 w-3.5" />
                    Process
                  </Cap>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
                      gap: 10,
                    }}
                  >
                    <FlapTile
                      sm
                      label="Uptime"
                      value={formatUptime(data.process.uptimeSeconds)}
                    />
                    <FlapTile
                      sm
                      label="RSS"
                      value={`${data.process.memoryUsageMb.rss} MB`}
                    />
                    <FlapTile
                      sm
                      label="Heap"
                      value={`${data.process.memoryUsageMb.heapUsed}/${data.process.memoryUsageMb.heapTotal} MB`}
                    />
                    <FlapTile
                      sm
                      label="Node"
                      value={data.process.nodeVersion}
                      style={{ gridColumn: "1 / -1" }}
                    />
                  </div>
                </Board>

                <Board pad={18}>
                  <Cap
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Agents
                  </Cap>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
                      gap: 10,
                    }}
                  >
                    <FlapTile
                      sm
                      label="Total"
                      value={formatNumber(data.agents.totalAgents)}
                    />
                    <FlapTile
                      sm
                      label="Active"
                      value={formatNumber(data.agents.activeAgents)}
                    />
                    <FlapTile
                      sm
                      label="Bot Enabled"
                      value={formatNumber(data.agents.botEnabledAgents)}
                    />
                  </div>
                </Board>
              </div>

              {/* Full-width timestamp footer */}
              <div className="text-[11px] text-v2-ink-muted text-center pt-1">
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
      </div>
    </SectionShell>
  );
}

export default BotHealthPage;
