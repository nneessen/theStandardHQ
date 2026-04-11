import {
  Policy,
  PolicyFilters,
  CreatePolicyData,
  LeadSourceType,
} from "../../types/policy.types";
import { PolicyRepository } from "./PolicyRepository";
import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import { formatDateForDB } from "../../lib/date";
import { commissionStatusService } from "../commissions/CommissionStatusService";
import { commissionService } from "../commissions/commissionService";
import {
  DatabaseError,
  NotFoundError,
  ValidationError,
} from "../../errors/ServiceErrors";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";

/**
 * Get the current authenticated user's ID
 * CRITICAL: Used to filter policies to only the current user's data
 */
async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user.id;
}

/**
 * Service layer for policies - handles business logic
 * Uses PolicyRepository for all data access
 */
class PolicyService {
  private repository = new PolicyRepository();

  /**
   * Get all policies ordered by creation date
   * CRITICAL: Filters to only current user's policies
   */
  async getAll(): Promise<Policy[]> {
    const userId = await getCurrentUserId();
    return this.repository.findAll({ userId: userId || undefined });
  }

  /**
   * Get a single policy by ID
   */
  async getById(id: string): Promise<Policy | null> {
    return this.repository.findById(id);
  }

  /**
   * Check if a policy number already exists
   * @param policyNumber - The policy number to check
   * @param excludePolicyId - Optional ID to exclude (for updates)
   * @returns true if duplicate exists
   */
  async checkPolicyNumberExists(
    policyNumber: string,
    excludePolicyId?: string,
    userId?: string,
  ): Promise<boolean> {
    if (!policyNumber || policyNumber.trim() === "") {
      return false;
    }

    const existing = await this.repository.findByPolicyNumber(
      policyNumber.trim(),
      userId,
    );
    if (!existing) {
      return false;
    }

    // When updating, exclude the current policy from duplicate check
    if (excludePolicyId && existing.id === excludePolicyId) {
      return false;
    }

    return true;
  }

  /**
   * Create a new policy and its associated commission record.
   */
  async create(policyData: CreatePolicyData): Promise<Policy> {
    // Check for duplicate policy number before creating (scoped to this user)
    if (policyData.policyNumber) {
      const isDuplicate = await this.checkPolicyNumberExists(
        policyData.policyNumber,
        undefined,
        policyData.userId,
      );
      if (isDuplicate) {
        throw new ValidationError(
          "A policy with this number already exists. Please use a unique policy number.",
          [
            {
              field: "policyNumber",
              message: "This policy number already exists",
              value: policyData.policyNumber,
            },
          ],
        );
      }
    }

    // Normalize empty string to null for database
    const normalizedData = {
      ...policyData,
      policyNumber: policyData.policyNumber?.trim() || null,
    };

    // Create policy record
    const policy = await this.repository.create(normalizedData);

    // Create commission record for this policy
    try {
      // DO NOT pass commissionRate - it MUST be looked up from comp_guide
      // using the user's contract_level, not the policy's stored percentage
      await commissionService.createWithAutoCalculation(
        {
          policyId: policy.id,
          userId: policy.userId,
          advanceMonths: 9, // Standard advance period
          status: "pending",
          type: "advance",
        },
        {
          carrierId: policy.carrierId,
          productId: policy.productId, // CRITICAL: Pass productId for accurate comp_guide lookup
          product: policy.product,
          termLength: policy.termLength ?? undefined, // For term_life commission modifiers
          annualPremium: policy.annualPremium,
          monthlyPremium: policy.monthlyPremium,
          autoCalculate: true,
        },
      );
      console.log(`Commission created for policy ${policy.id}`);
    } catch (error) {
      // CRITICAL: Commission creation MUST succeed for policy to be valid
      // Never silently fail - always notify user so they can take action
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to create commission for policy:", error);
      logger.error(
        "PolicyService.create",
        error instanceof Error ? error : new Error(String(error)),
      );

      // ALWAYS rethrow commission errors - silent failures cause data integrity issues
      // The policy was created but has no commission, which breaks all metrics
      // User-friendly messages for common errors:
      if (errorMessage.includes("Contract comp level not found")) {
        throw new Error(
          "Commission calculation failed: Your contract level is not configured. " +
            "Please contact your administrator to set up your contract level, then try again. " +
            `(Policy ${policy.policyNumber || policy.id} was created but needs commission added manually.)`,
        );
      }
      if (
        errorMessage.includes("comp_guide") ||
        errorMessage.includes("No comp_guide entry found")
      ) {
        throw new Error(
          "Commission calculation failed: No commission rate found for this carrier/product combination. " +
            "Please contact your administrator to configure the comp guide. " +
            `(Policy ${policy.policyNumber || policy.id} was created but needs commission added manually.)`,
        );
      }
      // Generic commission error
      throw new Error(
        `Commission creation failed: ${errorMessage}. ` +
          `Policy ${policy.policyNumber || policy.id} was created but needs commission added manually.`,
      );
    }

    // Emit policy created event
    const clientName =
      "client" in policy && policy.client
        ? "firstName" in policy.client
          ? `${policy.client.firstName} ${policy.client.lastName}`
          : policy.client.name
        : "Unknown Client";

    await workflowEventEmitter.emit(WORKFLOW_EVENTS.POLICY_CREATED, {
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      carrierId: policy.carrierId,
      productId: policy.productId,
      agentId: policy.userId,
      clientName,
      premium: policy.annualPremium,
      status: policy.status,
      effectiveDate: policy.effectiveDate,
      createdAt: new Date().toISOString(),
    });

    return policy;
  }

