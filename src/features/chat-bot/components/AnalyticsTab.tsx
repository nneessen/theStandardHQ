// src/features/chat-bot/components/AnalyticsTab.tsx
// "My Analytics" tab — personal bot performance metrics + attribution table

import { useState } from "react";
import { BarChart3, Loader2, AlertTriangle } from "lucide-react";
import {
  useChatBotAnalytics,
  useBotAttributions,
} from "../hooks/useChatBotAnalytics";
import { ConversationMetrics } from "./analytics/ConversationMetrics";
import { AppointmentMetrics } from "./analytics/AppointmentMetrics";
import { EngagementMetrics } from "./analytics/EngagementMetrics";
import { ConversionMetrics } from "./analytics/ConversionMetrics";
import { BotROI } from "./analytics/BotROI";
import { TimelineChart } from "./analytics/TimelineChart";
import { AttributionTable } from "./analytics/AttributionTable";

// Approximate monthly subscription cost for ROI calculation
const BOT_MONTHLY_COST = 49;

const emptyConversations = {
  total: 0,
  byStatus: {},
  byChannel: {},
  avgMessagesPerConvo: 0,
  suppressionRate: 0,
  staleRate: 0,
} as const;

const emptyAppointments = {
  total: 0,
  bookingRate: 0,
  showRate: 0,
  cancelRate: 0,
  avgDaysToAppointment: 0,
} as const;

const emptyEngagement = {
  responseRate: 0,
  multiTurnRate: 0,
  avgFirstResponseMin: 0,
  avgObjectionCount: 0,
  hardNoRate: 0,
} as const;

const emptyMessagePerformance = {
  trackedOutboundCount: 0,
  resolvedOutcomeCount: 0,
  resolvedOutcomeRate: 0,
  positiveRate: 0,
  negativeRate: 0,
  schedulingRate: 0,
  optOutRate: 0,
  topReplyCategories: [],
} as const;

export function AnalyticsTab() {
  const [range, setRange] = useState(() => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    return { from, to };
  });

  const analytics = useChatBotAnalytics(range.from, range.to);
  const attributions = useBotAttributions(range.from, range.to);

  const isLoading = analytics.isLoading || attributions.isLoading;

  return (
    <div className="space-y-3">
      {/* Date Range Picker */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
          Period:
        </span>
        <input
          type="date"
          value={range.from}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
        />
        <span className="text-[10px] text-zinc-400">to</span>
        <input
          type="date"
          value={range.to}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
        />
      </div>

      {isLoading ? (
        <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        </div>
      ) : analytics.error ? (
        <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
          <div className="py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Analytics temporarily unavailable
            </p>
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1">
              The analytics API may not be deployed yet. Attribution data below
              is still available.
            </p>
          </div>
        </div>
      ) : analytics.data ? (
        <>
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <ConversationMetrics
              data={analytics.data.conversations ?? emptyConversations}
            />
            <AppointmentMetrics
              data={analytics.data.appointments ?? emptyAppointments}
            />
            <EngagementMetrics
              data={analytics.data.engagement ?? emptyEngagement}
              messagePerformance={
                analytics.data.messagePerformance ?? emptyMessagePerformance
              }
            />
            <ConversionMetrics
              attributions={attributions.data || []}
              totalConversations={analytics.data.conversations?.total ?? 0}
            />
          </div>

          {/* ROI Card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <BotROI
              attributions={attributions.data || []}
              totalConversations={analytics.data.conversations?.total ?? 0}
              monthlyCost={BOT_MONTHLY_COST}
            />
            <TimelineChart data={analytics.data.timeline ?? []} />
          </div>
        </>
      ) : null}

      {/* Attribution Table — always shown (uses Supabase data, not external API) */}
      <AttributionTable attributions={attributions.data || []} />
    </div>
  );
}
