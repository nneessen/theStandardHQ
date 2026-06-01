import React, { useState, useMemo } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "../../contexts/AuthContext";
import { isLocalSupabase } from "../../services/base";
import { SESSION_STORAGE_KEYS } from "../../constants/auth.constants";
import { AuthErrorDisplay } from "./components/AuthErrorDisplay";
import { AuthSuccessMessage } from "./components/AuthSuccessMessage";
import { SignInForm } from "./components/SignInForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { PillButton } from "@/components/v2";
// Cinematic login reactor — an enhanced, bloomed evolution of the dashboard
// Jarvis orb. Lazy, so the WebGL/bloom bundle stays out of the initial payload.
import { LoginReactor } from "./login-reactor/LoginReactor";

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

  const intent = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("intent");
  }, []);
  const isRecruitIntent = intent === "recruit";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(email, password, "", mode)) return;

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
            ? "Redirecting to the local password reset flow…"
            : "Password reset email sent. Check your inbox.",
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- router state type
          navigate({ to: "/auth/verify-email" } as any);
        }, 1500);
      } else if (
        mode === "signin" &&
        (errorLower.includes("invalid login credentials") ||
          errorLower.includes("invalid email or password") ||
          errorLower.includes("email not found"))
      ) {
        setError("No account found or incorrect password.");
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

  const title =
    mode === "reset"
      ? "Reset your password"
      : isRecruitIntent
        ? "Welcome to your pipeline"
        : "Welcome back";

  const subtitle =
    mode === "reset"
      ? "Enter your email and we'll send you a reset link."
      : isRecruitIntent
        ? "Sign in to continue your onboarding."
        : "Sign in to your agency dashboard.";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b0b0c] text-[#f1e9d6] lg:flex-row">
      {/* ───────────── LEFT — cinematic Jarvis reactor ───────────── */}
      <section
        aria-hidden
        className="relative flex h-[40vh] w-full shrink-0 items-center justify-center overflow-hidden border-b border-white/10 lg:h-auto lg:min-h-screen lg:w-[56%] lg:border-b-0 lg:border-r"
        style={{
          background:
            "radial-gradient(120% 120% at 32% 28%, #14181f 0%, #0a0a0b 60%, #060607 100%)",
        }}
      >
        {/* The reactor fills the panel. Lazy three.js; static glow under
            prefers-reduced-motion; pauses when the tab is hidden. */}
        <LoginReactor className="absolute inset-0 h-full w-full" />
        {/* faint scanline texture + vignette for depth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 46%, transparent 28%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* wordmark + tagline, bottom */}
        <div className="absolute bottom-8 left-8 right-8 z-10">
          <div
            className="leading-[0.95]"
            style={{
              fontFamily: '"Archivo", system-ui, sans-serif',
              fontWeight: 800,
              fontSize: "clamp(34px, 4.5vw, 64px)",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "#f1e9d6",
            }}
          >
            The Standard
          </div>
          <p
            className="mt-2 max-w-sm text-sm leading-relaxed"
            style={{ color: "rgba(236,226,205,0.6)" }}
          >
            Your agency command center — KPIs, recruiting, and Jarvis, in one
            place.
          </p>
        </div>
      </section>

      {/* ───────────── RIGHT — sign-in form (auth logic unchanged) ───────────── */}
      <main className="login-surface relative flex w-full flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div
            className="mb-3 text-[11px] font-semibold uppercase"
            style={{
              fontFamily: '"Space Mono", monospace',
              letterSpacing: "0.18em",
              color: "rgba(236,226,205,0.45)",
            }}
          >
            {isRecruitIntent ? "Onboarding" : "Sign in"}
          </div>
          <h1
            className="text-3xl leading-tight tracking-tight sm:text-4xl"
            style={{
              fontFamily: '"Archivo", system-ui, sans-serif',
              fontWeight: 800,
              color: "#f1e9d6",
            }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "rgba(236,226,205,0.55)" }}
          >
            {subtitle}
          </p>

          <div className="mt-6 space-y-3">
            <AuthSuccessMessage message={message || ""} />
            <AuthErrorDisplay
              error={error || ""}
              mode={mode}
              onSwitchToSignup={() => {}}
            />
          </div>

          <div className="mt-5">
            {mode === "signin" && (
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
                <div className="mt-4">
                  <PillButton
                    type="button"
                    tone="ghost"
                    size="md"
                    fullWidth
                    disabled={loading}
                    onClick={() => switchMode("signin")}
                  >
                    Back to sign in
                  </PillButton>
                </div>
              </>
            )}
          </div>

          {mode === "signin" && (
            <p
              className="mt-6 text-[12px] leading-relaxed"
              style={{ color: "rgba(236,226,205,0.5)" }}
            >
              The Standard is invitation-only. If you don&apos;t have an account
              yet, your recruiter will send you a link.
            </p>
          )}

          <p
            className="mt-6 text-center text-[11px]"
            style={{ color: "rgba(236,226,205,0.4)" }}
          >
            By continuing, you agree to our{" "}
            <Link
              to="/terms"
              className="underline underline-offset-4 transition-colors hover:text-[#f1e9d6]"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              className="underline underline-offset-4 transition-colors hover:text-[#f1e9d6]"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <footer
          className="absolute bottom-5 left-0 right-0 text-center text-[11px] font-semibold uppercase"
          style={{
            fontFamily: '"Space Mono", monospace',
            letterSpacing: "0.18em",
            color: "rgba(236,226,205,0.3)",
          }}
        >
          © {new Date().getFullYear()} Nick Neessen. All rights reserved.
        </footer>
      </main>
    </div>
  );
};
