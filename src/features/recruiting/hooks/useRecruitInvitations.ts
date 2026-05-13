// src/features/recruiting/hooks/useRecruitInvitations.ts

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { recruitInvitationService } from "@/services/recruiting/recruitInvitationService";
import type { InvitationValidationResult } from "@/types/recruiting.types";

// ============================================================================
// AUTHENTICATED HOOKS (for recruiters)
// ============================================================================

/**
 * Creates a new recruit with invitation and sends the email
 */
export function useCreateRecruitWithInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      email: string;
      message?: string;
      upline_id?: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      city?: string;
      state?: string;
      sendEmail?: boolean;
    }) => {
      const { sendEmail = true, ...options } = params;

      // Create recruit and invitation
      const result = await recruitInvitationService.createRecruitWithInvitation(
        options.email,
        options,
      );

      if (!result.success || !result.token) {
        throw new Error(result.message);
      }

      // Send email if requested
      if (sendEmail && result.invitation_id && result.token) {
        // Get current user info for email
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, email, phone")
          .eq("id", user?.id || "")
          .single();

        if (profile) {
          const inviterName =
            `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
            "Your Recruiter";

          const emailResult =
            await recruitInvitationService.sendInvitationEmail(
              result.invitation_id,
              result.token,
              options.email,
              options.first_name
                ? `${options.first_name}${options.last_name ? ` ${options.last_name}` : ""}`
                : null,
              inviterName,
              profile.email,
              profile.phone,
              options.message || null,
            );
          // Return the email result alongside the create result so onSuccess
          // can warn the user if the row was created but the email failed
          // (e.g., missing MAILGUN_API_KEY in dev or supabase secrets in prod).
          return {
            ...result,
            emailSent: emailResult.success,
            emailError: emailResult.error,
          };
        }
      }

      return { ...result, emailSent: !sendEmail, emailError: undefined };
    },
    onSuccess: (data) => {
      const emailFailed = "emailSent" in data && data.emailSent === false;
      if (emailFailed) {
        toast.warning("Recruit added — but the invite email didn't send", {
          description:
            "The registration link wasn't delivered. Likely cause: Mailgun env vars (MAILGUN_API_KEY / MAILGUN_DOMAIN) aren't set on the send-email function. Check Settings → Integrations or contact an admin.",
          duration: 10000,
        });
      } else {
        toast.success("Invitation sent successfully!", {
          description:
            "Registration link sent. User will be added when they complete the form.",
          duration: 5000,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["recruits"] });
      queryClient.invalidateQueries({ queryKey: ["recruit-invitations"] });
      queryClient.invalidateQueries({
        queryKey: ["pending-invitations-count"],
      });
    },
    onError: (error: Error) => {
      console.error("Failed to create invitation:", error);
      toast.error(
        error.message || "Failed to send invitation. Please try again.",
      );
    },
  });
}

/**
 * Creates an invitation for an existing recruit
 */
export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      recruitId: string;
      email: string;
      message?: string;
      sendEmail?: boolean;
    }) => {
      const { recruitId, email, message, sendEmail = true } = params;

      const result = await recruitInvitationService.createInvitation(
        recruitId,
        email,
        message,
      );

      if (!result.success || !result.token) {
        throw new Error(result.message);
      }

      // Send email if requested
      if (sendEmail && result.invitation_id && result.token) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, email, phone")
          .eq("id", user?.id || "")
          .single();

        // Get recruit info
        const { data: recruit } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", recruitId)
          .single();

        if (profile) {
          const inviterName =
            `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
            "Your Recruiter";
          const recruitName = recruit
            ? `${recruit.first_name || ""}${recruit.last_name ? ` ${recruit.last_name}` : ""}`.trim() ||
              null
            : null;

          await recruitInvitationService.sendInvitationEmail(
            result.invitation_id,
            result.token,
            email,
            recruitName,
            inviterName,
            profile.email,
            profile.phone,
            message || null,
          );
        }
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Invitation sent!");
      queryClient.invalidateQueries({ queryKey: ["recruit-invitations"] });
      queryClient.invalidateQueries({
        queryKey: ["pending-invitations-count"],
      });
    },
    onError: (error: Error) => {
      console.error("Failed to create invitation:", error);
      toast.error(error.message || "Failed to send invitation.");
    },
  });
}

/**
 * Resends an invitation with a new token
 */
export function useResendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      invitationId: string;
      email: string;
      recruitName?: string;
      message?: string;
    }) => {
      const { invitationId, email, recruitName, message } = params;

      const result =
        await recruitInvitationService.resendInvitation(invitationId);

      if (!result.success || !result.token) {
        throw new Error(result.message);
      }

      // Send email with new token
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, last_name, email, phone")
        .eq("id", user?.id || "")
        .single();

      if (profile) {
        const inviterName =
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
          "Your Recruiter";

        await recruitInvitationService.sendInvitationEmail(
          invitationId,
          result.token,
          email,
          recruitName || null,
          inviterName,
          profile.email,
          profile.phone,
          message || null,
        );
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Invitation resent!");
      queryClient.invalidateQueries({ queryKey: ["recruit-invitations"] });
    },
    onError: (error: Error) => {
      console.error("Failed to resend invitation:", error);
      toast.error(error.message || "Failed to resend invitation.");
    },
  });
}

