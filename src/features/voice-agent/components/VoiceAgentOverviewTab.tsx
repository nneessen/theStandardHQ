// src/features/voice-agent/components/VoiceAgentOverviewTab.tsx
// Overview tab — compact metrics + feature showcase, muted zinc design
// Identical structure to ChatBotOverviewTab, adapted for voice content

import { Link } from "@tanstack/react-router";
import {
  PhoneCall,
  Calendar,
  CheckCircle,
  Moon,
  FileText,
  CalendarCheck,
  ArrowRight,
  Settings2,
  BarChart3,
  CreditCard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloseCrmLogo } from "@/components/logos/CloseCrmLogo";
import type { VoiceAgentSetupStep } from "./VoiceAgentLanding";

interface VoiceAgentOverviewTabProps {
  voiceAccessActive: boolean;
  voiceAgentPublished: boolean;
  voiceAgentCreated: boolean;
  voiceAgentProvisioning: boolean;
  closeConnected: boolean;
  canOpenSetup: boolean;
  setupSteps: VoiceAgentSetupStep[];
  completedSteps: number;
  nextStepTitle: string;
  nextStepDescription: string;
  primaryActionLabel: string;
  primaryActionHref?: string;
  primaryActionDisabled?: boolean;
  onPrimaryAction: () => void;
  onNavigateToSetup: () => void;
  onNavigateToStats: () => void;
  onNavigateToPlans: () => void;
  voiceEntitlement?: {
    status?: string;
    usage?: {
      outboundCalls?: number;
      inboundCalls?: number;
      answeredCalls?: number;
      usedMinutes?: number;
      includedMinutes?: number;
    };
  } | null;
  voiceUsage?: {
    outboundCalls?: number;
    inboundCalls?: number;
    answeredCalls?: number;
    usedMinutes?: number;
    includedMinutes?: number;
  } | null;
  voiceSetupState?: {
    usage?: {
      outboundCalls?: number;
      inboundCalls?: number;
      answeredCalls?: number;
      usedMinutes?: number;
      includedMinutes?: number;
    } | null;
  } | null;
  voiceSnapshot?: {
    usage?: {
      outboundCalls?: number;
      inboundCalls?: number;
      answeredCalls?: number;
      usedMinutes?: number;
      includedMinutes?: number;
    };
  } | null;
  launchPriceLabel: string;
  trialIncludedMinutes: number;
  includedMinutes: number;
}

