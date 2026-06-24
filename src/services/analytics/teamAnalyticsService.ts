// src/services/analytics/teamAnalyticsService.ts
// Service for fetching and processing team analytics data

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import type {
  TeamAnalyticsRawData,
  TeamPolicyRow,
  TeamCommissionRow,
  TeamAgentTargetRow,
  TeamCarrierRow,
  TeamClientRow,
  TeamAgentProfileRow,
  AgentPerformanceData,
  AgentSegmentationSummary,
  AgentSegment,
  TeamPaceMetrics,
  TeamPolicyStatusBreakdown,
  TeamGeographicBreakdown,
  TeamCarrierBreakdown,
} from "../../types/team-analytics.types";

/**
 * Raw response structure from the Postgres RPC
 */
interface TeamAnalyticsRPCResponse {
  policies: TeamPolicyRow[];
  commissions: TeamCommissionRow[];
  all_policies: TeamPolicyRow[];
  all_commissions: TeamCommissionRow[];
  agent_targets: TeamAgentTargetRow[];
  carriers: TeamCarrierRow[];
  clients: TeamClientRow[];
  agent_profiles: TeamAgentProfileRow[];
}

/**
 * Lifecycle statuses that count as an *issued* policy (the in-force book). Used
 * to keep the policy-status buckets mutually exclusive. Module-scoped Set so it
 * is allocated once and looked up in O(1), not rebuilt on every call.
 */
const ISSUED_LIFECYCLE_STATUSES = new Set<string>([
  "active",
  "lapsed",
  "cancelled",
]);

/**
 * Team Analytics Service
 *
 * Provides server-side aggregation of team data for analytics dashboards.
 * Uses a Postgres RPC function to minimize data transfer and processing time.
 */
