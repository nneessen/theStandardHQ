// src/services/hierarchy/invitationService.ts
// Service layer for hierarchy invitation system - handles all invitation business logic

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import { emailService } from "../email";
import { InvitationRepository, InviterProfile } from "./InvitationRepository";
import type {
  SendInvitationRequest,
  SendInvitationResponse,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  DenyInvitationRequest,
  CancelInvitationRequest,
  ResendInvitationRequest,
  InvitationWithDetails,
  InvitationStats,
} from "../../types/invitation.types";
import { NotFoundError } from "../../errors/ServiceErrors";

/**
 * Service layer for hierarchy invitation operations
 * Handles all invitation business logic with comprehensive validation
 */
class InvitationService {
  private repository: InvitationRepository;

  constructor() {
    this.repository = new InvitationRepository();
  }

  /**
   * Send an invitation to add someone to your downline
   * Validates all business rules before creating invitation
   */
  async sendInvitation(
    request: SendInvitationRequest,
  ): Promise<SendInvitationResponse> {
    try {
      // Get current user (inviter)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Validate invitation via repository RPC
      const validation = await this.repository.validateEligibility(
        user.id,
        request.invitee_email,
      );

      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join("; "),
          warnings: validation.warnings,
        };
      }

      // Create invitation via repository
      const invitation = await this.repository.create({
        inviter_id: user.id,
        invitee_email: request.invitee_email.toLowerCase().trim(),
        message: request.message || null,
        status: "pending",
      });

      // Get inviter's profile for email
      const inviterProfile = await this.repository.getUserProfile(user.id);
      const inviterName = this.formatInviterName(inviterProfile);

      // Send invitation email via Mailgun
      try {
        const emailHTML = this.generateInvitationEmailHTML(
          inviterName,
          request.invitee_email,
          request.message,
        );

        // Determine sender: owner uses personal email, others use system noreply
        const senderEmail = this.getSenderEmailAddress(
          inviterProfile?.email,
          inviterName,
        );

        await emailService.sendEmail({
          to: [request.invitee_email],
          subject: `${inviterName} invited you to join their team`,
          html: emailHTML,
          text: emailService.htmlToText(emailHTML),
          from: senderEmail,
        });

        logger.info(
          "Invitation email sent",
          {
            invitationId: invitation.id,
            inviteeEmail: request.invitee_email,
          },
          "InvitationService",
        );
      } catch (emailError) {
        // Log email failure but don't fail the invitation
        logger.error(
          "Failed to send invitation email",
          emailError instanceof Error
            ? emailError
            : new Error(String(emailError)),
        );
        // Add warning to response
        validation.warnings.push(
          "Invitation created but email notification failed to send",
        );
      }

      logger.info(
        "Invitation sent",
        {
          inviterId: user.id,
          inviteeEmail: request.invitee_email,
          invitationId: invitation.id,
        },
        "InvitationService",
      );

