import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { ArrowRight, Check, PhoneCall, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloseCrmLogo } from "@/components/logos/CloseCrmLogo";
import { cn } from "@/lib/utils";

export interface VoiceAgentSetupStep {
  id: string;
  title: string;
  description: string;
  state: "complete" | "current" | "upcoming";
}

const VOICE_FEATURES = [
  "Missed appointment follow-up calls",
  "Rescheduling & confirmation calls",
  "After-hours inbound call handling",
  "Quoted lead follow-up calls",
];

interface VoiceAgentLandingProps {
  voiceAccessActive: boolean;
  launchPriceLabel: string;
  includedMinutes: number;
  trialIncludedMinutes: number;
  showServiceWarning: boolean;
  localDevWarning?: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  primaryActionLabel: string;
  primaryActionHref?: "/billing";
  primaryActionDisabled?: boolean;
  onPrimaryAction: () => void;
  setupSteps: VoiceAgentSetupStep[];
  completedSteps: number;
  nextStepTitle: string;
  nextStepDescription: string;
  closeConnected: boolean;
  voiceAgentCreated: boolean;
  voiceAgentPublished: boolean;
  voiceAgentProvisioning: boolean;
  onNavigateToSetup: () => void;
  canOpenSetup: boolean;
}

export function VoiceAgentLanding({
  voiceAccessActive,
  launchPriceLabel,
  includedMinutes,
  trialIncludedMinutes,
  showServiceWarning,
  localDevWarning,
  isRefreshing,
  onRefresh,
  primaryActionLabel,
  primaryActionHref,
  primaryActionDisabled = false,
  onPrimaryAction,
  setupSteps,
  completedSteps,
  nextStepTitle,
  nextStepDescription,
  closeConnected,
  voiceAgentCreated,
  voiceAgentPublished,
  voiceAgentProvisioning,
  onNavigateToSetup,
  canOpenSetup,
}: VoiceAgentLandingProps) {
  const progressPercent =
    setupSteps.length > 0 ? (completedSteps / setupSteps.length) * 100 : 0;
  const setupComplete = completedSteps >= setupSteps.length;

  return (
    <div className="space-y-3">
      {showServiceWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {localDevWarning ??
              "Some live voice reads are temporarily degraded. Saved configuration still appears here when the last sync was successful."}
          </span>
        </div>
      )}

      {/* ── Section A: Tier Card + Setup Progress ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.8fr_1.2fr]">
        {/* Tier card */}
        <div
          className={cn(
            "relative rounded-lg border p-4 transition-all",
            voiceAccessActive
              ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/30 dark:bg-emerald-950/20"
              : "border-v2-ring dark:border-v2-ring-strong",
          )}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            {voiceAccessActive ? (
              <Badge className="h-4 whitespace-nowrap bg-emerald-500 px-1.5 text-[9px] text-white">
                <Check className="mr-0.5 h-2.5 w-2.5" />
                Active
              </Badge>
            ) : (
              <Badge className="h-4 whitespace-nowrap bg-amber-500 px-1.5 text-[9px] text-white">
                Free Trial
              </Badge>
            )}
          </div>

          <div className="mt-1">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-3.5 w-3.5 text-v2-ink-muted dark:text-v2-ink-subtle" />
              <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                Voice Pro
              </p>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-bold text-v2-ink dark:text-v2-ink">
                {voiceAccessActive
                  ? launchPriceLabel.replace("/mo", "")
                  : "Free"}
              </span>
              <span className="text-[11px] text-v2-ink-muted">/mo</span>
            </div>
            <p className="mt-0.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {voiceAccessActive
                ? `${includedMinutes.toLocaleString()} minutes / month`
                : `${trialIncludedMinutes} minutes included, hard-capped`}
            </p>
          </div>

          <div className="mt-3 space-y-1.5">
            {VOICE_FEATURES.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-1.5 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle"
              >
                <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            {voiceAccessActive ? (
              <Badge className="bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                Current Plan
              </Badge>
            ) : showServiceWarning ? (
              <Button
                size="sm"
                className="h-8 w-full"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? "Checking..." : "Check Again"}
              </Button>
            ) : primaryActionHref ? (
              <Button asChild size="sm" className="h-8 w-full">
                <Link to={primaryActionHref}>{primaryActionLabel}</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 w-full"
                onClick={onPrimaryAction}
                disabled={primaryActionDisabled}
              >
                {primaryActionLabel}
              </Button>
            )}
          </div>

          {!voiceAccessActive && !showServiceWarning && (
            <p className="mt-2 text-center text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
              No overage charges — hard-capped at {trialIncludedMinutes} minutes
            </p>
          )}
        </div>

        {/* Setup progress + next step */}
        <div className="rounded-lg border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-v2-ink-muted dark:text-v2-ink-subtle">
                Setup Progress
              </p>
              <p className="mt-1 text-[12px] text-v2-ink-muted dark:text-v2-ink-muted">
                {completedSteps} of {setupSteps.length} launch steps ready
              </p>
            </div>
            <p className="text-lg font-semibold text-v2-ink dark:text-v2-ink">
              {Math.round(progressPercent)}%
            </p>
          </div>

          <Progress
            value={progressPercent}
            className="mt-3 h-2 bg-v2-card-tinted dark:bg-v2-card-tinted [&>div]:bg-emerald-500"
          />

          {setupComplete ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-500" />
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Setup complete
                </p>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-v2-ink-muted dark:text-v2-ink-subtle">
                Your voice agent is live and taking calls.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-lg border border-v2-ring bg-v2-canvas p-3 dark:border-v2-ring dark:bg-v2-canvas/40">
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3 text-emerald-500" />
                  <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
                    {nextStepTitle}
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-v2-ink-muted dark:text-v2-ink-subtle">
                  {nextStepDescription}
                </p>
              </div>

              {canOpenSetup && (
                <Button
                  size="sm"
                  className="mt-3 h-8 w-full"
                  onClick={onNavigateToSetup}
                >
                  Continue to Setup
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Section B: Overview Cards ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <OverviewCard
          title="Voice Access"
          value={
            voiceAccessActive
              ? "Active"
              : voiceAgentProvisioning
                ? "Provisioning"
                : "Not active"
          }
          detail={
            voiceAccessActive
              ? "Voice entitlement is active for this workspace."
              : "Voice access must be activated before a managed voice agent can be created."
          }
        />
        <OverviewCard
          icon={
            <CloseCrmLogo className="h-4 w-auto text-v2-ink dark:text-v2-ink" />
          }
          title="Close CRM"
          value={closeConnected ? "Connected" : "Required"}
          detail={
            closeConnected
              ? "Inbound calls route through your Close CRM number and lead records live in Close."
              : voiceAgentCreated
                ? "Connect Close CRM in the Setup tab to enable inbound call routing."
                : "Connect Close CRM before creating the voice agent."
          }
        />
        <OverviewCard
          title="Voice Agent"
          value={
            voiceAgentPublished
              ? "Published"
              : voiceAgentCreated
                ? "Draft"
                : voiceAgentProvisioning
                  ? "Creating"
                  : "Not created"
          }
          detail={
            voiceAgentPublished
              ? "The voice agent is live. Edit voice, prompt, or call flow in Setup and republish."
              : voiceAgentCreated
                ? "The agent is provisioned. Configure voice, prompt, and call flow in Setup, then publish."
                : "Create the voice agent to unlock voice, prompt, and publish controls."
          }
        />
        <OverviewCard
          title="Next Step"
          value={nextStepTitle}
          detail={nextStepDescription}
        />
      </div>
    </div>
  );
}

function OverviewCard({
  icon,
  title,
  value,
  detail,
}: {
  icon?: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
      <div className="flex items-center gap-2">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <p className="text-[10px] uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
          {title}
        </p>
      </div>
      <p className="mt-2 text-[15px] font-semibold text-v2-ink dark:text-v2-ink">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-v2-ink-muted dark:text-v2-ink-subtle">
        {detail}
      </p>
    </div>
  );
}
