// src/features/chat-bot/components/UsageTab.tsx
// Usage stats: lead count vs limit, period, tier badge

import {
  Activity,
  AlertTriangle,
  Loader2,
  PhoneCall,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useChatBotUsage,
  useChatBotAgent,
  useIsOnExemptTeam,
  useChatBotVoiceEntitlement,
  useChatBotVoiceUsage,
} from "../hooks/useChatBot";

function getVoiceStatusClasses(status: string) {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-success/20 text-success dark:bg-success/15 dark:text-success";
    case "past_due":
    case "suspended":
      return "bg-warning/20 text-warning dark:bg-warning/15 dark:text-warning";
    case "canceled":
      return "bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink-muted";
    default:
      return "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-muted";
  }
}

export function UsageTab() {
  const { data: usage, isLoading } = useChatBotUsage();
  const { data: agent } = useChatBotAgent();
  const { data: isOnExemptTeam = false } = useIsOnExemptTeam();
  const { data: voiceEntitlement, isLoading: voiceEntitlementLoading } =
    useChatBotVoiceEntitlement();
  const { data: voiceUsage } = useChatBotVoiceUsage();
  const hasUnlimitedAccess = isOnExemptTeam || agent?.billingExempt === true;
  const unlimitedBadgeLabel = isOnExemptTeam ? "Team" : "Unlimited";
  const unlimitedMessage = isOnExemptTeam
    ? "Included via Team Access — No Lead Limits"
    : "Unlimited Access — No Lead Limits";
  const voiceLimit = voiceEntitlement
    ? voiceEntitlement.hardLimitMinutes > 0
      ? voiceEntitlement.hardLimitMinutes
      : voiceEntitlement.includedMinutes
    : voiceUsage?.hardLimitMinutes || voiceUsage?.includedMinutes || 0;
  const voiceUsedMinutes =
    voiceEntitlement?.usage?.usedMinutes ?? voiceUsage?.usedMinutes ?? 0;
  const voiceRemainingMinutes =
    voiceEntitlement?.usage?.remainingMinutes ??
    voiceUsage?.remainingMinutes ??
    0;
  const voicePercentUsed =
    voiceLimit > 0 ? Math.min((voiceUsedMinutes / voiceLimit) * 100, 100) : 0;
  const voiceStatus = voiceEntitlement?.status ?? "inactive";
  const voiceProvisioned =
    Boolean(voiceEntitlement) ||
    Boolean(
      voiceUsage &&
      (voiceUsage.includedMinutes > 0 || voiceUsage.usedMinutes > 0),
    );
  const voiceNeedsAttention =
    voiceStatus === "past_due" ||
    voiceStatus === "suspended" ||
    voiceStatus === "canceled" ||
    (voiceLimit > 0 && voiceUsedMinutes >= voiceLimit);
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="py-8 text-center">
          <Activity className="h-8 w-8 text-v2-ink-subtle dark:text-v2-ink-muted mx-auto mb-2" />
          <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Usage data unavailable
          </p>
        </div>
      </div>
    );
  }

  // Billing-exempt team members: simplified usage view
  if (hasUnlimitedAccess) {
    return (
      <div className="space-y-3">
        <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-v2-ink-subtle" />
              <span className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink uppercase tracking-wide">
                Lead Usage
              </span>
            </div>
            <Badge className="text-[9px] h-4 px-1.5 bg-info/20 text-info dark:bg-info dark:text-info">
              <Shield className="h-2.5 w-2.5 mr-0.5" />
              {unlimitedBadgeLabel}
            </Badge>
          </div>

          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-lg font-bold text-v2-ink dark:text-v2-ink">
              {usage.leadsUsed.toLocaleString()}
            </span>
            <span className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
              leads engaged
            </span>
          </div>

          <div className="flex items-center gap-2 p-2 bg-info/10 dark:bg-info/10 rounded text-[10px] text-info">
            <Shield className="h-3 w-3 flex-shrink-0" />
            <span>{unlimitedMessage}</span>
          </div>
        </div>

        {voiceProvisioned && (
          <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5 text-v2-ink-subtle" />
                <span className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink uppercase tracking-wide">
                  Voice Usage
                </span>
              </div>
              <Badge
                className={cn(
                  "text-[9px] h-4 px-1.5 capitalize",
                  getVoiceStatusClasses(voiceStatus),
                )}
              >
                {voiceStatus.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-lg font-bold text-v2-ink dark:text-v2-ink">
                {voiceUsedMinutes.toLocaleString()}
              </span>
              <span className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                / {voiceLimit.toLocaleString()} minutes
              </span>
            </div>

            <div className="h-2 bg-v2-card-tinted dark:bg-v2-card-tinted rounded-full overflow-hidden mb-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  voiceNeedsAttention ? "bg-warning" : "bg-info",
                )}
                style={{ width: `${voicePercentUsed}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              <span>{voiceRemainingMinutes.toLocaleString()} remaining</span>
              <span>{Math.round(voicePercentUsed)}% used</span>
            </div>

            {(voiceEntitlement?.cycleStartAt || voiceUsage?.cycleStartAt) &&
              (voiceEntitlement?.cycleEndAt || voiceUsage?.cycleEndAt) && (
                <div className="mt-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Cycle{" "}
                  {formatDate(
                    voiceEntitlement?.cycleStartAt ||
                      voiceUsage?.cycleStartAt ||
                      "",
                  )}{" "}
                  &rarr;{" "}
                  {formatDate(
                    voiceEntitlement?.cycleEndAt ||
                      voiceUsage?.cycleEndAt ||
                      "",
                  )}
                </div>
              )}

            {voiceNeedsAttention && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-warning">
                <AlertTriangle className="h-2.5 w-2.5" />
                <span>
                  {voiceStatus === "past_due" || voiceStatus === "suspended"
                    ? "Voice entitlement needs billing attention before calls can run."
                    : voiceStatus === "canceled"
                      ? "Voice entitlement is canceled."
                      : "Voice minute cap reached for the current cycle."}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const percentUsed =
    usage.leadLimit > 0
      ? Math.min((usage.leadsUsed / usage.leadLimit) * 100, 100)
      : 0;
  const isWarning = percentUsed >= 75 && percentUsed < 90;
  const isOverLimit = percentUsed >= 90;
  const remaining = Math.max(usage.leadLimit - usage.leadsUsed, 0);

  const tierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "starter":
        return "bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink-muted";
      case "growth":
        return "bg-info/20 text-info dark:bg-info dark:text-info";
      case "scale":
        return "bg-info/20 text-info dark:bg-info dark:text-info";
      default:
        return "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-muted";
    }
  };

  return (
    <div className="space-y-3">
      {/* Usage Card */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <span className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink uppercase tracking-wide">
              Lead Usage
            </span>
          </div>
          <Badge
            className={cn("text-[9px] h-4 px-1.5", tierColor(usage.tierName))}
          >
            {usage.tierName}
          </Badge>
        </div>

        {/* Count */}
        <div className="flex items-baseline gap-1 mb-2">
          <span
            className={cn(
              "text-lg font-bold",
              isOverLimit ? "text-destructive" : "text-v2-ink dark:text-v2-ink",
            )}
          >
            {usage.leadsUsed.toLocaleString()}
          </span>
          <span className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            / {usage.leadLimit.toLocaleString()} leads
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-v2-card-tinted dark:bg-v2-card-tinted rounded-full overflow-hidden mb-2">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOverLimit
                ? "bg-destructive"
                : isWarning
                  ? "bg-warning"
                  : "bg-success",
            )}
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            {remaining.toLocaleString()} remaining
          </span>
          <span
            className={cn(
              "text-[10px] font-medium",
              isOverLimit
                ? "text-destructive"
                : isWarning
                  ? "text-warning"
                  : "text-v2-ink-muted dark:text-v2-ink-subtle",
            )}
          >
            {Math.round(percentUsed)}% used
          </span>
        </div>

        {/* Warning */}
        {isWarning && !isOverLimit && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-warning">
            <AlertTriangle className="h-2.5 w-2.5" />
            <span>Approaching your lead limit for this period.</span>
          </div>
        )}

        {isOverLimit && (
          <div className="flex items-center gap-1 mt-2 p-1.5 bg-destructive/10 rounded text-[10px] text-destructive">
            <AlertTriangle className="h-2.5 w-2.5" />
            <span>
              You have reached your lead limit. New leads will not be processed
              until the next billing period.
            </span>
          </div>
        )}
      </div>

      {/* Billing Period Card */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
          Billing Period
        </h2>
        <div className="flex items-center gap-2 text-[11px] text-v2-ink dark:text-v2-ink-muted">
          <span>{formatDate(usage.periodStart)}</span>
          <span className="text-v2-ink-subtle">&rarr;</span>
          <span>{formatDate(usage.periodEnd)}</span>
        </div>
      </div>

      {(voiceEntitlementLoading || voiceProvisioned) && (
        <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-v2-ink-subtle" />
              <span className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink uppercase tracking-wide">
                Voice Add-on
              </span>
            </div>
            {!voiceEntitlementLoading && (
              <Badge
                className={cn(
                  "text-[9px] h-4 px-1.5 capitalize",
                  getVoiceStatusClasses(voiceStatus),
                )}
              >
                {voiceStatus.replace(/_/g, " ")}
              </Badge>
            )}
          </div>

          {voiceEntitlementLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-lg font-bold text-v2-ink dark:text-v2-ink">
                  {voiceUsedMinutes.toLocaleString()}
                </span>
                <span className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  / {voiceLimit.toLocaleString()} minutes
                </span>
              </div>

              <div className="h-2 bg-v2-card-tinted dark:bg-v2-card-tinted rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    voiceNeedsAttention ? "bg-warning" : "bg-info",
                  )}
                  style={{ width: `${voicePercentUsed}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  {voiceRemainingMinutes.toLocaleString()} remaining
                </span>
                <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  {voiceEntitlement?.planCode || "voice_pro_v1"}
                </span>
              </div>

              {(voiceEntitlement?.cycleStartAt || voiceUsage?.cycleStartAt) &&
                (voiceEntitlement?.cycleEndAt || voiceUsage?.cycleEndAt) && (
                  <div className="mt-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Cycle{" "}
                    {formatDate(
                      voiceEntitlement?.cycleStartAt ||
                        voiceUsage?.cycleStartAt ||
                        "",
                    )}{" "}
                    &rarr;{" "}
                    {formatDate(
                      voiceEntitlement?.cycleEndAt ||
                        voiceUsage?.cycleEndAt ||
                        "",
                    )}
                  </div>
                )}

              {voiceEntitlement && (
                <div className="mt-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Features:{" "}
                  {[
                    voiceEntitlement.features.missedAppointment &&
                      "Missed appointments",
                    voiceEntitlement.features.reschedule && "Reschedules",
                    voiceEntitlement.features.afterHoursInbound &&
                      "After-hours inbound",
                    voiceEntitlement.features.quotedFollowup &&
                      "Quoted follow-up",
                  ]
                    .filter(Boolean)
                    .join(", ") || "None enabled"}
                </div>
              )}

              {voiceNeedsAttention && (
                <div className="flex items-center gap-1 mt-2 text-[10px] text-warning">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <span>
                    {voiceStatus === "past_due" || voiceStatus === "suspended"
                      ? "Voice entitlement needs billing attention before calls can run."
                      : voiceStatus === "canceled"
                        ? "Voice entitlement is canceled."
                        : "Voice minute cap reached for the current cycle."}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