/**
 * Cancels an invitation
 */
export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      recruitInvitationService.cancelInvitation(invitationId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Invitation cancelled.");
        queryClient.invalidateQueries({ queryKey: ["recruit-invitations"] });
        queryClient.invalidateQueries({
          queryKey: ["pending-invitations-count"],
        });
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: Error) => {
      console.error("Failed to cancel invitation:", error);
      toast.error("Failed to cancel invitation.");
    },
  });
}

/**
 * Gets invitations for a specific recruit
 */
export function useInvitationsForRecruit(recruitId: string | undefined) {
  return useQuery({
    queryKey: ["recruit-invitations", recruitId],
    queryFn: () =>
      recruitId
        ? recruitInvitationService.getInvitationsForRecruit(recruitId)
        : Promise.resolve([]),
    enabled: !!recruitId,
  });
}

/**
 * Gets the active invitation for a recruit
 */
export function useActiveInvitation(recruitId: string | undefined) {
  return useQuery({
    queryKey: ["recruit-invitations", recruitId, "active"],
    queryFn: () =>
      recruitId
        ? recruitInvitationService.getActiveInvitation(recruitId)
        : Promise.resolve(null),
    enabled: !!recruitId,
  });
}

/**
 * Gets all pending invitations for the current user
 */
export function usePendingInvitations() {
  return useQuery({
    queryKey: ["recruit-invitations", "pending"],
    queryFn: () => recruitInvitationService.getMyPendingInvitations(),
  });
}

/**
 * Gets pending invitations count for badge
 */
export function usePendingInvitationsCount() {
  return useQuery({
    queryKey: ["pending-invitations-count"],
    queryFn: () => recruitInvitationService.getPendingInvitationsCount(),
    refetchInterval: 60000, // Refresh every minute
  });
}

// ============================================================================
// PUBLIC HOOKS (no auth required - for registration page)
// ============================================================================

/**
 * Validates an invitation token (public, no auth required)
 * Uses direct state management instead of React Query to avoid
 * issues with query execution in public/unauthenticated context.
 */
export function useInvitationByToken(token: string | undefined) {
  const [data, setData] = useState<InvitationValidationResult | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setData({
        valid: false,
        error: "invitation_not_found",
        message: "No invitation token provided.",
      });
      return;
    }

    let cancelled = false;

    async function validateToken() {
      console.log("[useInvitationByToken] Validating token:", token);
      setIsLoading(true);
      setError(null);

      try {
        const result = await recruitInvitationService.validateToken(token!);
        console.log("[useInvitationByToken] Result:", result);

        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[useInvitationByToken] Error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setData({
            valid: false,
            error: "invitation_not_found",
            message: "Failed to validate invitation.",
          });
          setIsLoading(false);
        }
      }
    }

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { data, isLoading, error };
}

/**
 * Submits registration with password - for public registration page
 * Completes invite validation + auth/profile creation in a single edge flow
 */
export function useSubmitRegistrationWithPassword() {
  return useMutation({
    mutationFn: (params: {
      token: string;
      email: string;
      password: string;
      formData: {
        first_name: string;
        last_name: string;
        phone?: string;
        date_of_birth?: string;
        street_address?: string;
        city?: string;
        state?: string;
        zip?: string;
        instagram_username?: string;
        facebook_handle?: string;
        personal_website?: string;
        referral_source?: string;
      };
    }) =>
      recruitInvitationService.submitRegistrationWithPassword(
        params.token,
        params.email,
        params.password,
        params.formData,
      ),
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Account created!", {
          description: "You can now log in to track your progress.",
          duration: 5000,
        });
      }
    },
    onError: (error: Error) => {
      console.error("Failed to submit registration:", error);
      toast.error("Failed to create account. Please try again.");
    },
  });
}

// ============================================================================
// COMBINED HOOK
// ============================================================================

export function useRecruitInvitations(recruitId?: string) {
  const invitations = useInvitationsForRecruit(recruitId);
  const activeInvitation = useActiveInvitation(recruitId);
  const createWithInvite = useCreateRecruitWithInvitation();
  const createInvite = useCreateInvitation();
  const resendInvite = useResendInvitation();
  const cancelInvite = useCancelInvitation();

  return {
    invitations: invitations.data || [],
    activeInvitation: activeInvitation.data,
    isLoading: invitations.isLoading || activeInvitation.isLoading,
    createWithInvite,
    createInvite,
    resendInvite,
    cancelInvite,
  };
}
