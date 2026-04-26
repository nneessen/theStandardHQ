// src/features/auth/EmailVerificationPending.tsx

import React from "react";
import { Button } from "../../components/ui";
import { Separator } from "@/components/ui/separator";
import { MAX_RESEND_ATTEMPTS } from "../../constants/auth.constants";
import { useEmailVerification } from "./hooks/useEmailVerification";
import { AuthErrorDisplay } from "./components/AuthErrorDisplay";
import { AuthSuccessMessage } from "./components/AuthSuccessMessage";
import { Mail, ArrowLeft } from "lucide-react";
import { LogoSpinner } from "@/components/ui/logo-spinner";

export const EmailVerificationPending: React.FC = () => {
  const {
    email,
    loading,
    error,
    message,
    resendCount,
    isResendDisabled,
    handleResend,
    handleBackToLogin,
    getResendButtonText,
  } = useEmailVerification();

  return (
    <div className="theme-v2 v2-canvas font-display text-v2-ink min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-foreground relative overflow-hidden">
        {/* Geometric background pattern */}
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
            <div className="w-7 h-7 rounded bg-white/10 dark:bg-black/10 flex items-center justify-center">
              <Mail className="h-3.5 w-3.5 text-white dark:text-black" />
            </div>
            <h1
              className="text-4xl xl:text-5xl font-bold leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <span className="text-white dark:text-black">Almost there.</span>
            </h1>
            <p className="text-white/80 dark:text-black/70 text-sm max-w-md leading-relaxed">
              We just need to verify your email address before you can start
              using the platform.
            </p>
          </div>

          {/* Bottom */}
          <div className="text-white/50 dark:text-black/50 text-xs">
            © {new Date().getFullYear()} The Standard Financial Group
          </div>
        </div>
      </div>

      {/* Right Panel - Content */}
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
              Check your email
            </h2>
            <p className="text-xs text-muted-foreground">
              We sent a verification link to
            </p>
            {email && (
              <p className="text-xs font-semibold text-foreground mt-1">
                {email}
              </p>
            )}
          </div>

          {/* Form Card with frosted glass effect */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-xl p-4">
            {/* Messages */}
            <div className="space-y-4 mb-6">
              {message && <AuthSuccessMessage message={message} />}
              {error && (
                <AuthErrorDisplay
                  error={error}
                  mode="signin"
                  onSwitchToSignup={() => {}}
                />
              )}
            </div>

            {/* Content */}
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  Click the link in the email to verify your account and get
                  started.
                </p>
                <p className="text-xs text-muted-foreground">
                  The link will expire in 24 hours for security reasons.
                </p>
              </div>

              <Button
                onClick={handleResend}
                disabled={isResendDisabled}
                variant="warning"
                className="w-full h-9"
                aria-label={getResendButtonText()}
              >
                {loading ? (
                  <>
                    <LogoSpinner size="sm" className="mr-2" />
                    Sending...
                  </>
                ) : (
                  getResendButtonText()
                )}
              </Button>

              {resendCount > 0 && resendCount < MAX_RESEND_ATTEMPTS && (
                <p className="text-xs text-center text-muted-foreground">
                  {resendCount} of {MAX_RESEND_ATTEMPTS} resend attempts used
                </p>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-background text-muted-foreground">
                    Didn't receive the email?
                  </span>
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground space-y-1">
                <p>Check your spam folder or try resending the email.</p>
                <p>Make sure you entered the correct email address.</p>
              </div>

              <Button
                type="button"
                onClick={handleBackToLogin}
                variant="ghost"
                className="w-full h-10"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need help? Contact support at support@thestandard.com
          </p>
        </div>
      </div>
    </div>
  );
};