  /**
   * Update an existing policy
   */
  async update(
    id: string,
    updates: Partial<CreatePolicyData>,
  ): Promise<Policy> {
    // Check for duplicate policy number when updating (scoped to this user)
    if (updates.policyNumber !== undefined) {
      if (updates.policyNumber && updates.policyNumber.trim() !== "") {
        // Get the policy's userId to scope the duplicate check
        const existingPolicy = await this.repository.findById(id);
        const isDuplicate = await this.checkPolicyNumberExists(
          updates.policyNumber,
          id,
          existingPolicy?.userId,
        );
        if (isDuplicate) {
          throw new ValidationError(
            "A policy with this number already exists. Please use a unique policy number.",
            [
              {
                field: "policyNumber",
                message: "This policy number already exists",
                value: updates.policyNumber,
              },
            ],
          );
        }
        updates.policyNumber = updates.policyNumber.trim();
      } else {
        // Normalize empty string to null
        updates.policyNumber = null;
      }
    }

    // Auto-unlink from lead purchase when deal goes bad
    if (updates.status === "denied" || updates.status === "withdrawn") {
      updates.leadPurchaseId = null;
      updates.leadSourceType = null;
    }

    return this.repository.update(id, updates);
  }

  /**
   * Update a policy's lead source attribution
   * This links a policy to a lead purchase for ROI tracking
   *
   * @param policyId - Policy ID to update
   * @param leadSourceType - Type of lead source (lead_purchase, free_lead, other, or null)
   * @param leadPurchaseId - Lead purchase ID (required when sourceType is 'lead_purchase')
   * @returns Updated policy
   */
  async updateLeadSource(
    policyId: string,
    leadSourceType: LeadSourceType | null,
    leadPurchaseId?: string | null,
  ): Promise<Policy> {
    // Validate: if leadSourceType is 'lead_purchase', leadPurchaseId is required
    if (leadSourceType === "lead_purchase" && !leadPurchaseId) {
      throw new ValidationError(
        "Lead purchase ID is required when source type is lead_purchase",
        [
          {
            field: "leadPurchaseId",
            message: "Lead purchase ID is required",
            value: leadPurchaseId,
          },
        ],
      );
    }

    // If source type is not lead_purchase, clear the leadPurchaseId
    const updateData = {
      leadSourceType,
      leadPurchaseId:
        leadSourceType === "lead_purchase" ? leadPurchaseId : null,
    };

    logger.info(
      "Updating policy lead source",
      { policyId, leadSourceType, leadPurchaseId },
      "PolicyService.updateLeadSource",
    );

    return this.repository.update(policyId, updateData);
  }

