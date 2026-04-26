// src/features/auth/AuthCallback.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../../services/base/supabase";
import { logger } from "../../services/base/logger";
import {
  AUTH_CALLBACK_TYPES,
  type AuthCallbackType,
  SESSION_STORAGE_KEYS,
} from "../../constants/auth.constants";

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState<string>("Verifying your email...");
  const [authType, setAuthType] = useState<AuthCallbackType | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type") as AuthCallbackType;
        const errorCode = hashParams.get("error_code");
        const errorDescription = hashParams.get("error_description");

        // Log all params for debugging (redact tokens)
        const allHashParams = Object.fromEntries(hashParams.entries());
        logger.auth("[AuthCallback] Hash received:", {
          ...allHashParams,
          access_token: allHashParams.access_token ? "[REDACTED]" : undefined,
          refresh_token: allHashParams.refresh_token ? "[REDACTED]" : undefined,
        });

        // For recovery errors, route to ResetPassword with error context
        if (
          (errorCode || errorDescription) &&
          type === AUTH_CALLBACK_TYPES.RECOVERY
        ) {
          logger.auth(
            "[AuthCallback] Recovery error detected, routing to reset password",
            {
              errorCode,
              errorDescription: errorDescription?.substring(0, 100),
            },
          );
          sessionStorage.setItem(
            SESSION_STORAGE_KEYS.PASSWORD_RESET_ERROR,
            JSON.stringify({
              code: errorCode,
              description: errorDescription,
              timestamp: new Date().toISOString(),
            }),
          );
          window.location.href = "/auth/reset-password?error=true";
          return;
        }

        if (errorCode || errorDescription) {
          throw new Error(
            errorDescription || `Authentication error: ${errorCode}`,
          );
        }

        setAuthType(type);
        logger.auth("Auth callback received", {
          type,
          hasAccessToken: !!accessToken,
        });

        if (type === AUTH_CALLBACK_TYPES.RECOVERY) {
          logger.auth(
            "Password recovery callback, redirecting to reset password",
          );
          // Store hash in sessionStorage before redirect (backup in case Supabase clears it)
          if (window.location.hash) {
            sessionStorage.setItem("recovery_hash", window.location.hash);
          }
          // Redirect to reset password page with hash intact so it can read the tokens
          setStatus("success");
          setMessage("Redirecting to password reset...");
          // Use window.location to preserve the hash with tokens
          window.location.href = `/auth/reset-password${window.location.hash}`;
          return;
        }

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          logger.auth("Session set successfully", {
            email: data.user?.email,
            type,
          });

          sessionStorage.removeItem(SESSION_STORAGE_KEYS.VERIFICATION_EMAIL);

          let successMessage = "Authentication successful! Redirecting...";
          if (type === AUTH_CALLBACK_TYPES.SIGNUP) {
            successMessage = "Email verified successfully! Welcome aboard!";
          } else if (type === AUTH_CALLBACK_TYPES.MAGICLINK) {
            successMessage = "Magic link verified! Signing you in...";
          } else if (type === AUTH_CALLBACK_TYPES.EMAIL_CHANGE) {
            successMessage = "Email updated successfully!";
          }

          setStatus("success");
          setMessage(successMessage);

          if (window.opener && !window.opener.closed) {
            setTimeout(() => {
              try {
                window.opener.location.href = "/dashboard";
                window.close();
              } catch (_e) {
                navigate({ to: "/dashboard" });
              }
            }, 2000);
          } else {
            setTimeout(() => {
              navigate({ to: "/dashboard" });
            }, 2000);
          }
        } else {
          throw new Error(
            "No authentication tokens found in URL. Please try the verification link again.",
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        logger.error(
          "Auth callback error",
          err instanceof Error ? err : String(err),
          "Auth",
        );

        setStatus("error");

        if (
          errorMessage.includes("expired") ||
          errorMessage.includes("invalid")
        ) {
          setMessage(
            "This verification link has expired or is invalid. Please request a new one.",
          );

          setTimeout(() => {
            navigate({ to: "/auth/verify-email" });
          }, 3000);
        } else if (
          errorMessage.includes("already") ||
          errorMessage.includes("confirmed")
        ) {
          setMessage("This email is already verified. Redirecting to login...");

          setTimeout(() => {
            navigate({ to: "/login" });
          }, 2000);
        } else {
          setMessage(
            errorMessage ||
              "Failed to verify email. Please try signing in again.",
          );

          setTimeout(() => {
            navigate({ to: "/login" });
          }, 3000);
        }
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="theme-v2 v2-canvas font-display text-v2-ink min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="bg-gradient-to-br from-card to-muted/10 rounded-2xl shadow-2xl p-8 text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground text-2xl font-bold mb-6 shadow-lg">
            CT
          </div>

          {/* Status Icon */}
          {status === "loading" && (
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {status === "success" && (
            <div className="flex justify-center mb-6">
              <svg
                className="h-12 w-12 text-status-active"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}

          {status === "error" && (
            <div className="flex justify-center mb-6">
              <svg
                className="h-12 w-12 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}

          {/* Message */}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {status === "loading" &&
              (authType === AUTH_CALLBACK_TYPES.SIGNUP
                ? "Verifying Email"
                : authType === AUTH_CALLBACK_TYPES.MAGICLINK
                  ? "Verifying Magic Link"
                  : "Authenticating")}
            {status === "success" && "Success!"}
            {status === "error" && "Verification Failed"}
          </h2>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
};
