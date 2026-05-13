// src/features/recruiting/pages/PublicRegistrationPage.tsx
// Public registration page for invited recruits.
// Single-viewport, NO SCROLLING: editorial hero left + compact form right.
// Uses the .theme-landing design system (Big Shoulders Display + JetBrains
// Mono, deep-green / icy-blue / adventure-yellow palette, 2px corners) so
// this page matches the public landing aesthetic exactly.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Lock,
  Sparkles,
  Phone as PhoneIcon,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInvitationByToken,
  useSubmitRegistrationWithPassword,
} from "@/features/recruiting";
import { US_STATES } from "@/constants/states";
// eslint-disable-next-line no-restricted-imports -- CSS side-effect: scoped .theme-landing tokens shared with public landing surfaces
import "@/features/landing/styles/landing-theme.css";

const REFERRAL_SOURCES = [
  "Friend or family member",
  "Current agent",
  "Social media",
  "Online search",
  "Job board",
  "Career fair",
  "Other",
];

const registrationSchema = z
  .object({
    first_name: z.string().min(1, "Required"),
    last_name: z.string().min(1, "Required"),
    password: z.string().min(8, "At least 8 characters"),
    confirm_password: z.string().min(1, "Required"),
    phone: z.string().optional(),
    date_of_birth: z.string().optional(),
    street_address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    instagram_username: z.string().optional(),
    facebook_handle: z.string().optional(),
    personal_website: z.string().optional(),
    referral_source: z.string().optional(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof registrationSchema>;

// ─── Reusable atmospheric shell ──────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-landing surface-base relative h-svh w-full overflow-hidden">
      <div className="topo-grid absolute inset-0 pointer-events-none" />
      <div
        className="floating-shape floating-shape-1 hidden md:block"
        style={{ top: "-6%", right: "-4%" }}
        aria-hidden
      />
      <div
        className="floating-shape floating-shape-2 hidden md:block"
        style={{ bottom: "8%", left: "-3%" }}
        aria-hidden
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function BrandWordmark() {
  return (
    <span
      className="font-display font-black uppercase tracking-tight"
      style={{ fontSize: "1.25rem", color: "var(--landing-deep-green)" }}
    >
      The Standard
    </span>
  );
}

// ─── Page component ─────────────────────────────────────────────────────

export function PublicRegistrationPage() {
  const params = useParams({ strict: false }) as { token?: string };
  const token = params.token;
  const navigate = useNavigate();

  const { data: invitation, isLoading } = useInvitationByToken(token);
  const submitRegistration = useSubmitRegistrationWithPassword();

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      password: "",
      confirm_password: "",
      phone: "",
      city: "",
      state: "",
    },
  });

  useEffect(() => {
    if (invitation?.valid && invitation.prefilled) {
      const prefilled = invitation.prefilled;
      if (prefilled.first_name) setValue("first_name", prefilled.first_name);
      if (prefilled.last_name) setValue("last_name", prefilled.last_name);
      if (prefilled.phone) setValue("phone", prefilled.phone);
      if (prefilled.city) setValue("city", prefilled.city);
      if (prefilled.state) setValue("state", prefilled.state);
    }
  }, [invitation, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!token || !invitation?.email) return;
    setSubmitError(null);
    const {
      password,
      confirm_password: _confirm,
      ...formDataWithoutPassword
    } = data;
    try {
      const result = await submitRegistration.mutateAsync({
        token,
        email: invitation.email,
        password,
        formData: formDataWithoutPassword,
      });
      if (!result.success) {
        setSubmitError(result.message);
        return;
      }
      setIsSubmitted(true);
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    }
  };

  // ─── Loading state ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <div className="h-full flex items-center justify-center px-4">
          <CenterCard>
            <Loader2
              className="h-7 w-7 mx-auto animate-spin"
              style={{ color: "var(--landing-deep-green)" }}
            />
            <p
              className="mt-3 text-eyebrow"
              style={{ color: "var(--landing-terrain-grey-dark)" }}
            >
              Validating invitation…
            </p>
          </CenterCard>
        </div>
      </PageShell>
    );
  }

  // ─── Invalid invitation state ────────────────────────────────────────
  if (!invitation?.valid) {
    return (
      <PageShell>
        <div className="h-full flex flex-col items-center justify-center px-4 gap-6">
          <BrandWordmark />
          <CenterCard>
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[2px] bg-[var(--landing-deep-green)]">
              <AlertCircle className="h-5 w-5 text-[var(--landing-icy-blue)]" />
            </div>
            <h2 className="text-display-xl mb-2">Link Not Found</h2>
            <p
              className="text-fluid-base mb-5 text-muted"
              style={{ maxWidth: "32ch", margin: "0 auto" }}
            >
              This invitation link is invalid, expired, or has already been
              used.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="btn btn-cta"
            >
              Go to Login
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </CenterCard>
        </div>
      </PageShell>
    );
  }

  // ─── Success state ───────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <PageShell>
        <div className="h-full flex flex-col items-center justify-center px-4 gap-6">
          <BrandWordmark />
          <CenterCard>
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[2px] bg-[var(--landing-adventure-yellow)]">
              <CheckCircle2 className="h-5 w-5 text-[var(--landing-deep-green)]" />
            </div>
            <h2 className="text-display-xl mb-2">You&apos;re In</h2>
            <p
              className="text-fluid-base mb-5 text-muted"
              style={{ maxWidth: "32ch", margin: "0 auto" }}
            >
              Your account is created. Sign in to access your pipeline and start
              writing business.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="btn btn-cta"
            >
              Sign In
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </CenterCard>
        </div>
      </PageShell>
    );
  }

  // ─── Registration form state ─────────────────────────────────────────
  const recipientFirstName = invitation.prefilled?.first_name?.split(" ")[0];

  return (
    <PageShell>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* ============ LEFT — Editorial hero ============ */}
        <section className="flex h-full min-h-0 flex-col px-5 pt-5 pb-6 sm:px-8 lg:px-12 lg:py-10 xl:px-16">
          <header className="flex-shrink-0 flex items-center justify-between">
            <BrandWordmark />
            <a
              href="/login"
              className="hidden sm:inline-flex landing-badge-pill hover:bg-[var(--landing-icy-blue-light)] transition-colors"
            >
              Already have an account?
              <ArrowRight className="h-3 w-3" />
            </a>
          </header>

          <div className="flex flex-1 min-h-0 flex-col justify-center py-4 lg:py-2">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-3 mb-5 lg:mb-7">
              <span
                className="pulse-glow inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] rounded-[2px] font-mono"
                style={{
                  background: "var(--landing-deep-green)",
                  color: "var(--landing-icy-blue)",
                }}
              >
                Registration
              </span>
              <span className="hidden sm:block w-10 h-px bg-[var(--landing-border)]" />
              <span className="hidden sm:inline text-eyebrow-lg">
                Final step · 2 minutes
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-display-2xl" style={{ fontWeight: 300 }}>
              {recipientFirstName ? (
                <>
                  Welcome,
                  <br />
                  <span style={{ fontWeight: 900 }}>{recipientFirstName}.</span>
                </>
              ) : (
                <>
                  Join The
                  <br />
                  <span style={{ fontWeight: 900 }}>Standard.</span>
                </>
              )}
            </h1>

            <p className="text-fluid-base text-muted mt-4 lg:mt-5 max-w-[40ch]">
              Set your password and confirm a few details. You&apos;ll be in
              your dashboard in under two minutes.
            </p>

            {/* What you get — compact lattice (desktop only) */}
            <div className="mt-6 lg:mt-8 hidden lg:grid lattice-grid grid-cols-3 max-w-md">
              <FeaturePillar
                icon={<Sparkles className="h-3.5 w-3.5" />}
                value="AI"
                label="Lead Scoring"
              />
              <FeaturePillar
                icon={<Lock className="h-3.5 w-3.5" />}
                value="100%"
                label="Secure"
              />
              <FeaturePillar
                icon={<PhoneIcon className="h-3.5 w-3.5" />}
                value="Day 1"
                label="Full Support"
              />
            </div>
          </div>

          <div className="flex-shrink-0 pt-4 mt-auto border-t border-[var(--landing-border)]">
            <p className="text-eyebrow">
              Invitation for{" "}
              <span className="mono text-[var(--landing-deep-green)]">
                {invitation.email}
              </span>
            </p>
          </div>
        </section>

        {/* ============ RIGHT — Compact form card ============ */}
        <section className="flex h-full min-h-0 items-center justify-center p-4 lg:p-8 xl:p-10">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="w-full max-w-[480px] bg-white border border-[var(--landing-border)] rounded-[2px] p-5 lg:p-6 shadow-[0_1px_0_rgba(22,27,19,0.04),0_4px_16px_-2px_rgba(22,27,19,0.06)]"
          >
            <div className="section-eyebrow-row mb-4">
              <span className="section-eyebrow-num">01</span>
              <span className="section-eyebrow-line" />
              <span className="section-eyebrow-label">Your details</span>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  id="first_name"
                  label="First name"
                  required
                  error={errors.first_name?.message}
                >
                  <Input
                    id="first_name"
                    {...register("first_name")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
                <FormField
                  id="last_name"
                  label="Last name"
                  required
                  error={errors.last_name?.message}
                >
                  <Input
                    id="last_name"
                    {...register("last_name")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  id="password"
                  label="Password"
                  required
                  error={errors.password?.message}
                >
                  <Input
                    id="password"
                    type="password"
                    {...register("password")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
                <FormField
                  id="confirm_password"
                  label="Confirm"
                  required
                  error={errors.confirm_password?.message}
                >
                  <Input
                    id="confirm_password"
                    type="password"
                    {...register("confirm_password")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField id="phone" label="Phone">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    {...register("phone")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
                <FormField id="date_of_birth" label="Date of birth">
                  <Input
                    id="date_of_birth"
                    type="date"
                    {...register("date_of_birth")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
                <FormField id="city" label="City">
                  <Input
                    id="city"
                    {...register("city")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
                <FormField id="state" label="State">
                  <Select
                    value={watch("state")}
                    onValueChange={(v) => setValue("state", v)}
                  >
                    <SelectTrigger
                      id="state"
                      className="h-9 text-sm rounded-[2px] bg-white"
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem
                          key={s.value}
                          value={s.value}
                          className="text-sm"
                        >
                          {s.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="zip" label="ZIP">
                  <Input
                    id="zip"
                    {...register("zip")}
                    className="h-9 text-sm rounded-[2px] bg-white"
                  />
                </FormField>
              </div>

              {/* Optional fields — collapsed by default to keep page above the fold */}
              <button
                type="button"
                onClick={() => setShowOptional((v) => !v)}
                className="text-eyebrow inline-flex items-center gap-1.5 hover:text-[var(--landing-deep-green)] transition-colors mt-1"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showOptional ? "rotate-180" : ""}`}
                />
                {showOptional ? "Hide" : "Add"} social & referral (optional)
              </button>

              {showOptional && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <FormField id="instagram_username" label="Instagram">
                      <Input
                        id="instagram_username"
                        placeholder="@handle"
                        {...register("instagram_username")}
                        className="h-9 text-sm rounded-[2px] bg-white"
                      />
                    </FormField>
                    <FormField id="facebook_handle" label="Facebook">
                      <Input
                        id="facebook_handle"
                        {...register("facebook_handle")}
                        className="h-9 text-sm rounded-[2px] bg-white"
                      />
                    </FormField>
                  </div>
                  <FormField
                    id="referral_source"
                    label="How did you hear about us?"
                  >
                    <Select
                      value={watch("referral_source")}
                      onValueChange={(v) => setValue("referral_source", v)}
                    >
                      <SelectTrigger
                        id="referral_source"
                        className="h-9 text-sm rounded-[2px] bg-white"
                      >
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {REFERRAL_SOURCES.map((src) => (
                          <SelectItem key={src} value={src} className="text-sm">
                            {src}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              )}
            </div>

            {submitError && (
              <div className="mt-3 px-3 py-2 rounded-[2px] border border-destructive/30 bg-destructive/5">
                <p className="text-xs text-destructive">{submitError}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-cta btn-lg w-full mt-4"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Complete Registration
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>

            <p className="mt-3 text-[10px] text-center text-muted">
              By continuing you agree to our{" "}
              <a href="/terms" className="underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        </section>
      </div>
    </PageShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white border border-[var(--landing-border)] rounded-[2px] p-6 lg:p-8 text-center max-w-md w-full"
      style={{
        boxShadow:
          "0 1px 0 rgba(22, 27, 19, 0.04), 0 8px 24px -4px rgba(22, 27, 19, 0.12)",
      }}
    >
      {children}
    </div>
  );
}

function FormField({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label
        htmlFor={id}
        className="text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--landing-terrain-grey-dark)]"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--landing-deep-green)]">*</span>
        )}
      </Label>
      {children}
      {error && (
        <p className="text-[10px] text-destructive font-mono">{error}</p>
      )}
    </div>
  );
}

function FeaturePillar({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1 py-2">
      <span className="landing-icon-tile h-7 w-7">{icon}</span>
      <span
        className="font-display font-black text-[1.25rem] leading-none"
        style={{ color: "var(--landing-deep-green)" }}
      >
        {value}
      </span>
      <span className="text-eyebrow">{label}</span>
    </div>
  );
}

export default PublicRegistrationPage;
