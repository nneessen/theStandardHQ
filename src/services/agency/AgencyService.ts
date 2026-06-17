// src/services/agency/AgencyService.ts
// Business logic for Agency operations

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import { AgencyRepository } from "./AgencyRepository";
import type {
  Agency,
  AgencyRow,
  CreateAgencyData,
  AgencyUpdate,
  AgencyMetrics,
  AgencyDashboardMetrics,
  AgencyProductionByAgent,
  AgencyOverrideSummary,
  OverrideByAgent,
  AgencyRecruitingSummary,
  RecruitingByRecruiter,
  CascadeAssignmentResult,
  CascadePreview,
  CreateAgencyWithCascadeOptions,
  CreateAgencyWithCascadeResult,
} from "../../types/imo.types";
import { IMO_ROLES } from "../../types/imo.types";
import {
  parseAgencyDashboardMetrics,
  parseAgencyProductionByAgent,
  parseAgencyOverrideSummary,
  parseOverrideByAgent,
  parseAgencyRecruitingSummary,
  parseRecruitingByRecruiter,
  isAccessDeniedError,
  isInvalidParameterError,
  isNotFoundError,
  isFunctionNotFoundError,
} from "../../types/dashboard-metrics.schemas";
import {
  parseAgencyPerformanceReport,
  parseAgencyWeeklyProduction,
  formatDateForQuery,
  validateReportDateRange,
  buildDateRangeParams,
  type AgencyPerformanceReport,
  type AgencyWeeklyReport,
  type ReportDateRange,
} from "../../types/team-reports.schemas";

/**
 * Service layer for Agency operations
 * Handles all Agency-related business logic
 */
class AgencyService {
  private repo: AgencyRepository;

  constructor() {
    this.repo = new AgencyRepository();
  }

