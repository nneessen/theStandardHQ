import React, { useState, useMemo } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "../../contexts/AuthContext";
import { isLocalSupabase } from "../../services/base";
import { Button } from "../../components/ui/button";
import { SESSION_STORAGE_KEYS } from "../../constants/auth.constants";
import { AuthErrorDisplay } from "./components/AuthErrorDisplay";
import { AuthSuccessMessage } from "./components/AuthSuccessMessage";
import { SignInForm } from "./components/SignInForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";

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

  const eyebrow = isRecruitIntent
    ? "[01] Onboarding · The Standard"
    : "[01] The Standard · Sign in";

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
        ? "Sign in to continue your onboarding. Your recruiter is ready when you are."
        : "Sign in to your agency dashboard.";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col lg:flex-row">
      {/* Editorial left pane — value-prop block, no animations */}
      <aside className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between p-10 xl:p-14 border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <img
            src="/logos/LetterLogo.png"
            alt="The Standard"
            className="h-9 w-9 dark:hidden"
          />
          <img
            src="/logos/Light Letter Logo .png"
            alt="The Standard"
            className="h-9 w-9 hidden dark:block"
          />
          <div className="flex flex-col">
            <span
              className="text-zinc-900 dark:text-zinc-100 text-base font-bold tracking-wide"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              THE STANDARD
            </span>
            <span className="text-[9px] uppercase tracking-[0.3em] font-semibold text-zinc-500 dark:text-zinc-400">
              Financial Group
            </span>
          </div>
        </div>

        <div className="max-w-xl">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-zinc-500 dark:text-zinc-400 mb-4">
            {isRecruitIntent ? "For new recruits" : "For agents"}
          </div>
          <h1
            className="text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.05] text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {isRecruitIntent ? (
              <>
                Your career
                <br />
                starts here.
              </>
            ) : (
              <>
                Your agency,
                <br />
                fully optimized.
              </>
            )}
          </h1>
          <div className="mt-5 h-[3px] w-12 bg-zinc-900 dark:bg-zinc-100" />
          <p className="mt-5 text-[14px] italic text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {isRecruitIntent
              ? "Sign in to pick up where you left off. Every step of your onboarding lives in one place — the next thing to do is always at the top."
              : "Track commissions, manage recruits, and grow your insurance business with analytics and automation built for the way you actually work."}
          </p>
        </div>

        <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-zinc-500 dark:text-zinc-400">
          © {new Date().getFullYear()} The Standard Financial Group
        </div>
      </aside>

      {/* Right pane — form */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src="/logos/LetterLogo.png"
              alt="The Standard"
              className="h-9 w-9 dark:hidden"
            />
            <img
              src="/logos/Light Letter Logo .png"
              alt="The Standard"
              className="h-9 w-9 hidden dark:block"
            />
            <div className="flex flex-col">
              <span
                className="text-zinc-900 dark:text-zinc-100 text-base font-bold tracking-wide"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                THE STANDARD
              </span>
              <span className="text-[9px] uppercase tracking-[0.3em] font-semibold text-zinc-500 dark:text-zinc-400">
                Financial Group
              </span>
            </div>
          </div>

          <div className="border-b border-zinc-900 dark:border-zinc-100 pb-5 mb-6">
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-zinc-500 dark:text-zinc-400">
              {eyebrow}
            </div>
            <h2
              className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 leading-[1.1]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {title}
            </h2>
            <p className="mt-2 text-[13px] italic text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {subtitle}
            </p>
          </div>

          <div className="space-y-3 mb-4">
            <AuthSuccessMessage message={message || ""} />
            <AuthErrorDisplay
              error={error || ""}
              mode={mode}
              onSwitchToSignup={() => {}}
            />
          </div>

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
              <p className="mt-5 text-[12px] italic text-zinc-600 dark:text-zinc-400 leading-relaxed">
                The Standard is invitation-only. If you don&apos;t have an
                account yet, your recruiter will send you a link.
              </p>
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
              <div className="mt-5 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <Button
                  type="button"
                  onClick={() => switchMode("signin")}
                  variant="ghost"
                  disabled={loading}
                  className="w-full text-[12px] uppercase tracking-[0.18em] font-semibold"
                >
                  Back to sign in
                </Button>
              </div>
            </>
          )}

          <p className="mt-8 text-[11px] text-zinc-500 dark:text-zinc-400">
            By continuing, you agree to our{" "}
            <Link
              to="/terms"
              className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
};
