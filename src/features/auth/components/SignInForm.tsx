// src/features/auth/components/SignInForm.tsx

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/v2";
import { FormErrors } from "../hooks/useAuthValidation";
import { AlertCircle } from "lucide-react";
import { LogoSpinner } from "@/components/ui/logo-spinner";

interface SignInFormProps {
  email: string;
  password: string;
  loading: boolean;
  formErrors: FormErrors;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  email,
  password,
  loading,
  formErrors,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}) => {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-xs font-semibold text-v2-ink-muted uppercase tracking-wider"
        >
          Email
        </Label>
        <Input
          variant="outlined"
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
          className={`h-11 rounded-v2-md border-v2-ring bg-v2-card text-v2-ink placeholder:text-v2-ink-subtle focus-visible:ring-v2-accent ${formErrors.email ? "border-destructive focus-visible:ring-destructive/50" : ""}`}
        />
        {formErrors.email && (
          <div className="flex items-center gap-1.5 text-xs text-destructive mt-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formErrors.email}</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="text-xs font-semibold text-v2-ink-muted uppercase tracking-wider"
          >
            Password
          </Label>
          <Button
            type="button"
            onClick={onForgotPassword}
            variant="link"
            disabled={loading}
            className="h-auto p-0 text-xs font-normal text-v2-ink-muted hover:text-v2-ink"
          >
            Forgot password?
          </Button>
        </div>
        <Input
          variant="outlined"
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          disabled={loading}
          autoComplete="current-password"
          className={`h-11 rounded-v2-md border-v2-ring bg-v2-card text-v2-ink placeholder:text-v2-ink-subtle focus-visible:ring-v2-accent ${formErrors.password ? "border-destructive focus-visible:ring-destructive/50" : ""}`}
        />
        {formErrors.password && (
          <div className="flex items-center gap-1.5 text-xs text-destructive mt-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formErrors.password}</span>
          </div>
        )}
      </div>

      <PillButton
        type="submit"
        tone="black"
        size="lg"
        fullWidth
        disabled={loading}
        className="mt-2"
      >
        {loading ? (
          <>
            <LogoSpinner size="sm" className="mr-2" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </PillButton>
    </form>
  );
};
