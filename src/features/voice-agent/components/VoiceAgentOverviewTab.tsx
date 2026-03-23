// src/features/voice-agent/components/VoiceAgentOverviewTab.tsx
// Overview tab — SaaS product showcase with dark hero, feature highlights, metrics, CTA
// Matches ChatBotOverviewTab structure, adapted for voice agent content

import { Link } from "@tanstack/react-router";
import {
  PhoneCall,
  ArrowRight,
  Sparkles,
  Clock,
  PhoneIncoming,
  Calendar,
  ShieldCheck,
  UserCheck,
  Voicemail,
  RefreshCw,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseCrmLogo } from "@/components/logos/CloseCrmLogo";
import type { ChatBotVoiceCloneStatus } from "@/features/chat-bot";
import type { VoiceAgentSetupStep } from "./VoiceAgentLanding";
import { VoiceCloneStatusCard } from "./VoiceCloneStatusCard";

// ─── Props ──────────────────────────────────────────────────────

interface VoiceUsageLike {
  outboundCalls?: number;
  inboundCalls?: number;
  answeredCalls?: number;
  usedMinutes?: number;
  includedMinutes?: number;
}

interface VoiceAgentOverviewTabProps {
  voiceAccessActive: boolean;
  voiceAgentPublished: boolean;
  setupSteps: VoiceAgentSetupStep[];
  completedSteps: number;
  nextStepTitle: string;
  primaryActionLabel: string;
  primaryActionHref?: string;
  primaryActionDisabled?: boolean;
  onPrimaryAction: () => void;
  onNavigateToSetup: () => void;
  onNavigateToStats: () => void;
  onNavigateToPlans: () => void;
  voiceEntitlement?: { status?: string; usage?: VoiceUsageLike } | null;
  voiceUsage?: VoiceUsageLike | null;
  voiceSetupState?: { usage?: VoiceUsageLike | null } | null;
  voiceSnapshot?: { usage?: VoiceUsageLike } | null;
  trialIncludedMinutes: number;
  includedMinutes: number;
  voiceCloneStatus?: ChatBotVoiceCloneStatus | null;
  cloneStatusLoading?: boolean;
  voiceAgentCreated?: boolean;
  externalAgentId?: string | null;
  onNavigateToVoiceClone?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────

const ACCENT = "#6366f1"; // indigo — matches page hero glow

const HIGHLIGHTS = [
  {
    icon: Calendar,
    title: "Missed Appointment Recovery",
    desc: "Automatically calls leads who no-showed and reschedules on the spot",
  },
  {
    icon: PhoneIncoming,
    title: "After-Hours Inbound",
    desc: "Answers calls outside business hours so no lead goes to voicemail",
  },
  {
    icon: RefreshCw,
    title: "Follow-Up Calls",
    desc: "Re-engages quoted leads who haven't committed to a policy yet",
  },
  {
    icon: Bot,
    title: "Natural Conversation",
    desc: "Retell-powered AI that handles objections and steers toward booking",
  },
  {
    icon: ShieldCheck,
    title: "Compliant & Capped",
    desc: "Hard minute cap — never exceeds your plan's included minutes",
  },
  {
    icon: UserCheck,
    title: "Human Handoff",
    desc: "Seamlessly transfers to a live agent when the lead requests it",
  },
  {
    icon: Clock,
    title: "Instant Response",
    desc: "Calls connect within seconds — no manual dialing required",
  },
  {
    icon: Voicemail,
    title: "Voicemail Detection",
    desc: "Detects voicemail boxes and leaves a pre-configured message",
  },
];

// ─── Main Component ─────────────────────────────────────────────

export function VoiceAgentOverviewTab({
  voiceAccessActive,
  voiceAgentPublished,
  setupSteps,
  completedSteps,
  nextStepTitle,
  primaryActionLabel,
  primaryActionHref,
  primaryActionDisabled = false,
  onPrimaryAction,
  onNavigateToSetup,
  onNavigateToStats,
  onNavigateToPlans,
  voiceEntitlement,
  voiceUsage,
  voiceSetupState,
  voiceSnapshot,
  includedMinutes,
  voiceCloneStatus,
  cloneStatusLoading = false,
  voiceAgentCreated = false,
  externalAgentId,
}: VoiceAgentOverviewTabProps) {
  const usage =
    voiceEntitlement?.usage ??
    voiceUsage ??
    voiceSetupState?.usage ??
    voiceSnapshot?.usage;

  const outboundCalls = usage?.outboundCalls ?? 0;
  const inboundCalls = usage?.inboundCalls ?? 0;
  const answeredCalls = usage?.answeredCalls ?? 0;
  const minutesUsed = usage?.usedMinutes ?? 0;
  const effectiveIncludedMinutes =
    usage?.includedMinutes || includedMinutes || 0;
  const totalCalls = outboundCalls + inboundCalls;
  const answerRate =
    totalCalls === 0
      ? "--%"
      : `${((answeredCalls / totalCalls) * 100).toFixed(1)}%`;

  const setupComplete = completedSteps >= setupSteps.length;
  const isSetupDone = voiceAccessActive && setupComplete;

  const ctaLabel = !voiceAccessActive
    ? "Start Free Trial"
    : !isSetupDone
      ? "Complete Setup"
      : "View Stats";
  const ctaAction = !voiceAccessActive
    ? onPrimaryAction
    : !isSetupDone
      ? onNavigateToSetup
      : onNavigateToStats;

  return (
    <div className="space-y-4">
      {/* ══════ Hero Section ══════ */}
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="va-overview-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#va-overview-grid)" />
          </svg>
        </div>

        {/* Glow orbs */}
        <div
          className="absolute top-0 -left-20 w-80 h-80 rounded-full blur-3xl"
          style={{ backgroundColor: `${ACCENT}15` }}
        />
        <div
          className="absolute bottom-0 -right-16 w-64 h-64 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(139,92,246,0.08)" }}
        />

