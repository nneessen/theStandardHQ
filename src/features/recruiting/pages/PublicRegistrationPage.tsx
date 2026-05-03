// src/features/recruiting/pages/PublicRegistrationPage.tsx
// Public registration page for recruit self-service - accessed via invite token
// Redesigned with split-panel layout to match Login/PublicJoinPage

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  MapPin,
  LinkIcon,
  Shield,
  FileText,
  TrendingUp,
  Lock,
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

// Referral source options
const REFERRAL_SOURCES = [
  "Friend or family member",
  "Current agent",
  "Social media",
  "Online search",
  "Job board",
  "Career fair",
  "Other",
];

// Form validation schema
const registrationSchema = z
  .object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Please confirm your password"),
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

export function PublicRegistrationPage() {
  const params = useParams({ strict: false }) as { token?: string };
  const token = params.token;
  const navigate = useNavigate();

  // Use hooks for invitation validation and registration submission
  const { data: invitation, isLoading } = useInvitationByToken(token);

  const submitRegistration = useSubmitRegistrationWithPassword();

  console.log("[PublicRegistrationPage] State:", {
    isLoading,
    invitation: invitation ? "present" : "null",
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

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

  // Update form when prefilled data loads
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

  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    if (!token || !invitation?.email) return;
    setSubmitError(null);

    console.log("[PublicRegistrationPage] Submitting registration...");

    // Extract password and form data
    const {
      password,
      confirm_password: _confirm,
      ...formDataWithoutPassword
    } = data;

    try {
      // Use mutation hook to create auth account and submit registration
      const result = await submitRegistration.mutateAsync({
        token,
        email: invitation.email,
        password,
        formData: formDataWithoutPassword,
      });

      if (!result.success) {
        console.error("[PublicRegistrationPage] Registration failed:", result);
        setSubmitError(result.message);
        return;
      }

      console.log("[PublicRegistrationPage] Registration complete:", result);
      setIsSubmitted(true);
    } catch (err) {
      console.error("[PublicRegistrationPage] Unexpected error:", err);
      setSubmitError("An unexpected error occurred. Please try again.");
    }
  };

  // Left Panel Component (reused for loading/error/success states)
  const LeftPanel = () => (
    <div className="hidden lg:flex lg:w-1/2 xl:w-[50%] bg-foreground relative overflow-hidden">
      {/* Grid pattern */}
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
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-warning/10 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 -right-20 w-80 h-80 bg-warning/70/5 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between p-8 xl:p-10 w-full h-full">
        {/* Logo */}
        <div className="flex items-center gap-4 group">
          <div className="relative">
            <div className="absolute inset-0 bg-warning/20 rounded-xl blur-xl group-hover:bg-warning/30 transition-all duration-500" />
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
              className="text-white text-2xl font-bold tracking-wide"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              THE STANDARD
            </span>
            <span className="text-warning text-[10px] uppercase tracking-[0.3em] font-medium">
              Financial Group
            </span>
          </div>
        </div>

        {/* Main messaging */}
        <div className="space-y-4">
          <div>
            <h1
              className="text-4xl xl:text-5xl font-bold leading-tight mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <span className="text-white">Welcome to</span>
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 bg-clip-text text-transparent">
                The Team
              </span>
            </h1>
            <p className="text-white/80 text-sm max-w-md leading-relaxed">
              Complete your registration to get started with your insurance
              career. We&apos;re excited to have you join our growing team.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid gap-2 max-w-md">
            <div className="flex items-center gap-2 text-white/90">
              <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs">
                Comprehensive training & mentorship
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs">
                Industry-leading commission structure
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs">Full support from day one</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-white/50 text-xs">
          &copy; {new Date().getFullYear()} The Standard Financial Group
        </div>
      </div>
    </div>
  );

  // Mobile Logo Component
  const MobileLogo = () => (
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
          <span className="text-warning text-[9px] uppercase tracking-[0.25em] font-medium">
            Financial Group
          </span>
        </div>
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-background">
        <LeftPanel />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">
              Verifying your invitation...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error states
  if (!invitation?.valid) {
    const errorType = invitation?.error || "invitation_not_found";
    const errorMessage =
      invitation?.message || "This invitation link is invalid or has expired.";

    return (
      <div className="min-h-screen flex bg-background">
        <LeftPanel />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <MobileLogo />
            <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-xl p-6 text-center">
              <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-foreground mb-2">
                {errorType === "invitation_expired"
                  ? "Invitation Expired"
                  : errorType === "invitation_completed"
                    ? "Already Registered"
                    : errorType === "invitation_cancelled"
                      ? "Invitation Cancelled"
                      : "Link Not Found"}
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                {errorMessage}
              </p>

              {invitation?.inviter && (
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Contact your recruiter:
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {invitation.inviter.name}
                  </p>
                  <a
                    href={`mailto:${invitation.inviter.email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {invitation.inviter.email}
                  </a>
                  {invitation.inviter.phone && (
                    <p className="text-sm text-muted-foreground">
                      {invitation.inviter.phone}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex bg-background">
        <LeftPanel />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <MobileLogo />
            <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-xl p-6 text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Welcome to the Team!
              </h1>
              <p className="text-sm text-muted-foreground mb-4">
                Your account has been created successfully.
              </p>

              {/* Next steps */}
              <div className="bg-info/10 border border-info/30 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-medium text-info dark:text-info mb-2">
                  What happens next?
                </p>
                <p className="text-xs text-info mb-2">
                  You can now log in to track your progress through the
                  onboarding process. Your recruiter will enroll you in a
                  pipeline, and you'll be guided through each step of becoming
                  part of the team.
                </p>
                <p className="text-xs text-info">
                  You'll be notified by text, email, or your upline will reach
                  out directly when it's time to complete the next step.
                </p>
              </div>

              {/* Login button */}
              <Button
                onClick={() => navigate({ to: "/login" })}
                className="w-full mb-4"
              >
                Go to Login
              </Button>

              {invitation.inviter && (
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Questions? Contact your recruiter:
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {invitation.inviter.name}
                  </p>
                  <a
                    href={`mailto:${invitation.inviter.email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {invitation.inviter.email}
                  </a>
                  {invitation.inviter.phone && (
                    <p className="text-sm text-muted-foreground">
                      {invitation.inviter.phone}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen flex bg-background">
      <LeftPanel />

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-4 pt-8 lg:p-6 overflow-y-auto">
        <div className="w-full max-w-lg">
          <MobileLogo />

          {/* Header */}
          <div className="mb-3 text-center lg:text-left">
            <h2
              className="text-lg font-bold text-foreground mb-1"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Complete Your Registration
            </h2>
            <p className="text-xs text-muted-foreground">
              {invitation.inviter?.name} has invited you to join The Standard.
            </p>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-xl overflow-hidden">
              {/* Personal Information */}
              <div className="p-4 border-b border-border/50">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="first_name" className="text-[10px]">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      {...register("first_name")}
                      className="mt-1 h-8 text-xs"
                      placeholder="John"
                    />
                    {errors.first_name && (
                      <p className="text-[10px] text-destructive mt-0.5">
                        {errors.first_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="last_name" className="text-[10px]">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="last_name"
                      {...register("last_name")}
                      className="mt-1 h-8 text-xs"
                      placeholder="Doe"
                    />
                    {errors.last_name && (
                      <p className="text-[10px] text-destructive mt-0.5">
                        {errors.last_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-[10px]">
                      Email
                    </Label>
                    <Input
                      id="email"
                      value={invitation.email || ""}
                      disabled
                      className="mt-1 h-8 text-xs bg-muted/50"
                    />
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Email cannot be changed
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-[10px]">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      {...register("phone")}
                      className="mt-1 h-8 text-xs"
                      placeholder="(555) 123-4567"
                      type="tel"
                    />
                  </div>

                  <div>
                    <Label htmlFor="date_of_birth" className="text-[10px]">
                      Date of Birth
                    </Label>
                    <Input
                      id="date_of_birth"
                      {...register("date_of_birth")}
                      className="mt-1 h-8 text-xs"
                      type="date"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="p-4 border-b border-border/50">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Create Your Password
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="password" className="text-[10px]">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      {...register("password")}
                      className="mt-1 h-8 text-xs"
                      placeholder="Min. 8 characters"
                    />
                    {errors.password && (
                      <p className="text-[10px] text-destructive mt-0.5">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirm_password" className="text-[10px]">
                      Confirm Password{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      {...register("confirm_password")}
                      className="mt-1 h-8 text-xs"
                      placeholder="Confirm password"
                    />
                    {errors.confirm_password && (
                      <p className="text-[10px] text-destructive mt-0.5">
                        {errors.confirm_password.message}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-[9px] text-muted-foreground mt-2">
                  You'll use this password to log in and track your onboarding
                  progress.
                </p>
              </div>

              {/* Address */}
              <div className="p-4 border-b border-border/50">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Address
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="street_address" className="text-[10px]">
                      Street Address
                    </Label>
                    <Input
                      id="street_address"
                      {...register("street_address")}
                      className="mt-1 h-8 text-xs"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="city" className="text-[10px]">
                        City
                      </Label>
                      <Input
                        id="city"
                        {...register("city")}
                        className="mt-1 h-8 text-xs"
                        placeholder="City"
                      />
                    </div>

                    <div>
                      <Label htmlFor="state" className="text-[10px]">
                        State
                      </Label>
                      <Select
                        value={watch("state") || ""}
                        onValueChange={(value) => setValue("state", value)}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="zip" className="text-[10px]">
                        ZIP Code
                      </Label>
                      <Input
                        id="zip"
                        {...register("zip")}
                        className="mt-1 h-8 text-xs"
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="p-4 border-b border-border/50">
                <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Social Media (Optional)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="instagram_username" className="text-[10px]">
                      Instagram Username
                    </Label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        @
                      </span>
                      <Input
                        id="instagram_username"
                        {...register("instagram_username")}
                        className="h-8 text-xs pl-6"
                        placeholder="username"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="facebook_handle" className="text-[10px]">
                      Facebook
                    </Label>
                    <Input
                      id="facebook_handle"
                      {...register("facebook_handle")}
                      className="mt-1 h-8 text-xs"
                      placeholder="username or profile URL"
                    />
                  </div>

                  <div>
                    <Label htmlFor="personal_website" className="text-[10px]">
                      Personal Website
                    </Label>
                    <Input
                      id="personal_website"
                      {...register("personal_website")}
                      className="mt-1 h-8 text-xs"
                      placeholder="https://yoursite.com"
                    />
                  </div>
                </div>
              </div>

              {/* Referral Source */}
              <div className="p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">
                  How did you hear about us?
                </h3>

                <Select
                  value={watch("referral_source") || ""}
                  onValueChange={(value) => setValue("referral_source", value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Error display */}
            {submitError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-xs text-destructive">{submitError}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-4">
              <Button
                type="submit"
                className="w-full h-9 text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account & Complete Registration"
                )}
              </Button>
            </div>
          </form>

          {/* Footer */}
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Questions? Contact {invitation.inviter?.name} at{" "}
            <a
              href={`mailto:${invitation.inviter?.email}`}
              className="text-primary hover:underline"
            >
              {invitation.inviter?.email}
            </a>
          </p>

          {/* Mobile footer */}
          <p className="lg:hidden mt-4 text-center text-[10px] text-muted-foreground">
            &copy; {new Date().getFullYear()} The Standard Financial Group
          </p>
        </div>
      </div>
    </div>
  );
}

export default PublicRegistrationPage;
