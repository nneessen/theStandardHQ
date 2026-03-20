// src/features/auth/Login.tsx

import React, { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "../../contexts/AuthContext";
import { isLocalSupabase } from "../../services/base";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import { SESSION_STORAGE_KEYS } from "../../constants/auth.constants";
import { AuthErrorDisplay } from "./components/AuthErrorDisplay";
import { AuthSuccessMessage } from "./components/AuthSuccessMessage";
import { SignInForm } from "./components/SignInForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Info, Shield, TrendingUp, Users } from "lucide-react";

interface LoginProps {
  onSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const formErrors = {};
  const validateForm = (
    _email: string,
    _password: string,
    _confirmPassword: string,
    _mode: string,
  ) => true;
  const clearErrors = () => {};
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm(email, password, "", mode)) {
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        await signIn(email, password);
        onSuccess?.();
      } else if (mode === "reset") {
        await resetPassword(email);
        setMessage(
          isLocalSupabase
            ? "Redirecting to the local password reset flow..."
            : "Password reset email sent! Check your inbox.",
        );
        setTimeout(() => setMode("signin"), 3000);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      const errorLower = errorMessage.toLowerCase();

      if (
        errorLower.includes("email not confirmed") ||
        errorLower.includes("email not verified")
      ) {
        setError("Please verify your email before signing in.");
        sessionStorage.setItem(SESSION_STORAGE_KEYS.VERIFICATION_EMAIL, email);
        setTimeout(() => {
          navigate({
            to: "/auth/verify-email",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- router state type
          } as any);
        }, 1500);
      } else if (
        mode === "signin" &&
        (errorLower.includes("invalid login credentials") ||
          errorLower.includes("invalid email or password") ||
          errorLower.includes("email not found"))
      ) {
        setError("No account found or incorrect password. ");
      } else if (
        errorLower.includes("user is disabled") ||
        errorLower.includes("account has been disabled") ||
        errorLower.includes("account suspended")
      ) {
        setError(
          "Your account has been disabled. Please contact support for assistance.",
        );
      } else if (
        errorLower.includes("rate limit") ||
        errorLower.includes("too many requests") ||
        errorLower.includes("email rate limit exceeded")
      ) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else if (
        errorLower.includes("network") ||
        errorLower.includes("fetch failed") ||
        errorLower.includes("failed to fetch") ||
        errorLower.includes("networkerror")
      ) {
        setError("Connection error. Please check your internet and try again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "signin" | "reset") => {
    setMode(newMode);
    setError(null);
    setMessage(null);
    clearErrors();
    setPassword("");
  };

  const getTitle = () => {
    switch (mode) {
      case "reset":
        return "Reset password";
      default:
        return "Welcome back";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "reset":
        return "Enter your email and we'll send you a reset link";
      default:
        return "Sign in to your agency dashboard";
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-foreground relative overflow-hidden">
        {/* Refined grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Animated glow orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-10 w-full">
          {/* Enhanced logo with glow and subtitle */}
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-xl group-hover:bg-amber-500/30 transition-all duration-500" />
              <img
                src="/logos/Light Letter Logo .png"
                alt="The Standard"
                className="relative h-14 w-14 drop-shadow-2xl dark:hidden"
              />
              <img
                src="/logos/LetterLogo.png"
                alt="The Standard"
                className="relative h-14 w-14 drop-shadow-2xl hidden dark:block"
              />
            </div>
            <div className="flex flex-col">
              <span
                className="text-white dark:text-black text-2xl font-bold tracking-wide"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                THE STANDARD
              </span>
              <span className="text-amber-400 text-[10px] uppercase tracking-[0.3em] font-medium">
                Financial Group
              </span>
            </div>
          </div>

          {/* Middle - Main messaging */}
          <div className="space-y-4">
            <div>
              <h1
                className="text-4xl xl:text-5xl font-bold leading-tight mb-3"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="text-white dark:text-black">Your agency,</span>
                <br />
                <span className="text-white/70 dark:text-black/70">
                  fully optimized.
                </span>
              </h1>
              <p className="text-white/80 dark:text-black/70 text-sm max-w-md leading-relaxed">
                Track commissions, manage recruits, and grow your insurance
                business with powerful analytics and automation.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid gap-2 max-w-md">
              <div className="flex items-center gap-2 text-white/90 dark:text-black/80">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-black/10">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">
                  Real-time commission tracking & forecasting
                </span>
              </div>
              <div className="flex items-center gap-2 text-white/90 dark:text-black/80">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-black/10">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">
                  Complete recruiting pipeline management
                </span>
              </div>
              <div className="flex items-center gap-2 text-white/90 dark:text-black/80">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-black/10">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">Secure, role-based team access</span>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="text-white/50 dark:text-black/50 text-xs">
            © {new Date().getFullYear()} The Standard Financial Group
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <div className="flex items-center gap-3">
              <img
                src="/logos/LetterLogo.png"
                alt="The Standard"
                className="h-10 w-10 dark:hidden"
              />
              <img
                src="/logos/Light Letter Logo .png"
                alt="The Standard"
                className="h-10 w-10 hidden dark:block"
              />
              <div className="flex flex-col">
                <span
                  className="text-foreground text-xl font-bold tracking-wide"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  THE STANDARD
                </span>
                <span className="text-amber-500 text-[9px] uppercase tracking-[0.25em] font-medium">
                  Financial Group
                </span>
              </div>
            </div>
          </div>

          {/* Header */}

          <div className="mb-3 text-center lg:text-left">
            <h2
              className="text-lg font-bold text-foreground mb-1"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {getTitle()}
            </h2>
            <p className="text-xs text-muted-foreground">{getSubtitle()}</p>
          </div>

          {/* Form Card with frosted glass effect */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-xl p-4">
            {/* Messages */}
            <div className="space-y-4 mb-6">
              <AuthSuccessMessage message={message || ""} />
              <AuthErrorDisplay
                error={error || ""}
                mode={mode}
                onSwitchToSignup={() => {}}
              />
            </div>

            {/* Forms */}
            {mode === "signin" && (
              <>
                <SignInForm
                  email={email}
                  password={password}
                  loading={loading}
                  formErrors={formErrors}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSubmit={handleSubmit}
                  onForgotPassword={() => switchMode("reset")}
                />

                <Alert className="mt-6 border-muted bg-muted/30">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <AlertDescription className="text-muted-foreground">
                    This system is invitation-only. Contact your manager for
                    access.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {mode === "reset" && (
              <>
                <ResetPasswordForm
                  email={email}
                  loading={loading}
                  formErrors={formErrors}
                  onEmailChange={setEmail}
                  onSubmit={handleSubmit}
                />

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-background text-muted-foreground">
                        Remember your password?
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => switchMode("signin")}
                    variant="ghost"
                    disabled={loading}
                    className="w-full mt-4 text-sm font-medium"
                  >
                    Back to sign in
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link
              to="/terms"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
