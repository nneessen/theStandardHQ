// src/features/close-kpi/components/CloseKpiOverviewTab.tsx
// Overview tab — Close CRM KPI product showcase with dark hero, feature highlights, CTA

import {
  BarChart3,
  Phone,
  TrendingUp,
  Timer,
  Grid3X3,
  Target,
  Zap,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseLogo } from "@/features/chat-bot";

// ─── Props ──────────────────────────────────────────────────────

interface CloseKpiOverviewTabProps {
  hasAccess: boolean;
  isCloseConnected: boolean;
  widgetCount: number;
  onNavigateToTab: (tabId: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────

const ACCENT = "#4EC375"; // Close brand green

const HIGHLIGHTS = [
  {
    icon: BarChart3,
    title: "Lead Pipeline Health",
    desc: "Monitor lead counts by status, source, and smart view with configurable widgets",
  },
  {
    icon: Phone,
    title: "Call Analytics",
    desc: "Track volume, duration, connect rates, and disposition breakdowns",
  },
  {
    icon: TrendingUp,
    title: "Opportunity Funnel",
    desc: "Pipeline value, win rate, deal velocity, and stage conversion metrics",
  },
  {
    icon: Timer,
    title: "Lifecycle Velocity",
    desc: "Measure time between status transitions — identify bottlenecks fast",
  },
  {
    icon: Target,
    title: "VM Rate Analysis",
    desc: "Voicemail rates by smart view — stop dialing spam and dead lists",
  },
  {
    icon: Clock,
    title: "Best Call Times",
    desc: "Find optimal hours and days for outreach based on connect rates",
  },
  {
    icon: Zap,
    title: "Speed to Lead",
    desc: "Track time from lead creation to first outbound contact",
  },
  {
    icon: Grid3X3,
    title: "Contact Cadence",
    desc: "Monitor gaps between touches and dial attempts before connection",
  },
];

// ─── Main Component ─────────────────────────────────────────────

export function CloseKpiOverviewTab({
  hasAccess,
  isCloseConnected,
  widgetCount,
  onNavigateToTab,
}: CloseKpiOverviewTabProps) {
  const hasDashboard = hasAccess && isCloseConnected && widgetCount > 0;

  const ctaLabel = !hasAccess
    ? "Get Started"
    : !isCloseConnected
      ? "Connect Close CRM"
      : "Go to Dashboard";
  const ctaTarget = !hasAccess
    ? "plans"
    : !isCloseConnected
      ? "dashboard"
      : "dashboard";

  return (
    <div className="space-y-4">
      {/* ══════ Hero Section ══════ */}
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="close-overview-grid"
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
            <rect width="100%" height="100%" fill="url(#close-overview-grid)" />
          </svg>
        </div>

        {/* Glow orbs */}
        <div
          className="absolute top-0 -left-20 w-80 h-80 rounded-full blur-3xl"
          style={{ backgroundColor: `${ACCENT}15` }}
        />
        <div
          className="absolute bottom-0 -right-16 w-64 h-64 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(20,99,255,0.08)" }}
        />

        <div className="relative px-6 py-6">
          <div className="flex items-start gap-5">
            {/* Hero icon */}
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl flex-shrink-0"
              style={{ backgroundColor: `${ACCENT}25` }}
            >
              <BarChart3 className="h-7 w-7" style={{ color: ACCENT }} />
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
                  Close CRM Integration
                </span>
              </div>

              <h1
                className="text-xl font-bold text-white dark:text-black tracking-tight mb-1.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Your CRM, Analyzed
              </h1>
              <p className="text-[11px] text-white/50 dark:text-black/40 leading-relaxed max-w-2xl">
                Build a fully configurable analytics dashboard from your Close
                CRM data. Monitor pipeline health, call performance, lifecycle
                velocity, and lead quality signals — all in real time.
              </p>

              {/* Integration logos */}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[9px] text-white/30 dark:text-black/25 uppercase tracking-widest font-medium">
                  Powered by
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10">
                    <CloseLogo className="h-3.5 w-auto text-white dark:text-black" />
                    <span className="text-[9px] text-white/60 dark:text-black/50 font-medium">
                      Close CRM
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
          Widget Types
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

      {/* ══════ Dashboard Quick Links (when setup) ══════ */}
      {hasDashboard && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
              Your Dashboard
            </span>
            <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
              {widgetCount} widget{widgetCount !== 1 ? "s" : ""} configured
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onNavigateToTab("dashboard")}
              className="px-2 py-0.5 text-[9px] font-medium rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
            >
              Open Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ══════ CTA ══════ */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            {!hasAccess
              ? "Ready to unlock CRM analytics?"
              : !isCloseConnected
                ? "Connect your Close CRM to get started"
                : "Your analytics dashboard is ready"}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {!hasAccess
              ? "Upgrade to Pro to access real-time Close CRM analytics and KPI tracking."
              : !isCloseConnected
                ? "Link your Close API key to start pulling live CRM data into widgets."
                : "Add widgets, customize metrics, and track your team's CRM performance."}
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
