import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import { AgencyRequestRepository } from "./AgencyRequestRepository";
import type {
  AgencyRequest,
  AgencyRequestRow,
  CreateAgencyRequestData,
} from "../../types/agency-request.types";
import type { Agency } from "../../types/imo.types";

class AgencyRequestService {
  private repo: AgencyRequestRepository;

  constructor() {
    this.repo = new AgencyRequestRepository();
  }

  /**
   * Check if current user can request an agency
   */
  async canRequestAgency(): Promise<{
    canRequest: boolean;
    reason?: string;
  }> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { canRequest: false, reason: "Authentication required" };
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("upline_id, agency_id, imo_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return { canRequest: false, reason: "User profile not found" };
      }

      // Check if user has an upline
      if (!profile.upline_id) {
        return {
          canRequest: false,
          reason: "You need an upline to request agency status",
        };
      }

      // Check if user belongs to an IMO
      if (!profile.imo_id) {
        return {
          canRequest: false,
          reason: "You must belong to an IMO to request agency status",
        };
      }

      // Check if user belongs to an agency
      if (!profile.agency_id) {
        return {
          canRequest: false,
          reason: "You must belong to an agency to request agency status",
        };
      }

      // Check if user already has a pending request
      const hasPending = await this.repo.hasPendingRequest(user.id);
      if (hasPending) {
        return {
          canRequest: false,
          reason: "You already have a pending agency request",
        };
      }

      // Check if user already owns an agency
      const { count } = await supabase
        .from("agencies")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("is_active", true);

      if (count && count > 0) {
        return { canRequest: false, reason: "You already own an agency" };
      }

