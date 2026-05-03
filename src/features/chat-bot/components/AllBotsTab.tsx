// src/features/chat-bot/components/AllBotsTab.tsx
// "All Bots" tab — visible to ALL users. Shows collective bot analytics.
// No PII, no agent names, no client data — pure aggregate metrics.

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useCollectiveAnalytics } from "../hooks/useChatBotAnalytics";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function AllBotsTab({
  onNavigateToSubscription,
}: {
  onNavigateToSubscription?: () => void;
}) {
  const [range] = useState(() => {
    const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { from, to };
  });

  const { data, isLoading, error } = useCollectiveAnalytics(
    range.from,
    range.to,
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
            All Bots · 30 days
          </span>
        </div>
        <div className="flex items-center divide-x divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-1 px-3 first:pl-0 last:pr-0">
              <div className="h-2.5 w-12 bg-muted rounded animate-pulse mb-1" />
              <div className="h-4 w-8 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-3 w-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground">
            Analytics temporarily unavailable
          </span>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "Active Bots", sublabel: "", value: String(data.activeBots) },
    {
      label: "Leads Engaged",
      sublabel: "Total SMS conversations",
      value: data.totalConversations.toLocaleString(),
    },
    {
      label: "Appointments Booked",
      sublabel: "Qualified meetings set",
      value: data.totalAppointments.toLocaleString(),
    },
    {
      label: "Policies Written",
      sublabel: "Bot-attributed closings",
      value: data.totalAttributions.toLocaleString(),
    },
    {
      label: "Booking Rate",
      sublabel: "Lead → Appointment",
      value: formatPercent(data.bookingRate * 100),
    },
    {
      label: "Close Rate",
      sublabel: "Lead → Policy",
      value: formatPercent(data.conversionRate),
    },
    {
      label: "Revenue Impact",
      sublabel: "Attributed annual premium",
      value: formatCurrency(data.totalPremium),
    },
    {
      label: "Direct / Assisted",
      sublabel: "Full / partial attribution",
      value: `${data.botConverted} / ${data.botAssisted}`,
    },
  ];

  return (
    <div className="space-y-3">
      {/* ── Metrics Strip ──────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
            All Bots · Last 30 days
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground mb-2">
          Real-time performance across all SMS bots on the platform.
        </p>

        {/* Desktop: single horizontal row with dividers */}
        <div className="hidden md:flex items-center divide-x divide-border">
          {metrics.map((m) => (
            <div key={m.label} className="flex-1 px-3 first:pl-0 last:pr-0">
              <div className="text-[9px] text-muted-foreground">{m.label}</div>
              <div className="text-sm font-bold text-foreground">{m.value}</div>
              {m.sublabel && (
                <div className="text-[8px] text-muted-foreground/70">
                  {m.sublabel}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: 3-col compact grid */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-2 md:hidden">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-[9px] text-muted-foreground">{m.label}</div>
              <div className="text-[11px] font-bold text-foreground">
                {m.value}
              </div>
              {m.sublabel && (
                <div className="text-[8px] text-muted-foreground/70">
                  {m.sublabel}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Timeline (mini table) ──────────────────────────────── */}
      {data.timeline.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              Daily Activity
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground mb-2">
            Last 7 days of activity
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-[9px] text-muted-foreground font-medium pb-1 pr-3">
                    Date
                  </th>
                  <th className="text-[9px] text-muted-foreground font-medium pb-1 pr-3 text-right">
                    Conversations
                  </th>
                  <th className="text-[9px] text-muted-foreground font-medium pb-1 pr-3 text-right">
                    Appointments
                  </th>
                  <th className="text-[9px] text-muted-foreground font-medium pb-1 text-right">
                    Conversions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.timeline.slice(-7).map((row) => (
                  <tr
                    key={row.date}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="text-[10px] text-muted-foreground py-0.5 pr-3">
                      {row.date}
                    </td>
                    <td className="text-[10px] font-medium text-foreground py-0.5 pr-3 text-right">
                      {row.conversations}
                    </td>
                    <td className="text-[10px] font-medium text-foreground py-0.5 pr-3 text-right">
                      {row.appointments}
                    </td>
                    <td className="text-[10px] font-medium text-foreground py-0.5 text-right">
                      {row.conversions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CTA for non-subscribers ────────────────────────────── */}
      {onNavigateToSubscription && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-foreground">
              Start your AI Chat Bot
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Engage leads via SMS, book appointments, and close more sales
              automatically.
            </p>
          </div>
          <button
            onClick={onNavigateToSubscription}
            className="px-3 py-1.5 text-[10px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors flex-shrink-0"
          >
            Get Started
          </button>
        </div>
      )}
    </div>
  );
}
