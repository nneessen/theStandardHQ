// src/features/chat-bot/components/ChatBotOverviewTab.tsx
// Overview tab — compact metrics + feature showcase, muted zinc design

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ChatBotAgent, useChatBotUsage } from "../hooks/useChatBot";
import {
  useCollectiveAnalytics,
  useChatBotAnalytics,
} from "../hooks/useChatBotAnalytics";

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
  });

  const { data: analytics } = useChatBotAnalytics(range.from, range.to);
  const { data: usage } = useChatBotUsage();

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
      label: "Conversations",
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
      label: "Premium",
      value: currencyFmt.format(collective?.totalPremium ?? 0),
    },
    {
      label: "Booking Rate",
      value: `${((collective?.bookingRate ?? 0) * 100).toFixed(1)}%`,
    },
  ];

  return (
    <div className="space-y-3">
      {/* ── Platform Metrics Strip ──────────────────────────────── */}
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
            Platform Performance · 30 days
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
        </div>

        {collectiveLoading ? (
          <div className="flex items-center divide-x divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 px-3 first:pl-0 last:pr-0">
                <div className="h-2.5 w-12 bg-muted rounded animate-pulse mb-1" />
                <div className="h-4 w-8 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : collectiveError ? (
          <p className="text-[10px] text-muted-foreground">
            Analytics temporarily unavailable
          </p>
        ) : (
          <div className="flex items-center divide-x divide-border">
            {platformMetrics.map((m) => (
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
        )}
      </div>

      {/* ── Your Bot (subscribers with setup done) ──────────────── */}
      {hasAccess && isSetupDone && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Your Bot · 30 days
            </span>
            <span className="text-[9px] font-medium text-muted-foreground">
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

          <div className="flex items-center divide-x divide-border mb-2">
            <div className="flex-1 pr-3">
              <div className="text-[9px] text-muted-foreground">
                Conversations
              </div>
              <div className="text-sm font-bold text-foreground">
                {analytics?.conversations?.total ?? 0}
              </div>
            </div>
            <div className="flex-1 px-3">
              <div className="text-[9px] text-muted-foreground">
                Appointments
              </div>
              <div className="text-sm font-bold text-foreground">
                {analytics?.appointments?.total ?? 0}
              </div>
            </div>
            <div className="flex-1 px-3">
              <div className="text-[9px] text-muted-foreground">
                Booking Rate
              </div>
              <div className="text-sm font-bold text-foreground">
                {((analytics?.appointments?.bookingRate ?? 0) * 100).toFixed(1)}
                %
              </div>
            </div>
            <div className="flex-1 pl-3">
              <div className="text-[9px] text-muted-foreground">Usage</div>
              <div className="text-sm font-bold text-foreground">
                {usage?.leadsUsed ?? 0}{" "}
                <span className="text-[9px] font-normal text-muted-foreground">
                  / {usage?.leadLimit ?? 0}
                </span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground/20 transition-all"
                  style={{
                    width: `${Math.min(100, usage?.leadLimit ? (usage.leadsUsed / usage.leadLimit) * 100 : 0)}%`,
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
                className="px-2 py-0.5 text-[9px] font-medium rounded border border-border hover:bg-muted text-muted-foreground transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA Footer (non-subscribers) ────────────────────────── */}
      {!hasAccess && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-semibold text-foreground">
              Ready to automate your lead engagement?
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Start converting more leads into booked appointments.
            </div>
          </div>
          <Button
            size="sm"
            className="h-7 text-[10px] gap-1.5"
            onClick={() => onNavigateToTab(ctaTarget)}
          >
            {ctaLabel}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