  /**
   * Delete a policy
   */
  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /**
   * Check if a policy shares its client with other policies
   * Returns info about shared client for pre-delete warnings
   *
   * @param policyId - Policy ID to check
   * @returns Object with shared status and count of other policies
   */
  async checkSharedClient(
    policyId: string,
  ): Promise<{ isShared: boolean; otherPoliciesCount: number }> {
    // Get the client_id for this policy
    const clientId = await this.repository.getClientIdForPolicy(policyId);

    if (!clientId) {
      // No client_id means no shared client issue
      return { isShared: false, otherPoliciesCount: 0 };
    }

    // Count how many policies share this client
    const totalCount = await this.repository.countPoliciesByClientId(clientId);

    // Subtract 1 to exclude the current policy
    const otherPoliciesCount = Math.max(0, totalCount - 1);

    return {
      isShared: otherPoliciesCount > 0,
      otherPoliciesCount,
    };
  }

  /**
   * Get policies filtered by various criteria (server-side).
   * CRITICAL: Filters to only current user's policies.
   * All filters are pushed to the DB query for performance.
   */
  async getFiltered(filters: PolicyFilters): Promise<Policy[]> {
    const userId = await getCurrentUserId();

    // Convert PolicyFilters to repository filter format for server-side filtering.
    // Legacy startDate/endDate fall back to dateFrom/dateTo so older callers
    // continue to work; they filter on the dateField (default submit_date).
    const dateFrom =
      filters.dateFrom ??
      (filters.startDate ? formatDateForDB(filters.startDate) : undefined);
    const dateTo =
      filters.dateTo ??
      (filters.endDate ? formatDateForDB(filters.endDate) : undefined);

    const repoFilters: {
      status?: string;
      carrierId?: string;
      product?: string;
      dateFrom?: string;
      dateTo?: string;
      dateField?: "submit_date" | "effective_date";
      searchTerm?: string;
    } = {};

    if (filters.status) repoFilters.status = filters.status;
    if (filters.carrierId) repoFilters.carrierId = filters.carrierId;
    if (filters.product) repoFilters.product = filters.product;
    if (dateFrom) repoFilters.dateFrom = dateFrom;
    if (dateTo) repoFilters.dateTo = dateTo;
    if (filters.dateField) repoFilters.dateField = filters.dateField;
    if (filters.searchTerm) repoFilters.searchTerm = filters.searchTerm;

    const policies = await this.repository.findAll(
      { userId: userId || undefined },
      Object.keys(repoFilters).length > 0 ? repoFilters : undefined,
    );

    // Premium range filters — applied client-side since they're rarely used
    // and annual_premium is already returned in the result set
    if (filters.minPremium || filters.maxPremium) {
      return policies.filter((policy) => {
        if (filters.minPremium && policy.annualPremium < filters.minPremium)
          return false;
        if (filters.maxPremium && policy.annualPremium > filters.maxPremium)
          return false;
        return true;
      });
    }

    return policies;
  }

  /**
   * Get paginated policies with filters and sorting
   * CRITICAL: Filters to only current user's policies
   * @param page - Current page number (1-based)
   * @param pageSize - Number of items per page
   * @param filters - Optional filters to apply
   * @param sortConfig - Optional sorting configuration
   * @returns Array of policies for the current page
   */
  async getPaginated(
    page: number,
    pageSize: number,
    filters?: PolicyFilters,
    sortConfig?: { field: string; direction: "asc" | "desc" },
  ): Promise<Policy[]> {
    // Get current user ID to filter policies
    const userId = await getCurrentUserId();

    // Convert PolicyFilters to repository filter format
    const repoFilters = filters
      ? {
          status: filters.status,
          carrierId: filters.carrierId,
          product: filters.product,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          dateField: filters.dateField,
          searchTerm: filters.searchTerm,
        }
      : undefined;

    const options = {
      page,
      pageSize,
      orderBy: sortConfig?.field || "created_at",
      orderDirection: sortConfig?.direction || ("desc" as const),
      userId: userId || undefined, // CRITICAL: Filter to current user's policies
    };

    return this.repository.findAll(options, repoFilters);
  }

  /**
   * Get count of policies matching filters
   * CRITICAL: Filters to only current user's policies
   * @param filters - Optional filters to apply
   * @returns Total count of matching policies
   */
  async getCount(filters?: PolicyFilters): Promise<number> {
    // Get current user ID to filter policies
    const userId = await getCurrentUserId();

    // Convert PolicyFilters to repository filter format
    const repoFilters = filters
      ? {
          status: filters.status,
          carrierId: filters.carrierId,
          product: filters.product,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          dateField: filters.dateField,
          searchTerm: filters.searchTerm,
        }
      : undefined;

    return this.repository.countPolicies(repoFilters, userId || undefined);
  }