class TeamAnalyticsService {
  /**
   * Fetch raw team analytics data from Postgres RPC
   */
  async getTeamAnalyticsData(
    userIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<TeamAnalyticsRawData> {
    try {
      const { data, error } = await supabase.rpc("get_team_analytics_data", {
        p_team_user_ids: userIds,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });

      if (error) {
        logger.error("TeamAnalyticsService.getTeamAnalyticsData RPC error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userIdsCount: userIds.length,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });
        throw error;
      }

      // Transform snake_case from Postgres to camelCase for TypeScript
      const rpcData = data as TeamAnalyticsRPCResponse;

      return {
        policies: rpcData.policies || [],
        commissions: rpcData.commissions || [],
        allPolicies: rpcData.all_policies || [],
        allCommissions: rpcData.all_commissions || [],
        agentTargets: rpcData.agent_targets || [],
        carriers: rpcData.carriers || [],
        clients: rpcData.clients || [],
        agentProfiles: rpcData.agent_profiles || [],
      };
    } catch (error) {
      logger.error(
        "TeamAnalyticsService.getTeamAnalyticsData",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Calculate agent performance metrics for segmentation
   *
   * Total AP = ALL submissions with effective_date in the selected date range,
   * regardless of status or lifecycle_status. The RPC handles date filtering.
   *
   * Persistency is calculated as: active / (active + lapsed + cancelled)
   * from allPolicies (all-time data). Pending policies are NOT included.
   */
  calculateAgentPerformance(
    rawData: TeamAnalyticsRawData,
    dateFilteredPolicies?: TeamPolicyRow[],
    dateFilteredCommissions?: TeamCommissionRow[],
  ): AgentPerformanceData[] {
    const policies = dateFilteredPolicies || rawData.policies;
    const commissions = dateFilteredCommissions || rawData.commissions;
    const allPolicies = rawData.allPolicies;

    // Group policies and commissions by user
    // ALL policies in the date range count toward Total AP (no status filter)
    const policyByUser = new Map<string, TeamPolicyRow[]>();
    const allPolicyByUser = new Map<string, TeamPolicyRow[]>();
    const commissionByUser = new Map<string, TeamCommissionRow[]>();

    policies.forEach((p) => {
      const existing = policyByUser.get(p.user_id) || [];
      existing.push(p);
      policyByUser.set(p.user_id, existing);
    });

    allPolicies.forEach((p) => {
      // Include all statuses for persistency calculation
      const existing = allPolicyByUser.get(p.user_id) || [];
      existing.push(p);
      allPolicyByUser.set(p.user_id, existing);
    });

    commissions.forEach((c) => {
      const existing = commissionByUser.get(c.user_id) || [];
      existing.push(c);
      commissionByUser.set(c.user_id, existing);
    });

    // Calculate metrics for each agent
    const agentMetrics: AgentPerformanceData[] = rawData.agentProfiles.map(
      (agent) => {
        const agentPolicies = policyByUser.get(agent.id) || [];
        const agentAllPolicies = allPolicyByUser.get(agent.id) || [];
        const agentCommissions = commissionByUser.get(agent.id) || [];

        // totalAP = all submissions with effective_date in range (no status filter)
        const totalAP = agentPolicies.reduce(
          (sum, p) => sum + (p.annual_premium || 0),
          0,
        );
        const policyCount = agentPolicies.length;
        const avgPremium = policyCount > 0 ? totalAP / policyCount : 0;

        // Status counts from all policies
        // Use lifecycle_status for active/lapsed/cancelled (issued policy lifecycle)
        const activePolicies = agentAllPolicies.filter(
          (p) => p.lifecycle_status === "active",
        ).length;
        const lapsedPolicies = agentAllPolicies.filter(
          (p) => p.lifecycle_status === "lapsed",
        ).length;
        const cancelledPolicies = agentAllPolicies.filter(
          (p) => p.lifecycle_status === "cancelled",
        ).length;

        // IMPORTANT: Persistency excludes pending policies
        // Only count issued policies (active + lapsed + cancelled)
        const issuedPolicies =
          activePolicies + lapsedPolicies + cancelledPolicies;
        const persistencyRate =
          issuedPolicies > 0 ? (activePolicies / issuedPolicies) * 100 : 100; // No issued policies = 100% persistency (nothing to lapse)

        const commissionEarned = agentCommissions.reduce(
          (sum, c) => sum + (c.earned_amount || 0),
          0,
        );

        const agentName =
          [agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
          agent.email;

        return {
          agentId: agent.id,
          agentName,
          agentEmail: agent.email,
          contractLevel: agent.contract_level || 100,
          totalAP,
          policyCount,
          avgPremium,
          activePolicies,
          lapsedPolicies,
          cancelledPolicies,
          persistencyRate,
          commissionEarned,
        };
      },
    );

    // Sort by total AP descending
    return agentMetrics.sort((a, b) => b.totalAP - a.totalAP);
  }

  /**
   * Segment agents by performance tier
   *
   * Uses simple splits:
   * - Top Performers: Top 20% by AP
   * - Solid Performers: Next 30% (20-50%)
   * - Needs Attention: Bottom 50%
   */
  segmentAgents(
    agentMetrics: AgentPerformanceData[],
  ): AgentSegmentationSummary {
    if (agentMetrics.length === 0) {
      const emptySegment: AgentSegment = {
        tier: "top_performer",
        agents: [],
        totalAP: 0,
        avgAP: 0,
        policyCount: 0,
        agentCount: 0,
      };
      return {
        topPerformers: { ...emptySegment, tier: "top_performer" },
        solidPerformers: { ...emptySegment, tier: "solid_performer" },
        needsAttention: { ...emptySegment, tier: "needs_attention" },
        totalAgents: 0,
        totalTeamAP: 0,
        avgAgentAP: 0,
      };
    }

    // Sorted by AP descending
    const sorted = [...agentMetrics].sort((a, b) => b.totalAP - a.totalAP);
    const totalAgents = sorted.length;

    // Top 20% = top performers (at least 1)
    // Next 30% = solid performers
    // Bottom 50% = needs attention
    const topThreshold = Math.max(1, Math.ceil(totalAgents * 0.2));
    const solidThreshold = Math.ceil(totalAgents * 0.5);

    const topPerformersAgents = sorted.slice(0, topThreshold);
    const solidPerformersAgents = sorted.slice(topThreshold, solidThreshold);
    const needsAttentionAgents = sorted.slice(solidThreshold);

    const createSegment = (
      agents: AgentPerformanceData[],
      tier: "top_performer" | "solid_performer" | "needs_attention",
    ): AgentSegment => {
      const totalAP = agents.reduce((sum, a) => sum + a.totalAP, 0);
      const policyCount = agents.reduce((sum, a) => sum + a.policyCount, 0);
      return {
        tier,
        agents,
        totalAP,
        avgAP: agents.length > 0 ? totalAP / agents.length : 0,
        policyCount,
        agentCount: agents.length,
      };
    };

    const totalTeamAP = sorted.reduce((sum, a) => sum + a.totalAP, 0);

    return {
      topPerformers: createSegment(topPerformersAgents, "top_performer"),
      solidPerformers: createSegment(solidPerformersAgents, "solid_performer"),
      needsAttention: createSegment(needsAttentionAgents, "needs_attention"),
      totalAgents,
      totalTeamAP,
      avgAgentAP: totalAgents > 0 ? totalTeamAP / totalAgents : 0,
    };
  }

  /**
   * Calculate team pace metrics
   *
   * Total AP = ALL submissions with effective_date in the selected date range,
   * regardless of status or lifecycle_status. The RPC handles date filtering.
   * Pace = Total AP MTD / dayOfMonth * daysInMonth.
   */
  calculateTeamPace(
    rawData: TeamAnalyticsRawData,
    startDate: Date,
    endDate: Date,
    timePeriod: string,
  ): TeamPaceMetrics {
    const now = new Date();

    // All policies in the date range count toward Total AP (no status filter)
    const periodPolicies = rawData.policies;

    // Filter to policies with effective_date up to today to avoid inflating pace
    // with future-dated policies (common in insurance: renewals, pre-dated effective dates)
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const pacePolicies = periodPolicies.filter(
      (p) => !p.effective_date || p.effective_date <= todayStr,
    );

    // Calculate metrics from submissions up to today only
    const totalAPWritten = pacePolicies.reduce(
      (sum, p) => sum + (p.annual_premium || 0),
      0,
    );
    const totalPoliciesWritten = pacePolicies.length;
    const avgPremiumPerPolicy =
      totalPoliciesWritten > 0 ? totalAPWritten / totalPoliciesWritten : 0;

    // Calculate time elapsed and remaining
    const periodStart = startDate.getTime();
    const periodEnd = endDate.getTime();
    const nowTime = Math.min(now.getTime(), periodEnd); // Don't go past period end

    const msElapsed = Math.max(0, nowTime - periodStart);
    // Use floor+1 to avoid off-by-one at midnight (day 1 = today inclusive)
    const daysElapsed = Math.max(
      1,
      Math.floor(msElapsed / (24 * 60 * 60 * 1000)) + 1,
    );

    const msRemaining = Math.max(0, periodEnd - nowTime);
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    const totalDaysInPeriod = Math.max(
      1,
      Math.ceil((periodEnd - periodStart) / (24 * 60 * 60 * 1000)),
    );

    // Calculate pace
    const currentAPPace = totalAPWritten / daysElapsed;
    const projectedAPTotal = currentAPPace * totalDaysInPeriod;
    const projectedPolicyTotal = Math.round(
      (totalPoliciesWritten / daysElapsed) * totalDaysInPeriod,
    );

    // Calculate target from agent targets using avg_premium * policy count target
    // This is more accurate than using income targets for AP comparison
    let teamAPTarget = 0;
    rawData.agentTargets.forEach((t) => {
      const avgPremium = t.avg_premium_target || 0;
      const policyTarget = t.annual_policies_target || 0;
      // If we have both, use them; otherwise estimate from income
      if (avgPremium > 0 && policyTarget > 0) {
        if (timePeriod.includes("year") || timePeriod === "yearly") {
          teamAPTarget += avgPremium * policyTarget;
        } else {
          // Monthly: divide annual by 12
          teamAPTarget += (avgPremium * policyTarget) / 12;
        }
      }
    });

    // If no premium-based target, don't show a comparison (set to 0)
    const surplusDeficit = teamAPTarget > 0 ? totalAPWritten - teamAPTarget : 0;
    const isProfitable = teamAPTarget === 0 || surplusDeficit >= 0;

    return {
      totalAPWritten,
      totalPoliciesWritten,
      avgPremiumPerPolicy,
      projectedAPTotal,
      currentAPPace,
      projectedPolicyTotal,
      teamAPTarget,
      surplusDeficit,
      isProfitable,
      daysElapsed,
      daysRemaining,
      timePeriod,
    };
  }

  /**
   * Current composition of the team's book by policy status.
   *
   * Point-in-time snapshot of the WHOLE in-force book (own + downline) — NOT
   * date-range scoped. The panel's label ("X total policies") and its
   * persistency badge are both book-wide, so the per-status counts must be too.
   *
   * Previously each status was filtered by a *different* date field within the
   * selected period (active by effective_date, pending by submit_date, cancelled
   * by cancellation_date/updated_at, lapsed by updated_at). That silently dropped
   * any policy whose relevant date fell outside the period — e.g. a policy
   * cancelled in a prior period vanished from the cancelled count entirely —
   * producing incoherent totals and badly under-counting cancellations/lapses.
   * We now count current lifecycle/status across all-time `allPolicies`, matching
   * getPolicyStatusSnapshot() on the per-agent Analytics page.
   *
   * Issued policies bucket by lifecycle_status; applications still in
   * underwriting (status='pending', null lifecycle) surface as pending. Terminal
   * non-issued applications (withdrawn/denied) are excluded — they belong to the
   * conversion funnel, not the in-force book.
   */
  calculatePolicyStatusBreakdown(
    rawData: TeamAnalyticsRawData,
  ): TeamPolicyStatusBreakdown {
    const allPolicies = rawData.allPolicies;

    const active = allPolicies.filter((p) => p.lifecycle_status === "active");
    const lapsed = allPolicies.filter((p) => p.lifecycle_status === "lapsed");
    const cancelled = allPolicies.filter(
      (p) => p.lifecycle_status === "cancelled",
    );
    // Keep the buckets mutually exclusive. Pending applications carry
    // lifecycle_status 'pending' or null (verified in prod), so we can't gate on
    // "null lifecycle" — that would drop the bulk of pending rows. Instead we
    // exclude only the lifecycle values already counted above, so an issued
    // policy whose `status` still reads 'pending' (approval-state drift) is
    // counted once by its lifecycle bucket, not double-counted in totals.
    const pending = allPolicies.filter(
      (p) =>
        p.status === "pending" &&
        !ISSUED_LIFECYCLE_STATUSES.has(p.lifecycle_status ?? ""),
    );

    const sumPremium = (policies: TeamPolicyRow[]) =>
      policies.reduce((sum, p) => sum + (p.annual_premium || 0), 0);

    // Persistency = active / issued (active + lapsed + cancelled). Pending
    // applications aren't "issued" yet, so they're excluded from the rate.
    const issuedPolicies = active.length + lapsed.length + cancelled.length;
    const persistencyRate =
      issuedPolicies > 0 ? (active.length / issuedPolicies) * 100 : 100;

    const totalCount =
      active.length + pending.length + cancelled.length + lapsed.length;
    const totalPremium =
      sumPremium(active) +
      sumPremium(pending) +
      sumPremium(cancelled) +
      sumPremium(lapsed);

    return {
      active: { count: active.length, premium: sumPremium(active) },
      pending: { count: pending.length, premium: sumPremium(pending) },
      lapsed: { count: lapsed.length, premium: sumPremium(lapsed) },
      cancelled: { count: cancelled.length, premium: sumPremium(cancelled) },
      total: { count: totalCount, premium: totalPremium },
      persistencyRate,
    };
  }

  /**
   * Calculate geographic distribution by client state for the selected date range
   * Uses date-filtered policies (effective_date in range), not all-time data.
   */
  calculateGeographicBreakdown(
    rawData: TeamAnalyticsRawData,
  ): TeamGeographicBreakdown[] {
    // Use date-filtered policies for current period view
    const stateMap = new Map<string, { count: number; premium: number }>();

    rawData.policies.forEach((policy) => {
      const state = policy.client_state || "Unknown";

      const existing = stateMap.get(state) || { count: 0, premium: 0 };
      existing.count++;
      existing.premium += policy.annual_premium || 0;
      stateMap.set(state, existing);
    });

    // Convert to array and calculate percentages
    const totalPolicies = rawData.policies.length;
    const breakdown: TeamGeographicBreakdown[] = [];

    stateMap.forEach((data, state) => {
      breakdown.push({
        state,
        policyCount: data.count,
        totalPremium: data.premium,
        percentage: totalPolicies > 0 ? (data.count / totalPolicies) * 100 : 0,
      });
    });

    // Sort by policy count descending
    return breakdown.sort((a, b) => b.policyCount - a.policyCount);
  }

  /**
   * Calculate carrier breakdown for the selected date range
   * Uses date-filtered policies and commissions, not all-time data.
   */
  calculateCarrierBreakdown(
    rawData: TeamAnalyticsRawData,
  ): TeamCarrierBreakdown[] {
    // Create carrier lookup
    const carrierMap = new Map<string, TeamCarrierRow>();
    rawData.carriers.forEach((c) => carrierMap.set(c.id, c));

    // Create commission lookup by policy (date-filtered)
    const commissionByPolicy = new Map<string, number>();
    rawData.commissions.forEach((c) => {
      if (c.policy_id) {
        const existing = commissionByPolicy.get(c.policy_id) || 0;
        commissionByPolicy.set(
          c.policy_id,
          existing + (c.commission_amount || 0),
        );
      }
    });

    // Group by carrier and product
    const carrierData = new Map<
      string,
      {
        carrierId: string;
        carrierName: string;
        policyCount: number;
        totalPremium: number;
        totalCommission: number;
        products: Map<
          string,
          {
            name: string;
            policyCount: number;
            totalPremium: number;
            totalCommission: number;
          }
        >;
      }
    >();

    rawData.policies.forEach((policy) => {
      const carrierId = policy.carrier_id || "unknown";
      const carrier = carrierMap.get(carrierId);
      const carrierName = carrier?.name || "Unknown Carrier";
      const productName = policy.product || "Unknown Product";
      const commission = policy.id ? commissionByPolicy.get(policy.id) || 0 : 0;

      if (!carrierData.has(carrierId)) {
        carrierData.set(carrierId, {
          carrierId,
          carrierName,
          policyCount: 0,
          totalPremium: 0,
          totalCommission: 0,
          products: new Map(),
        });
      }

      const carrierEntry = carrierData.get(carrierId)!;
      carrierEntry.policyCount++;
      carrierEntry.totalPremium += policy.annual_premium || 0;
      carrierEntry.totalCommission += commission;

      if (!carrierEntry.products.has(productName)) {
        carrierEntry.products.set(productName, {
          name: productName,
          policyCount: 0,
          totalPremium: 0,
          totalCommission: 0,
        });
      }

      const productEntry = carrierEntry.products.get(productName)!;
      productEntry.policyCount++;
      productEntry.totalPremium += policy.annual_premium || 0;
      productEntry.totalCommission += commission;
    });

    // Convert to array
    const breakdown: TeamCarrierBreakdown[] = [];
    carrierData.forEach((data) => {
      const products = Array.from(data.products.values()).map((p) => ({
        ...p,
        avgCommissionRate:
          p.totalPremium > 0 ? (p.totalCommission / p.totalPremium) * 100 : 0,
      }));

      breakdown.push({
        carrierId: data.carrierId,
        carrierName: data.carrierName,
        policyCount: data.policyCount,
        totalPremium: data.totalPremium,
        totalCommission: data.totalCommission,
        avgCommissionRate:
          data.totalPremium > 0
            ? (data.totalCommission / data.totalPremium) * 100
            : 0,
        products: products.sort((a, b) => b.totalPremium - a.totalPremium),
      });
    });

    // Sort by total premium descending
    return breakdown.sort((a, b) => b.totalPremium - a.totalPremium);
  }
}

export const teamAnalyticsService = new TeamAnalyticsService();
