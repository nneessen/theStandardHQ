// src/services/leaderboard/leaderboardService.ts
// Service for leaderboard data fetching and transformation

import { supabase } from "../base/supabase";
import {
  getMonthStartString,
  getTodayString,
  getWeekStartString,
  getYearStartString,
} from "@/lib/date";
import type { Database } from "../../types/database.types";
import type {
  LeaderboardFilters,
  AgentLeaderboardEntry,
  AgencyLeaderboardEntry,
  TeamLeaderboardEntry,
  SubmitLeaderboardEntry,
  AgentLeaderboardResponse,
  AgencyLeaderboardResponse,
  TeamLeaderboardResponse,
  SubmitLeaderboardResponse,
  LeaderboardTotals,
  SubmitLeaderboardTotals,
  TeamLeader,
  DateRange,
  LeaderboardTimePeriod,
} from "../../types/leaderboard.types";

// Database row types from generated types
type AgentLeaderboardRow =
  Database["public"]["Functions"]["get_leaderboard_data"]["Returns"][number];
type AgencyLeaderboardRow =
  Database["public"]["Functions"]["get_agency_leaderboard_data"]["Returns"][number];
type TeamLeaderboardRow =
  Database["public"]["Functions"]["get_team_leaderboard_data"]["Returns"][number];
type TeamLeaderRow =
  Database["public"]["Functions"]["get_team_leaders_for_leaderboard"]["Returns"][number];
type SubmitLeaderboardRow =
  Database["public"]["Functions"]["get_submit_leaderboard"]["Returns"][number];

/**
 * Calculate date range from a time period filter
 */
function calculateDateRange(
  period: LeaderboardTimePeriod,
  customStart?: string,
  customEnd?: string,
): DateRange {
  // All boundaries use the canonical LOCAL-date helpers (src/lib/date) — business dates
  // (submit_date/effective_date) are local DATEs, so a UTC "today" would roll the window
  // forward an evening early and empty out daily/weekly numbers (see getTodayString).
  const today = getTodayString();

  switch (period) {
    case "daily":
      return { start: today, end: today };

    case "weekly":
      // Week-to-date: Monday through today (local).
      return { start: getWeekStartString(), end: today };

    case "mtd":
      return { start: getMonthStartString(), end: today };

    case "ytd":
      return { start: getYearStartString(), end: today };

    case "custom":
      if (!customStart || !customEnd) {
        throw new Error(
          "Custom date range requires both startDate and endDate",
        );
      }
      return { start: customStart, end: customEnd };

    default:
      // Default to MTD
      return { start: getMonthStartString(), end: today };
  }
}

/**
 * Transform database row to AgentLeaderboardEntry
 */
function transformAgentEntry(row: AgentLeaderboardRow): AgentLeaderboardEntry {
  return {
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentEmail: row.agent_email,
    profilePhotoUrl: row.profile_photo_url,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    directDownlineCount: row.direct_downline_count,
    ipTotal: Number(row.ip_total),
    apTotal: Number(row.ap_total),
    policyCount: row.policy_count,
    pendingPolicyCount: row.pending_policy_count,
    prospectCount: row.prospect_count,
    pipelineCount: row.pipeline_count,
    rankOverall: row.rank_overall,
  };
}

/**
 * Transform database row to AgencyLeaderboardEntry
 */
function transformAgencyEntry(
  row: AgencyLeaderboardRow,
): AgencyLeaderboardEntry {
  return {
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    agentCount: row.agent_count,
    ipTotal: Number(row.ip_total),
    apTotal: Number(row.ap_total),
    policyCount: row.policy_count,
    pendingPolicyCount: row.pending_policy_count,
    prospectCount: row.prospect_count,
    pipelineCount: row.pipeline_count,
    rankOverall: row.rank_overall,
  };
}

/**
 * Transform database row to TeamLeaderboardEntry
 */