export function VoiceAgentOverviewTab({
  voiceAccessActive,
  voiceAgentPublished,
  voiceAgentCreated,
  voiceAgentProvisioning,
  closeConnected: _closeConnected,
  canOpenSetup: _canOpenSetup,
  setupSteps,
  completedSteps,
  nextStepTitle,
  nextStepDescription: _nextStepDescription,
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
  launchPriceLabel,
  trialIncludedMinutes,
  includedMinutes,
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
    usage?.includedMinutes ?? includedMinutes ?? 0;
  const totalCalls = outboundCalls + inboundCalls;
  const answerRate =
    totalCalls === 0
      ? "--%"
      : `${((answeredCalls / totalCalls) * 100).toFixed(1)}%`;

  const setupComplete = completedSteps >= setupSteps.length;

  const voiceMetrics = [
    { label: "Outbound", value: String(outboundCalls) },
    { label: "Inbound", value: String(inboundCalls) },
    { label: "Answered", value: String(answeredCalls) },
    {
      label: "Minutes",
      value: `${minutesUsed}/${effectiveIncludedMinutes}`,
    },
    { label: "Answer Rate", value: answerRate },
  ];

  return (
    <div className="space-y-3">
      {/* ── Voice Metrics Strip (subscribers) ───────────────────── */}
      {voiceAccessActive && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              Voice Metrics · This Cycle
            </span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div className="flex items-center divide-x divide-border">
            {voiceMetrics.map((m) => (
              <div key={m.label} className="flex-1 px-3 first:pl-0 last:pr-0">
                <div className="text-[9px] text-muted-foreground">
                  {m.label}
                </div>
                <div className="text-sm font-bold text-foreground">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Status + Nav (subscribers) ─────────────────────── */}
      {voiceAccessActive && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Agent Status
              </span>
              {voiceAgentPublished ? (
                <Badge className="h-4 bg-emerald-100 px-1.5 text-[8px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Published
                </Badge>
              ) : voiceAgentCreated ? (
                <Badge className="h-4 bg-amber-100 px-1.5 text-[8px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Draft
                </Badge>
              ) : voiceAgentProvisioning ? (
                <Badge className="h-4 bg-amber-100 px-1.5 text-[8px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Provisioning
                </Badge>
              ) : (
                <Badge variant="outline" className="h-4 px-1.5 text-[8px]">
                  Not Created
                </Badge>
              )}
            </div>
            {!setupComplete && (
              <span className="text-[9px] text-muted-foreground">
                Setup: {completedSteps}/{setupSteps.length} · Next:{" "}
                {nextStepTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[9px] gap-1"
              onClick={onNavigateToSetup}
            >
              <Settings2 className="h-2.5 w-2.5" />
              Setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[9px] gap-1"
              onClick={onNavigateToStats}
            >
              <BarChart3 className="h-2.5 w-2.5" />
              Stats
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[9px] gap-1"
              onClick={onNavigateToPlans}
            >
              <CreditCard className="h-2.5 w-2.5" />
              Plan
            </Button>
          </div>
        </div>
      )}

      {/* ── How It Works ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            How It Works
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex items-start gap-2">
          {[
            {
              icon: Calendar,
              title: "Lead Misses Appointment",
              desc: "A lead no-shows or cancels their scheduled appointment",
            },
            {
              icon: PhoneCall,
              title: "AI Calls The Lead",
              desc: "Your voice agent automatically calls within minutes",
            },
            {
              icon: Calendar,
              title: "Appointment Rescheduled",
              desc: "The AI books a new appointment on your calendar",
            },
            {
              icon: CheckCircle,
              title: "CRM Updated",
              desc: "Call results and new appointment saved to Close CRM",
            },
          ].map((step, i) => (
            <div key={i} className="flex-1 flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[9px] font-bold text-muted-foreground flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <div className="text-[11px] font-medium text-foreground">
                  {step.title}
                </div>
                <div className="text-[10px] text-muted-foreground leading-snug">
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Use Cases ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            What Your Voice Agent Can Do
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
          {[
            {
              icon: Calendar,
              title: "Missed Appointment Follow-Up",
              desc: "Auto-calls leads who no-show their appointments",
            },
            {
              icon: Moon,
              title: "After-Hours Inbound",
              desc: "Answers calls after hours, qualifies, books callbacks",
            },
            {
              icon: FileText,
              title: "Quote Follow-Up",
              desc: "Follows up on sent quotes to keep deals moving",
            },
            {
              icon: CalendarCheck,
              title: "Rescheduling & Confirmation",
              desc: "Handles date changes and appointment confirmations",
            },
          ].map((uc) => (
            <div
              key={uc.title}
              className="flex items-start gap-2.5 p-2 rounded-lg border border-border/50 bg-muted/30"
            >
              <div
                className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0"
                style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
              >
                <uc.icon className="h-3.5 w-3.5" style={{ color: "#6366f1" }} />
              </div>
              <div className="pt-0.5">
                <div className="text-[11px] font-medium text-foreground">
                  {uc.title}
                </div>
                <div className="text-[10px] text-muted-foreground leading-snug">
                  {uc.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Voice Providers (non-subscribers) ────────────────────── */}
      {!voiceAccessActive && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Voice Providers
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            Choose from{" "}
            {["ElevenLabs", "Cartesia", "Minimax", "Fish Audio"].map((p) => (
              <Badge key={p} variant="outline" className="text-[9px] h-4">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Pricing (non-subscribers) ────────────────────────────── */}
      {!voiceAccessActive && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Plans
            </span>
          </div>

          <div className="flex items-start divide-x divide-border">
            <div className="flex-1 pr-4">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-lg font-bold text-foreground">$0</span>
                <span className="text-[10px] text-muted-foreground">
                  / trial
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                {trialIncludedMinutes} min hard-capped · No credit card
              </p>
              {primaryActionHref ? (
                <Button asChild size="sm" className="h-6 text-[9px]">
                  <Link to={primaryActionHref}>{primaryActionLabel}</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-6 text-[9px]"
                  disabled={primaryActionDisabled}
                  onClick={onPrimaryAction}
                >
                  {primaryActionLabel}
                </Button>
              )}
            </div>
            <div className="flex-1 pl-4">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-lg font-bold text-foreground">
                  {launchPriceLabel.replace("/mo", "")}
                </span>
                <span className="text-[10px] text-muted-foreground">/ mo</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                {includedMinutes.toLocaleString()} min/month · All features
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[9px]"
                onClick={onNavigateToPlans}
              >
                View Plans
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Requirements (non-subscribers) ───────────────────────── */}
      {!voiceAccessActive && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-[10px] text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-2">
            <CloseCrmLogo className="h-3.5 w-auto text-foreground" />
            <span>
              <span className="font-medium text-foreground">Close CRM</span>{" "}
              required for call routing
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PhoneCall className="h-3 w-3 flex-shrink-0" />
            <span>
              <span className="font-medium text-foreground">Retell.ai</span>{" "}
              managed platform — no separate account
            </span>
          </div>
        </div>
      )}

      {/* ── CTA Footer (non-subscribers) ────────────────────────── */}
      {!voiceAccessActive && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-semibold text-foreground">
              Start Your Free {trialIncludedMinutes}-Minute Trial
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              No credit card required. Hard-capped at {trialIncludedMinutes}{" "}
              minutes.
            </div>
          </div>
          {primaryActionHref ? (
            <Button asChild size="sm" className="h-7 text-[10px] gap-1.5">
              <Link to={primaryActionHref}>
                {primaryActionLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-[10px] gap-1.5"
              disabled={primaryActionDisabled}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
