import { supabase } from "../base/supabase";
import { JoinRequestRepository } from "./JoinRequestRepository";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import type {
  JoinRequest,
  JoinRequestRow,
  CreateJoinRequestInput,
  ApproveJoinRequestInput,
  RejectJoinRequestInput,
  ImoOption,
  AgencyOption,
  JoinRequestEligibility,
} from "../../types/join-request.types";

/**
 * Service layer for join request operations
 * Handles business logic and validation
 */
class JoinRequestService {
  private repo: JoinRequestRepository;

  constructor() {
    this.repo = new JoinRequestRepository();
  }

  /**
   * Check if current user can submit a join request
   */
  async checkEligibility(): Promise<JoinRequestEligibility> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { canSubmit: false, reason: "Not authenticated" };
    }

    // Check via database function
    const canSubmit = await this.repo.canSubmitRequest();

    if (!canSubmit) {
      // Determine the specific reason
      const hasPending = await this.repo.hasPendingRequest(user.id);
      if (hasPending) {
        return {
          canSubmit: false,
          reason: "You already have a pending request",
        };
      }

      return {
        canSubmit: false,
        reason: "You are already approved with an IMO",
      };
    }

    return { canSubmit: true };
  }

  /**
   * Get available IMOs for join request form
   */
  async getAvailableImos(): Promise<ImoOption[]> {
    return this.repo.getAvailableImos();
  }

  /**
   * Get agencies in an IMO for join request form
   */
  async getAgenciesForImo(imoId: string): Promise<AgencyOption[]> {
    return this.repo.getAgenciesForImo(imoId);
  }

  /**
   * Create a new join request
   */
  async createRequest(input: CreateJoinRequestInput): Promise<JoinRequestRow> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Validate eligibility
    const eligibility = await this.checkEligibility();
    if (!eligibility.canSubmit) {
      throw new Error(eligibility.reason || "Cannot submit request");
    }

    // Create the request (approver_id set by database trigger)
    const request = await this.repo.create({
      requester_id: user.id,
      imo_id: input.imo_id,
      agency_id: input.agency_id ?? null,
      requested_upline_id: input.requested_upline_id ?? null,
      message: input.message ?? null,
      status: "pending",
    });

    // Notify the approver (approver_id is set by a DB trigger, not returned by
    // create) — refetch to obtain it. Non-fatal.
    const full = await this.repo.findWithRelations(request.id);
    await workflowEventEmitter.emit(WORKFLOW_EVENTS.JOIN_REQUEST_CREATED, {
      recipientId: full?.approver_id ?? undefined,
      requesterId: user.id,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });

    return request;
  }

  /**
   * Get current user's join requests
   */
  async getMyRequests(): Promise<JoinRequest[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    return this.repo.findByRequester(user.id);
  }

  /**
   * Get current user's pending request (if any)
   */
  async getMyPendingRequest(): Promise<JoinRequest | null> {
    const requests = await this.getMyRequests();
    return requests.find((r) => r.status === "pending") ?? null;
  }

  /**
   * Cancel current user's pending request
   */
  async cancelMyRequest(requestId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Verify ownership
    const request = await this.repo.findWithRelations(requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.requester_id !== user.id) {
      throw new Error("Not authorized to cancel this request");
    }

    if (request.status !== "pending") {
      throw new Error("Can only cancel pending requests");
    }

    await this.repo.cancel(requestId);
  }

  /**
   * Get pending requests for current user to approve
   */
  async getPendingApprovals(): Promise<JoinRequest[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    return this.repo.findPendingForApprover(user.id);
  }

  /**
   * Get count of pending approvals for current user
   */
  async getPendingApprovalCount(): Promise<number> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return 0;
    }

    return this.repo.getPendingCount(user.id);
  }

  /**
   * Approve a join request
   */
  async approveRequest(input: ApproveJoinRequestInput): Promise<void> {
    // Capture the requester (not in the input) so we can notify them.
    const request = await this.repo.findWithRelations(input.request_id);
    await this.repo.approve(input.request_id, input.agency_id, input.upline_id);
    await workflowEventEmitter.emit(WORKFLOW_EVENTS.JOIN_REQUEST_APPROVED, {
      recipientId: request?.requester_id ?? undefined,
      requestId: input.request_id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Reject a join request
   */
  async rejectRequest(input: RejectJoinRequestInput): Promise<void> {
    const request = await this.repo.findWithRelations(input.request_id);
    await this.repo.reject(input.request_id, input.reason ?? null);
    await workflowEventEmitter.emit(WORKFLOW_EVENTS.JOIN_REQUEST_REJECTED, {
      recipientId: request?.requester_id ?? undefined,
      requestId: input.request_id,
      reason: input.reason ?? undefined,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get a single request with relations
   */
  async getRequest(requestId: string): Promise<JoinRequest | null> {
    return this.repo.findWithRelations(requestId);
  }

  /**
   * Get all requests for an IMO (admin view)
   */
  async getRequestsForImo(imoId: string): Promise<JoinRequest[]> {
    return this.repo.findByImo(imoId);
  }
}

export const joinRequestService = new JoinRequestService();
export { JoinRequestService };