function transformTeamEntry(row: TeamLeaderboardRow): TeamLeaderboardEntry {
  return {
    leaderId: row.leader_id,
    leaderName: row.leader_name,
    leaderEmail: row.leader_email,
    leaderProfilePhotoUrl: row.leader_profile_photo_url,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    teamSize: row.team_size,
    ipTotal: Number(row.ip_total),
    apTotal: Number(row.ap_total),
    policyCount: row.policy_count,
    pendingPolicyCount: row.pending_policy_count,
    prospectCount: row.prospect_count,
    pipelineCount: row.pipeline_count,
    rankOverall: row.rank_overall,
  };
}

/**
 * Transform database row to SubmitLeaderboardEntry
 */
function transformSubmitEntry(
  row: SubmitLeaderboardRow,
): SubmitLeaderboardEntry {
  return {
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentEmail: row.agent_email,
    profilePhotoUrl: row.profile_photo_url,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    apTotal: Number(row.ap_total),
    policyCount: Number(row.policy_count),
    rankOverall: Number(row.rank_overall),
  };
}

/**
 * Calculate aggregate totals from agent entries
 */
function calculateAgentTotals(
  entries: AgentLeaderboardEntry[],
): LeaderboardTotals {
  const totalEntries = entries.length;
  const totalIp = entries.reduce((sum, e) => sum + e.ipTotal, 0);
  const totalAp = entries.reduce((sum, e) => sum + e.apTotal, 0);
  const totalPolicies = entries.reduce((sum, e) => sum + e.policyCount, 0);
  const totalPendingPolicies = entries.reduce(
    (sum, e) => sum + e.pendingPolicyCount,
    0,
  );
  const totalProspects = entries.reduce((sum, e) => sum + e.prospectCount, 0);
  const totalPipeline = entries.reduce((sum, e) => sum + e.pipelineCount, 0);
  const avgIpPerEntry = totalEntries > 0 ? totalIp / totalEntries : 0;

  return {
    totalEntries,
    totalIp,
    totalAp,
    totalPolicies,
    totalPendingPolicies,
    avgIpPerEntry,
    totalProspects,
    totalPipeline,
  };
}

/**
 * Calculate aggregate totals from agency entries
 */
function calculateAgencyTotals(
  entries: AgencyLeaderboardEntry[],
): LeaderboardTotals {
  const totalEntries = entries.length;
  const totalIp = entries.reduce((sum, e) => sum + e.ipTotal, 0);
  const totalAp = entries.reduce((sum, e) => sum + e.apTotal, 0);
  const totalPolicies = entries.reduce((sum, e) => sum + e.policyCount, 0);
  const totalPendingPolicies = entries.reduce(
    (sum, e) => sum + e.pendingPolicyCount,
    0,
  );
  const totalProspects = entries.reduce((sum, e) => sum + e.prospectCount, 0);
  const totalPipeline = entries.reduce((sum, e) => sum + e.pipelineCount, 0);
  const avgIpPerEntry = totalEntries > 0 ? totalIp / totalEntries : 0;

  return {
    totalEntries,
    totalIp,
    totalAp,
    totalPolicies,
    totalPendingPolicies,
    avgIpPerEntry,
    totalProspects,
    totalPipeline,
  };
}

/**
 * Calculate aggregate totals from team entries
 */
function calculateTeamTotals(
  entries: TeamLeaderboardEntry[],
): LeaderboardTotals {
  const totalEntries = entries.length;
  const totalIp = entries.reduce((sum, e) => sum + e.ipTotal, 0);
  const totalAp = entries.reduce((sum, e) => sum + e.apTotal, 0);
  const totalPolicies = entries.reduce((sum, e) => sum + e.policyCount, 0);
  const totalPendingPolicies = entries.reduce(
    (sum, e) => sum + e.pendingPolicyCount,
    0,
  );
  const totalProspects = entries.reduce((sum, e) => sum + e.prospectCount, 0);
  const totalPipeline = entries.reduce((sum, e) => sum + e.pipelineCount, 0);
  const avgIpPerEntry = totalEntries > 0 ? totalIp / totalEntries : 0;

  return {
    totalEntries,
    totalIp,
    totalAp,
    totalPolicies,
    totalPendingPolicies,
    avgIpPerEntry,
    totalProspects,
    totalPipeline,
  };
}