  /**
   * Get aggregate metrics for policies matching filters
   * CRITICAL: Filters to only current user's policies
   * Returns totals across ALL matching policies (not just current page)
   * @param filters - Optional filters to apply
   * @returns Aggregate metrics including counts, premiums, and YTD data
   */
  async getAggregateMetrics(filters?: PolicyFilters): Promise<{
    totalPolicies: number;
    activePolicies: number;
    pendingPolicies: number;
    lapsedPolicies: number;
    cancelledPolicies: number;
    totalPremium: number;
    avgPremium: number;
    ytdPolicies: number;
    ytdPremium: number;
  }> {
    // Get current user ID to filter policies
    const userId = await getCurrentUserId();

    // Convert PolicyFilters to repository filter format
    const repoFilters = filters
      ? {
          status: filters.status,
          carrierId: filters.carrierId,
          product: filters.product,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          dateField: filters.dateField,
          searchTerm: filters.searchTerm,
        }
      : undefined;

    return this.repository.getAggregateMetrics(
      repoFilters,
      userId || undefined,
    );
  }

  /**
   * Business logic: Get monthly metrics for a given month/year
   */
  async getMonthlyMetrics(year: number, month: number) {
    return this.repository.getMonthlyMetrics(year, month);
  }

  /**
   * Business logic: Get total annual premium by carrier
   */
  async getTotalAnnualPremiumByCarrier(carrierId: string): Promise<number> {
    return this.repository.getTotalAnnualPremiumByCarrier(carrierId);
  }

  /**
   * Business logic: Find policies by carrier
   */
  async findByCarrier(carrierId: string): Promise<Policy[]> {
    return this.repository.findByCarrier(carrierId);
  }

  /**
   * Business logic: Find policies by user/agent
   */
  async findByAgent(userId: string): Promise<Policy[]> {
    return this.repository.findByAgent(userId);
  }

  /**
   * Find policies linked to a specific lead purchase
   * Used for ROI tracking display in LeadPurchaseDialog
   */
  async findByLeadPurchaseId(leadPurchaseId: string): Promise<Policy[]> {
    return this.repository.findByLeadPurchaseId(leadPurchaseId);
  }

  /**
   * Find recent policies that are NOT linked to any lead purchase
   * Used for the policy selector in LeadPurchaseDialog
   * Only returns the specified user's policies
   */
  async findUnlinkedRecent(
    userId: string,
    limit: number = 50,
  ): Promise<Policy[]> {
    return this.repository.findUnlinkedRecent(userId, limit);
  }

