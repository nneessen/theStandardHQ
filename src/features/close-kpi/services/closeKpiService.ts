// src/features/close-kpi/services/closeKpiService.ts
// Service layer calling the close-kpi-data edge function directly.
// This function decrypts the user's Close API key and calls Close API v1.

import { supabase } from "@/services/base/supabase";
import type {
  LeadHeatDashboardStatus,
  PrebuiltDashboardRollupResponse,
} from "../types/close-kpi.types";
import {
  isRankableLeadHeatSignals,
  mapLeadHeatAiInsightsRow,
} from "../lib/lead-heat";

// ─── Edge Function Caller ──────────────────────────────────────────

async function closeKpiApi<T>(
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  let accessToken = (await supabase.auth.getSession()).data.session
    ?.access_token;

  if (!accessToken) {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    accessToken = session?.access_token;
  }

  const { data, error } = await supabase.functions.invoke("close-kpi-data", {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
    body: { action, ...params },
  });

  if (error) {
    // Read error body from FunctionsHttpError context
    let msg = error.message || "Close KPI API error";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      }
    } catch {
      // body already consumed
    }
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

// ─── Response Types ────────────────────────────────────────────────

export interface CloseMetadataResponse {
  statuses: { id: string; label: string }[];
  customFields: {
    id: string;
    name: string;
    type: string;
    choices?: string[];
  }[];
  smartViews: { id: string; name: string }[];
  pipelines: {
    id: string;
    name: string;
    statuses: { id: string; label: string; type: string }[];
  }[];
}

export interface LeadCountsResponse {
  byStatus: { id: string; label: string; count: number }[];
  total: number;
}

export interface LeadSearchResponse {
  totalResults: number;
  data: {
    id: string;
    display_name: string;
    status_id: string;
    date_created: string;
  }[];
}

export interface ActivitiesResponse {
  call?: {
    total: number;
    answered: number;
    voicemail: number;
    missed: number;
    inbound: number;
    outbound: number;
    connectRate: number;
    totalDurationMin: number;
    avgDurationMin: number;
    byDisposition: Record<string, number>;
    byHour?: Record<number, { total: number; answered: number }>;
    isTruncated?: boolean;
  };
  email?: {
    total: number;
    sent: number;
    received: number;
    isTruncated?: boolean;
  };
  sms?: {
    total: number;
    sent: number;
    received: number;
    isTruncated?: boolean;
  };
}

export interface OpportunitiesResponse {
  total: number;
  isTruncated?: boolean;
  totalValue: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  activeCount: number;
  winRate: number;
  avgDealSize: number;
  avgTimeToCloseDays: number;
  byStatus: { id: string; label: string; count: number; value: number }[];
}

export interface StatusChangesResponse {
  transitions: {
    from: string;
    to: string;
    avgDays: number;
    medianDays: number;
    minDays: number;
    maxDays: number;
    sampleSize: number;
  }[];
  totalChanges: number;
}

export interface VmRateSmartViewResponse {
  rows: {
    smartViewId: string;
    smartViewName: string;
    totalFirstCalls: number;
    vmCount: number;
    answeredCount: number;
    otherCount: number;
    vmRate: number;
  }[];
  overall: {
    totalFirstCalls: number;
    vmCount: number;
    vmRate: number;
  };
}

const LEAD_HEAT_STALE_AFTER_MS = 24 * 60 * 60_000;
const LEAD_HEAT_ACTIVE_RUN_WINDOW_MS = 25 * 60_000;

// ─── Service Methods ───────────────────────────────────────────────