      return {
        success: true,
        invitation,
        warnings: validation.warnings,
      };
    } catch (error) {
      logger.error(
        "InvitationService.sendInvitation",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Accept an invitation (invitee side)
   * Sets upline_id via database trigger
   */
  async acceptInvitation(
    request: AcceptInvitationRequest,
  ): Promise<AcceptInvitationResponse> {
    try {
      // Get current user (invitee)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Get invitation via repository
      const invitation = await this.repository.findById(request.invitation_id);

      if (!invitation) {
        throw new NotFoundError("Invitation", request.invitation_id);
      }

      // Validate acceptance via repository RPC
      const validation = await this.repository.validateAcceptance(
        user.id,
        invitation.id,
      );

      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join("; "),
        };
      }

      // Update status to 'accepted' (trigger will handle upline_id update)
      const updatedInvitation = await this.repository.updateStatus(
        request.invitation_id,
        "accepted",
      );

      // Emit invitation.accepted (non-fatal). recipientId = the inviter, who is
      // notified their invite was accepted.
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.INVITATION_ACCEPTED, {
        recipientId: invitation.inviter_id ?? undefined,
        inviteeId: user.id,
        invitationId: invitation.id,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        "Invitation accepted",
        {
          inviteeId: user.id,
          invitationId: request.invitation_id,
          inviterId: invitation.inviter_id,
        },
        "InvitationService",
      );

      return {
        success: true,
        invitation: updatedInvitation,
      };
    } catch (error) {
      logger.error(
        "InvitationService.acceptInvitation",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Deny an invitation (invitee side)
   */
  async denyInvitation(
    request: DenyInvitationRequest,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user (invitee)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Verify invitation belongs to user and is pending
      const invitation = await this.repository.findPendingByInviteeId(
        request.invitation_id,
        user.id,
      );

      if (!invitation) {
        return {
          success: false,
          error: "Invitation not found or already processed",
        };
      }

      // Update status to 'denied'
      await this.repository.updateStatus(request.invitation_id, "denied");

      logger.info(
        "Invitation denied",
        {
          inviteeId: user.id,
          invitationId: request.invitation_id,
        },
        "InvitationService",
      );

      return { success: true };
    } catch (error) {
      logger.error(
        "InvitationService.denyInvitation",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Cancel an invitation (inviter side)
   */
  async cancelInvitation(
    request: CancelInvitationRequest,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user (inviter)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Verify invitation belongs to user and is pending
      const invitation = await this.repository.findPendingByInviterId(
        request.invitation_id,
        user.id,
      );

      if (!invitation) {
        return {
          success: false,
          error: "Invitation not found or already processed",
        };
      }

      // Update status to 'cancelled'
      await this.repository.updateStatus(request.invitation_id, "cancelled");

      logger.info(
        "Invitation cancelled",
        {
          inviterId: user.id,
          invitationId: request.invitation_id,
        },
        "InvitationService",
      );

      return { success: true };
    } catch (error) {
      logger.error(
        "InvitationService.cancelInvitation",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Resend an invitation (updates expiration date)
   */
  async resendInvitation(
    request: ResendInvitationRequest,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user (inviter)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Verify invitation belongs to user and is pending
      const invitation = await this.repository.findPendingByInviterId(
        request.invitation_id,
        user.id,
      );

      if (!invitation) {
        return {
          success: false,
          error: "Invitation not found or already processed",
        };
      }

      // SECURITY FIX: Re-validate the invitation before resending
      // This prevents resending to non-existent users or invalid invitees
      // Pass invitation_id to exclude from "pending invitation exists" check
      const validation = await this.repository.validateEligibility(
        user.id,
        invitation.invitee_email,
        request.invitation_id, // Exclude this invitation from duplicate check
      );

      if (!validation.valid) {
        // Auto-cancel the invalid invitation
        try {
          await this.repository.updateStatus(
            request.invitation_id,
            "cancelled",
          );
        } catch (cancelError) {
          // Log but continue - the validation failure is the primary issue
          logger.error(
            "Failed to cancel invalid invitation",
            {
              invitationId: request.invitation_id,
              cancelError:
                cancelError instanceof Error
                  ? cancelError.message
                  : String(cancelError),
            },
            "InvitationService",
          );
        }
        logger.warn(
          "Invalid invitation cancelled on resend attempt",
          {
            invitationId: request.invitation_id,
            inviteeEmail: invitation.invitee_email,
            errors: validation.errors,
          },
          "InvitationService",
        );
        return {
          success: false,
          error:
            validation.errors.join("; ") + ". Invitation has been cancelled.",
        };
      }

      // Check if invitation is expired
      const now = new Date();
      const expiresAt = new Date(invitation.expires_at);
      const isExpired = now > expiresAt;

      // Update expires_at to 7 days from now
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      await this.repository.extendExpiration(
        request.invitation_id,
        newExpiresAt,
      );

      // Get inviter's profile for email
      const inviterProfile = await this.repository.getUserProfile(user.id);
      const inviterName = this.formatInviterName(inviterProfile);

      // Send invitation email via Mailgun
      try {
        const emailHTML = this.generateInvitationEmailHTML(
          inviterName,
          invitation.invitee_email,
          invitation.message,
        );

        // Determine sender: owner uses personal email, others use system noreply
        const senderEmail = this.getSenderEmailAddress(
          inviterProfile?.email,
          inviterName,
        );

        await emailService.sendEmail({
          to: [invitation.invitee_email],
          subject: `Reminder: ${inviterName} invited you to join their team`,
          html: emailHTML,
          text: emailService.htmlToText(emailHTML),
          from: senderEmail,
        });

        logger.info(
          "Invitation resend email sent",
          {
            invitationId: request.invitation_id,
            inviteeEmail: invitation.invitee_email,
          },
          "InvitationService",
        );
      } catch (emailError) {
        // Log email failure but don't fail the resend
        logger.error(
          "Failed to send invitation resend email",
          emailError instanceof Error
            ? emailError
            : new Error(String(emailError)),
        );
      }

      logger.info(
        "Invitation resent",
        {
          inviterId: user.id,
          invitationId: request.invitation_id,
          inviteeEmail: invitation.invitee_email,
          wasExpired: isExpired,
          newExpiresAt: newExpiresAt.toISOString(),
        },
        "InvitationService",
      );

      return { success: true };
    } catch (error) {
      logger.error(
        "InvitationService.resendInvitation",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get all invitations received by current user
   */
  async getReceivedInvitations(
    status?: string,
  ): Promise<InvitationWithDetails[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Get all invitations for this user via repository
      const invitations = await this.repository.findPendingForInvitee(
        user.id,
        user.email?.toLowerCase() || "",
      );

      // Apply status filter if provided
      const filtered = status
        ? invitations.filter((inv) => inv.status === status)
        : invitations;

      // Enrich with details via repository
      return await this.repository.enrichWithDetails(filtered);
    } catch (error) {
      logger.error(
        "InvitationService.getReceivedInvitations",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get all invitations sent by current user
   */
  async getSentInvitations(status?: string): Promise<InvitationWithDetails[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Get sent invitations via repository
      const invitations = await this.repository.findByInviterId(
        user.id,
        status,
      );

      // Enrich with details via repository
      return await this.repository.enrichWithDetails(invitations);
    } catch (error) {
      logger.error(
        "InvitationService.getSentInvitations",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get invitation statistics for current user
   */
  async getInvitationStats(): Promise<InvitationStats> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Get stats via repository
      return await this.repository.getStatsByUserId(user.id);
    } catch (error) {
      logger.error(
        "InvitationService.getInvitationStats",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Format inviter name for display
   */
  private formatInviterName(profile: InviterProfile | null): string {
    if (!profile) return "A team member";

    const fullName =
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    return fullName || profile.email || "A team member";
  }

  /**
   * Get the sender email address for invitation emails
   * Returns the inviter's personal email if they're the owner, otherwise noreply
   */
  private getSenderEmailAddress(
    inviterEmail: string | null | undefined,
    inviterName: string,
  ): string {
    // Owner email - when the owner sends invitations, use their personal email
    const OWNER_EMAIL = "nickneessen@thestandardhq.com";
    const SYSTEM_EMAIL = "noreply@thestandardhq.com";

    if (inviterEmail?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      return `${inviterName} <${OWNER_EMAIL}>`;
    }

    // For all other users, use the system noreply address
    return `The Standard HQ <${SYSTEM_EMAIL}>`;
  }

  /**
   * Generate invitation email HTML
   * Uses zinc-based styling to match the application design
   */
  private generateInvitationEmailHTML(
    inviterName: string,
    inviteeEmail: string,
    message?: string | null,
  ): string {
    // Use environment variable or fallback to production URL
    const appUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : import.meta.env.VITE_APP_URL || "https://yourapp.com";
    const hierarchyUrl = `${appUrl}/hierarchy`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #3f3f46; max-width: 560px; margin: 0 auto; padding: 16px; background-color: #fafafa;">
  <!-- Header -->
  <div style="background-color: #18181b; padding: 20px 24px; border-radius: 6px 6px 0 0;">
    <h1 style="color: #fafafa; margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.02em;">Team Invitation</h1>
  </div>

  <!-- Main Content -->
  <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 6px 6px;">
    <p style="font-size: 14px; margin: 0 0 16px 0; color: #52525b;">Hi there,</p>

    <p style="font-size: 14px; margin: 0 0 20px 0; color: #27272a;">
      <strong style="color: #18181b;">${inviterName}</strong> has invited you to join their team.
    </p>

    ${
      message
        ? `
    <div style="background-color: #f4f4f5; padding: 12px 16px; border-left: 3px solid #18181b; margin: 0 0 20px 0; border-radius: 0 4px 4px 0;">
      <p style="margin: 0; font-size: 13px; font-style: italic; color: #52525b;">"${message}"</p>
    </div>
    `
        : ""
    }

    <p style="font-size: 13px; margin: 0 0 12px 0; color: #52525b; font-weight: 500;">To accept this invitation:</p>

    <ol style="font-size: 13px; line-height: 1.7; margin: 0 0 24px 0; padding-left: 20px; color: #3f3f46;">
      <li style="margin-bottom: 4px;">Log into your account using <strong style="color: #18181b;">${inviteeEmail}</strong></li>
      <li style="margin-bottom: 4px;">Go to the Team page</li>
      <li style="margin-bottom: 4px;">Click Accept on the invitation banner</li>
    </ol>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 24px 0;">
      <a href="${hierarchyUrl}" style="display: inline-block; background-color: #18181b; color: #fafafa; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 13px;">View Invitation</a>
    </div>

    <p style="font-size: 12px; color: #71717a; margin: 20px 0 0 0;">
      This invitation expires in 7 days. You can decline it from the Team page if needed.
    </p>

    <!-- Divider -->
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;">

    <!-- Footer -->
    <p style="font-size: 11px; color: #a1a1aa; text-align: center; margin: 0;">
      If you didn't expect this invitation, please contact your team leader.
    </p>
  </div>

  <!-- Email Footer -->
  <div style="text-align: center; padding: 16px 0;">
    <p style="font-size: 11px; color: #a1a1aa; margin: 0;">The Standard HQ</p>
  </div>
</body>
</html>
    `.trim();
  }
}

export { InvitationService };
export const invitationService = new InvitationService();
