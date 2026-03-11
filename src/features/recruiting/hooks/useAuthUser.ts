// src/features/recruiting/hooks/useAuthUser.ts
// Hook wrapper for auth user service functions

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createAuthUserWithProfile,
  sendPasswordReset,
  type CreateAuthUserParams,
} from "@/services/recruiting";

/**
 * Hook to send password reset email
 */
export function useSendPasswordReset() {
  return useMutation({
    mutationFn: ({
      email,
      redirectTo,
    }: {
      email: string;
      redirectTo: string;
    }) => sendPasswordReset(email, redirectTo),
    onError: (error: Error) => {
      console.error("Failed to send password reset:", error);
    },
  });
}

/**
 * Hook to create auth user with profile
 */
export function useCreateAuthUser() {
  return useMutation({
    mutationFn: (params: CreateAuthUserParams) =>
      createAuthUserWithProfile(params),
    onError: (error: Error) => {
      console.error("Failed to create auth user:", error);
    },
  });
}

/**
 * Combined hook to resend invite (tries password reset, falls back to creating auth user)
 */
export function useResendInvite() {
  return useMutation({
    mutationFn: async ({
      email,
      fullName,
      roles,
      existingProfileId,
    }: {
      email: string;
      fullName: string;
      roles: string[];
      /** The recruit's user_profiles.id — required when the profile was created
       *  before the auth user (e.g., from lead acceptance). Ensures the auth user
       *  is created with the same UUID. */
      existingProfileId?: string;
    }) => {
      const redirectTo = `${window.location.origin}/auth/callback`;

      // First, try to send password reset (works if auth user exists)
      const resetResult = await sendPasswordReset(email, redirectTo);

      if (resetResult.success) {
        return { success: true, method: "password_reset" as const };
      }

      // If there's an error (user not found in auth.users), create auth user first
      const shouldCreateAuthUser =
        resetResult.error?.includes("No auth account found") ||
        resetResult.error?.includes("not found") ||
        !resetResult.success;

      if (shouldCreateAuthUser) {
        console.log(
          "[useResendInvite] Auth user not found or error occurred, creating one...",
        );
        const createResult = await createAuthUserWithProfile({
          email,
          fullName,
          roles,
          isAdmin: false,
          skipPipeline: true,
          existingProfileId,
        });

        return {
          success: true,
          method: "create_user" as const,
          emailSent: createResult.emailSent,
          message: createResult.message,
        };
      }

      throw new Error(resetResult.error || "Failed to send invite");
    },
    onSuccess: (data) => {
      if (data.method === "password_reset") {
        toast.success("Invite sent!");
      } else if (data.emailSent) {
        toast.success("Login instructions sent!");
      } else if (data.message?.includes("already exists")) {
        toast.success("User already has an account. Sending password reset...");
      } else {
        toast.success(
          "Account created but email may not have sent. Check edge function logs.",
        );
      }
    },
    onError: (error: Error) => {
      const errorMsg = error.message.toLowerCase();
      if (
        errorMsg.includes("database error") ||
        errorMsg.includes("invalid email")
      ) {
        toast.error(
          "Cannot create account - email format may be invalid. Try updating the email address first.",
        );
      } else {
        toast.error(error.message || "Failed to create login access");
      }
    },
  });
}