        <div className="relative px-6 py-6">
          <div className="flex items-start gap-5">
            {/* Hero icon */}
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl flex-shrink-0"
              style={{ backgroundColor: `${ACCENT}25` }}
            >
              <PhoneCall className="h-7 w-7" style={{ color: ACCENT }} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 mb-3"
                style={{
                  backgroundColor: `${ACCENT}20`,
                  borderColor: `${ACCENT}40`,
                }}
              >
                <Sparkles className="h-3 w-3" style={{ color: ACCENT }} />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: ACCENT }}
                >
                  AI-Powered Voice Agent
                </span>
              </div>

              <h1
                className="text-xl font-bold text-white dark:text-black tracking-tight mb-1.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Automate Follow-Ups &amp; Inbound Calls
              </h1>
              <p className="text-[11px] text-white/50 dark:text-black/40 leading-relaxed max-w-2xl">
                Your AI voice agent handles missed appointments, after-hours
                inbound, and follow-up calls automatically — connecting with
                leads by phone while you focus on selling. Powered by Retell.ai
                with a managed workspace — no separate account needed.
              </p>

              {/* CTA + Integration logos row */}
              <div className="flex items-center justify-between gap-4 mt-4">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-white/30 dark:text-black/25 uppercase tracking-widest font-medium">
                    Integrates with
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10">
                      <CloseCrmLogo className="h-3.5 w-auto text-white dark:text-black" />
                      <span className="text-[9px] text-white/60 dark:text-black/50 font-medium">
                        Close CRM
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10">
                      <PhoneCall className="h-3.5 w-3.5 text-white/70 dark:text-black/60" />
                      <span className="text-[9px] text-white/60 dark:text-black/50 font-medium">
                        Retell.ai
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                {primaryActionHref && !voiceAccessActive ? (
                  <Button
                    asChild
                    size="sm"
                    className="h-8 text-[10px] gap-1.5 px-4 text-white shadow-md flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
                      boxShadow: `0 4px 14px ${ACCENT}30`,
                    }}
                  >
                    <Link to={primaryActionHref}>
                      {primaryActionLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 text-[10px] gap-1.5 px-4 text-white shadow-md flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
                      boxShadow: `0 4px 14px ${ACCENT}30`,
                    }}
                    disabled={primaryActionDisabled}
                    onClick={ctaAction}
                  >
                    {ctaLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ Feature Highlights Grid ══════ */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h3 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
          What&apos;s Included
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.title}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30"
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: `${ACCENT}12` }}
              >
                <h.icon className="h-4 w-4" style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {h.title}
                </div>
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">
                  {h.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════ Voice Metrics Strip (subscribers) ══════ */}
      {voiceAccessActive && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
              Voice Metrics · This Cycle
            </span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
            {[
              { label: "Outbound", value: String(outboundCalls) },
              { label: "Inbound", value: String(inboundCalls) },
              { label: "Answered", value: String(answeredCalls) },
              {
                label: "Minutes",
                value: `${minutesUsed}/${effectiveIncludedMinutes}`,
              },
              { label: "Answer Rate", value: answerRate },
            ].map((m) => (
              <div key={m.label} className="flex-1 px-3 first:pl-0 last:pr-0">
                <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                  {m.label}
                </div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ Voice Cloning (subscribers with agent created) ══════ */}
      {voiceAccessActive && voiceAgentCreated && (
        <VoiceCloneStatusCard
          cloneStatus={voiceCloneStatus}
          isLoading={cloneStatusLoading}
          agentId={externalAgentId}
        />
      )}

      {/* ══════ Your Agent (subscribers with setup done) ══════ */}
      {voiceAccessActive && isSetupDone && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
              Your Voice Agent
            </span>
            <span className="text-[9px] font-medium">
              {voiceAgentPublished ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Published
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Draft
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 mb-2">
            <div className="flex-1 pr-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Outbound
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {outboundCalls}
              </div>
            </div>
            <div className="flex-1 px-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Inbound
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {inboundCalls}
              </div>
            </div>
            <div className="flex-1 px-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Answer Rate
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {answerRate}
              </div>
            </div>
            <div className="flex-1 pl-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Minutes
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {minutesUsed}{" "}
                <span className="text-[9px] font-normal text-zinc-400 dark:text-zinc-500">
                  / {effectiveIncludedMinutes}
                </span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, effectiveIncludedMinutes ? (minutesUsed / effectiveIncludedMinutes) * 100 : 0)}%`,
                    backgroundColor: ACCENT,
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: "Setup", action: onNavigateToSetup },
              { label: "Stats", action: onNavigateToStats },
              { label: "Plans", action: onNavigateToPlans },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                className="px-2 py-0.5 text-[9px] font-medium rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════ Setup Progress (subscribers, setup incomplete) ══════ */}
      {voiceAccessActive && !setupComplete && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Setup Progress
            </span>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
              {completedSteps}/{setupSteps.length} complete
            </span>
          </div>
          <div className="flex gap-1 mb-2">
            {setupSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i < completedSteps ? "bg-emerald-500" : "bg-zinc-100 dark:bg-zinc-800"}`}
              />
            ))}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Next:{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {nextStepTitle}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
