// src/services/recruiting/recruitInvitationService.ts

import { supabase } from "../base/supabase";
import type {
  RecruitInvitation,
  CreateInvitationResult,
  InvitationValidationResult,
  RegistrationFormData,
  RegistrationResult,
} from "@/types/recruiting.types";

/**
 * Service for managing recruit self-registration invitations
 */
export const recruitInvitationService = {
  // ========================================
  // AUTHENTICATED METHODS (for recruiters)
  // ========================================

  /**
   * Creates an invitation for a new recruit
   * No user_profiles record is created - that happens when they submit the registration form
   */
  async createRecruitWithInvitation(
    email: string,
    options?: {
      message?: string;
      upline_id?: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      city?: string;
      state?: string;
    },
  ): Promise<{
    success: boolean;
    recruit_id?: string;
    invitation_id?: string;
    token?: string;
    error?: string;
    message: string;
  }> {
    try {
      // Create invitation via RPC (user is created when form is submitted)
      const { data: invitationResult, error: invitationError } = await supabase
        .rpc("create_recruit_invitation", {
          p_email: email.toLowerCase().trim(),
          p_message: options?.message || null,
          p_first_name: options?.first_name || null,
          p_last_name: options?.last_name || null,
          p_phone: options?.phone || null,
          p_city: options?.city || null,
          p_state: options?.state || null,
          p_upline_id: options?.upline_id || null,
        })
        .single();

      const typedResult = invitationResult as CreateInvitationResult | null;

      if (invitationError) {
        console.error("Error creating invitation:", invitationError);
        return {
          success: false,
          error: "invitation_failed",
          message: "Failed to create invitation. Please try again.",
        };
      }

      if (!typedResult?.success) {
        return {
          success: false,
          error: typedResult?.error || "invitation_failed",
          message:
            typedResult?.message ||
            "Failed to create invitation. Please try again.",
        };
      }

      return {
        success: true,
        // No recruit_id yet - created when form is submitted
        recruit_id: undefined,
        invitation_id: typedResult.invitation_id,
        token: typedResult.token,
        message: "Invitation created successfully.",
      };
    } catch (error) {
      console.error("Error in createRecruitWithInvitation:", error);
      return {
        success: false,
        error: "unexpected_error",
        message: "An unexpected error occurred. Please try again.",
      };
    }
  },

  /**
   * Creates an invitation for an existing recruit
   * @deprecated Use createRecruitWithInvitation instead. The new architecture
   * defers user creation until form submission. This function now fetches
   * the recruit's existing data to prefill the invitation.
   */
  async createInvitation(
    recruitId: string,
    email: string,
    message?: string,
  ): Promise<CreateInvitationResult> {
    // Fetch existing recruit data for prefill
    const { data: recruit } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, phone, city, state")
      .eq("id", recruitId)
      .single();

    const { data, error } = await supabase
      .rpc("create_recruit_invitation", {
        p_email: email.toLowerCase().trim(),
        p_message: message || null,
        p_first_name: recruit?.first_name || null,
        p_last_name: recruit?.last_name || null,
        p_phone: recruit?.phone || null,
        p_city: recruit?.city || null,
        p_state: recruit?.state || null,
      })
      .single();

    if (error) {
      console.error("Error creating invitation:", error);
      // Check for specific error types
      if (error.message?.includes("email_exists")) {
        return {
          success: false,
          error: "email_exists",
          message: "A user with this email already exists in the system.",
        };
      }
      return {
        success: false,
        error: "rpc_error",
        message: "Failed to create invitation. Please try again.",
      };
    }

    return data as CreateInvitationResult;
  },

  /**
   * Marks an invitation as sent (after email is delivered)
   */
  async markInvitationSent(invitationId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc("mark_invitation_sent", { p_invitation_id: invitationId })
      .single();

    if (error) {
      console.error("Error marking invitation sent:", error);
      return false;
    }

    const result = data as { success: boolean } | null;
    return result?.success ?? false;
  },

  /**
   * Resends an invitation (generates new token, resets expiration)
   */
  async resendInvitation(invitationId: string): Promise<{
    success: boolean;
    token?: string;
    error?: string;
    message: string;
  }> {
    const { data, error } = await supabase
      .rpc("resend_recruit_invitation", { p_invitation_id: invitationId })
      .single();

    if (error) {
      console.error("Error resending invitation:", error);
      return {
        success: false,
        error: "rpc_error",
        message: "Failed to resend invitation. Please try again.",
      };
    }

    return data as {
      success: boolean;
      token?: string;
      error?: string;
      message: string;
    };
  },

  /**
   * Cancels an invitation
   */
  async cancelInvitation(
    invitationId: string,
  ): Promise<{ success: boolean; error?: string; message: string }> {
    const { data, error } = await supabase
      .rpc("cancel_recruit_invitation", { p_invitation_id: invitationId })
      .single();

    if (error) {
      console.error("Error cancelling invitation:", error);
      return {
        success: false,
        error: "rpc_error",
        message: "Failed to cancel invitation. Please try again.",
      };
    }

    return data as { success: boolean; error?: string; message: string };
  },

  /**
   * Gets invitations for a specific recruit
   */
  async getInvitationsForRecruit(
    recruitId: string,
  ): Promise<RecruitInvitation[]> {
    const { data, error } = await supabase
      .from("recruit_invitations")
      .select("*")
      .eq("recruit_id", recruitId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invitations for recruit:", error);
      return [];
    }

    return (data as RecruitInvitation[]) || [];
  },

  /**
   * Gets the latest active invitation for a recruit
   */
  async getActiveInvitation(
    recruitId: string,
  ): Promise<RecruitInvitation | null> {
    const { data, error } = await supabase
      .from("recruit_invitations")
      .select("*")
      .eq("recruit_id", recruitId)
      .in("status", ["pending", "sent", "viewed"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching active invitation:", error);
      return null;
    }

    return data as RecruitInvitation | null;
  },

  /**
   * Gets all pending/active invitations sent by the current user
   */
  async getMyPendingInvitations(): Promise<RecruitInvitation[]> {
    const { data, error } = await supabase
      .from("recruit_invitations")
      .select(
        `
        *,
        recruit:recruit_id (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .in("status", ["pending", "sent", "viewed"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending invitations:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Gets count of pending invitations for badge
   */
  async getPendingInvitationsCount(): Promise<number> {
    const { data, error } = await supabase
      .rpc("get_pending_invitations_count")
      .single();

    if (error) {
      console.error("Error getting pending count:", error);
      return 0;
    }

    return (data as number) || 0;
  },

  // ========================================
  // PUBLIC METHODS (no auth required)
  // ========================================

  /**
   * Validates an invitation token and returns prefilled data
   * This is called from the public registration page
   */
  async validateToken(token: string): Promise<InvitationValidationResult> {
    console.log("[validateToken] Starting validation for token:", token);

    try {
      // Note: Don't use .single() for RPC calls that return JSON
      // The RPC returns JSON directly, not a row
      const { data, error } = await supabase.rpc(
        "get_public_invitation_by_token",
        { p_token: token },
      );

      console.log("[validateToken] RPC response:", { data, error });

      if (error) {
        console.error("[validateToken] Error validating token:", error);
        return {
          valid: false,
          error: "invitation_not_found",
          message: "Unable to validate invitation. Please try again.",
        };
      }

      if (!data) {
        console.error("[validateToken] No data returned");
        return {
          valid: false,
          error: "invitation_not_found",
          message: "Invalid invitation token.",
        };
      }

      console.log("[validateToken] Success, returning data");
      return data as InvitationValidationResult;
    } catch (err) {
      console.error("[validateToken] Exception caught:", err);
      return {
        valid: false,
        error: "invitation_not_found",
        message: "An error occurred while validating the invitation.",
      };
    }
  },

  /**
   * Submits the registration form data with password
   * This is called from the public registration page
   * Validates the invitation and completes auth/profile creation in one edge flow
   */
  async submitRegistrationWithPassword(
    token: string,
    email: string,
    password: string,
    formData: Omit<RegistrationFormData, "password" | "confirm_password">,
  ): Promise<RegistrationResult> {
    console.log("[submitRegistrationWithPassword] Starting for token:", token);

    try {
      console.log(
        "[submitRegistrationWithPassword] Completing invite registration via edge function...",
      );

      const { data: edgeFnData, error: edgeFnError } =
        await supabase.functions.invoke("complete-recruit-registration", {
          body: {
            token,
            email,
            password,
            formData,
          },
        });

      if (edgeFnError) {
        console.error(
          "[submitRegistrationWithPassword] Edge function failed:",
          edgeFnError,
        );
        return {
          success: false,
          error: "auth_failed",
          message: edgeFnError.message || "Failed to create account.",
        };
      }

      if (!edgeFnData) {
        console.error(
          "[submitRegistrationWithPassword] No data returned from edge function",
        );
        return {
          success: false,
          error: "submission_failed",
          message: "Registration failed. Please try again.",
        };
      }

      if (edgeFnData.success !== true) {
        console.error(
          "[submitRegistrationWithPassword] Registration failed:",
          edgeFnData,
        );
        return {
          success: false,
          error:
            typeof edgeFnData.error === "string"
              ? edgeFnData.error
              : "submission_failed",
          message:
            typeof edgeFnData.message === "string"
              ? edgeFnData.message
              : "Failed to complete registration. Please try again.",
        };
      }

      const result = edgeFnData as RegistrationResult;
      console.log("[submitRegistrationWithPassword] Success:", result);

      return result;
    } catch (err) {
      console.error("[submitRegistrationWithPassword] Exception:", err);
      return {
        success: false,
        error: "submission_failed",
        message: "An error occurred. Please try again.",
      };
    }
  },

  // ========================================
  // EMAIL SENDING
  // ========================================

  /**
   * Sends the invitation email to the recruit
   */
  async sendInvitationEmail(
    invitationId: string,
    token: string,
    recipientEmail: string,
    recipientName: string | null,
    inviterName: string,
    inviterEmail: string,
    inviterPhone: string | null,
    message: string | null,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Build registration URL
      const baseUrl =
        import.meta.env.VITE_APP_URL || "https://www.thestandardhq.com";
      const registrationUrl = `${baseUrl}/register/${token}`;

      // Build email body
      const recipientDisplayName = recipientName || "there";
      const emailBody = buildInvitationEmailHtml({
        recipientName: recipientDisplayName,
        inviterName,
        inviterEmail,
        inviterPhone,
        message,
        registrationUrl,
        expiresIn: "7 days",
      });

      // Send via edge function directly (no quota needed for system emails)
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: [recipientEmail],
          subject: `${inviterName} invited you to join The Standard`,
          html: emailBody,
          text: `Hi ${recipientDisplayName},\n\n${inviterName} has invited you to join The Standard.\n\nClick here to complete your registration: ${registrationUrl}\n\nThis link expires in 7 days.${message ? `\n\nMessage from ${inviterName}:\n${message}` : ""}\n\nIf you have questions, contact ${inviterName} at ${inviterEmail}${inviterPhone ? ` or ${inviterPhone}` : ""}.`,
          from: `The Standard HQ <noreply@updates.thestandardhq.com>`,
          replyTo: inviterEmail,
        },
      });

      if (error) {
        console.error("Error sending invitation email:", error);
        return { success: false, error: error.message };
      }

      // Mark invitation as sent
      await this.markInvitationSent(invitationId);

      return { success: true };
    } catch (err) {
      console.error("Error in sendInvitationEmail:", err);
      return { success: false, error: "Failed to send email" };
    }
  },
};

/**
 * Builds the HTML email template for invitations
 */
function buildInvitationEmailHtml(params: {
  recipientName: string;
  inviterName: string;
  inviterEmail: string;
  inviterPhone: string | null;
  message: string | null;
  registrationUrl: string;
  expiresIn: string;
}): string {
  const {
    recipientName,
    inviterName,
    inviterEmail,
    inviterPhone,
    message,
    registrationUrl,
    expiresIn,
  } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join The Standard</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">You're Invited!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #3f3f46;">
                Hi ${recipientName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; color: #3f3f46;">
                <strong>${inviterName}</strong> has invited you to join The Standard. Complete your registration to get started with your onboarding.
              </p>

              ${
                message
                  ? `
              <div style="margin: 24px 0; padding: 16px; background-color: #f4f4f5; border-radius: 6px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 500; color: #71717a;">Message from ${inviterName}:</p>
                <p style="margin: 0; font-size: 15px; color: #3f3f46; font-style: italic;">"${message}"</p>
              </div>
              `
                  : ""
              }

              <div style="text-align: center; margin: 32px 0;">
                <a href="${registrationUrl}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #2563eb; text-decoration: none; border-radius: 6px;">
                  Complete Registration
                </a>
              </div>

              <p style="margin: 0 0 8px; font-size: 14px; color: #71717a; text-align: center;">
                This link expires in ${expiresIn}.
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #3b82f6; word-break: break-all;">
                ${registrationUrl}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e4e4e7; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">
                Questions? Contact your recruiter:
              </p>
              <p style="margin: 0; font-size: 14px; color: #3f3f46;">
                <strong>${inviterName}</strong><br>
                <a href="mailto:${inviterEmail}" style="color: #2563eb; text-decoration: none;">${inviterEmail}</a>
                ${inviterPhone ? `<br>${inviterPhone}` : ""}
              </p>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
          © ${new Date().getFullYear()} The Standard HQ. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export default recruitInvitationService;
