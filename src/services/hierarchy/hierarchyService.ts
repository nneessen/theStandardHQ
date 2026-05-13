// src/services/hierarchy/hierarchyService.ts
// Service layer for hierarchy management - handles business logic for agency hierarchy

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import { HierarchyRepository } from "./HierarchyRepository";
import {
  PolicyRepository,
  PolicyMetricRow,
} from "../policies/PolicyRepository";
import {
  CommissionRepository,
  CommissionMetricRow,
} from "../commissions/CommissionRepository";
import {
  OverrideRepository,
  OverrideMetricRow,
} from "../overrides/OverrideRepository";
import type {
  HierarchyNode,
  UserProfile,
  DownlinePerformance,
  HierarchyChangeRequest,
  HierarchyValidationResult,
  HierarchyStats,
} from "../../types/hierarchy.types";
import { NotFoundError, ValidationError } from "../../errors/ServiceErrors";
import { userTargetsRepository } from "../targets/UserTargetsRepository";
import { calculateCommissionProgress } from "../../utils/commissionProgress";

/**
 * Service layer for hierarchy operations
 * Handles all agency hierarchy business logic
 *
 * Uses domain-specific repositories:
 * - HierarchyRepository: user_profiles hierarchy queries
 * - PolicyRepository: policies table queries
 * - CommissionRepository: commissions table queries
 * - OverrideRepository: override_commissions table queries
 */
class HierarchyService {
  private hierarchyRepo: HierarchyRepository;
  private policyRepo: PolicyRepository;
  private commissionRepo: CommissionRepository;
  private overrideRepo: OverrideRepository;

  constructor() {
    this.hierarchyRepo = new HierarchyRepository();
    this.policyRepo = new PolicyRepository();
    this.commissionRepo = new CommissionRepository();
    this.overrideRepo = new OverrideRepository();
  }

