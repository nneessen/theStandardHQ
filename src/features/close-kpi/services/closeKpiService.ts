// src/features/close-kpi/services/closeKpiService.ts
// Service layer calling the close-kpi-data edge function directly.
// This function decrypts the user's Close API key and calls Close API v1.

import { supabase } from "@/services/base/supabase";

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
};
