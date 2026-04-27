import {
  CheckCircle2,
  Clock3,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ChatBotVoiceEntitlement,
  ChatBotVoiceSetupState,
} from "@/features/chat-bot";
import type { VoiceEntitlementSnapshotView } from "../types";

interface VoiceAgentStatusCardProps {
  hasVoiceAddon: boolean;
  syncStatus: string | null | undefined;
  lastSyncedAt: string | null | undefined;
  lastSyncAttemptAt: string | null | undefined;
  lastSyncHttpStatus: number | null | undefined;
  voiceEntitlement: ChatBotVoiceEntitlement | null | undefined;
  voiceSetupState?: ChatBotVoiceSetupState | null;
  snapshot: VoiceEntitlementSnapshotView | null;
  showServiceWarning: boolean;
  retellConnected: boolean;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEntitlementStatusClass(status: string | null | undefined) {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "past_due":
    case "suspended":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    case "canceled":
      return "bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink-muted";
    default:
      return "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-muted";
  }
}

function getSyncStatusClass(syncStatus: string | null | undefined) {
  switch (syncStatus) {
    case "synced":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "degraded":
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
}

function getFeatureLabels(
  entitlement: ChatBotVoiceEntitlement | null | undefined,
  snapshot: VoiceEntitlementSnapshotView | null,
) {
  const features = entitlement?.features ?? snapshot?.features;
  if (!features) return [];

  return [
    features.missedAppointment ? "Missed appointments" : null,
    features.reschedule ? "Reschedules" : null,
    features.afterHoursInbound ? "After-hours inbound" : null,
    features.quotedFollowup ? "Quoted follow-up" : null,
  ].filter(Boolean) as string[];
}

function getSetupStateCopy(
  setupState: ChatBotVoiceSetupState | null | undefined,
  retellConnected: boolean,
) {
  if (!setupState) {
    return retellConnected
      ? "Ready in The Standard HQ"
      : "Create your voice agent next";
  }

  if (setupState.agent?.published) {
    return "Published and live";
  }

  switch (setupState.nextAction?.key) {
    case "activate_trial":
    case "resolve_billing":
    case "resolve_suspension":
    case "replenish_minutes":
    case "reactivate_voice":
    case "activate_voice":
      return "Voice access required";
    case "connect_close":
      return "Connect Close CRM next";
    case "create_agent":
      return "Create your voice agent next";
    case "wait_for_provisioning":
      return "Provisioning in progress";
    case "publish_agent":
      return "Ready to publish";
    case "connect_calendar":
    case "review_guardrails":
      return "Finish setup in The Standard HQ";
    case "repair_agent":
      return "Agent repair required";
    default:
      return retellConnected
        ? "Ready in The Standard HQ"
        : "Create your voice agent next";
  }
}

export function VoiceAgentStatusCard({
  hasVoiceAddon,
  syncStatus,
  lastSyncedAt,
  lastSyncAttemptAt,
  lastSyncHttpStatus,
  voiceEntitlement,
  voiceSetupState,
  snapshot,
  showServiceWarning,
  retellConnected,
}: VoiceAgentStatusCardProps) {
  const effectiveEntitlement =
    voiceEntitlement ?? voiceSetupState?.entitlement ?? snapshot;
  const featureLabels = getFeatureLabels(
    voiceEntitlement ?? voiceSetupState?.entitlement,
    snapshot,
  );
  const syncState = syncStatus || (hasVoiceAddon ? "pending" : "not_started");
  const hasSyncAttention =
    syncStatus === "degraded" ||
    Boolean(lastSyncHttpStatus && lastSyncHttpStatus >= 400);
  const voiceAccessAssigned = voiceSetupState
    ? voiceSetupState.readiness?.entitlementActive === true
    : hasVoiceAddon ||
      effectiveEntitlement?.status === "active" ||
      effectiveEntitlement?.status === "trialing";
  const setupStateCopy = getSetupStateCopy(voiceSetupState, retellConnected);

  return (
    <div className="rounded-lg border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall className="h-3.5 w-3.5 text-v2-ink-muted dark:text-v2-ink-subtle" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink dark:text-v2-ink">
              Voice Status
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Subscription and workspace readiness
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge
            className={cn(
              "text-[9px] h-4 px-1.5 capitalize",
              getEntitlementStatusClass(effectiveEntitlement?.status),
            )}
          >
            {effectiveEntitlement?.status?.replace(/_/g, " ") || "not active"}
          </Badge>
          {hasVoiceAddon && (
            <Badge
              className={cn(
                "text-[9px] h-4 px-1.5 capitalize",
                getSyncStatusClass(syncStatus),
              )}
            >
              {syncState.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2.5 dark:border-v2-ring dark:bg-v2-canvas/40">
          <p className="text-[10px] uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
            Voice Access
          </p>
          <p className="mt-1 text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
            {voiceAccessAssigned
              ? "Assigned to this workspace"
              : "Not yet assigned"}
          </p>
        </div>

        <div className="rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2.5 dark:border-v2-ring dark:bg-v2-canvas/40">
          <p className="text-[10px] uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
            Voice Plan
          </p>
          <p className="mt-1 text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
            {effectiveEntitlement?.planCode || "Voice Pro launch plan"}
          </p>
        </div>

        <div className="rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2.5 dark:border-v2-ring dark:bg-v2-canvas/40">
          <p className="text-[10px] uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
            Setup State
          </p>
          <p className="mt-1 text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
            {setupStateCopy}
          </p>
        </div>

        <div className="rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2.5 dark:border-v2-ring dark:bg-v2-canvas/40">
          <p className="text-[10px] uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
            Last Update
          </p>
          <p className="mt-1 text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
            {formatDateTime(lastSyncedAt || lastSyncAttemptAt)}
          </p>
        </div>
      </div>

      {featureLabels.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
            Included Features
          </p>
          <div className="flex flex-wrap gap-1.5">
            {featureLabels.map((feature) => (
              <Badge
                key={feature}
                variant="outline"
                className="border-v2-ring bg-v2-canvas text-[9px] text-v2-ink dark:border-v2-ring-strong dark:bg-v2-canvas/40 dark:text-v2-ink-muted"
              >
                {feature}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {showServiceWarning && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Live entitlement reads are temporarily unavailable. Managed sync
            data below may be the last successful snapshot.
          </span>
        </div>
      )}

      {!showServiceWarning && hasSyncAttention && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            The latest managed sync needs attention. Support may need to rerun
            setup for this workspace.
          </span>
        </div>
      )}

      {!voiceAccessAssigned && !effectiveEntitlement && !showServiceWarning && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2 text-[11px] text-v2-ink-muted dark:border-v2-ring dark:bg-v2-canvas/40 dark:text-v2-ink-subtle">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            No voice plan has been assigned yet. Once voice access is active,
            entitlement and sync details will appear here.
          </span>
        </div>
      )}

      {hasVoiceAddon && syncStatus === "synced" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            The Standard HQ is showing the current voice state and can manage
            the connected voice workspace directly for this account.
          </span>
        </div>
      )}
    </div>
  );
}