/**
 * Calculate aggregate totals from submit leaderboard entries
 */
function calculateSubmitTotals(
  entries: SubmitLeaderboardEntry[],
): SubmitLeaderboardTotals {
  const totalEntries = entries.length;
  const totalAp = entries.reduce((sum, e) => sum + e.apTotal, 0);
  const totalPolicies = entries.reduce((sum, e) => sum + e.policyCount, 0);
  const avgApPerEntry = totalEntries > 0 ? totalAp / totalEntries : 0;

  return {
    totalEntries,
    totalAp,
    totalPolicies,
    avgApPerEntry,
  };
}

/**
 * Transform database row to TeamLeader
 */
function transformTeamLeader(row: TeamLeaderRow): TeamLeader {
  return {
    id: row.id,
    name: row.name,
    downlineCount: row.downline_count,
  };
}

/**
 * Leaderboard service for fetching and managing leaderboard data
 */
export const leaderboardService = {
  /**
   * Fetch individual agent leaderboard data
   */
  async getAgentLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<AgentLeaderboardResponse> {
    const { timePeriod, startDate, endDate } = filters;
    const dateRange = calculateDateRange(timePeriod, startDate, endDate);

    const { data, error } = await supabase.rpc("get_leaderboard_data", {
      p_start_date: dateRange.start,
      p_end_date: dateRange.end,
      p_scope: "all",
    });

    if (error) {
      console.error("Error fetching agent leaderboard:", error);
      throw new Error(`Failed to fetch agent leaderboard: ${error.message}`);
    }

    const entries = (data || []).map(transformAgentEntry);
    const totals = calculateAgentTotals(entries);

    return { entries, totals };
  },

  /**
   * Fetch the AGENT leaderboard scoped to a SINGLE agency, ranked by AP (desc).
   * Used by Social Studio — "my agency only" graphics, AP as the hero metric.
   * The RPC's rank_overall leads on IP under the "all" scope, so we re-sort by
   * apTotal and re-number client-side.
   */
  async getAgencyAgentLeaderboard(
    filters: LeaderboardFilters,
    agencyId: string,
  ): Promise<AgentLeaderboardResponse> {
    const { timePeriod, startDate, endDate } = filters;
    const dateRange = calculateDateRange(timePeriod, startDate, endDate);

    // Two calls in parallel: the canonical leaderboard (full agent metrics) and the
    // additive AP-count companion (submitted_policies that MATCHES apTotal —
    // get_leaderboard_data computes but drops it). Merge by agent_id so a social card
    // shows a policy count consistent with the premium it ranks on.
    const [lb, apc] = await Promise.all([
      supabase.rpc("get_leaderboard_data", {
        p_start_date: dateRange.start,
        p_end_date: dateRange.end,
        p_scope: "agency",
        p_scope_id: agencyId,
      }),
      supabase.rpc("get_agency_ap_leaderboard", {
        p_start_date: dateRange.start,
        p_end_date: dateRange.end,
        p_agency_id: agencyId,
      }),
    ]);

    if (lb.error) {
      console.error("Error fetching agency agent leaderboard:", lb.error);
      throw new Error(
        `Failed to fetch agency agent leaderboard: ${lb.error.message}`,
      );
    }

    // Non-fatal enrichment: if the submitted-count call fails, fall back to the
    // legacy approved policyCount rather than breaking the card.
    const submittedByAgent = new Map<string, number>();
    if (apc.error) {
      console.error(
        "Error fetching agency submitted counts (non-fatal):",
        apc.error,
      );
    } else {
      for (const r of apc.data ?? [])
        submittedByAgent.set(r.agent_id, r.submitted_policies);
    }

    const entries: AgentLeaderboardEntry[] = (lb.data || [])
      .map(transformAgentEntry)
      .map((entry: AgentLeaderboardEntry) => ({
        ...entry,
        submittedPolicies: submittedByAgent.get(entry.agentId),
      }))
      .sort(
        (a: AgentLeaderboardEntry, b: AgentLeaderboardEntry) =>
          b.apTotal - a.apTotal,
      )
      .map((entry: AgentLeaderboardEntry, i: number) => ({
        ...entry,
        rankOverall: i + 1,
      }));
    const totals = calculateAgentTotals(entries);

    return { entries, totals };
  },

  /**
   * Fetch agency leaderboard data (rankings agencies as units)
   */
  async getAgencyLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<AgencyLeaderboardResponse> {
    const { timePeriod, startDate, endDate } = filters;
    const dateRange = calculateDateRange(timePeriod, startDate, endDate);

    const { data, error } = await supabase.rpc("get_agency_leaderboard_data", {
      p_start_date: dateRange.start,
      p_end_date: dateRange.end,
    });

    if (error) {
      console.error("Error fetching agency leaderboard:", error);
      throw new Error(`Failed to fetch agency leaderboard: ${error.message}`);
    }

    const entries = (data || []).map(transformAgencyEntry);
    const totals = calculateAgencyTotals(entries);

    return { entries, totals };
  },

  /**
   * Fetch team leaderboard data (ranking teams as units)
   */
  async getTeamLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<TeamLeaderboardResponse> {
    const { timePeriod, startDate, endDate, teamThreshold } = filters;
    const dateRange = calculateDateRange(timePeriod, startDate, endDate);

    const { data, error } = await supabase.rpc("get_team_leaderboard_data", {
      p_start_date: dateRange.start,
      p_end_date: dateRange.end,
      p_min_downlines: teamThreshold || 5,
    });

    if (error) {
      console.error("Error fetching team leaderboard:", error);
      throw new Error(`Failed to fetch team leaderboard: ${error.message}`);
    }

    const entries = (data || []).map(transformTeamEntry);
    const totals = calculateTeamTotals(entries);

    return { entries, totals };
  },

  /**
   * Fetch submit leaderboard (rankings by AP for submitted policies)
   */
  async getSubmitLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<SubmitLeaderboardResponse> {
    const { timePeriod, startDate, endDate } = filters;
    const dateRange = calculateDateRange(timePeriod, startDate, endDate);

    const { data, error } = await supabase.rpc("get_submit_leaderboard", {
      p_start_date: dateRange.start,
      p_end_date: dateRange.end,
    });

    if (error) {
      console.error("Error fetching submit leaderboard:", error);
      throw new Error(`Failed to fetch submit leaderboard: ${error.message}`);
    }

    const entries = (data || []).map(transformSubmitEntry);
    const totals = calculateSubmitTotals(entries);

    return { entries, totals };
  },

  /**
   * Fetch team leaders (agents with N+ direct downlines)
   * @param minDownlines - Minimum number of direct downlines to qualify
   * @returns Array of TeamLeader objects
   */
  async getTeamLeaders(minDownlines: number = 5): Promise<TeamLeader[]> {
    const { data, error } = await supabase.rpc(
      "get_team_leaders_for_leaderboard",
      {
        p_min_downlines: minDownlines,
      },
    );

    if (error) {
      console.error("Error fetching team leaders:", error);
      throw new Error(`Failed to fetch team leaders: ${error.message}`);
    }

    return (data || []).map(transformTeamLeader);
  },

  /**
   * Fetch list of agencies for the agency filter dropdown.
   * Tenant isolation: RLS policy on agencies table enforces imo_id = get_my_imo_id().
   * @returns Array of agency objects with id and name
   */
  async getAgencies(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from("agencies")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching agencies:", error);
      throw new Error(`Failed to fetch agencies: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Calculate date range from filters (exposed for testing/debugging)
   */
  calculateDateRange,
};
