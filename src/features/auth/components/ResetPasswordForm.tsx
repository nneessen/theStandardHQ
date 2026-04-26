// src/features/auth/components/ResetPasswordForm.tsx

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillButton } from "@/components/v2";
import { FormErrors } from "../hooks/useAuthValidation";
import { AlertCircle } from "lucide-react";
import { LogoSpinner } from "@/components/ui/logo-spinner";

interface ResetPasswordFormProps {
  email: string;
  loading: boolean;
  formErrors: FormErrors;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  email,
  loading,
  formErrors,
  onEmailChange,
  onSubmit,
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

      <PillButton
        type="submit"
        tone="black"
        size="lg"
        fullWidth
        disabled={loading}
      >
        {loading ? (
          <>
            <LogoSpinner size="sm" className="mr-2" />
            Sending...
          </>
        ) : (
          "Send reset link"
        )}
      </PillButton>
    </form>
  );
};
