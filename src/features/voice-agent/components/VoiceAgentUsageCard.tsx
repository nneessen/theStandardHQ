import {
  Activity,
  Loader2,
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ChatBotVoiceSetupState,
  ChatBotVoiceEntitlement,
  ChatBotVoiceUsage,
} from "@/features/chat-bot";
import type { VoiceEntitlementSnapshotView } from "../types";

interface VoiceAgentUsageCardProps {
  isLoading: boolean;
  launchIncludedMinutes: number;
  voiceSetupState?: ChatBotVoiceSetupState | null;
  voiceEntitlement: ChatBotVoiceEntitlement | null | undefined;
  voiceUsage: ChatBotVoiceUsage | null | undefined;
  snapshot: VoiceEntitlementSnapshotView | null;
  showServiceWarning: boolean;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function VoiceAgentUsageCard({
  isLoading,
  launchIncludedMinutes,
  voiceSetupState,
  voiceEntitlement,
  voiceUsage,
  snapshot,
  showServiceWarning,
}: VoiceAgentUsageCardProps) {
  const effectiveEntitlement = voiceEntitlement ?? voiceSetupState?.entitlement;
  const effectiveUsage = voiceUsage ?? voiceSetupState?.usage;
  const hasUsageSnapshot = Boolean(
    effectiveEntitlement ||
    effectiveUsage ||
    snapshot?.usage ||
    snapshot?.includedMinutes,
  );

  const includedMinutes =
    effectiveEntitlement?.includedMinutes ??
    effectiveUsage?.includedMinutes ??
    snapshot?.includedMinutes ??
    launchIncludedMinutes;
  const hardLimitMinutes =
    effectiveEntitlement?.hardLimitMinutes ??
    effectiveUsage?.hardLimitMinutes ??
    snapshot?.hardLimitMinutes ??
    includedMinutes;
  const minuteLimit = hardLimitMinutes > 0 ? hardLimitMinutes : includedMinutes;
  const entitlementUsage = effectiveEntitlement?.usage;
  const snapshotUsage = snapshot?.usage;
  const usedMinutes =
    entitlementUsage?.usedMinutes ??
    effectiveUsage?.usedMinutes ??
    snapshotUsage?.usedMinutes ??
    0;
  const remainingMinutes =
    entitlementUsage?.remainingMinutes ??
    effectiveUsage?.remainingMinutes ??
    snapshotUsage?.remainingMinutes ??
    Math.max(minuteLimit - usedMinutes, 0);
  const outboundCalls =
    entitlementUsage?.outboundCalls ??
    effectiveUsage?.outboundCalls ??
    snapshotUsage?.outboundCalls ??
    0;
  const inboundCalls =
    entitlementUsage?.inboundCalls ??
    effectiveUsage?.inboundCalls ??
    snapshotUsage?.inboundCalls ??
    0;
  const answeredCalls =
    entitlementUsage?.answeredCalls ??
    effectiveUsage?.answeredCalls ??
    snapshotUsage?.answeredCalls ??
    0;
  const cycleStart =
    effectiveEntitlement?.cycleStartAt ??
    effectiveUsage?.cycleStartAt ??
    snapshot?.cycleStartAt ??
    null;
  const cycleEnd =
    effectiveEntitlement?.cycleEndAt ??
    effectiveUsage?.cycleEndAt ??
    snapshot?.cycleEndAt ??
    null;
  const percentUsed =
    minuteLimit > 0 ? Math.min((usedMinutes / minuteLimit) * 100, 100) : 0;
  const voiceStatus = effectiveEntitlement?.status;
  const usageNeedsAttention =
    voiceStatus === "past_due" ||
    voiceStatus === "suspended" ||
    voiceStatus === "canceled" ||
    (Boolean(effectiveEntitlement) && usedMinutes >= minuteLimit);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
              Usage Snapshot
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Included minutes and current cycle activity
          </p>
        </div>

        <Badge className="text-[9px] h-4 px-1.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {minuteLimit.toLocaleString()} minute cap
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : !hasUsageSnapshot ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {launchIncludedMinutes.toLocaleString()} included minutes
          </p>
          <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
            Usage reporting will appear here after voice access is active.
            Self-serve checkout is still disabled for voice.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {usedMinutes.toLocaleString()}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                of {minuteLimit.toLocaleString()} minutes used
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usageNeedsAttention ? "bg-amber-500" : "bg-sky-500",
                )}
                style={{ width: `${percentUsed}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
              <span>{remainingMinutes.toLocaleString()} remaining</span>
              <span>{Math.round(percentUsed)}% used</span>
            </div>
          </div>

          {(cycleStart || cycleEnd) && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Current Cycle
              </p>
              <p className="mt-1 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                {formatDate(cycleStart) || "Start pending"} to{" "}
                {formatDate(cycleEnd) || "End pending"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <PhoneOutgoing className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Outbound
                </p>
              </div>
              <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {outboundCalls.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <PhoneIncoming className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Inbound
                </p>
              </div>
              <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {inboundCalls.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Answered
                </p>
              </div>
              <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {answeredCalls.toLocaleString()}
              </p>
            </div>
          </div>

          {(showServiceWarning || snapshot) && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              {showServiceWarning
                ? "Live usage data is temporarily unavailable. Values may reflect the last successful sync."
                : "Usage is shown from the current entitlement snapshot when available."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
