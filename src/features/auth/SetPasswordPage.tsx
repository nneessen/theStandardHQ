// src/features/auth/SetPasswordPage.tsx
//
// Public page for the app-controlled onboarding link /set-password/{token}.
// A newly-created account (e.g. an agent added to a team) lands here from the
// "Welcome - Set Your Password" email, validates an app-owned setup token
// (read-only, scanner-safe), sets a password, and is sent to sign in.
//
// Replaces the old Supabase recovery-link flow whose link died well before the
// promised window and could be burned by email scanners.

import React, { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSetupTokenValidation, useSetAccountPassword } from "@/hooks/team";

export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams({ strict: false }) as { token?: string };

  const validationQuery = useSetupTokenValidation(token);
  const setPasswordMutation = useSetAccountPassword();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checking = validationQuery.isLoading;
  const validation = token
    ? validationQuery.data
    : { valid: false, message: "This link is missing its token." };
  const submitting = setPasswordMutation.isPending;

  const validatePasswords = (): string | null => {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validatePasswords();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!token) return;

    const result = await setPasswordMutation.mutateAsync({ token, password });

    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate({ to: "/login" }), 2000);
    } else {
      setError(
        result.message ||
          result.error ||
          "We couldn't set your password. Please try again or ask for a new link.",
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center">
          <span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-foreground text-background">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="mt-3 text-lg font-semibold text-foreground">
            Set your password
          </h1>
          {validation?.valid && validation.email && (
            <p className="mt-1 text-sm text-muted-foreground">
              for <span className="font-medium">{validation.email}</span>
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          {checking && (
            <div className="flex items-center justify-center py-8">
              <LogoSpinner size="sm" />
            </div>
          )}

          {!checking && success && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium text-foreground">
                Password set! Taking you to sign in…
              </p>
            </div>
          )}

          {!checking && !success && validation && !validation.valid && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                {validation.message ||
                  "This link is no longer valid. Ask your team leader to resend it."}
              </p>
              <Button
                variant="outline"
                className="mt-2 h-9 text-sm"
                onClick={() => navigate({ to: "/login" })}
              >
                Go to sign in
              </Button>
            </div>
          )}

          {!checking && !success && validation?.valid && (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  New password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="new-password"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium"
                >
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="new-password"
                  className="h-9"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-9 text-sm font-medium"
              >
                {submitting ? (
                  <>
                    <LogoSpinner size="sm" className="mr-2" />
                    Setting password…
                  </>
                ) : (
                  "Set password & continue"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetPasswordPage;
