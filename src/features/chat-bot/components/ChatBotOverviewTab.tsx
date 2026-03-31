// src/features/chat-bot/components/ChatBotOverviewTab.tsx
// Overview tab — SaaS product showcase with dark hero, feature highlights, metrics, CTA

import { useState } from "react";
import {
  Bot,
  MessageSquare,
  Calendar,
  Clock,
  Zap,
  ShieldCheck,
  RefreshCw,
  Globe,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ChatBotAgent, useChatBotUsage } from "../hooks/useChatBot";
import {
  useCollectiveAnalytics,
  useChatBotAnalytics,
} from "../hooks/useChatBotAnalytics";
import {
  CloseLogo,
  CalendlyLogo,
  GoogleCalendarLogo,
} from "./IntegrationLogos";

// ─── Props ──────────────────────────────────────────────────────

interface ChatBotOverviewTabProps {
  hasAccess: boolean;
  agent: ChatBotAgent | null | undefined;
  setupComplete: boolean;
  wizardDone: boolean;
  isTeamMember: boolean;
  currentTierId: string | null;
  onNavigateToTab: (tabId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ACCENT = "#3b82f6";

const HIGHLIGHTS = [
  {
    icon: Clock,
    title: "Instant Response",
    desc: "Replies within seconds during compliant business hours",
  },
  {
    icon: Zap,
    title: "Proactive Outreach",
    desc: "Contacts new CRM leads automatically — doesn't wait for them",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    desc: "Books from your real Calendly or Google Calendar availability",
  },
  {
    icon: MessageSquare,
    title: "Objection Handling",
    desc: "Natural rebuttals that steer hesitant leads toward booking",
  },
  {
    icon: ShieldCheck,
    title: "Compliant Conversations",
    desc: "Never quotes prices or policy details over text",
  },
  {
    icon: RefreshCw,
    title: "Follow-Up Re-engagement",
    desc: "Re-engages cold leads with personalized follow-up sequences",
  },
  {
    icon: Globe,
    title: "Timezone Aware",
    desc: "Auto-adjusts appointment offers based on the lead's timezone",
  },
  {
    icon: TrendingUp,
    title: "Full Attribution",
    desc: "Tracks which policies originated from bot conversations",
  },
];

// ─── Main Component ─────────────────────────────────────────────

export function ChatBotOverviewTab({
  hasAccess,
  agent,
  setupComplete,
  wizardDone,
  isTeamMember: _isTeamMember,
  currentTierId: _currentTierId,
  onNavigateToTab,
}: ChatBotOverviewTabProps) {
  const isSetupDone = setupComplete || wizardDone;

  const [range] = useState(() => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    return { from, to };
  });

  const {
    data: collective,
    isLoading: collectiveLoading,
    error: collectiveError,
  } = useCollectiveAnalytics(range.from, range.to, {
    refetchInterval: 30_000,
    enabled: hasAccess && agent !== undefined,
  });

  const personalEnabled = hasAccess && !!agent && isSetupDone;
  const { data: analytics } = useChatBotAnalytics(range.from, range.to, {
    enabled: personalEnabled,
  });
  const { data: usage } = useChatBotUsage({ enabled: personalEnabled });

  const ctaLabel = !hasAccess
    ? "Get Started"
    : !isSetupDone
      ? "Complete Setup"
      : "View Conversations";
  const ctaTarget = !hasAccess
    ? "plans"
    : !isSetupDone
      ? "setup"
      : "conversations";

  const platformMetrics = [
    { label: "Active Bots", value: String(collective?.activeBots ?? 0) },
    {
      label: "Leads Engaged",
      value: (collective?.totalConversations ?? 0).toLocaleString(),
    },
    {
      label: "Appointments",
      value: (collective?.totalAppointments ?? 0).toLocaleString(),
    },
    {
      label: "Policies",
      value: (collective?.totalAttributions ?? 0).toLocaleString(),
    },
    {
      label: "Revenue",
      value: currencyFmt.format(collective?.totalPremium ?? 0),
    },
    {
      label: "Booking Rate",
      value: `${((collective?.bookingRate ?? 0) * 100).toFixed(1)}%`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ══════ Hero Section ══════ */}
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="overview-grid"
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
            <rect width="100%" height="100%" fill="url(#overview-grid)" />
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
              <Bot className="h-7 w-7" style={{ color: ACCENT }} />
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
                  AI-Powered SMS Bot
                </span>
              </div>

              <h1
                className="text-xl font-bold text-white dark:text-black tracking-tight mb-1.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Automate Lead Engagement &amp; Appointment Booking
              </h1>
              <p className="text-[11px] text-white/50 dark:text-black/40 leading-relaxed max-w-2xl">
                Your AI-powered SMS assistant responds to leads in seconds,
                handles objections naturally, and books appointments on your
                real calendar — all within compliant hours. No leads fall
                through the cracks.
              </p>

              {/* Integration logos */}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[9px] text-white/30 dark:text-black/25 uppercase tracking-widest font-medium">
                  Integrates with
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10">
                    <CloseLogo className="h-3.5 w-auto text-white dark:text-black" />
                    <span className="text-[9px] text-white/60 dark:text-black/50 font-medium">
                      Close CRM
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10">
                    <CalendlyLogo className="h-4 w-4" />
                    <span className="text-[9px] text-white/60 dark:text-black/50 font-medium">
                      Calendly
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10">
                    <GoogleCalendarLogo className="h-4 w-4" />
                    <span className="text-[9px] text-white/60 dark:text-black/50 font-medium">
                      Google Cal
                    </span>
                  </div>
                </div>
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

      {/* ══════ Platform Metrics Strip ══════ */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
            Platform Performance · 30 days
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
        </div>

        {collectiveLoading ? (
          <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 px-3 first:pl-0 last:pr-0">
                <div className="h-2.5 w-12 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-1" />
                <div className="h-4 w-8 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : collectiveError ? (
          <p className="text-[10px] text-zinc-400">
            Analytics temporarily unavailable
          </p>
        ) : (
          <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
            {platformMetrics.map((m) => (
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
        )}
      </div>

      {/* ══════ Your Bot (subscribers with setup done) ══════ */}
      {hasAccess && isSetupDone && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
              Your Bot · 30 days
            </span>
            <span className="text-[9px] font-medium">
              {agent?.botEnabled ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Active
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Inactive
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 mb-2">
            <div className="flex-1 pr-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Conversations
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {analytics?.conversations?.total ?? 0}
              </div>
            </div>
            <div className="flex-1 px-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Appointments
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {analytics?.appointments?.total ?? 0}
              </div>
            </div>
            <div className="flex-1 px-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Booking Rate
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {((analytics?.appointments?.bookingRate ?? 0) * 100).toFixed(1)}
                %
              </div>
            </div>
            <div className="flex-1 pl-3">
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                Usage
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {usage?.leadsUsed ?? 0}{" "}
                <span className="text-[9px] font-normal text-zinc-400 dark:text-zinc-500">
                  / {usage?.leadLimit ?? 0}
                </span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, usage?.leadLimit ? (usage.leadsUsed / usage.leadLimit) * 100 : 0)}%`,
                    backgroundColor: ACCENT,
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: "Conversations", tabId: "conversations" },
              { label: "Appointments", tabId: "appointments" },
              { label: "Analytics", tabId: "analytics" },
              { label: "Configuration", tabId: "setup" },
            ].map(({ label, tabId }) => (
              <button
                key={tabId}
                onClick={() => onNavigateToTab(tabId)}
                className="px-2 py-0.5 text-[9px] font-medium rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════ CTA ══════ */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            {!hasAccess
              ? "Ready to automate your lead engagement?"
              : !isSetupDone
                ? "Your bot is waiting to be configured"
                : "Your AI bot is working for you"}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {!hasAccess
              ? "Start converting more leads into booked appointments — free plan available."
              : !isSetupDone
                ? "Connect your CRM and calendar to start engaging leads automatically."
                : "View your conversations, analytics, and attribution data."}
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 text-[10px] gap-1.5 px-4 text-white shadow-md flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
            boxShadow: `0 4px 14px ${ACCENT}30`,
          }}
          onClick={() => onNavigateToTab(ctaTarget)}
        >
          {ctaLabel}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