  /**
   * Get the current user's agency
   * @deprecated Use getMyAgencyForUser(userId) instead to avoid redundant auth calls
   */
  async getMyAgency(): Promise<Agency | null> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        logger.warn("No authenticated user", {}, "AgencyService");
        return null;
      }

      return this.getMyAgencyForUser(user.id);
    } catch (error) {
      logger.error(
        "Failed to get user agency",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get the agency for a specific user by their userId
   * Preferred over getMyAgency() when userId is already available from AuthContext
   */
  async getMyAgencyForUser(userId: string): Promise<Agency | null> {
    try {
      // Get user's agency_id
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("agency_id")
        .eq("id", userId)
        .single();

      if (profileError || !profile?.agency_id) {
        logger.warn("User has no agency", { userId }, "AgencyService");
        return null;
      }

      // Get agency with owner
      return this.repo.findWithOwner(profile.agency_id);
    } catch (error) {
      logger.error(
        "Failed to get user agency",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get an agency by ID
   */
  async getAgency(agencyId: string): Promise<AgencyRow | null> {
    return this.repo.findById(agencyId);
  }

  /**
   * Get an agency with owner info
   */
  async getAgencyWithOwner(agencyId: string): Promise<Agency | null> {
    return this.repo.findWithOwner(agencyId);
  }

  /**
   * Get all agencies in the current user's IMO
   */
  async getAgenciesInMyImo(): Promise<Agency[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return [];
      }

      // Get user's imo_id
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("imo_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.imo_id) {
        return [];
      }

      return this.repo.findByImo(profile.imo_id);
    } catch (error) {
      logger.error(
        "Failed to get agencies in IMO",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get all agencies in a specific IMO
   */
  async getAgenciesByImo(imoId: string): Promise<Agency[]> {
    return this.repo.findByImo(imoId);
  }

  /**
   * Get all active agencies across all IMOs (super admin only)
   */
  async getAllActiveAgencies(): Promise<Agency[]> {
    return this.repo.findAllActive();
  }

  /**
   * Get agencies owned by current user
   */
  async getMyOwnedAgencies(): Promise<AgencyRow[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return [];
      }

      return this.repo.findByOwner(user.id);
    } catch (error) {
      logger.error(
        "Failed to get owned agencies",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Create a new agency
   */
  async createAgency(data: CreateAgencyData): Promise<AgencyRow> {
    try {
      // Check if code is available in the IMO
      const isAvailable = await this.repo.isCodeAvailable(
        data.imo_id,
        data.code,
      );
      if (!isAvailable) {
        throw new Error(
          `Agency code "${data.code}" is already in use in this IMO`,
        );
      }

      logger.info(
        "Creating new agency",
        { imoId: data.imo_id, code: data.code },
        "AgencyService",
      );

      const agency = await this.repo.create({
        ...data,
        is_active: true,
      });

      // Emit agency.created (non-fatal). recipientId = the designated owner (if any).
      // Request-driven creation flows through approve_agency_request instead, so this
      // covers direct/manual creation only (see agency_request.approved for the other).
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.AGENCY_CREATED, {
        recipientId:
          (data as { owner_id?: string | null }).owner_id ?? undefined,
        agencyId: agency.id,
        agencyName: agency.name,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        "Agency created successfully",
        { id: agency.id, code: agency.code },
        "AgencyService",
      );

      return agency;
    } catch (error) {
      logger.error(
        "Failed to create agency",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Preview cascade assignment - returns count of users that would be affected
   * without making any changes. Useful for confirmation UI.
   */
  async previewCascadeAssignment(ownerId: string): Promise<CascadePreview> {
    try {
      // Get owner info
      const { data: owner, error: ownerError } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, hierarchy_path")
        .eq("id", ownerId)
        .single();

      if (ownerError || !owner) {
        throw new Error("Owner not found");
      }

      const ownerName =
        `${owner.first_name || ""} ${owner.last_name || ""}`.trim() ||
        "Unknown";

      // If owner has no hierarchy_path, just count themselves
      if (!owner.hierarchy_path) {
        return { ownerName, downlineCount: 0, totalCount: 1 };
      }

      // Count downlines using same pattern as the RPC
      const { count, error: countError } = await supabase
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .like("hierarchy_path", `${owner.hierarchy_path}.%`);

      if (countError) {
        throw countError;
      }

      return {
        ownerName,
        downlineCount: count || 0,
        totalCount: (count || 0) + 1, // +1 for owner
      };
    } catch (error) {
      logger.error(
        "Failed to preview cascade assignment",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Creates an agency with optional cascade assignment of owner's downline.
   * When cascadeDownlines is true, the owner and all users in their hierarchy
   * will be assigned to the new agency.
   */
  async createAgencyWithCascade(
    data: CreateAgencyData,
    options: CreateAgencyWithCascadeOptions = {},
  ): Promise<CreateAgencyWithCascadeResult> {
    const { cascadeDownlines = false } = options;

    try {
      // Step 1: Create the agency (existing logic)
      const agency = await this.createAgency(data);

      // Step 2: If owner specified and cascade enabled, run cascade assignment
      if (data.owner_id && cascadeDownlines) {
        const { data: result, error } = await supabase.rpc(
          "cascade_agency_assignment",
          {
            p_agency_id: agency.id,
            p_owner_id: data.owner_id,
            p_imo_id: data.imo_id,
          },
        );

        if (error) {
          // Log error but don't fail - agency was created successfully
          logger.error(
            "Cascade assignment failed after agency creation",
            error,
            "AgencyService",
          );
          return {
            agency,
            cascadeResult: {
              success: false,
              ownerUpdated: false,
              downlinesUpdated: 0,
              totalUpdated: 0,
              error: error.message,
            },
          };
        }

        // Parse RPC result (returns JSONB)
        const rpcResult = result as {
          success: boolean;
          owner_updated?: boolean;
          downlines_updated?: number;
          total_updated?: number;
          owner_name?: string;
          owner_hierarchy_path?: string;
          error?: string;
          error_detail?: string;
        };

        const cascadeResult: CascadeAssignmentResult = {
          success: rpcResult.success,
          ownerUpdated: rpcResult.owner_updated ?? false,
          downlinesUpdated: rpcResult.downlines_updated ?? 0,
          totalUpdated: rpcResult.total_updated ?? 0,
          ownerName: rpcResult.owner_name,
          ownerHierarchyPath: rpcResult.owner_hierarchy_path,
          error: rpcResult.error,
          errorDetail: rpcResult.error_detail,
        };

        logger.info(
          "Agency created with cascade assignment",
          {
            agencyId: agency.id,
            ownerId: data.owner_id,
            totalUsersAssigned: cascadeResult.totalUpdated,
          },
          "AgencyService",
        );

        return { agency, cascadeResult };
      }

      // No cascade - just return the agency
      return { agency };
    } catch (error) {
      logger.error(
        "Failed to create agency with cascade",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Update an agency
   */
  async updateAgency(agencyId: string, data: AgencyUpdate): Promise<AgencyRow> {
    try {
      // Get existing agency for imo_id
      const existing = await this.repo.findById(agencyId);
      if (!existing) {
        throw new Error("Agency not found");
      }

      // If updating code, check availability
      if (data.code && data.code !== existing.code) {
        const isAvailable = await this.repo.isCodeAvailable(
          existing.imo_id,
          data.code,
          agencyId,
        );
        if (!isAvailable) {
          throw new Error(
            `Agency code "${data.code}" is already in use in this IMO`,
          );
        }
      }

      logger.info("Updating agency", { id: agencyId }, "AgencyService");

      const agency = await this.repo.update(agencyId, data);

      logger.info(
        "Agency updated successfully",
        { id: agency.id },
        "AgencyService",
      );

      return agency;
    } catch (error) {
      logger.error(
        "Failed to update agency",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Delete an agency permanently
   */
  async deleteAgency(agencyId: string): Promise<void> {
    try {
      // Check if agency has any agents
      const { count: agentCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId);

      if (agentCount && agentCount > 0) {
        throw new Error(
          `Cannot delete agency with ${agentCount} agent(s). Reassign or remove agents first.`,
        );
      }

      logger.info("Deleting agency", { agencyId }, "AgencyService");

      await this.repo.delete(agencyId);

      logger.info("Agency deleted successfully", { agencyId }, "AgencyService");
    } catch (error) {
      logger.error(
        "Failed to delete agency",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Deactivate an agency (soft delete)
   */
  async deactivateAgency(agencyId: string): Promise<AgencyRow> {
    try {
      logger.info("Deactivating agency", { id: agencyId }, "AgencyService");

      const agency = await this.repo.update(agencyId, { is_active: false });

      logger.info("Agency deactivated", { id: agency.id }, "AgencyService");

      return agency;
    } catch (error) {
      logger.error(
        "Failed to deactivate agency",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Assign a user to an agency
   * Authorization: Caller must be super admin, IMO admin of the target agency's IMO, or agency owner
   */
  async assignAgentToAgency(agentId: string, agencyId: string): Promise<void> {
    try {
      // Get current user for authorization check
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        throw new Error("Authentication required");
      }

      // Verify agency exists
      const agency = await this.repo.findById(agencyId);
      if (!agency) {
        throw new Error("Agency not found");
      }

      // Get current user's profile for authorization
      const { data: callerProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("imo_id, roles, is_super_admin")
        .eq("id", currentUser.id)
        .single();

      if (profileError || !callerProfile) {
        throw new Error("Failed to verify authorization");
      }

      // Authorization check:
      // 1. Super admin can assign anyone to any agency
      // 2. IMO admin can assign users to agencies within their IMO
      // 3. Agency owner can assign users to their own agency
      const isSuperAdmin = callerProfile.is_super_admin === true;
      const isImoAdmin =
        callerProfile.imo_id === agency.imo_id &&
        (callerProfile.roles?.includes(IMO_ROLES.IMO_OWNER) ||
          callerProfile.roles?.includes(IMO_ROLES.IMO_ADMIN));
      const isAgencyOwner = agency.owner_id === currentUser.id;

      if (!isSuperAdmin && !isImoAdmin && !isAgencyOwner) {
        logger.warn(
          "Unauthorized agency assignment attempt",
          { callerId: currentUser.id, agentId, agencyId },
          "AgencyService",
        );
        throw new Error("Not authorized to assign users to this agency");
      }

      // Update user's agency_id and imo_id
      const { error } = await supabase
        .from("user_profiles")
        .update({ agency_id: agencyId, imo_id: agency.imo_id })
        .eq("id", agentId);

      if (error) {
        throw error;
      }

      logger.info(
        "Agent assigned to agency",
        { agentId, agencyId, authorizedBy: currentUser.id },
        "AgencyService",
      );
    } catch (error) {
      logger.error(
        "Failed to assign agent to agency",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Transfer agency ownership
   */
  async transferOwnership(
    agencyId: string,
    newOwnerId: string,
  ): Promise<AgencyRow> {
    try {
      // Verify new owner exists and is in the same IMO
      const agency = await this.repo.findById(agencyId);
      if (!agency) {
        throw new Error("Agency not found");
      }

      const { data: newOwner, error: ownerError } = await supabase
        .from("user_profiles")
        .select("id, imo_id")
        .eq("id", newOwnerId)
        .single();

      if (ownerError || !newOwner) {
        throw new Error("New owner not found");
      }

      if (newOwner.imo_id !== agency.imo_id) {
        throw new Error("New owner must be in the same IMO");
      }

      logger.info(
        "Transferring agency ownership",
        { agencyId, newOwnerId },
        "AgencyService",
      );

      const updatedAgency = await this.repo.updateOwner(agencyId, newOwnerId);

      // Emit agency.ownership_transferred (non-fatal). recipientId = the NEW owner.
      await workflowEventEmitter.emit(
        WORKFLOW_EVENTS.AGENCY_OWNERSHIP_TRANSFERRED,
        {
          recipientId: newOwnerId,
          previousOwnerId: agency.owner_id ?? undefined,
          agencyId,
          agencyName: updatedAgency.name,
          timestamp: new Date().toISOString(),
        },
      );

      logger.info(
        "Agency ownership transferred",
        { agencyId, newOwnerId },
        "AgencyService",
      );

      return updatedAgency;
    } catch (error) {
      logger.error(
        "Failed to transfer agency ownership",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get agency metrics using RPC for efficient single-query execution
   * This avoids the unbounded IN clause issue with large agencies
   */
  async getAgencyMetrics(agencyId: string): Promise<AgencyMetrics> {
    try {
      const { data, error } = await supabase.rpc("get_agency_metrics", {
        p_agency_id: agencyId,
      });

      if (error) throw error;

      // RPC returns JSON, parse into AgencyMetrics
      const metrics = data as {
        total_agents: number;
        active_agents: number;
        total_policies: number;
        total_premium: number;
        total_commissions: number;
        total_override_commissions: number;
      };

      return {
        total_agents: metrics.total_agents ?? 0,
        active_agents: metrics.active_agents ?? 0,
        total_policies: metrics.total_policies ?? 0,
        total_premium: Number(metrics.total_premium) || 0,
        total_commissions: Number(metrics.total_commissions) || 0,
        total_override_commissions:
          Number(metrics.total_override_commissions) || 0,
      };
    } catch (error) {
      logger.error(
        "Failed to get agency metrics",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Check if current user is an agency owner
   */
  async isCurrentUserAgencyOwner(): Promise<boolean> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return false;
      }

      const agencies = await this.repo.findByOwner(user.id);
      return agencies.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get agency dashboard metrics (aggregated for agency owners)
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   * @param dateRange - Optional date range for filtering policies and commissions
   */
  async getDashboardMetrics(
    agencyId?: string,
    dateRange?: ReportDateRange,
  ): Promise<AgencyDashboardMetrics | null> {
    try {
      // Validate date range if provided (kept for interface compatibility)
      validateReportDateRange(dateRange);

      // Note: get_agency_dashboard_metrics only accepts p_agency_id.
      // It computes YTD internally using date_trunc('year', now()).
      // Do NOT spread dateParams here — the DB function has no date parameters.
      const { data, error } = await supabase.rpc(
        "get_agency_dashboard_metrics",
        {
          p_agency_id: agencyId || null,
        },
      );

      if (error) {
        // Handle access denied and not found gracefully using error codes
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error)
        ) {
          logger.warn(
            "Access denied or invalid params for agency dashboard metrics",
            { agencyId, code: error.code },
            "AgencyService",
          );
          return null;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Validate response with Zod schema
      const validated = parseAgencyDashboardMetrics(data);
      const row = validated[0];

      return {
        agency_id: row.agency_id,
        agency_name: row.agency_name,
        imo_id: row.imo_id,
        active_policies: row.active_policies,
        total_annual_premium: row.total_annual_premium,
        total_commissions_ytd: row.total_commissions_ytd,
        total_earned_ytd: row.total_earned_ytd,
        total_unearned: row.total_unearned,
        agent_count: row.agent_count,
        avg_production_per_agent: row.avg_production_per_agent,
        top_producer_id: row.top_producer_id,
        top_producer_name: row.top_producer_name,
        top_producer_premium: row.top_producer_premium,
      };
    } catch (error) {
      logger.error(
        "Failed to get agency dashboard metrics",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get production breakdown by agent for agency owners
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   */
  async getProductionByAgent(
    agencyId?: string,
  ): Promise<AgencyProductionByAgent[]> {
    try {
      const { data, error } = await supabase.rpc(
        "get_agency_production_by_agent",
        {
          p_agency_id: agencyId || null,
        },
      );

      if (error) {
        // Handle access denied and not found gracefully using error codes
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error)
        ) {
          logger.warn(
            "Access denied or invalid params for agency production by agent",
            { agencyId, code: error.code },
            "AgencyService",
          );
          return [];
        }
        throw error;
      }

      if (!data) {
        return [];
      }

      // Validate response with Zod schema
      const validated = parseAgencyProductionByAgent(data);

      return validated.map((row) => ({
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        agent_email: row.agent_email,
        contract_level: row.contract_level,
        active_policies: row.active_policies,
        total_annual_premium: row.total_annual_premium,
        commissions_ytd: row.commissions_ytd,
        earned_ytd: row.earned_ytd,
        unearned_amount: row.unearned_amount,
        pct_of_agency_production: row.pct_of_agency_production,
        joined_date: row.joined_date,
      }));
    } catch (error) {
      logger.error(
        "Failed to get agency production by agent",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get agency performance report with monthly trends
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   * @throws DateRangeValidationError if date range exceeds 24 months
   */
  async getPerformanceReport(
    agencyId?: string,
    dateRange?: ReportDateRange,
  ): Promise<AgencyPerformanceReport | null> {
    try {
      // Validate date range to prevent abuse (max 24 months)
      validateReportDateRange(dateRange);

      // Always provide dates - use defaults if no range specified
      const now = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const params = {
        p_agency_id: agencyId ?? null,
        p_start_date: dateRange
          ? formatDateForQuery(dateRange.startDate)
          : formatDateForQuery(twelveMonthsAgo),
        p_end_date: dateRange
          ? formatDateForQuery(dateRange.endDate)
          : formatDateForQuery(now),
      };

      const { data, error } = await supabase.rpc(
        "get_agency_performance_report",
        params,
      );

      if (error) {
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error) ||
          isFunctionNotFoundError(error)
        ) {
          logger.warn(
            "Access denied, invalid params, or function not found for agency performance report",
            { agencyId, code: error.code },
            "AgencyService",
          );
          return null;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          agency_id: agencyId || "",
          months: [],
          summary: {
            total_new_policies: 0,
            total_new_premium: 0,
            total_commissions: 0,
            total_new_agents: 0,
            total_lapsed: 0,
            net_growth: 0,
          },
        };
      }

      const validated = parseAgencyPerformanceReport(data);

      // Calculate summary from monthly data
      const summary = validated.reduce(
        (acc, row) => ({
          total_new_policies: acc.total_new_policies + row.new_policies,
          total_new_premium: acc.total_new_premium + row.new_premium,
          total_commissions: acc.total_commissions + row.commissions_earned,
          total_new_agents: acc.total_new_agents + row.new_agents,
          total_lapsed: acc.total_lapsed + row.policies_lapsed,
          net_growth: acc.net_growth + row.net_premium_change,
        }),
        {
          total_new_policies: 0,
          total_new_premium: 0,
          total_commissions: 0,
          total_new_agents: 0,
          total_lapsed: 0,
          net_growth: 0,
        },
      );

      return {
        agency_id: agencyId || "",
        months: validated,
        summary,
      };
    } catch (error) {
      logger.error(
        "Failed to get agency performance report",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get agency weekly production report
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   * @param dateRange - Optional date range. Defaults to last 12 weeks.
   */
  async getWeeklyProduction(
    agencyId?: string,
    dateRange?: ReportDateRange,
  ): Promise<AgencyWeeklyReport | null> {
    try {
      // Validate date range if provided
      validateReportDateRange(dateRange);

      // Default to last 12 weeks
      const now = new Date();
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks

      const params = {
        p_agency_id: agencyId ?? null,
        p_start_date: dateRange
          ? formatDateForQuery(dateRange.startDate)
          : formatDateForQuery(twelveWeeksAgo),
        p_end_date: dateRange
          ? formatDateForQuery(dateRange.endDate)
          : formatDateForQuery(now),
      };

      const { data, error } = await supabase.rpc(
        "get_agency_weekly_production",
        params,
      );

      if (error) {
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error) ||
          isFunctionNotFoundError(error)
        ) {
          logger.warn(
            "Access denied, invalid params, or function not found for agency weekly production",
            { agencyId, code: error.code },
            "AgencyService",
          );
          return null;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          agency_id: agencyId || "",
          weeks: [],
          summary: {
            total_new_policies: 0,
            total_new_premium: 0,
            total_commissions: 0,
            total_lapsed: 0,
            net_growth: 0,
          },
        };
      }

      const validated = parseAgencyWeeklyProduction(data);

      // Calculate summary from weekly data
      const summary = validated.reduce(
        (acc, row) => ({
          total_new_policies: acc.total_new_policies + row.new_policies,
          total_new_premium: acc.total_new_premium + row.new_premium,
          total_commissions: acc.total_commissions + row.commissions_earned,
          total_lapsed: acc.total_lapsed + row.policies_lapsed,
          net_growth: acc.net_growth + row.net_premium_change,
        }),
        {
          total_new_policies: 0,
          total_new_premium: 0,
          total_commissions: 0,
          total_lapsed: 0,
          net_growth: 0,
        },
      );

      return {
        agency_id: agencyId || "",
        weeks: validated,
        summary,
      };
    } catch (error) {
      logger.error(
        "Failed to get agency weekly production",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get agency override commission summary
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   * @param dateRange - Optional date range for filtering by policy effective date
   */
  async getOverrideSummary(
    agencyId?: string,
    dateRange?: ReportDateRange,
  ): Promise<AgencyOverrideSummary | null> {
    try {
      // Validate date range if provided
      validateReportDateRange(dateRange);

      // Build params using centralized utility (defaults to YTD)
      const dateParams = buildDateRangeParams(dateRange);

      const { data, error } = await supabase.rpc(
        "get_agency_override_summary",
        {
          p_agency_id: agencyId || null,
          ...dateParams,
        },
      );

      if (error) {
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error)
        ) {
          logger.warn(
            "Access denied or invalid params for agency override summary",
            { agencyId, code: error.code },
            "AgencyService",
          );
          return null;
        }
        throw error;
      }

      // No data case: return empty summary (distinguishes "no overrides" from "no access")
      if (!data || data.length === 0) {
        return {
          agency_id: "",
          agency_name: "",
          total_override_count: 0,
          total_override_amount: 0,
          pending_amount: 0,
          earned_amount: 0,
          paid_amount: 0,
          chargeback_amount: 0,
          unique_uplines: 0,
          unique_downlines: 0,
          avg_override_per_policy: 0,
          top_earner_id: null,
          top_earner_name: null,
          top_earner_amount: 0,
        };
      }

      // Validate response with Zod schema
      const validated = parseAgencyOverrideSummary(data);
      const row = validated[0];

      return {
        agency_id: row.agency_id,
        agency_name: row.agency_name,
        total_override_count: row.total_override_count,
        total_override_amount: row.total_override_amount,
        pending_amount: row.pending_amount,
        earned_amount: row.earned_amount,
        paid_amount: row.paid_amount,
        chargeback_amount: row.chargeback_amount,
        unique_uplines: row.unique_uplines,
        unique_downlines: row.unique_downlines,
        avg_override_per_policy: row.avg_override_per_policy,
        top_earner_id: row.top_earner_id,
        top_earner_name: row.top_earner_name,
        top_earner_amount: row.top_earner_amount,
      };
    } catch (error) {
      logger.error(
        "Failed to get agency override summary",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get override commission breakdown by agent for agency owners
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   */
  async getOverridesByAgent(agencyId?: string): Promise<OverrideByAgent[]> {
    try {
      const { data, error } = await supabase.rpc("get_overrides_by_agent", {
        p_agency_id: agencyId || null,
      });

      if (error) {
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error)
        ) {
          logger.warn(
            "Access denied or invalid params for overrides by agent",
            { agencyId, code: error.code },
            "AgencyService",
          );
          return [];
        }
        throw error;
      }

      if (!data) {
        return [];
      }

      // Validate response with Zod schema
      const validated = parseOverrideByAgent(data);

      return validated.map((row) => ({
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        agent_email: row.agent_email,
        override_count: row.override_count,
        total_amount: row.total_amount,
        pending_amount: row.pending_amount,
        earned_amount: row.earned_amount,
        paid_amount: row.paid_amount,
        avg_per_override: row.avg_per_override,
        pct_of_agency_overrides: row.pct_of_agency_overrides,
      }));
    } catch (error) {
      logger.error(
        "Failed to get overrides by agent",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get agency recruiting summary (funnel metrics for one agency)
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   */
  async getRecruitingSummary(
    agencyId?: string,
  ): Promise<AgencyRecruitingSummary | null> {
    try {
      // If no agencyId provided, get user's agency
      let targetAgencyId = agencyId;
      if (!targetAgencyId) {
        const myAgency = await this.getMyAgency();
        if (!myAgency) {
          return null;
        }
        targetAgencyId = myAgency.id;
      }

      const { data, error } = await supabase.rpc(
        "get_agency_recruiting_summary",
        {
          p_agency_id: targetAgencyId,
        },
      );

      if (error) {
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error)
        ) {
          logger.warn(
            "Access denied or invalid params for agency recruiting summary",
            { agencyId: targetAgencyId, code: error.code },
            "AgencyService",
          );
          return null;
        }
        throw error;
      }

      // Empty object indicates no access
      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      // Validate response with Zod schema
      const validated = parseAgencyRecruitingSummary(data);

      return {
        total_recruits: validated.total_recruits,
        by_status: validated.by_status,
        by_agent_status: validated.by_agent_status,
        conversion_rate: validated.conversion_rate,
        avg_days_to_complete: validated.avg_days_to_complete,
        active_in_pipeline: validated.active_in_pipeline,
        completed_count: validated.completed_count,
        dropped_count: validated.dropped_count,
      };
    } catch (error) {
      logger.error(
        "Failed to get agency recruiting summary",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }

  /**
   * Get recruiting breakdown by recruiter for agency owners
   * Uses RPC function for efficient single-query execution
   * @param agencyId - Optional agency ID. Defaults to user's own agency.
   */
  async getRecruitingByRecruiter(
    agencyId?: string,
  ): Promise<RecruitingByRecruiter[]> {
    try {
      // If no agencyId provided, get user's agency
      let targetAgencyId = agencyId;
      if (!targetAgencyId) {
        const myAgency = await this.getMyAgency();
        if (!myAgency) {
          return [];
        }
        targetAgencyId = myAgency.id;
      }

      const { data, error } = await supabase.rpc(
        "get_recruiting_by_recruiter",
        {
          p_agency_id: targetAgencyId,
        },
      );

      if (error) {
        if (
          isAccessDeniedError(error) ||
          isInvalidParameterError(error) ||
          isNotFoundError(error)
        ) {
          logger.warn(
            "Access denied or invalid params for recruiting by recruiter",
            { agencyId: targetAgencyId, code: error.code },
            "AgencyService",
          );
          return [];
        }
        throw error;
      }

      if (!data) {
        return [];
      }

      // Validate response with Zod schema (JSONB array)
      const validated = parseRecruitingByRecruiter(data);

      return validated.map((row) => ({
        recruiter_id: row.recruiter_id,
        recruiter_name: row.recruiter_name,
        recruiter_email: row.recruiter_email,
        total_recruits: row.total_recruits,
        active_in_pipeline: row.active_in_pipeline,
        completed_count: row.completed_count,
        dropped_count: row.dropped_count,
        conversion_rate: row.conversion_rate,
        licensed_count: row.licensed_count,
      }));
    } catch (error) {
      logger.error(
        "Failed to get recruiting by recruiter",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyService",
      );
      throw error;
    }
  }
}

// Export singleton instance
export const agencyService = new AgencyService();

// Export class for testing
export { AgencyService };