      return { canRequest: true };
    } catch (error) {
      logger.error(
        "Failed to check agency request eligibility",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      return {
        canRequest: false,
        reason: "An error occurred checking eligibility",
      };
    }
  }

  /**
   * Create a new agency request
   */
  async createRequest(
    data: CreateAgencyRequestData,
  ): Promise<AgencyRequestRow> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Authentication required");
      }

      // Get user profile for upline and agency info
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("upline_id, agency_id, imo_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("User profile not found");
      }

      if (!profile.upline_id) {
        throw new Error("You need an upline to request agency status");
      }

      if (!profile.agency_id) {
        throw new Error(
          "You must belong to an agency to request agency status",
        );
      }

      if (!profile.imo_id) {
        throw new Error("You must belong to an IMO to request agency status");
      }

      // Check for existing pending request
      const hasPending = await this.repo.hasPendingRequest(user.id);
      if (hasPending) {
        throw new Error("You already have a pending agency request");
      }

      // Check if agency code is available
      const isCodeAvailable = await this.repo.isCodeAvailable(
        profile.imo_id,
        data.proposed_code,
      );
      if (!isCodeAvailable) {
        throw new Error(
          `Agency code "${data.proposed_code}" is already in use`,
        );
      }

      logger.info(
        "Creating agency request",
        { userId: user.id, proposedCode: data.proposed_code },
        "AgencyRequestService",
      );

      const request = await this.repo.create({
        requester_id: user.id,
        approver_id: profile.upline_id,
        imo_id: profile.imo_id,
        current_agency_id: profile.agency_id,
        proposed_name: data.proposed_name,
        proposed_code: data.proposed_code,
        proposed_description: data.proposed_description ?? null,
        status: "pending",
      });

      // Notify the approver (the requester's upline). Non-fatal.
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.AGENCY_REQUEST_CREATED, {
        recipientId: profile.upline_id ?? undefined,
        requesterId: user.id,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        "Agency request created",
        { requestId: request.id },
        "AgencyRequestService",
      );

      return request;
    } catch (error) {
      logger.error(
        "Failed to create agency request",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      throw error;
    }
  }

  /**
   * Get current user's agency requests
   */
  async getMyRequests(): Promise<AgencyRequest[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return [];
      }

      return this.repo.findByRequester(user.id);
    } catch (error) {
      logger.error(
        "Failed to get my agency requests",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      throw error;
    }
  }

  /**
   * Get a single request by ID
   */
  async getRequest(requestId: string): Promise<AgencyRequest | null> {
    return this.repo.findWithRelations(requestId);
  }

  /**
   * Get pending requests awaiting current user's approval
   */
  async getPendingRequestsToApprove(): Promise<AgencyRequest[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return [];
      }

      return this.repo.findPendingForApprover(user.id);
    } catch (error) {
      logger.error(
        "Failed to get pending agency requests",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      throw error;
    }
  }

  /**
   * Get count of pending requests for current user to approve
   */
  async getPendingApprovalCount(): Promise<number> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return 0;
      }

      return this.repo.getPendingCount(user.id);
    } catch (error) {
      logger.error(
        "Failed to get pending approval count",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      return 0;
    }
  }

  /**
   * Cancel current user's pending request
   */
  async cancelRequest(requestId: string): Promise<void> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Authentication required");
      }

      // Verify request belongs to current user
      const request = await this.repo.findById(requestId);
      if (!request) {
        throw new Error("Request not found");
      }

      if (request.requester_id !== user.id) {
        throw new Error("Not authorized to cancel this request");
      }

      if (request.status !== "pending") {
        throw new Error("Only pending requests can be cancelled");
      }

      logger.info(
        "Cancelling agency request",
        { requestId },
        "AgencyRequestService",
      );

      await this.repo.cancel(requestId);

      logger.info(
        "Agency request cancelled",
        { requestId },
        "AgencyRequestService",
      );
    } catch (error) {
      logger.error(
        "Failed to cancel agency request",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      throw error;
    }
  }

  /**
   * Approve a pending agency request
   * Returns the newly created agency
   */
  async approveRequest(requestId: string): Promise<Agency> {
    try {
      logger.info(
        "Approving agency request",
        { requestId },
        "AgencyRequestService",
      );

      // The RPC function handles all authorization checks
      const newAgencyId = await this.repo.approve(requestId);

      // Fetch the created agency
      const { data: agency, error } = await supabase
        .from("agencies")
        .select(
          `
          *,
          owner:user_profiles!agencies_owner_id_fkey (
            id,
            email,
            first_name,
            last_name
          )
        `,
        )
        .eq("id", newAgencyId)
        .single();

      if (error || !agency) {
        throw new Error("Agency created but failed to fetch details");
      }

      // Notify the requester (now the agency owner). Non-fatal.
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.AGENCY_REQUEST_APPROVED, {
        recipientId:
          (agency as { owner_id?: string | null }).owner_id ?? undefined,
        requestId,
        agencyId: newAgencyId,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        "Agency request approved",
        { requestId, newAgencyId },
        "AgencyRequestService",
      );

      return agency as Agency;
    } catch (error) {
      logger.error(
        "Failed to approve agency request",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      throw error;
    }
  }

  /**
   * Reject a pending agency request
   */
  async rejectRequest(requestId: string, reason?: string): Promise<void> {
    try {
      logger.info(
        "Rejecting agency request",
        { requestId, reason },
        "AgencyRequestService",
      );

      // Capture the requester before the RPC so we can notify them.
      const existing = await this.repo.findWithRelations(requestId);

      // The RPC function handles authorization checks
      await this.repo.reject(requestId, reason ?? null);

      await workflowEventEmitter.emit(WORKFLOW_EVENTS.AGENCY_REQUEST_REJECTED, {
        recipientId: existing?.requester_id ?? undefined,
        requestId,
        reason: reason ?? undefined,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        "Agency request rejected",
        { requestId },
        "AgencyRequestService",
      );
    } catch (error) {
      logger.error(
        "Failed to reject agency request",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      throw error;
    }
  }

  /**
   * Check if agency code is available
   */
  async isCodeAvailable(code: string): Promise<boolean> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Authentication required");
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("imo_id")
        .eq("id", user.id)
        .single();

      if (!profile?.imo_id) {
        // User not in an IMO - return false instead of throwing to prevent UI errors
        return false;
      }

      return this.repo.isCodeAvailable(profile.imo_id, code);
    } catch (error) {
      logger.error(
        "Failed to check code availability",
        error instanceof Error ? error : new Error(String(error)),
        "AgencyRequestService",
      );
      throw error;
    }
  }
}

export const agencyRequestService = new AgencyRequestService();
export { AgencyRequestService };