export const closeKpiService = {
  /** Check if user has an active Close CRM connection */
  getConnectionStatus: async (userId: string) => {
    const { data } = await supabase
      .from("close_config")
      .select("id, is_active, organization_name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    return data;
  },

  /** Fetch all Close metadata in one call (statuses, custom fields, smart views, pipelines) */
  getMetadata: () => closeKpiApi<CloseMetadataResponse>("get_metadata"),

  /** Fetch the shipped Close-backed prebuilt dashboard widgets in one batched rollup */
  getPrebuiltDashboardRollup: (params: {
    dateRange: string;
    from: string;
    to: string;
  }) =>
    closeKpiApi<PrebuiltDashboardRollupResponse>(
      "get_prebuilt_dashboard_rollup",
      params,
    ),

  /** Get lead counts grouped by status, optionally filtered by date range and smart view */
  getLeadCounts: (params: {
    from?: string;
    to?: string;
    smartViewId?: string;
  }) => closeKpiApi<LeadCountsResponse>("get_lead_counts", params),

  /** Search leads with filters, returns total count + optional data */
  searchLeads: (params: {
    from?: string;
    to?: string;
    statusId?: string;
    smartViewId?: string;
    limit?: number;
  }) => closeKpiApi<LeadSearchResponse>("search_leads", params),

  /** Fetch call/email/SMS activities with date filters */
  getActivities: (params: { from?: string; to?: string; types?: string[] }) =>
    closeKpiApi<ActivitiesResponse>("get_activities", params),

  /** Fetch opportunity data with status type and date filters */
  getOpportunities: (params: {
    from?: string;
    to?: string;
    statusType?: string;
  }) => closeKpiApi<OpportunitiesResponse>("get_opportunities", params),

  /** Fetch lead status change history for lifecycle velocity */
  getLeadStatusChanges: (params: {
    from?: string;
    to?: string;
    fromStatus?: string;
    toStatus?: string;
  }) => closeKpiApi<StatusChangesResponse>("get_lead_status_changes", params),

  /** Fetch VM rate by smart view — cross-references calls with smart view leads */
  getVmRateBySmartView: (params: {
    from?: string;
    to?: string;
    smartViewIds: string[];
    firstCallOnly?: boolean;
  }) =>
    closeKpiApi<VmRateSmartViewResponse>("get_vm_rate_by_smart_view", params),

  /** Best time to call — connect rates by hour and day of week */
  getBestCallTimes: (params: { from?: string; to?: string }) =>
    closeKpiApi<{
      hourly: {
        hour: number;
        label: string;
        total: number;
        answered: number;
        vm: number;
        noAnswer: number;
        connectRate: number;
      }[];
      daily: {
        day: number;
        label: string;
        total: number;
        answered: number;
        connectRate: number;
      }[];
      bestHour: {
        hour: number;
        label: string;
        connectRate: number;
        total: number;
      } | null;
      bestDay: {
        day: number;
        label: string;
        connectRate: number;
        total: number;
      } | null;
      totalCalls: number;
      isTruncated: boolean;
    }>("get_best_call_times", params),

  /** Cross-reference: smart view rows × status columns */
  getCrossReference: (params: {
    smartViewIds: string[];
    statusIds?: string[];
  }) =>
    closeKpiApi<{
      rows: {
        smartViewId: string;
        smartViewName: string;
        cells: Record<string, number>;
        total: number;
      }[];
      statusLabels: { id: string; label: string }[];
      totals: Record<string, number>;
      grandTotal: number;
    }>("get_cross_reference", params),

  /** Speed to lead — time from creation to first outbound touch */
  getSpeedToLead: (params: {
    from?: string;
    to?: string;
    smartViewId?: string;
  }) =>
    closeKpiApi<{
      avgMinutes: number;
      medianMinutes: number;
      distribution: { label: string; max: number; count: number }[];
      totalLeads: number;
      leadsWithActivity: number;
      pctContacted: number;
    }>("get_speed_to_lead", params),

  /** Contact cadence — time gaps between touches */
  getContactCadence: (params: {
    from?: string;
    to?: string;
    smartViewId?: string;
  }) =>
    closeKpiApi<{
      avgGapHours: number;
      medianGapHours: number;
      totalLeads: number;
      leadsContacted: number;
      leadsMultiTouch: number;
      totalTouches: number;
      avgTouchesPerLead: number;
      touchDistribution: { touches: number; leads: number }[];
    }>("get_contact_cadence", params),

  /** Dial attempts — how many calls before connection */
  getDialAttempts: (params: {
    from?: string;
    to?: string;
    smartViewId?: string;
  }) =>
    closeKpiApi<{
      avgAttempts: number;
      medianAttempts: number;
      totalLeadsDialed: number;
      leadsConnected: number;
      neverConnected: number;
      connectPct: number;
      attemptRates: {
        attempt: number;
        total: number;
        answered: number;
        connectRate: number;
      }[];
    }>("get_dial_attempts", params),

  // ─── Lead Heat Index Methods ──────────────────────────────────────

  /** Get lead heat summary (distribution by heat level) — uses server-side aggregation */
  getLeadHeatSummary: async (userId: string) => {
    // Server-side aggregate: count by heat_level (avoids fetching all rows to client)
    const [distributionResult, statsResult, outcomeResult] = await Promise.all([
      supabase
        .from("lead_heat_scores")
        .select("heat_level")
        .eq("user_id", userId),
      supabase
        .from("lead_heat_scores")
        .select("score, scored_at")
        .eq("user_id", userId)
        .order("scored_at", { ascending: false })
        .limit(1),
      supabase
        .from("lead_heat_outcomes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    if (distributionResult.error)
      throw new Error(distributionResult.error.message);

    const allLevels = distributionResult.data ?? [];
    const total = allLevels.length;

    // Count per level from the heat_level column only (small payload: just one text column)
    const levels = ["hot", "warming", "neutral", "cooling", "cold"] as const;
    const levelCounts = new Map<string, number>();
    for (const row of allLevels) {
      levelCounts.set(
        row.heat_level,
        (levelCounts.get(row.heat_level) ?? 0) + 1,
      );
    }
    const distribution = levels.map((level) => {
      const count = levelCounts.get(level) ?? 0;
      return {
        level,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    // Avg score: compute from the count + sum via a lightweight approach
    // Since we only fetched heat_level above, do a separate count-only for avg
    const { data: avgData } = await supabase.rpc("avg_lead_heat_score", {
      p_user_id: userId,
    });
    const avgRow = Array.isArray(avgData) ? avgData[0] : avgData;
    const avgScore = (avgRow as { avg_score: number } | null)?.avg_score ?? 0;

    const lastScoredAt = statsResult.data?.[0]?.scored_at ?? null;
    const sampleSize = outcomeResult.count ?? 0;

    return {
      distribution,
      totalScored: total,
      avgScore: Math.round(avgScore),
      avgScorePrevious: null,
      trend: "right" as const,
      lastScoredAt,
      isPersonalized: sampleSize >= 50,
      sampleSize,
    };
  },

  /** Get lead heat list (paginated, sorted, filtered) — reads from pre-computed Supabase table */
  getLeadHeatList: async (params: {
    userId: string;
    filterLevel?: string;
    sortBy?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const {
      userId,
      filterLevel = "all",
      sortBy = "score_desc",
      page = 1,
      pageSize = 25,
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("lead_heat_scores")
      .select(
        "close_lead_id, display_name, score, heat_level, trend, previous_score, scored_at, breakdown, signals, ai_insights",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .not("signals->>hasWonOpportunity", "eq", "true")
      .not("signals->>currentStatusLabel", "ilike", "%sold%")
      .not("signals->>currentStatusLabel", "ilike", "%won%")
      .not("signals->>currentStatusLabel", "ilike", "%policy pending%")
      .not("signals->>currentStatusLabel", "ilike", "%policy issued%")
      .not("signals->>currentStatusLabel", "ilike", "%issued%")
      .not("signals->>currentStatusLabel", "ilike", "%bound%")
      .not("signals->>currentStatusLabel", "ilike", "%in force%")
      .not("signals->>currentStatusLabel", "ilike", "%active policy%");

    if (filterLevel && filterLevel !== "all") {
      query = query.eq("heat_level", filterLevel);
    }

    switch (sortBy) {
      case "score_asc":
        query = query.order("score", { ascending: true });
        break;
      case "recency":
        query = query.order("scored_at", { ascending: false });
        break;
      case "name":
        query = query.order("display_name", { ascending: true });
        break;
      default: // score_desc
        query = query.order("score", { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) throw new Error(error.message);

    const leads = (data ?? [])
      .filter((row) =>
        isRankableLeadHeatSignals(
          row.signals as Record<string, unknown> | null | undefined,
        ),
      )
      .map((row) => {
        // Determine the top contributing signal from breakdown
        const breakdown = row.breakdown as Record<string, number> | null;
        let topSignal = "";
        if (breakdown) {
          const entries = Object.entries(breakdown)
            .filter(([key]) => key !== "penalties")
            .sort(([, a], [, b]) => b - a);
          if (entries.length > 0) {
            topSignal = formatSignalName(entries[0][0]);
          }
        }

        return {
          closeLeadId: row.close_lead_id,
          displayName: row.display_name ?? "Unknown",
          score: row.score,
          heatLevel: row.heat_level,
          trend: row.trend,
          previousScore: row.previous_score,
          lastTouchAt:
            ((row.signals as Record<string, unknown>)?.lastActivityAt as
              | string
              | null) ?? null,
          currentStatus:
            ((row.signals as Record<string, unknown>)
              ?.currentStatusLabel as string) ?? "Unknown",
          topSignal,
          aiInsight: row.ai_insights ?? null,
        };
      });

    return {
      leads,
      total: count ?? leads.length,
      page,
      pageSize,
    };
  },

  /** Get AI portfolio insights — reads from cached analysis */
  getLeadHeatAiInsights: async (userId: string) => {
    const { data: cachedAnalysis, error: analysisError } = await supabase
      .from("lead_heat_ai_portfolio_analysis")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (analysisError) {
      throw new Error(analysisError.message);
    }

    let analysis = cachedAnalysis as {
      analysis?: Record<string, unknown> | null;
      anomalies?: unknown[] | null;
      recommendations?: unknown[] | null;
      weight_adjustments?: unknown[] | null;
      analyzed_at?: string | null;
      expires_at?: string | null;
    } | null;

    const analysisExpired =
      !analysis?.expires_at || new Date(analysis.expires_at) <= new Date();

    if (!analysis || analysisExpired) {
      const accessToken = await getAccessToken();
      const { data, error } = await supabase.functions.invoke(
        "close-lead-heat-score",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { action: "get_portfolio_insights" },
        },
      );

      if (error) {
        throw new Error(await getFunctionsInvokeErrorMessage(error));
      }

      analysis =
        (data as {
          analysis?: Record<string, unknown> | null;
          anomalies?: unknown[] | null;
          recommendations?: unknown[] | null;
          weight_adjustments?: unknown[] | null;
          analyzed_at?: string | null;
          expires_at?: string | null;
        } | null) ?? null;
    }

    const { data: weightsRow } = await supabase
      .from("lead_heat_agent_weights")
      .select("version, sample_size")
      .eq("user_id", userId)
      .maybeSingle();

    return mapLeadHeatAiInsightsRow(analysis ?? null, weightsRow);
  },

  /** Trigger a lead heat rescore — calls the lead heat scoring edge function */
  triggerRescore: async () => {
    const accessToken = await getAccessToken();
    const { data, error } = await supabase.functions.invoke(
      "close-lead-heat-score",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { action: "score_all" },
      },
    );

    if (error) throw new Error(await getFunctionsInvokeErrorMessage(error));
    return data;
  },

  /** AI deep dive on a single lead — calls edge function (Tier 3) */
  analyzeLeadDeepDive: async (closeLeadId: string) => {
    const accessToken = await getAccessToken();
    const { data, error } = await supabase.functions.invoke(
      "close-lead-heat-score",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { action: "analyze_lead", closeLeadId },
      },
    );

    if (error) throw new Error(await getFunctionsInvokeErrorMessage(error));
    return data;
  },

  /** Get count of scored leads for a user (for setup guide status) */
  getLeadHeatScoreCount: async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from("lead_heat_scores")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  /** Check if any scoring runs have completed (for setup guide status) */
  hasCompletedScoringRuns: async (userId: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from("lead_heat_scoring_runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  },

  /** Get lightweight lead-heat freshness state for dashboard decisions */
  getLeadHeatDashboardStatus: async (
    userId: string,
  ): Promise<LeadHeatDashboardStatus> => {
    const [latestScoreResult, latestRunResult] = await Promise.all([
      supabase
        .from("lead_heat_scores")
        .select("scored_at")
        .eq("user_id", userId)
        .order("scored_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("lead_heat_scoring_runs")
        .select("status, started_at, completed_at, error_message")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (latestScoreResult.error) {
      throw new Error(latestScoreResult.error.message);
    }
    if (latestRunResult.error) {
      throw new Error(latestRunResult.error.message);
    }

    const lastScoredAt = latestScoreResult.data?.scored_at ?? null;
    const latestRun = latestRunResult.data;
    const isActiveRunning =
      latestRun?.status === "running" &&
      !!latestRun.started_at &&
      Date.now() - new Date(latestRun.started_at).getTime() <
        LEAD_HEAT_ACTIVE_RUN_WINDOW_MS;

    let state: LeadHeatDashboardStatus["state"] = "never_scored";

    if (isActiveRunning) {
      state = "running";
    } else if (lastScoredAt) {
      const scoreAgeMs = Date.now() - new Date(lastScoredAt).getTime();
      state = scoreAgeMs > LEAD_HEAT_STALE_AFTER_MS ? "stale" : "fresh";
    }

    return {
      state,
      hasCachedScores: !!lastScoredAt,
      lastScoredAt,
      lastRunStatus: isActiveRunning ? "running" : (latestRun?.status ?? null),
      lastRunStartedAt: latestRun?.started_at ?? null,
      lastRunCompletedAt: latestRun?.completed_at ?? null,
      lastRunErrorMessage: latestRun?.error_message ?? null,
      staleAfterMs: LEAD_HEAT_STALE_AFTER_MS,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  let accessToken = (await supabase.auth.getSession()).data.session
    ?.access_token;
  if (!accessToken) {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    accessToken = session?.access_token;
  }
  if (!accessToken) throw new Error("Session expired. Please log in again.");
  return accessToken;
}

async function getFunctionsInvokeErrorMessage(error: Error): Promise<string> {
  let msg = error.message || "Edge function error";

  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) msg = body.error;
    }
  } catch {
    // response body may already be consumed
  }

  return msg;
}

function formatSignalName(key: string): string {
  const names: Record<string, string> = {
    callAnswerRate: "Call Answer Rate",
    emailReplyRate: "Email Reply Rate",
    smsResponseRate: "SMS Response",
    engagementRecency: "Recent Activity",
    inboundCalls: "Inbound Calls",
    quoteRequested: "Quote Requested",
    emailEngagement: "Email Engagement",
    appointment: "Appointment Set",
    leadAge: "Lead Freshness",
    timeSinceTouch: "Follow-up Recency",
    timeInStatus: "Status Duration",
    statusVelocity: "Pipeline Momentum",
    hasOpportunity: "Active Opportunity",
    opportunityValue: "Deal Value",
    stageProgression: "Stage Progress",
    sourceQuality: "Source Quality",
    similarLeadPattern: "AI Pattern Match",
  };
  return names[key] ?? key;
}