  /**
   * Cancel a policy and trigger automatic chargeback calculation
   *
   * When a policy is cancelled, this method:
   * 1. Updates policy lifecycle_status to 'cancelled'
   * 2. Database trigger automatically calculates chargeback
   * 3. Commission status updated to 'charged_back' with chargeback amount
   *
   * @param policyId - Policy ID to cancel
   * @param reason - Reason for cancellation (required)
   * @param cancelDate - Cancellation date (defaults to today)
   * @returns Updated policy and chargeback details
   */
  async cancelPolicy(
    policyId: string,
    reason: string,
    cancelDate: Date = new Date(),
  ): Promise<{
    policy: Policy;
    chargeback: {
      amount: number;
      monthsPaid: number;
      reason: string;
    };
  }> {
    try {
      // Validate reason
      if (!reason || reason.trim().length === 0) {
        throw new ValidationError("Cancellation reason is required", [
          { field: "reason", message: "Reason cannot be empty", value: reason },
        ]);
      }

      // Validate policy exists
      const policy = await this.repository.findById(policyId);
      if (!policy) {
        throw new NotFoundError("Policy", policyId);
      }

      // Validate policy is not already cancelled or lapsed (lifecycle_status)
      if (
        policy.lifecycleStatus === "cancelled" ||
        policy.lifecycleStatus === "lapsed"
      ) {
        throw new ValidationError("Policy is already cancelled or lapsed", [
          {
            field: "lifecycleStatus",
            message: "Cannot cancel an already cancelled/lapsed policy",
            value: policy.lifecycleStatus,
          },
        ]);
      }

      // Update policy lifecycle_status to 'cancelled'
      // Database trigger will automatically calculate chargeback
      const { data: updated, error: updateError } = await supabase
        .from("policies")
        .update({
          lifecycle_status: "cancelled",
          lead_purchase_id: null,
          lead_source_type: null,
          notes: policy.notes
            ? `${policy.notes}\n\nCancelled: ${reason} (${cancelDate.toISOString().split("T")[0]})`
            : `Cancelled: ${reason} (${cancelDate.toISOString().split("T")[0]})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", policyId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseError("cancelPolicy", updateError);
      }

      // Get updated commission with chargeback details
      const { data: commission, error: commissionError } = await supabase
        .from("commissions")
        .select("chargeback_amount, chargeback_reason, months_paid")
        .eq("policy_id", policyId)
        .single();

      if (commissionError) {
        logger.warn(
          "Could not fetch chargeback details",
          {
            policyId,
            error: commissionError,
          },
          "PolicyService.cancelPolicy",
        );
      }

      if (policy.leadPurchaseId) {
        logger.info(
          "Auto-unlinked cancelled policy from lead purchase",
          { policyId, leadPurchaseId: policy.leadPurchaseId },
          "PolicyService.cancelPolicy",
        );
      }

      logger.info(
        "Policy cancelled",
        {
          policyId,
          reason,
          chargebackAmount: commission?.chargeback_amount || 0,
        },
        "PolicyService",
      );

      // Transform and return
      const updatedPolicy = this.repository["transformFromDB"](updated);

      // Emit policy cancelled event
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.POLICY_CANCELLED, {
        policyId: updatedPolicy.id,
        policyNumber: updatedPolicy.policyNumber,
        agentId: updatedPolicy.userId,
        reason,
        cancelDate: cancelDate.toISOString(),
        chargebackAmount: parseFloat(commission?.chargeback_amount || "0"),
        timestamp: new Date().toISOString(),
      });

      return {
        policy: updatedPolicy,
        chargeback: {
          amount: parseFloat(commission?.chargeback_amount || "0"),
          monthsPaid: commission?.months_paid || 0,
          reason: commission?.chargeback_reason || reason,
        },
      };
    } catch (error) {
      logger.error(
        "PolicyService.cancelPolicy",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Mark a policy as lapsed and trigger automatic chargeback calculation
   *
   * When a policy lapses (client stopped paying), this method:
   * 1. Updates policy status to 'lapsed'
   * 2. Database trigger automatically calculates chargeback
   * 3. Commission status updated to 'charged_back' with chargeback amount
   *
   * @param policyId - Policy ID to lapse
   * @param lapseDate - Date when policy lapsed (defaults to today)
   * @param reason - Optional reason for lapse
   * @returns Updated policy and chargeback details
   */
  async lapsePolicy(
    policyId: string,
    lapseDate: Date = new Date(),
    reason?: string,
  ): Promise<{
    policy: Policy;
    chargeback: {
      amount: number;
      monthsPaid: number;
      reason: string;
    };
  }> {
    try {
      // Validate policy exists
      const policy = await this.repository.findById(policyId);
      if (!policy) {
        throw new NotFoundError("Policy", policyId);
      }

      // Validate policy is not already lapsed or cancelled (check lifecycle_status)
      if (
        policy.lifecycleStatus === "cancelled" ||
        policy.lifecycleStatus === "lapsed"
      ) {
        throw new ValidationError("Policy is already cancelled or lapsed", [
          {
            field: "lifecycleStatus",
            message: "Cannot lapse an already cancelled/lapsed policy",
            value: policy.lifecycleStatus,
          },
        ]);
      }

      // Update policy lifecycle_status to 'lapsed'
      // Database trigger will automatically calculate chargeback
      const lapseNote = reason
        ? `Lapsed: ${reason} (${lapseDate.toISOString().split("T")[0]})`
        : `Lapsed on ${lapseDate.toISOString().split("T")[0]} - client stopped paying`;

      const { data: updated, error: updateError } = await supabase
        .from("policies")
        .update({
          lifecycle_status: "lapsed",
          lead_purchase_id: null,
          lead_source_type: null,
          notes: policy.notes ? `${policy.notes}\n\n${lapseNote}` : lapseNote,
          updated_at: new Date().toISOString(),
        })
        .eq("id", policyId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseError("lapsePolicy", updateError);
      }

      // Get updated commission with chargeback details
      const { data: commission, error: commissionError } = await supabase
        .from("commissions")
        .select("chargeback_amount, chargeback_reason, months_paid")
        .eq("policy_id", policyId)
        .single();

      if (commissionError) {
        logger.warn(
          "Could not fetch chargeback details",
          {
            policyId,
            error: commissionError,
          },
          "PolicyService.lapsePolicy",
        );
      }

      if (policy.leadPurchaseId) {
        logger.info(
          "Auto-unlinked lapsed policy from lead purchase",
          { policyId, leadPurchaseId: policy.leadPurchaseId },
          "PolicyService.lapsePolicy",
        );
      }

      logger.info(
        "Policy lapsed",
        {
          policyId,
          lapseDate,
          chargebackAmount: commission?.chargeback_amount || 0,
        },
        "PolicyService",
      );

      // Transform and return
      const updatedPolicy = this.repository["transformFromDB"](updated);

      return {
        policy: updatedPolicy,
        chargeback: {
          amount: parseFloat(commission?.chargeback_amount || "0"),
          monthsPaid: commission?.months_paid || 0,
          reason: commission?.chargeback_reason || "Policy lapsed",
        },
      };
    } catch (error) {
      logger.error(
        "PolicyService.lapsePolicy",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Reinstate a cancelled or lapsed policy
   *
   * When a policy is reinstated after cancellation/lapse:
   * 1. Updates policy status to 'active'
   * 2. Reverses the chargeback on associated commission
   * 3. Commission status restored to 'earned'
   *
   * @param policyId - Policy ID to reinstate
   * @param reason - Reason for reinstatement (required)
   * @returns Updated policy
   */
  async reinstatePolicy(policyId: string, reason: string): Promise<Policy> {
    try {
      // Validate reason
      if (!reason || reason.trim().length === 0) {
        throw new ValidationError("Reinstatement reason is required", [
          { field: "reason", message: "Reason cannot be empty", value: reason },
        ]);
      }

      // Validate policy exists
      const policy = await this.repository.findById(policyId);
      if (!policy) {
        throw new NotFoundError("Policy", policyId);
      }

      // Validate policy is cancelled or lapsed (check lifecycle_status)
      if (
        policy.lifecycleStatus !== "cancelled" &&
        policy.lifecycleStatus !== "lapsed"
      ) {
        throw new ValidationError(
          "Policy must be cancelled or lapsed to reinstate",
          [
            {
              field: "lifecycleStatus",
              message: "Can only reinstate cancelled/lapsed policies",
              value: policy.lifecycleStatus,
            },
          ],
        );
      }

      // Get commission to reverse chargeback
      const { data: commission, error: commissionError } = await supabase
        .from("commissions")
        .select("id")
        .eq("policy_id", policyId)
        .single();

      // Reverse chargeback if commission exists
      if (commission && !commissionError) {
        await commissionStatusService.reverseChargeback(commission.id);
      }

      // Update policy lifecycle_status to 'active'
      const { data: updated, error: updateError } = await supabase
        .from("policies")
        .update({
          lifecycle_status: "active",
          notes: policy.notes
            ? `${policy.notes}\n\nReinstated: ${reason} (${new Date().toISOString().split("T")[0]})`
            : `Reinstated: ${reason} (${new Date().toISOString().split("T")[0]})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", policyId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseError("reinstatePolicy", updateError);
      }

      logger.info(
        "Policy reinstated",
        {
          policyId,
          reason,
        },
        "PolicyService",
      );

      // Transform and return
      const reinstatedPolicy = this.repository["transformFromDB"](updated);

      // Emit policy renewed event (reinstatement is a form of renewal)
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.POLICY_RENEWED, {
        policyId: reinstatedPolicy.id,
        policyNumber: reinstatedPolicy.policyNumber,
        agentId: reinstatedPolicy.userId,
        reason,
        renewalDate: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });

      return reinstatedPolicy;
    } catch (error) {
      logger.error(
        "PolicyService.reinstatePolicy",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}

export { PolicyService };
export const policyService = new PolicyService();
