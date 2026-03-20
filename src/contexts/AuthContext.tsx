// /home/nneessen/projects/commissionTracker/src/contexts/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { isLocalSupabase, supabase } from "../services/base";
import {
  User as SupabaseUser,
  Session,
  AuthChangeEvent,
} from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import type { UserProfile } from "../types/user.types";
import { userService } from "../services/settings/userService";
import { logger } from "../services/base/logger";

export interface SignUpResult {
  requiresVerification: boolean;
  email: string;
}

interface AuthContextType {
  user: Partial<UserProfile> | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user metadata type
  updateUserMetadata: (metadata: any) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  requestEmailChange: (newEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Partial<UserProfile> | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  // Track previous user ID to prevent unnecessary state updates on tab focus
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        const newUserId = newSession?.user?.id ?? null;
        const previousUserId = previousUserIdRef.current;
        const isUserChange = previousUserId !== newUserId;

        // Always update session (for token refresh)
        setSession(newSession);

        // Only update user state if user ID actually changed
        // This prevents re-renders during token refresh when tab regains focus
        if (isUserChange) {
          setSupabaseUser(newSession?.user ?? null);

          if (newSession?.user) {
            // Start with basic profile from auth metadata
            const basicProfile = userService.mapAuthUserToProfile(
              newSession.user,
            );
            setUser(basicProfile);

            // Fetch full profile from database in background (non-blocking)
            (async () => {
              try {
                const { data: dbProfile } = await supabase
                  .from("user_profiles")
                  .select("*")
                  .eq("id", newSession.user.id)
                  .single();
                if (dbProfile) {
                  setUser((prev) => ({ ...prev, ...dbProfile }));
                }
              } catch (err: unknown) {
                logger.warn(
                  "Could not fetch full user profile",
                  err instanceof Error ? err : String(err),
                  "Auth",
                );
              }
            })();
          } else {
            setUser(null);
          }

          // Update ref after processing
          previousUserIdRef.current = newUserId;
        }

        switch (event) {
          case "SIGNED_IN":
            // Only clear cache if user actually changed (not session restore/token refresh)
            if (isUserChange && previousUserId !== null) {
              queryClient.clear();
              logger.auth("User signed in (new user)");
            } else if (isUserChange) {
              // First sign in (previousUserId was null) - clear for fresh start
              queryClient.clear();
              logger.auth("User signed in (initial)");
            } else {
              logger.auth("User session restored");
            }
            break;
          case "SIGNED_OUT":
            // Always clear cache on sign out to prevent data leakage
            queryClient.clear();
            logger.auth("User signed out");
            break;
          case "TOKEN_REFRESHED":
            // Never clear cache on token refresh - same user, just new token
            logger.auth("Token refreshed");
            break;
          case "USER_UPDATED":
            logger.auth("User updated");
            break;
          case "PASSWORD_RECOVERY":
            logger.auth("Password recovery initiated");
            break;
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkSession and queryClient are stable and only needed on mount
  }, []);

