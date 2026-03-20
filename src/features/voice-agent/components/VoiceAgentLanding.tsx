import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  PhoneCall,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type VoiceAgentMode = "coming-soon" | "managed" | "degraded";

export interface VoiceAgentSetupStep {
  id: string;
  title: string;
  description: string;
  state: "complete" | "current" | "upcoming";
}

interface VoiceAgentLandingProps {
  mode: VoiceAgentMode;
  chatBotActive: boolean;
  voiceAddonActive: boolean;
  launchPriceLabel: string;
  includedMinutes: number;
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
}

function getModeBadge(mode: VoiceAgentMode) {
  switch (mode) {
    case "managed":
      return {
        label: "Managed Rollout",
        className:
          "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      };
    case "degraded":
      return {
        label: "Service Issue",
        className:
          "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      };
    default:
      return {
        label: "Coming Soon",
        className:
          "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      };
  }
}

function getVoiceRolloutLabel(
  mode: VoiceAgentMode,
  voiceAddonActive: boolean,
): string {
  if (voiceAddonActive || mode === "managed") {
    return "Managed rollout";
  }
  if (mode === "degraded") {
    return "Temporarily unavailable";
  }
  return "Not set up yet";
}

function getStepIcon(step: VoiceAgentSetupStep) {
  if (step.state === "complete") {
    return (
      <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
    );
  }

  return (
    <Circle
      className={cn(
        "h-4 w-4",
        step.state === "current"
          ? "fill-sky-500 text-sky-500 dark:fill-sky-300 dark:text-sky-300"
          : "text-zinc-500 dark:text-zinc-500",
      )}
    />
  );
}

export function VoiceAgentLanding({
  mode,
  chatBotActive,
  voiceAddonActive,
  launchPriceLabel,
  includedMinutes,
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
}: VoiceAgentLandingProps) {
  const badge = getModeBadge(mode);
  const progressPercent =
    setupSteps.length > 0 ? (completedSteps / setupSteps.length) * 100 : 0;
  const title =
    mode === "managed"
      ? "Set up and launch your AI Voice Agent."
      : mode === "degraded"
        ? "Your AI Voice Agent setup is temporarily unavailable."
        : "AI Voice Agent is available as a separate add-on.";

  const description =
    mode === "managed"
      ? "Choose the voice, write the greeting, configure call handling, and publish before you go live."
      : mode === "degraded"
        ? "Voice setup data is temporarily degraded. The Standard HQ is still the control surface, but some live reads may be delayed."
        : "Voice remains a separate paid add-on from AI Chat Bot. When voice access is active, setup and launch happen here.";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_35%),linear-gradient(135deg,#0f172a,#18181b_55%,#082f49)] px-4 py-5 dark:border-zinc-800">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <PhoneCall className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-sm font-semibold text-white">
                    AI Voice Agent
                  </h1>
                  <Badge
                    className={cn("h-4 px-1.5 text-[9px]", badge.className)}
                  >
                    {badge.label}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-300">
                  Voice setup in The Standard HQ
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xl font-semibold tracking-tight text-white">
                {title}
              </p>
              <p className="max-w-2xl text-[12px] leading-6 text-zinc-300">
                {description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showServiceWarning ? (
              <Button
                size="sm"
                className="h-8 bg-white text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? "Checking..." : "Check Again"}
              </Button>
            ) : primaryActionHref ? (
              <Button asChild size="sm" className="h-8">
                <Link to={primaryActionHref}>{primaryActionLabel}</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8"
                onClick={onPrimaryAction}
                disabled={primaryActionDisabled}
              >
                {primaryActionLabel}
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link to="/billing">View Billing</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                  Setup Progress
                </p>
                <p className="mt-1 text-[12px] text-zinc-200">
                  {completedSteps} of {setupSteps.length} launch steps ready
                </p>
              </div>
              <p className="text-lg font-semibold text-white">
                {Math.round(progressPercent)}%
              </p>
            </div>

            <Progress
              value={progressPercent}
              className="mt-3 h-2 bg-white/10 [&>div]:bg-sky-400"
            />

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {setupSteps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "rounded-lg border px-3 py-3",
                    step.state === "current"
                      ? "border-sky-300 bg-sky-400/10"
                      : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{getStepIcon(step)}</div>
                    <div>
                      <p className="text-[12px] font-semibold text-white">
                        {step.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-300" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                Next Step
              </p>
            </div>
            <p className="mt-3 text-lg font-semibold text-white">
              {nextStepTitle}
            </p>
            <p className="mt-2 text-[12px] leading-6 text-zinc-300">
              {nextStepDescription}
            </p>

            <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-zinc-950/20 p-3">
              <div className="flex items-center justify-between text-[11px] text-zinc-300">
                <span>Launch plan</span>
                <span className="font-semibold text-white">
                  {launchPriceLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-300">
                <span>Included minutes</span>
                <span className="font-semibold text-white">
                  {includedMinutes.toLocaleString()} / month
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-300">
                <span>Rollout</span>
                <span className="font-semibold text-white">
                  {getVoiceRolloutLabel(mode, voiceAddonActive)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-[11px] text-zinc-300">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
              <span>
                {chatBotActive
                  ? "Voice works alongside your AI Chat Bot, but setup and launch happen here."
                  : "If you do not use AI Chat Bot, The Standard HQ will create the managed voice workspace here as you connect Close CRM and create the agent."}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {showServiceWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {localDevWarning ??
                "Some live voice reads are temporarily degraded. Saved configuration still appears here when the last sync was successful."}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                AI Chat Bot
              </p>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
              Keep SMS workflows, conversations, and message usage on the AI
              Chat Bot side. Use this page to shape the voice experience.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                Voice Setup
              </p>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
              Start with the spoken experience first: voice, greeting, prompt,
              and call handling. Extra technical controls stay out of the main
              setup flow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
