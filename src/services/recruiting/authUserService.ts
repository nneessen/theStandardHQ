// src/services/recruiting/authUserService.ts

import { supabase } from "@/services/base";

export interface CreateAuthUserParams {
  email: string;
  fullName: string;
  roles: string[];
  isAdmin?: boolean;
  skipPipeline?: boolean;
  /** Pass when the user_profiles record already exists (e.g., from lead acceptance).
   *  Ensures auth.users.id matches user_profiles.id so the handle_new_user trigger
   *  hits ON CONFLICT (id) instead of violating the UNIQUE (email) constraint. */
  existingProfileId?: string;
}

export interface CreateAuthUserResult {
  user: {
    id: string;
    email: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase auth user type
    [key: string]: any;
  };
  emailSent: boolean;
  message: string;
}

/**
 * Creates an auth user with corresponding user profile
 * This ensures both auth.users and user_profiles entries are created
 * Returns the user info and whether the password reset email was sent
 */
export async function createAuthUserWithProfile({
  email,
  fullName,
  roles,
  isAdmin = false,
  skipPipeline = false,
  existingProfileId,
}: CreateAuthUserParams): Promise<CreateAuthUserResult> {
  try {
    // Call Edge Function to create user with proper password reset email
    const { data, error } = await supabase.functions.invoke(
      "create-auth-user",
      {
        body: {
          email,
          fullName,
          roles,
          isAdmin,
          skipPipeline,
          existingProfileId,
        },
      },
    );

    if (error) {
      console.error("Auth user creation error:", error);
      // Check if the response body contains the actual error message
      const errorMessage =
        data?.error || data?.details || error.message || String(error);
      throw new Error(`Failed to create auth user: ${errorMessage}`);
    }

    // Handle case where user already exists (not an error)
    if (data?.alreadyExists) {
      return {
        user: data.user || { id: "existing", email },
        emailSent: false,
        message: data.message ?? "User already exists",
      };
    }

    if (!data?.user) {
      // Edge function returned 200 but no user - check for error in data
      if (data?.error) {
        throw new Error(data.error);
      }
      throw new Error("No user returned from auth creation");
    }

    return {
      user: data.user,
      emailSent: data.emailSent ?? false,
      message: data.message ?? "User created",
    };
  } catch (error) {
    console.error("Create auth user with profile error:", error);
    throw error;
  }
}

/**
 * Checks if a user with the given email already exists
 */
export async function checkUserExists(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking user existence:", error);
    return false;
  }

  return !!data;
}

export interface SendPasswordResetResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Sends a password reset email to the user
 * Uses the send-password-reset edge function
 */
export async function sendPasswordReset(
  email: string,
  redirectTo: string,
): Promise<SendPasswordResetResult> {
  const { data, error } = await supabase.functions.invoke(
    "send-password-reset",
    {
      body: {
        email,
        redirectTo,
      },
    },
  );

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to send password reset",
    };
  }

  return {
    success: data?.success === true,
    message: data?.message,
    error: data?.error,
  };
}