  const checkSession = async () => {
    try {
      setLoading(true);

      // Get the current session
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      setSession(session);
      setSupabaseUser(session?.user ?? null);

      if (session?.user) {
        // Set basic profile immediately from auth metadata
        const basicProfile = userService.mapAuthUserToProfile(session.user);
        setUser(basicProfile);

        // Initialize the ref with current user ID
        previousUserIdRef.current = session.user.id;

        // Await full profile from database before completing load
        // This ensures user.is_super_admin and user.roles are available
        // before ImoContext or other consumers run their queries
        try {
          const { data: dbProfile } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (dbProfile) {
            setUser((prev) => ({ ...prev, ...dbProfile }));
          }
        } catch (err: unknown) {
          logger.warn(
            "Could not fetch full user profile",
            err instanceof Error ? err : String(err),
            "Auth",
          );
        }

        logger.auth("Existing session found", { email: session.user.email });
        // Removed: await refreshSession() - unnecessary since session is already validated
        // and it triggers extra auth state events
      } else {
        setUser(null);
        previousUserIdRef.current = null;
      }
    } catch (err: unknown) {
      logger.error(
        "Error checking session",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(
        err instanceof Error ? err : new Error("Failed to check session"),
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error) throw error;

      setSession(session);
      setSupabaseUser(session?.user ?? null);

      if (session?.user) {
        const fullUser = userService.mapAuthUserToProfile(session.user);
        setUser(fullUser);
      }

      logger.auth("Session refreshed");
    } catch (err: unknown) {
      // Don't sign out on refresh errors - the existing session may still be valid
      // This prevents logout during OAuth redirects or transient network issues
      logger.warn(
        "Session refresh failed, continuing with existing session",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      // Don't throw - allow the app to continue with the existing session
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setSession(data.session);
      setSupabaseUser(data.user);

      if (data.user) {
        // Set basic profile immediately
        const basicProfile = userService.mapAuthUserToProfile(data.user);
        setUser(basicProfile);

        // Fetch full profile in background (non-blocking)
        (async () => {
          try {
            const { data: dbProfile } = await supabase
              .from("user_profiles")
              .select("*")
              .eq("id", data.user.id)
              .single();
            if (dbProfile) {
              setUser((prev) => ({ ...prev, ...dbProfile }));
            }
          } catch (err: unknown) {
            logger.warn(
              "Could not fetch full user profile",
              err instanceof Error ? err : String(err),
              "Auth",
            );
          }
        })();
      }

      logger.auth("Sign in successful", { email: data.user?.email });
    } catch (err: unknown) {
      logger.error(
        "Sign in error",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(err instanceof Error ? err : new Error("Failed to sign in"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
  ): Promise<SignUpResult> => {
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: email.split("@")[0],
          },
        },
      });

      if (error) throw error;

      const requiresVerification = data.user && !data.session;

      if (requiresVerification) {
        logger.auth("Email confirmation required", { email });
        return { requiresVerification: true, email };
      }

      if (data.session && data.user) {
        setSession(data.session);
        setSupabaseUser(data.user);

        const fullUser = userService.mapAuthUserToProfile(data.user);
        setUser(fullUser);

        logger.auth("Sign up successful (auto-confirmed)", {
          email: data.user.email,
        });
      }

      return { requiresVerification: false, email };
    } catch (err: unknown) {
      logger.error(
        "Sign up error",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(err instanceof Error ? err : new Error("Failed to sign up"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      setLoading(true);

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      // Clear ALL cached data to prevent data leakage between users
      queryClient.clear();

      setSession(null);
      setSupabaseUser(null);
      setUser(null);

      logger.auth("Sign out successful");
    } catch (err: unknown) {
      logger.error(
        "Sign out error",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(err instanceof Error ? err : new Error("Failed to sign out"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      setLoading(true);

      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error: fnError } = await supabase.functions.invoke(
        "send-password-reset",
        {
          body: {
            email,
            redirectTo,
          },
        },
      );

      if (fnError) throw fnError;
      if (data?.success === false) throw new Error(data.error);

      if (isLocalSupabase && typeof data?.recoveryUrl === "string") {
        logger.auth("Redirecting browser to local password recovery flow");

        if (!(import.meta.env.MODE === "test" || import.meta.env.VITEST)) {
          window.location.assign(data.recoveryUrl);
        }

        return;
      }

      logger.auth("Password reset email sent");
    } catch (err: unknown) {
      logger.error(
        "Password reset error",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(
        err instanceof Error ? err : new Error("Failed to reset password"),
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      setError(null);
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Track password set time in user_profiles (only if not already set)
      // This enables password reminder automations to skip users who've set their password
      if (user?.id) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .update({ password_set_at: new Date().toISOString() })
          .eq("id", user.id)
          .is("password_set_at", null);

        if (profileError) {
          // Log but don't fail - password update succeeded, tracking is secondary
          logger.error("Failed to track password_set_at", profileError, "Auth");
        }
      }

      logger.auth("Password updated successfully");
    } catch (err: unknown) {
      logger.error(
        "Password update error",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(
        err instanceof Error ? err : new Error("Failed to update password"),
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user metadata type
  const updateUserMetadata = async (metadata: any) => {
    try {
      if (!user) {
        throw new Error("No authenticated user");
      }

      setError(null);
      setLoading(true);

      const result = await userService.updateUser(user.id!, metadata);
      if (result.success && result.data) {
        setUser(result.data);
      } else if (!result.success) {
        throw new Error(result.error || "Failed to update user");
      }

      logger.auth("User metadata updated successfully");
    } catch (err: unknown) {
      logger.error(
        "Error updating user metadata",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to update user metadata"),
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      setError(null);

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      logger.auth("Verification email resent", { email });
    } catch (err: unknown) {
      logger.error(
        "Resend verification email error",
        err instanceof Error ? err : String(err),
        "Auth",
      );
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to resend verification email"),
      );
      throw err;
    }
  };

  const requestEmailChange = async (newEmail: string) => {
    const { data, error: fnError } = await supabase.functions.invoke(
      "send-email-change",
      { body: { newEmail } },
    );
    if (fnError || !data?.success) {
      throw new Error(
        data?.error || fnError?.message || "Failed to send confirmation email",
      );
    }
    logger.auth("Email change confirmation sent");
  };

  const value: AuthContextType = {
    user,
    supabaseUser,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
    updateUserMetadata,
    resendVerificationEmail,
    requestEmailChange,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
