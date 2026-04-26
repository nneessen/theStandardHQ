import React, { useState, useMemo } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "../../contexts/AuthContext";
import { isLocalSupabase } from "../../services/base";
import { SESSION_STORAGE_KEYS } from "../../constants/auth.constants";
import { AuthErrorDisplay } from "./components/AuthErrorDisplay";
import { AuthSuccessMessage } from "./components/AuthSuccessMessage";
import { SignInForm } from "./components/SignInForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { SectionShell, SoftCard, PillButton } from "@/components/v2";

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
    <SectionShell>
      <div className="min-h-screen flex flex-col">
        {/* Top brand strip */}
        <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-v2-pill bg-v2-card border border-v2-ring shadow-v2-soft px-3 py-1.5">
            <img
              src="/logos/LetterLogo.png"
              alt="The Standard"
              className="h-6 w-6 dark:hidden"
            />
            <img
              src="/logos/Light Letter Logo .png"
              alt="The Standard"
              className="h-6 w-6 hidden dark:block"
            />
            <span className="text-sm font-semibold tracking-tight text-v2-ink">
              The Standard
            </span>
            <span className="ml-1 inline-flex items-center px-2 h-5 rounded-v2-pill bg-v2-accent text-[10px] font-bold uppercase tracking-wider text-v2-ink">
              HQ
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-v2-ink-muted">
            <span>Need help?</span>
            <a
              href="/landing"
              className="rounded-v2-pill border border-v2-ring px-3 h-8 inline-flex items-center hover:bg-v2-card transition-colors"
            >
              Visit our site
            </a>
          </div>
        </header>

        {/* Main hero */}
        <main className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-10">
          <div className="w-full max-w-md">
            <SoftCard
              radius="lg"
              padding="lg"
              lift
              className="relative overflow-hidden"
            >
              {/* Decorative accent blob */}
              <div
                aria-hidden
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-v2-accent opacity-30 blur-2xl pointer-events-none"
              />

              <div className="relative">
                <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle mb-3">
                  {isRecruitIntent ? "Onboarding" : "Sign in"}
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-v2-ink font-display">
                  {title}
                </h1>
                <p className="mt-2 text-sm text-v2-ink-muted leading-relaxed">
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
                  <p className="mt-6 text-[12px] text-v2-ink-muted leading-relaxed">
                    The Standard is invitation-only. If you don&apos;t have an
                    account yet, your recruiter will send you a link.
                  </p>
                )}
              </div>
            </SoftCard>

            <p className="mt-6 text-center text-[11px] text-v2-ink-subtle">
              By continuing, you agree to our{" "}
              <Link
                to="/terms"
                className="underline underline-offset-4 hover:text-v2-ink transition-colors"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                className="underline underline-offset-4 hover:text-v2-ink transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </main>

        <footer className="px-6 sm:px-10 py-5 text-[11px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle text-center">
          © {new Date().getFullYear()} The Standard Financial Group
        </footer>
      </div>
    </SectionShell>
  );
};