  /**
   * Get the current user's hierarchy tree (all downlines)
   * Returns a tree structure with nested children
   */
  async getMyHierarchyTree(): Promise<HierarchyNode[]> {
    try {
      // Get current user (auth stays in service layer)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Get current user's profile with hierarchy info
      const myProfile = await this.hierarchyRepo.findById(user.id);
      if (!myProfile) {
        throw new NotFoundError("User profile", user.id);
      }

      // Get all downlines using hierarchy_path
      const downlines = await this.hierarchyRepo.findDownlinesByHierarchyPath(
        myProfile.hierarchy_path || myProfile.id,
      );

      // Get override earnings for all agents in tree
      const allAgentIds = [myProfile.id, ...downlines.map((d) => d.id)];
      const overrides = await this.overrideRepo.findByBaseAgentIds(allAgentIds);

      // Calculate total override earnings per agent
      const overridesByAgent = this.aggregateOverridesByAgent(overrides);

      // Build tree structure
      const allNodes: UserProfile[] = [myProfile, ...downlines];
      return this.buildTree(allNodes, myProfile.id, overridesByAgent);
    } catch (error) {
      logger.error(
        "HierarchyService.getMyHierarchyTree",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get all downlines (flat list, not tree)
   * Useful for dropdowns, tables, etc.
   */
  async getMyDownlines(): Promise<UserProfile[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      const myProfile = await this.hierarchyRepo.findById(user.id);
      if (!myProfile) {
        throw new NotFoundError("User profile", user.id);
      }

      return this.hierarchyRepo.findDownlinesByHierarchyPath(
        myProfile.hierarchy_path || myProfile.id,
      );
    } catch (error) {
      logger.error(
        "HierarchyService.getMyDownlines",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get upline chain for current user (path from root to current user)
   */
  async getMyUplineChain(): Promise<UserProfile[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      const myProfile = await this.hierarchyRepo.findById(user.id);
      if (!myProfile) {
        throw new NotFoundError("User profile", user.id);
      }

      // Parse hierarchy_path to get all upline IDs
      const hierarchyPath = myProfile.hierarchy_path || myProfile.id;
      const uplineIds = hierarchyPath
        .split(".")
        .filter((id: string) => id !== user.id);

      if (uplineIds.length === 0) {
        return []; // Root agent, no uplines
      }

      return this.hierarchyRepo.findByIds(uplineIds);
    } catch (error) {
      logger.error(
        "HierarchyService.getMyUplineChain",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get performance metrics for a specific downline
   */
  async getDownlinePerformance(
    downlineId: string,
  ): Promise<DownlinePerformance> {
    try {
      // Verify downline exists
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      const downline = await this.hierarchyRepo.findById(downlineId);
      if (!downline) {
        throw new NotFoundError("Downline", downlineId);
      }

      // Get policy metrics for this downline
      const policies = await this.policyRepo.findMetricsByUserIds([downlineId]);
      const policyMetrics = this.calculatePolicyMetrics(policies);

      // Get commission metrics for this downline
      const commissions = await this.commissionRepo.findMetricsByUserIds([
        downlineId,
      ]);
      const commissionMetrics = this.calculateCommissionMetrics(commissions);

      // Get override metrics (what this downline generated for uplines)
      const overrides = await this.overrideRepo.findByBaseAgentId(downlineId);
      const overrideMetrics = this.calculateOverrideMetrics(overrides);

      return {
        agent_id: downlineId,
        agent_email: downline.email,
        hierarchy_depth: downline.hierarchy_depth ?? 0,
        policies_written: policyMetrics.total,
        policies_active: policyMetrics.active,
        policies_lapsed: policyMetrics.lapsed,
        policies_cancelled: policyMetrics.cancelled,
        total_premium: policyMetrics.totalPremium,
        avg_premium:
          policyMetrics.total > 0
            ? policyMetrics.totalPremium / policyMetrics.total
            : 0,
        total_base_commission: commissionMetrics.total,
        total_commission_earned: commissionMetrics.earned,
        total_commission_paid: commissionMetrics.paid,
        total_overrides_generated: overrideMetrics.total,
        pending_overrides_generated: overrideMetrics.pending,
        earned_overrides_generated: overrideMetrics.earned,
        paid_overrides_generated: overrideMetrics.paid,
        persistency_rate:
          policyMetrics.total > 0
            ? (policyMetrics.active / policyMetrics.total) * 100
            : 0,
      };
    } catch (error) {
      logger.error(
        "HierarchyService.getDownlinePerformance",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Update an agent's upline (admin only)
   * Validates against circular references and comp level hierarchy
   */
  async updateAgentHierarchy(
    request: HierarchyChangeRequest,
  ): Promise<UserProfile> {
    try {
      // Validate request
      const validation = await this.validateHierarchyChange(request);
      if (!validation.valid) {
        throw new ValidationError(
          "Invalid hierarchy change",
          validation.errors.map((err) => ({
            field: "upline_id",
            message: err,
            value: request.new_upline_id,
          })),
        );
      }

      // Update upline_id (triggers will handle hierarchy_path and circular reference checks)
      const data = await this.hierarchyRepo.updateUpline(
        request.agent_id,
        request.new_upline_id,
      );

      return data;
    } catch (error) {
      logger.error(
        "HierarchyService.updateAgentHierarchy",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Validate a proposed hierarchy change
   * Uses RPC to bypass RLS for validation queries
   */
  async validateHierarchyChange(
    request: HierarchyChangeRequest,
  ): Promise<HierarchyValidationResult> {
    try {
      // Use RPC to validate (bypasses RLS with SECURITY DEFINER)
      const { data, error } = await supabase.rpc("validate_hierarchy_change", {
        p_agent_id: request.agent_id,
        p_new_upline_id: request.new_upline_id,
      });

      if (error) {
        logger.error(
          "HierarchyService.validateHierarchyChange",
          new Error(error.message),
        );
        return {
          valid: false,
          errors: [`Validation failed: ${error.message}`],
          warnings: [],
        };
      }

      // RPC returns JSON with valid, errors, warnings
      const result = data as {
        valid: boolean;
        errors: string[];
        warnings: string[];
      };

      return {
        valid: result.valid,
        errors: result.errors || [],
        warnings: result.warnings || [],
      };
    } catch (error) {
      logger.error(
        "HierarchyService.validateHierarchyChange",
        error instanceof Error ? error : new Error(String(error)),
      );
      return {
        valid: false,
        errors: [
          "Validation failed: " +
            (error instanceof Error ? error.message : String(error)),
        ],
        warnings: [],
      };
    }
  }

  /**
   * Get performance metrics for ALL downlines at once
   * More efficient than calling getDownlinePerformance() for each agent
   */
  async getAllDownlinePerformance(): Promise<DownlinePerformance[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      const downlines = await this.getMyDownlines();

      if (downlines.length === 0) {
        return [];
      }

      const downlineIds = downlines.map((d) => d.id);

      // Batch fetch all data
      const [policies, commissions, overrides] = await Promise.all([
        this.policyRepo.findMetricsByUserIds(downlineIds),
        this.commissionRepo.findMetricsByUserIds(downlineIds),
        this.overrideRepo.findByBaseAgentIds(downlineIds),
      ]);

      // Aggregate data by downline
      return downlines.map((downline) => {
        const downlinePolicies = policies.filter(
          (p) => p.user_id === downline.id,
        );
        const downlineCommissions = commissions.filter(
          (c) => c.user_id === downline.id,
        );
        const downlineOverrides = overrides.filter(
          (o) => o.base_agent_id === downline.id,
        );

        const policyMetrics = this.calculatePolicyMetrics(downlinePolicies);
        const commissionMetrics =
          this.calculateCommissionMetrics(downlineCommissions);
        const overrideMetrics =
          this.calculateOverrideMetrics(downlineOverrides);

        return {
          agent_id: downline.id,
          agent_email: downline.email,
          hierarchy_depth: downline.hierarchy_depth ?? 0,
          policies_written: policyMetrics.total,
          policies_active: policyMetrics.active,
          policies_lapsed: policyMetrics.lapsed,
          policies_cancelled: policyMetrics.cancelled,
          total_premium: policyMetrics.totalPremium,
          avg_premium:
            policyMetrics.total > 0
              ? policyMetrics.totalPremium / policyMetrics.total
              : 0,
          total_base_commission: commissionMetrics.total,
          total_commission_earned: commissionMetrics.earned,
          total_commission_paid: commissionMetrics.paid,
          total_overrides_generated: overrideMetrics.total,
          pending_overrides_generated: overrideMetrics.pending,
          earned_overrides_generated: overrideMetrics.earned,
          paid_overrides_generated: overrideMetrics.paid,
          persistency_rate:
            policyMetrics.total > 0
              ? (policyMetrics.active / policyMetrics.total) * 100
              : 0,
        };
      });
    } catch (error) {
      logger.error(
        "HierarchyService.getAllDownlinePerformance",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get hierarchy statistics for current user
   * CRITICAL FIX: Include team leader's own data in team metrics
   * @param startDate - Optional start date for filtering (ISO string)
   * @param endDate - Optional end date for filtering (ISO string)
   */
  async getMyHierarchyStats(
    startDate?: string,
    endDate?: string,
  ): Promise<HierarchyStats> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error(
          "HierarchyService.getMyHierarchyStats",
          new Error("Not authenticated"),
        );
        throw new Error("Not authenticated");
      }

      // Get current user's profile to verify they exist
      const myProfile = await this.hierarchyRepo.findById(user.id);
      if (!myProfile) {
        logger.error(
          "HierarchyService.getMyHierarchyStats",
          new Error(`Profile not found for user ${user.id}`),
        );
        throw new NotFoundError("User profile", user.id);
      }

      // Get all downlines (including pending and archived)
      const allDownlines = await this.getMyDownlines();

      // Filter to only APPROVED and ACTIVE (not archived) downlines for stats
      const downlines = allDownlines.filter(
        (d) => d.approval_status === "approved" && !d.archived_at,
      );

      // Calculate date ranges
      const now = new Date();
      const mtdStart =
        startDate ||
        new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const mtdEnd = endDate || now.toISOString();
      const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString();

      // Calculate direct downlines - only approved agents with upline_id = current user
      const directDownlines = downlines.filter(
        (d) => d.upline_id === myProfile.id,
      );

      // Get all downline IDs for policy aggregation
      const downlineIds = downlines.map((d) => d.id);

      // Include owner + all downlines for AP calculation
      const allTeamUserIds = [myProfile.id, ...downlineIds];

      // ==========================================
      // PARALLELIZED QUERIES - All independent, run simultaneously
      // ==========================================
      const [mtdOverrides, ytdOverrides, allPolicies, invitationResult] =
        await Promise.all([
          // MTD overrides where user is override_agent OR base_agent
          this.overrideRepo.findForAgentInRange(myProfile.id, mtdStart),
          // YTD overrides where user is override_agent
          this.overrideRepo.findByOverrideAgentId(myProfile.id, ytdStart),
          // All policies for team members
          this.policyRepo.findMetricsByUserIds(allTeamUserIds),
          // Pending invitations count
          supabase
            .from("hierarchy_invitations")
            .select("*", { count: "exact", head: true })
            .eq("inviter_id", myProfile.id)
            .eq("status", "pending"),
        ]);

      const pendingInvitations = invitationResult.count || 0;

      // Calculate MTD income (only where user is the override_agent receiving the income)
      const mtdIncome = mtdOverrides
        .filter((o) => o.override_agent_id === myProfile.id)
        .reduce(
          (sum, o) =>
            sum + parseFloat(String(o.override_commission_amount) || "0"),
          0,
        );

      const ytdIncome = ytdOverrides.reduce(
        (sum, o) =>
          sum + parseFloat(String(o.override_commission_amount) || "0"),
        0,
      );

      // ==========================================
      // Calculate Team Performance Metrics
      // ==========================================

      // Group policies by user_id for O(1) lookup instead of O(N) filtering per user
      const policiesByUserId = new Map<string, typeof allPolicies>();
      for (const policy of allPolicies) {
        const existing = policiesByUserId.get(policy.user_id) || [];
        existing.push(policy);
        policiesByUserId.set(policy.user_id, existing);
      }

      // Aggregate metrics for all team members
      let teamAPTotal = 0; // All submissions (any status)
      let teamIPTotal = 0; // Only active/issued policies
      let teamPoliciesCount = 0;
      let teamPendingAPTotal = 0;
      let teamPendingPoliciesCount = 0;
      const agentPerformance: Array<{
        id: string;
        name: string;
        ap: number;
      }> = [];

      // Date objects for non-policy date comparisons (recruitment rate, etc.)
      const rangeStart = new Date(mtdStart);
      const rangeEnd = new Date(mtdEnd);
      // YYYY-MM-DD strings for policy date comparison (avoids UTC vs local timezone drift)
      const rangeStartStr = mtdStart.slice(0, 10);
      const rangeEndStr = mtdEnd.slice(0, 10);

      // Aggregate policies for all team members (owner + downlines) using pre-fetched data
      for (const userId of allTeamUserIds) {
        // O(1) lookup from pre-grouped Map
        const policies = policiesByUserId.get(userId) || [];

        // AP is submission-based: all policies with submit_date in selected range (any status)
        const submittedPolicies = policies.filter((p) => {
          if (!p.submit_date) return false;
          return p.submit_date >= rangeStartStr && p.submit_date <= rangeEndStr;
        });

        // Total AP: sum of ALL submissions in period
        const agentAP = submittedPolicies.reduce((sum, p) => {
          const val = parseFloat(String(p.annual_premium ?? 0));
          return sum + (isNaN(val) ? 0 : val);
        }, 0);

        teamAPTotal += agentAP;
        teamPoliciesCount += submittedPolicies.length;

        // IP: lifecycle_status = 'active' + effective_date in range
        const activePolicies = policies.filter((p) => {
          if (p.lifecycle_status !== "active") return false;
          if (!p.effective_date) return false;
          return (
            p.effective_date >= rangeStartStr && p.effective_date <= rangeEndStr
          );
        });
        const agentIP = activePolicies.reduce((sum, p) => {
          const val = parseFloat(String(p.annual_premium ?? 0));
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
        teamIPTotal += agentIP;

        // Pending AP: status = 'pending' + submit_date in range
        const pendingPolicies = submittedPolicies.filter(
          (p) => p.status === "pending",
        );
        const pendingAP = pendingPolicies.reduce((sum, p) => {
          const val = parseFloat(String(p.annual_premium ?? 0));
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
        teamPendingAPTotal += pendingAP;
        teamPendingPoliciesCount += pendingPolicies.length;

        // Track agent performance for top performer (include owner)
        if (agentAP > 0) {
          const isOwner = userId === myProfile.id;
          const agent = isOwner
            ? myProfile
            : downlines.find((d) => d.id === userId);
          if (agent) {
            agentPerformance.push({
              id: userId,
              name:
                `${agent.first_name || ""} ${agent.last_name || ""}`.trim() ||
                agent.email,
              ap: agentAP,
            });
          }
        }
      }

      // Find top performer
      const topPerformer =
        agentPerformance.sort((a, b) => b.ap - a.ap)[0] || null;

      // Calculate avg premium per agent (only count LICENSED agents)
      // Filter downlines to only those with agent_status === 'licensed'
      const licensedDownlines = downlines.filter(
        (d) => d.agent_status === "licensed",
      );
      // Check if owner is licensed (count them only if they are)
      const isOwnerLicensed = myProfile.agent_status === "licensed";
      const licensedAgentCount =
        licensedDownlines.length + (isOwnerLicensed ? 1 : 0);
      const avgPremiumPerAgent =
        licensedAgentCount > 0 ? teamAPTotal / licensedAgentCount : 0;

      // ==========================================
      // Calculate Health Metrics
      // ==========================================

      // Retention rate: Approved agents / Total agents (including pending)
      const retentionRate =
        allDownlines.length > 0
          ? (downlines.length / allDownlines.length) * 100
          : 0;

      // Recruitment rate: New approved agents this period / total approved agents
      const newAgents = downlines.filter((d) => {
        const createdAt = new Date(d.created_at || "");
        return createdAt >= rangeStart && createdAt <= rangeEnd;
      }).length;
      const recruitmentRate =
        downlines.length > 0 ? (newAgents / downlines.length) * 100 : 0;

      // Average contract level across approved team members
      const contractLevels = downlines
        .filter((d) => d.contract_level != null)
        .map((d) => d.contract_level as number);
      const avgContractLevel =
        contractLevels.length > 0
          ? contractLevels.reduce((sum, lvl) => sum + lvl, 0) /
            contractLevels.length
          : 0;

      // Calculate RELATIVE max depth from user's position
      const myDepth = myProfile.hierarchy_depth || 0;
      const maxDownlineDepth =
        downlines.length > 0
          ? Math.max(...downlines.map((d) => d.hierarchy_depth || 0))
          : myDepth;
      const relativeMaxDepth = maxDownlineDepth - myDepth;

      // ==========================================
      // Calculate Team Pace Metrics (AP-based)
      // ==========================================

      // Fetch targets for all team members
      const [downlineTargets, myTargets] = await Promise.all([
        userTargetsRepository.findDownlineWithOwner(),
        userTargetsRepository.findByUserId(myProfile.id),
      ]);

      // Calculate AP targets for each team member
      const calcAPTargets = (
        t: { annualPoliciesTarget?: number; avgPremiumTarget?: number } | null,
      ): { monthly: number; yearly: number } => {
        if (!t) return { monthly: 0, yearly: 0 };
        const yearlyAP =
          (t.annualPoliciesTarget || 0) * (t.avgPremiumTarget || 0);
        return { monthly: yearlyAP / 12, yearly: yearlyAP };
      };

      // Sum team AP targets (monthly and yearly)
      const downlineTargetSums = downlineTargets.reduce(
        (acc, t) => {
          const targets = calcAPTargets({
            annualPoliciesTarget: t.annualPoliciesTarget,
            avgPremiumTarget: t.avgPremiumTarget,
          });
          return {
            monthly: acc.monthly + targets.monthly,
            yearly: acc.yearly + targets.yearly,
          };
        },
        { monthly: 0, yearly: 0 },
      );

      const myAPTargets = calcAPTargets({
        annualPoliciesTarget: myTargets?.annualPoliciesTarget,
        avgPremiumTarget: myTargets?.avgPremiumTarget,
      });

      const teamMonthlyAPTarget =
        myAPTargets.monthly + downlineTargetSums.monthly;
      const teamYearlyAPTarget = myAPTargets.yearly + downlineTargetSums.yearly;

      // ==========================================
      // Calculate YTD AP for yearly pace (all submissions, any status)
      // ==========================================
      let teamYTDAPTotal = 0;
      const ytdStartStr = `${now.getFullYear()}-01-01`;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Use pre-grouped policies (O(1) lookup)
      for (const userId of allTeamUserIds) {
        const policies = policiesByUserId.get(userId) || [];

        // YTD: ALL policies with submit_date in year range (any status)
        const ytdPolicies = policies.filter((p) => {
          if (!p.submit_date) return false;
          return p.submit_date >= ytdStartStr && p.submit_date <= todayStr;
        });

        const ytdAP = ytdPolicies.reduce((sum, p) => {
          const val = parseFloat(String(p.annual_premium ?? 0));
          return sum + (isNaN(val) ? 0 : val);
        }, 0);

        teamYTDAPTotal += ytdAP;
      }

      // ==========================================
      // Calculate FIXED MTD AP for monthly pace (not affected by selected time period)
      // All submissions for current month by submit_date (any status)
      // ==========================================
      let fixedMonthlyAPTotal = 0;
      const pad = (n: number) => String(n).padStart(2, "0");
      const fixedMtdStartStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

      for (const userId of allTeamUserIds) {
        const policies = policiesByUserId.get(userId) || [];

        // MTD: ALL policies with submit_date in current month (any status)
        const mtdPolicies = policies.filter((p) => {
          if (!p.submit_date) return false;
          return p.submit_date >= fixedMtdStartStr && p.submit_date <= todayStr;
        });

        fixedMonthlyAPTotal += mtdPolicies.reduce((sum, p) => {
          const val = parseFloat(String(p.annual_premium ?? 0));
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }

      // ==========================================
      // Monthly Pace Calculations
      // Formula: Total AP MTD / day of month × days in month
      // ==========================================
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      const dayOfMonth = now.getDate();
      const expectedMonthlyAPAtThisPoint =
        (dayOfMonth / daysInMonth) * teamMonthlyAPTarget;

      // Monthly pace: all submissions for current month
      const teamMonthlyAPForPace = fixedMonthlyAPTotal;
      const teamMonthlyPacePercentage =
        expectedMonthlyAPAtThisPoint > 0
          ? (teamMonthlyAPForPace / expectedMonthlyAPAtThisPoint) * 100
          : teamMonthlyAPTarget > 0
            ? 0
            : 100;

      const teamMonthlyPaceStatus: "ahead" | "on_pace" | "behind" =
        teamMonthlyPacePercentage >= 105
          ? "ahead"
          : teamMonthlyPacePercentage >= 95
            ? "on_pace"
            : "behind";

      // Projected month-end AP: Total AP MTD / day of month × days in month
      const teamMonthlyProjected =
        dayOfMonth > 0 ? (teamMonthlyAPForPace / dayOfMonth) * daysInMonth : 0;

      // ==========================================
      // Yearly Pace Calculations
      // Formula: Total AP YTD / day of year × days in year
      // ==========================================
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const dayOfYear =
        Math.floor(
          (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
      const daysInYear =
        (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) ||
        now.getFullYear() % 400 === 0
          ? 366
          : 365;

      const expectedYearlyAPAtThisPoint =
        (dayOfYear / daysInYear) * teamYearlyAPTarget;

      // Yearly pace: all submissions YTD (no separate pending addition)
      const teamYearlyAPForPace = teamYTDAPTotal;
      const teamYearlyPacePercentage =
        expectedYearlyAPAtThisPoint > 0
          ? (teamYearlyAPForPace / expectedYearlyAPAtThisPoint) * 100
          : teamYearlyAPTarget > 0
            ? 0
            : 100;

      const teamYearlyPaceStatus: "ahead" | "on_pace" | "behind" =
        teamYearlyPacePercentage >= 105
          ? "ahead"
          : teamYearlyPacePercentage >= 95
            ? "on_pace"
            : "behind";

      // Projected year-end AP: Total AP YTD / day of year × days in year
      const teamYearlyProjected =
        dayOfYear > 0 ? (teamYearlyAPForPace / dayOfYear) * daysInYear : 0;

      const result: HierarchyStats = {
        // Agent counts - ALL approved agents (not archived)
        total_agents: downlines.length + 1, // approved downlines + self
        total_downlines: downlines.length, // approved downlines only
        direct_downlines: directDownlines.length, // approved direct reports only
        max_depth: relativeMaxDepth,

        // Override income
        total_override_income_mtd: mtdIncome,
        total_override_income_ytd: ytdIncome,

        // Team performance
        team_ap_total: teamAPTotal, // All submissions (any status)
        team_ip_total: teamIPTotal, // Only active/issued policies
        team_policies_count: teamPoliciesCount,
        avg_premium_per_agent: avgPremiumPerAgent,

        // Top performer
        top_performer_id: topPerformer?.id || null,
        top_performer_name: topPerformer?.name || null,
        top_performer_ap: topPerformer?.ap || 0,

        // Health metrics
        recruitment_rate: recruitmentRate,
        retention_rate: retentionRate,
        avg_contract_level: avgContractLevel,
        pending_invitations: pendingInvitations || 0,

        // Pending AP Submission
        team_pending_ap_total: teamPendingAPTotal,
        team_pending_policies_count: teamPendingPoliciesCount,

        // Team Pace - Monthly
        team_monthly_ap_target: teamMonthlyAPTarget,
        team_fixed_monthly_ap: fixedMonthlyAPTotal,
        team_monthly_pace_percentage: teamMonthlyPacePercentage,
        team_monthly_pace_status: teamMonthlyPaceStatus,
        team_monthly_projected: teamMonthlyProjected,

        // Team Pace - Yearly
        team_yearly_ap_target: teamYearlyAPTarget,
        team_ytd_ap_total: teamYTDAPTotal,
        team_yearly_pace_percentage: teamYearlyPacePercentage,
        team_yearly_pace_status: teamYearlyPaceStatus,
        team_yearly_projected: teamYearlyProjected,
      };

      return result;
    } catch (error) {
      logger.error(
        "HierarchyService.getMyHierarchyStats",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get comprehensive details for a specific agent
   * Only returns data if caller is admin, self, or upline of the agent
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hierarchy node can have various shapes
  async getAgentDetails(agentId: string): Promise<any> {
    try {
      // Validate agentId
      if (!agentId) {
        logger.error(
          "HierarchyService.getAgentDetails",
          new Error("AgentId is required"),
        );
        throw new ValidationError("AgentId is required", [
          { field: "agentId", message: "Required", value: agentId },
        ]);
      }

      // Check permission - only admin, self, or upline can view agent details
      const { data: canView, error: permError } = await supabase.rpc(
        "can_view_agent_details",
        { p_agent_id: agentId },
      );

      if (permError) {
        logger.error(
          "HierarchyService.getAgentDetails permission check failed",
          permError,
        );
        throw new Error("Permission check failed");
      }

      if (!canView) {
        logger.warn(
          "Unauthorized attempt to view agent details",
          { agentId },
          "HierarchyService",
        );
        throw new ValidationError(
          "You can only view details for your downline agents",
          [{ field: "agentId", message: "Not authorized", value: agentId }],
        );
      }

      // Get agent profile
      const agent = await this.hierarchyRepo.findById(agentId);
      if (!agent) {
        logger.warn("Agent not found", { agentId }, "HierarchyService");
        throw new NotFoundError("Agent", agentId);
      }

      // Get performance metrics
      const policies = await this.policyRepo.findWithRelationsByUserId(
        agent.id,
      );

      const policyMetrics = policies.reduce(
        (acc, policy) => {
          acc.totalPolicies++;
          // Use lifecycle_status for active policy counting (issued, in-force policies)
          if (policy.lifecycle_status === "active") {
            acc.activePolicies++;
            const premVal = parseFloat(String(policy.annual_premium ?? 0));
            acc.totalPremium += isNaN(premVal) ? 0 : premVal;
          }
          return acc;
        },
        { totalPolicies: 0, activePolicies: 0, totalPremium: 0 },
      );

      // Get recent activity
      const recentPolicies = await this.policyRepo.findRecentByUserId(
        agent.id,
        5,
      );

      const recentActivity = recentPolicies.map((p) => ({
        type: "policy",
        title: `New ${p.product || "Unknown"} policy`,
        description: `Policy #${p.policyNumber || "N/A"} - ${p.carrierId || "Unknown"}`,
        timestamp: p.createdAt || new Date().toISOString(),
      }));

      // Get upline info
      let uplineEmail = null;
      if (agent.upline_id) {
        const upline = await this.hierarchyRepo.findById(agent.upline_id);
        uplineEmail = upline?.email;
      }

      // Calculate performance score (simple example)
      const persistencyRate =
        policyMetrics.totalPolicies > 0
          ? (policyMetrics.activePolicies / policyMetrics.totalPolicies) * 100
          : 0;
      const performanceScore = Math.min(100, Math.round(persistencyRate * 1.1));

      return {
        ...agent,
        totalPolicies: policyMetrics.totalPolicies,
        activePolicies: policyMetrics.activePolicies,
        totalPremium: policyMetrics.totalPremium,
        avgPremium:
          policyMetrics.activePolicies > 0
            ? policyMetrics.totalPremium / policyMetrics.activePolicies
            : 0,
        persistencyRate,
        performanceScore,
        uplineEmail,
        recentActivity,
        joinDate: agent.created_at || new Date().toISOString(),
        isActive: true,
        overridesGenerated: 0, // Will be calculated from override_commissions
      };
    } catch (error) {
      logger.error(
        "HierarchyService.getAgentDetails",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get all policies for a specific agent
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase response type
  async getAgentPolicies(agentId: string): Promise<any> {
    try {
      const policies = await this.policyRepo.findWithRelationsByUserId(agentId);

      // Use lifecycle_status for active policy counting (issued, in-force policies)
      const active = policies.filter(
        (p) => p.lifecycle_status === "active",
      ).length;
      const total = policies.length;

      return {
        total,
        active,
        policies: policies.map((p) => ({
          id: p.id,
          policyNumber: p.policy_number,
          clientName: p.client?.name || "Unknown",
          product: p.product,
          carrier: p.carrier?.name || p.carrier_id,
          annualPremium: p.annual_premium,
          status: p.status,
          lifecycleStatus: p.lifecycle_status,
          createdAt: p.created_at || new Date().toISOString(),
          submitDate: p.submit_date || p.created_at || new Date().toISOString(),
          effectiveDate: p.effective_date,
          issueDate:
            p.effective_date || p.created_at || new Date().toISOString(),
        })),
      };
    } catch (error) {
      logger.error(
        "HierarchyService.getAgentPolicies",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get commission data for a specific agent
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase response type
  async getAgentCommissions(agentId: string): Promise<any> {
    try {
      const commissions =
        await this.commissionRepo.findWithPolicyByUserId(agentId);

      const enrichedCommissions = commissions.map((commission) => {
        const policy = Array.isArray(commission.policy)
          ? (commission.policy[0] ?? null)
          : commission.policy;
        const amount = parseFloat(String(commission.amount) || "0");
        const chargebackAmount = parseFloat(
          String(commission.chargeback_amount) || "0",
        );
        const advanceMonths = commission.advance_months || 9;

        const earnedBreakdown = calculateCommissionProgress({
          amount,
          advanceMonths: commission.advance_months,
          fallbackMonthsPaid: commission.months_paid || 0,
          effectiveDate: policy?.effective_date || null,
          lifecycleStatus: policy?.lifecycle_status || null,
          cancellationDate: policy?.cancellation_date || null,
        });

        return {
          id: commission.id,
          date: commission.created_at || new Date().toISOString(),
          policyNumber: policy?.policy_number || "N/A",
          type: commission.type,
          amount,
          earnedAmount: earnedBreakdown.earnedAmount,
          unearnedAmount: earnedBreakdown.unearnedAmount,
          monthsPaid: earnedBreakdown.monthsPaid,
          advanceMonths,
          chargebackAmount,
          status: commission.status || "pending",
        };
      });

      const metrics = enrichedCommissions.reduce(
        (acc, commission) => {
          acc.totalEarned += commission.earnedAmount;
          acc.totalUnearned += commission.unearnedAmount;
          if (commission.status === "pending") acc.pending += commission.amount;
          if (commission.status === "paid") acc.paid += commission.amount;
          if ((commission.advanceMonths || 0) > 0) {
            acc.advances += commission.amount;
          }
          acc.chargebacks += commission.chargebackAmount;
          return acc;
        },
        {
          totalEarned: 0,
          pending: 0,
          paid: 0,
          advances: 0,
          chargebacks: 0,
          totalUnearned: 0,
        },
      );

      return {
        totalEarned: metrics.totalEarned,
        pending: metrics.pending,
        paid: metrics.paid,
        advances: metrics.advances,
        chargebacks: metrics.chargebacks,
        unearned: Math.max(
          0,
          Math.max(
            metrics.totalUnearned,
            metrics.advances - metrics.totalEarned,
          ),
        ),
        recent: enrichedCommissions,
      };
    } catch (error) {
      logger.error(
        "HierarchyService.getAgentCommissions",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get override commission data for a specific agent
   * Returns both: agent's override earnings from downlines AND viewer's overrides from this agent
   * @param agentId - The agent to get override data for
   * @param viewerId - Optional viewer ID to get their overrides from this agent
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase response type
  async getAgentOverrides(agentId: string, viewerId?: string): Promise<any> {
    try {
      const now = new Date();
      const mtdStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString();

      // Build parallel queries. Earned/paid totals use the existing methods
      // (which require a paid base commission). Pending totals use the new
      // pending methods (which only require an active policy) so unpaid-but-
      // computed override income is still visible on dashboards.
      const hasViewer = !!viewerId && viewerId !== agentId;

      const queries: Promise<
        { override_commission_amount: number | string | null }[]
      >[] = [
        // [0,1] Agent's earned/paid earnings from their downlines
        this.overrideRepo.findByOverrideAgentIdInRange(agentId, mtdStart),
        this.overrideRepo.findByOverrideAgentIdInRange(agentId, ytdStart),
        // [2,3] Agent's PENDING earnings from their downlines
        this.overrideRepo.findPendingByOverrideAgentInRange(agentId, mtdStart),
        this.overrideRepo.findPendingByOverrideAgentInRange(agentId, ytdStart),
      ];

      if (hasViewer) {
        queries.push(
          // [4,5] Viewer's earned overrides from this agent
          this.overrideRepo.findByOverrideAndBaseAgentInRange(
            viewerId!,
            agentId,
            mtdStart,
          ),
          this.overrideRepo.findByOverrideAndBaseAgentInRange(
            viewerId!,
            agentId,
            ytdStart,
          ),
          // [6,7] Viewer's PENDING overrides from this agent
          this.overrideRepo.findPendingByOverrideAndBaseAgent(
            viewerId!,
            agentId,
            mtdStart,
          ),
          this.overrideRepo.findPendingByOverrideAndBaseAgent(
            viewerId!,
            agentId,
            ytdStart,
          ),
        );
      }

      const results = await Promise.all(queries);

      const sumOverrides = (
        arr: { override_commission_amount: number | string | null }[],
      ) =>
        arr.reduce(
          (sum, o) =>
            sum + parseFloat(String(o.override_commission_amount) || "0"),
          0,
        );

      const agentEarnings = {
        mtd: sumOverrides(results[0]),
        ytd: sumOverrides(results[1]),
        mtdPending: sumOverrides(results[2]),
        ytdPending: sumOverrides(results[3]),
      };

      const viewerEarningsFromAgent = hasViewer
        ? {
            mtd: sumOverrides(results[4]),
            ytd: sumOverrides(results[5]),
            mtdPending: sumOverrides(results[6]),
            ytdPending: sumOverrides(results[7]),
          }
        : { mtd: 0, ytd: 0, mtdPending: 0, ytdPending: 0 };

      return {
        agentEarnings,
        viewerEarningsFromAgent,
        // Legacy fields preserved for any callers that still read them
        mtd: agentEarnings.mtd,
        ytd: agentEarnings.ytd,
      };
    } catch (error) {
      logger.error(
        "HierarchyService.getAgentOverrides",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get override amount the viewer earns from agent(s) (for team table)
   * @param viewerId - The logged-in user viewing the team table
   * @param baseAgentIds - Single agent ID or array of agent IDs
   * @param options - Optional date range (inclusive, YYYY-MM-DD or ISO)
   * @returns For single ID: { mtd: number }, for array: Map<agentId, mtdAmount>
   */
  async getViewerOverridesFromAgent(
    viewerId: string,
    baseAgentIds: string | string[],
    options?: { startDate?: string; endDate?: string },
  ): Promise<{ mtd: number } | Map<string, number>> {
    const ids = Array.isArray(baseAgentIds) ? baseAgentIds : [baseAgentIds];
    const isBatch = Array.isArray(baseAgentIds);

    if (ids.length === 0) {
      return isBatch ? new Map() : { mtd: 0 };
    }

    try {
      const now = new Date();
      const defaultMtdStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const startDate = options?.startDate ?? defaultMtdStart;
      const endDate = options?.endDate;

      const overrides =
        await this.overrideRepo.findByOverrideAndBaseAgentInRange(
          viewerId,
          ids,
          startDate,
          endDate,
        );

      // Group by base_agent_id and sum
      const mtdByAgent = new Map<string, number>();
      for (const o of overrides) {
        const agentId = o.base_agent_id;
        const current = mtdByAgent.get(agentId) || 0;
        mtdByAgent.set(
          agentId,
          current + parseFloat(String(o.override_commission_amount) || "0"),
        );
      }

      // Return format based on input type (backward compatible)
      if (!isBatch) {
        return { mtd: mtdByAgent.get(ids[0]) || 0 };
      }
      return mtdByAgent;
    } catch (error) {
      logger.error(
        "HierarchyService.getViewerOverridesFromAgent",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get an agent's direct team (their downlines) with metrics
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase response type
  async getAgentTeam(agentId: string): Promise<any> {
    try {
      // Get direct downlines
      const directReports =
        await this.hierarchyRepo.findDirectReportsByUplineId(agentId);

      if (directReports.length === 0) {
        return {
          directReports: [],
          totalMembers: 0,
          totalPremium: 0,
          totalPolicies: 0,
        };
      }

      const reportIds = directReports.map((r) => r.id);

      // Batch fetch policies and commissions for all direct reports
      const [policies, commissions] = await Promise.all([
        this.policyRepo.findMetricsByUserIds(reportIds),
        this.commissionRepo.findMetricsByUserIds(reportIds),
      ]);

      // Aggregate metrics per team member
      const teamMembers = directReports.map((member) => {
        const memberPolicies = policies.filter((p) => p.user_id === member.id);
        // Use lifecycle_status for active policy filtering (issued, in-force policies)
        const activePolicies = memberPolicies.filter(
          (p) => p.lifecycle_status === "active",
        );
        const totalPremium = activePolicies.reduce(
          (sum, p) => sum + parseFloat(String(p.annual_premium) || "0"),
          0,
        );

        const memberCommissions = commissions.filter(
          (c) => c.user_id === member.id,
        );
        const totalCommissions = memberCommissions.reduce(
          (sum, c) => sum + parseFloat(String(c.amount) || "0"),
          0,
        );

        return {
          id: member.id,
          email: member.email,
          name:
            member.first_name && member.last_name
              ? `${member.first_name} ${member.last_name}`
              : member.email,
          contractLevel: member.contract_level || 100,
          policies: activePolicies.length,
          premium: totalPremium,
          commissions: totalCommissions,
        };
      });

      // Calculate totals
      const totalPremium = teamMembers.reduce((sum, m) => sum + m.premium, 0);
      const totalPolicies = teamMembers.reduce((sum, m) => sum + m.policies, 0);

      return {
        directReports: teamMembers,
        totalMembers: teamMembers.length,
        totalPremium,
        totalPolicies,
      };
    } catch (error) {
      logger.error(
        "HierarchyService.getAgentTeam",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * @deprecated Use getAgentTeam instead
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTeamComparison(agentId: string): Promise<any> {
    return this.getAgentTeam(agentId);
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  /**
   * Aggregate override amounts by agent ID
   */
  private aggregateOverridesByAgent(
    overrides: OverrideMetricRow[],
  ): Record<string, number> {
    return overrides.reduce(
      (acc, o) => {
        const agentId = o.base_agent_id;
        const amount = parseFloat(String(o.override_commission_amount) || "0");
        acc[agentId] = (acc[agentId] || 0) + amount;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Calculate policy metrics from policy rows
   * Uses lifecycle_status for active/lapsed/cancelled counts (lifecycle states)
   */
  private calculatePolicyMetrics(policies: PolicyMetricRow[]): {
    total: number;
    active: number;
    lapsed: number;
    cancelled: number;
    totalPremium: number;
  } {
    return policies.reduce(
      (acc, policy) => {
        acc.total++;
        // Use lifecycle_status for lifecycle states (active, lapsed, cancelled)
        if (policy.lifecycle_status === "active") acc.active++;
        if (policy.lifecycle_status === "lapsed") acc.lapsed++;
        if (policy.lifecycle_status === "cancelled") acc.cancelled++;
        const premVal = parseFloat(String(policy.annual_premium ?? 0));
        acc.totalPremium += isNaN(premVal) ? 0 : premVal;
        return acc;
      },
      { total: 0, active: 0, lapsed: 0, cancelled: 0, totalPremium: 0 },
    );
  }

  /**
   * Calculate commission metrics from commission rows
   */
  private calculateCommissionMetrics(commissions: CommissionMetricRow[]): {
    total: number;
    earned: number;
    paid: number;
  } {
    return commissions.reduce(
      (acc, comm) => {
        const policy = Array.isArray(comm.policy)
          ? (comm.policy[0] ?? null)
          : comm.policy;
        const amount = parseFloat(String(comm.amount) || "0");
        const progress = calculateCommissionProgress({
          amount,
          advanceMonths: comm.advance_months,
          fallbackMonthsPaid: comm.months_paid,
          effectiveDate: policy?.effective_date || null,
          lifecycleStatus: policy?.lifecycle_status || null,
          cancellationDate: policy?.cancellation_date || null,
        });
        acc.total += amount;
        acc.earned += progress.earnedAmount;
        if (comm.status === "paid") acc.paid += amount;
        return acc;
      },
      { total: 0, earned: 0, paid: 0 },
    );
  }

  /**
   * Calculate override metrics from override rows
   */
  private calculateOverrideMetrics(overrides: OverrideMetricRow[]): {
    total: number;
    pending: number;
    earned: number;
    paid: number;
  } {
    return overrides.reduce(
      (acc, override) => {
        const amount = parseFloat(
          String(override.override_commission_amount) || "0",
        );
        acc.total += amount;
        if (override.status === "pending") acc.pending += amount;
        if (override.status === "earned") acc.earned += amount;
        if (override.status === "paid") acc.paid += amount;
        return acc;
      },
      { total: 0, pending: 0, earned: 0, paid: 0 },
    );
  }

  /**
   * Build tree structure from flat list of profiles
   */
  private buildTree(
    profiles: UserProfile[],
    rootId: string,
    overridesByAgent?: Record<string, number>,
  ): HierarchyNode[] {
    const nodeMap = new Map<string, HierarchyNode>();

    // Create nodes
    profiles.forEach((profile) => {
      nodeMap.set(profile.id, {
        ...profile,
        children: [],
        downline_count: 0,
        direct_downline_count: 0,
        override_earnings: overridesByAgent?.[profile.id] || 0,
      });
    });

    // Build parent-child relationships
    const roots: HierarchyNode[] = [];

    nodeMap.forEach((node) => {
      if (node.upline_id === null || node.id === rootId) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(node.upline_id);
        if (parent) {
          parent.children.push(node);
          parent.direct_downline_count++;
        }
      }
    });

    // Calculate total downline counts (recursive)
    const calculateDownlineCounts = (node: HierarchyNode): number => {
      let count = node.children.length;
      node.children.forEach((child) => {
        count += calculateDownlineCounts(child);
      });
      node.downline_count = count;
      return count;
    };

    roots.forEach(calculateDownlineCounts);

    return roots;
  }
}

// Export singleton instance
export const hierarchyService = new HierarchyService();

// Export class for testing
export { HierarchyService };
