// src/features/chat-bot/components/MonitoringTab.tsx
// Real-time bot monitoring dashboard: status, activity, conversion, errors, follow-up

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Loader2,
  MessageSquare,
  Zap,
  Clock,
  TrendingUp,
  ShieldAlert,
  MailCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentMonitoring } from "../hooks/useChatBot";
import type { ActivityWindow } from "@/types/chat-bot-monitoring";

// ─── Status Logic ───────────────────────────────────────────────

type BotStatusLevel = "green" | "yellow" | "red";

function getBotStatusLevel(botStatus: {
  isActive: boolean;
  botEnabled: boolean;
  closeConnected: boolean;
  calendlyConnected: boolean;
  googleConnected: boolean;
}): BotStatusLevel {
  if (!botStatus.isActive || !botStatus.botEnabled) return "red";
  const calendarConnected =
    botStatus.calendlyConnected || botStatus.googleConnected;
  if (!botStatus.closeConnected || !calendarConnected) return "yellow";
  return "green";
}

const statusConfig: Record<
  BotStatusLevel,
  { label: string; dotClass: string; bgClass: string }
> = {
  green: {
    label: "All Systems Operational",
    dotClass: "bg-emerald-500",
    bgClass:
      "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  },
  yellow: {
    label: "Partial Connection",
    dotClass: "bg-amber-500",
    bgClass:
      "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  },
  red: {
    label: "Bot Inactive",
    dotClass: "bg-red-500",
    bgClass: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
  },
};

// ─── Helpers ────────────────────────────────────────────────────

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function minutesToLabel(min: number): string {
  if (min < 1) return "<1m";
  if (min < 60) return `${min.toFixed(1)}m`;
  return `${(min / 60).toFixed(1)}h`;
}

// ─── Component ──────────────────────────────────────────────────

export function MonitoringTab() {
  const { data: monitoring, isLoading, error } = useAgentMonitoring();
  const [activityPeriod, setActivityPeriod] = useState<"24h" | "7d">("24h");

  if (isLoading) {
    return (
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
        </div>
      </div>
    );
  }

  if (error || !monitoring) {
    return (
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="py-8 text-center">
          <Activity className="h-8 w-8 text-v2-ink-subtle dark:text-v2-ink-muted mx-auto mb-2" />
          <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Monitoring data unavailable
          </p>
          <p className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted mt-1">
            The monitoring API may not be deployed yet. Data will appear
            automatically once available.
          </p>
        </div>
      </div>
    );
  }

  const statusLevel = getBotStatusLevel(monitoring.botStatus);
  const status = statusConfig[statusLevel];
  const activity: ActivityWindow =
    activityPeriod === "24h" ? monitoring.activity24h : monitoring.activity7d;

  // Error indicator flags
  const hasStale = monitoring.errorIndicators.newStale24h > 0;
  const hasSuppressed = monitoring.errorIndicators.newSuppressed24h > 0;
  const hasHighRejection = monitoring.errorIndicators.hardNoRate7d > 0.15;
  const hasErrors = hasStale || hasSuppressed || hasHighRejection;

  return (
    <div className="space-y-2">
      {/* ── Bot Status ────────────────────────────────── */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
          Bot Status
        </h2>
        <div
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium",
            status.bgClass,
          )}
        >
          <span
            className={cn("h-2 w-2 rounded-full shrink-0", status.dotClass)}
          />
          {status.label}
        </div>
        <div className="grid grid-cols-5 gap-2 mt-2">
          <StatusPill
            label="Bot Enabled"
            active={monitoring.botStatus.botEnabled}
          />
          <StatusPill
            label="Close CRM"
            active={monitoring.botStatus.closeConnected}
          />
          <StatusPill
            label={
              monitoring.botStatus.calendarProvider === "google"
                ? "Google Cal"
                : "Calendly"
            }
            active={
              monitoring.botStatus.calendlyConnected ||
              monitoring.botStatus.googleConnected
            }
          />
          <StatusPill
            label="Follow-Up"
            active={monitoring.botStatus.followUpEnabled}
          />
          <StatusPill
            label="Reminders"
            active={monitoring.botStatus.remindersEnabled}
          />
        </div>
      </div>

      {/* ── Activity ──────────────────────────────────── */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
            Activity
          </h2>
          <div className="flex items-center gap-0.5 bg-v2-card-tinted dark:bg-v2-card-tinted rounded p-0.5">
            <button
              onClick={() => setActivityPeriod("24h")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                activityPeriod === "24h"
                  ? "bg-white dark:bg-v2-ring-strong shadow-sm text-v2-ink dark:text-v2-ink"
                  : "text-v2-ink-muted dark:text-v2-ink-subtle",
              )}
            >
              24h
            </button>
            <button
              onClick={() => setActivityPeriod("7d")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                activityPeriod === "7d"
                  ? "bg-white dark:bg-v2-ring-strong shadow-sm text-v2-ink dark:text-v2-ink"
                  : "text-v2-ink-muted dark:text-v2-ink-subtle",
              )}
            >
              7d
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            icon={MessageSquare}
            label="Conversations"
            value={String(activity.newConversations)}
          />
          <MetricCard
            icon={Zap}
            label="Response Rate"
            value={pct(activity.responseRate)}
            accent={
              activity.responseRate >= 0.9
                ? "green"
                : activity.responseRate >= 0.7
                  ? "amber"
                  : "red"
            }
          />
          <MetricCard
            icon={Clock}
            label="Avg Response"
            value={minutesToLabel(activity.avgResponseTimeMin)}
          />
        </div>
      </div>

      {/* ── Conversion Funnel ─────────────────────────── */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
          Conversion (7d)
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <div className="text-lg font-semibold text-v2-ink dark:text-v2-ink">
              {pct(monitoring.conversion.bookingRate7d)}
            </div>
            <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Booking Rate
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            <div className="text-center">
              <div className="font-medium text-v2-ink dark:text-v2-ink">
                {monitoring.conversion.totalConversations7d}
              </div>
              <div className="text-[9px]">Conversations</div>
            </div>
            <TrendingUp className="h-3 w-3 text-v2-ink-subtle" />
            <div className="text-center">
              <div className="font-medium text-v2-ink dark:text-v2-ink">
                {monitoring.conversion.totalAppointments7d}
              </div>
              <div className="text-[9px]">Appointments</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error Indicators ──────────────────────────── */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
          Error Indicators
        </h2>
        {!hasErrors ? (
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            No issues detected
          </div>
        ) : (
          <div className="space-y-1.5">
            {hasStale && (
              <ErrorBadge
                icon={ShieldAlert}
                label="Stale Leads (24h)"
                value={monitoring.errorIndicators.newStale24h}
                detail="Leads going cold without response"
              />
            )}
            {hasSuppressed && (
              <ErrorBadge
                icon={AlertTriangle}
                label="Suppressed (24h)"
                value={monitoring.errorIndicators.newSuppressed24h}
                detail="Bot being suppressed on conversations"
              />
            )}
            {hasHighRejection && (
              <ErrorBadge
                icon={AlertTriangle}
                label="Hard No Rate (7d)"
                value={pct(monitoring.errorIndicators.hardNoRate7d)}
                detail="High rejection rate from leads"
              />
            )}
          </div>
        )}
      </div>

      {/* ── Follow-Up Effectiveness ───────────────────── */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
          Follow-Up (7d)
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-v2-ink dark:text-v2-ink">
              {pct(monitoring.followUp.followUpEffectiveness7d)}
            </div>
            <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Effectiveness
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <MetricCard
              icon={MailCheck}
              label="Sent"
              value={String(monitoring.followUp.followUpsSent7d)}
              compact
            />
            <MetricCard
              icon={Calendar}
              label="Converted"
              value={String(monitoring.followUp.followUpsConverted7d)}
              compact
            />
          </div>
        </div>
      </div>

      {/* ── Job Health ────────────────────────────────── */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
          Job Health
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-sm font-medium text-v2-ink dark:text-v2-ink">
              {monitoring.jobHealth.pendingJobs}
            </div>
            <div className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Pending
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-v2-ink dark:text-v2-ink">
              {monitoring.jobHealth.activeJobs}
            </div>
            <div className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Active
            </div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                "text-sm font-medium",
                monitoring.jobHealth.failedJobs24h > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-v2-ink dark:text-v2-ink",
              )}
            >
              {monitoring.jobHealth.failedJobs24h}
            </div>
            <div className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Failed (24h)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={cn(
        "text-center px-1.5 py-1 rounded text-[10px] font-medium",
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          : "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle",
      )}
    >
      {label}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
  compact,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: "green" | "amber" | "red";
  compact?: boolean;
}) {
  const accentClass =
    accent === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : accent === "red"
          ? "text-red-600 dark:text-red-400"
          : "text-v2-ink dark:text-v2-ink";

  return (
    <div
      className={cn(
        "bg-v2-canvas dark:bg-v2-card-tinted/50 rounded px-2 py-1.5",
        compact && "px-1.5 py-1",
      )}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="h-3 w-3 text-v2-ink-subtle" />
        <span className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "text-sm font-semibold",
          accentClass,
          compact && "text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ErrorBadge({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-red-700 dark:text-red-300">
            {label}
          </span>
          <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">
            {value}
          </span>
        </div>
        <div className="text-[9px] text-red-600/70 dark:text-red-400/70">
          {detail}
        </div>
      </div>
    </div>
  );
}
