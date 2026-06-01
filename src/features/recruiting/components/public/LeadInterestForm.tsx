// src/features/recruiting/components/public/LeadInterestForm.tsx
// Public interest form for recruiting funnel - Visual redesign v2

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSubmitLead } from "../../hooks/useLeads";
import { US_STATES } from "@/constants/states";
import {
  TCPA_LEAD_CONSENT_TEXT,
  TCPA_LEAD_CONSENT_VERSION,
} from "@/features/legal";
import {
  INCOME_GOAL_OPTIONS,
  SPECIALTY_OPTIONS,
  type LeadAvailability,
  type LeadInsuranceExperience,
  type LeadSpecialty,
} from "@/types/leads.types";

// Validation schema
const leadFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Please enter a valid phone number")
    .regex(/^[\d\s\-().+]+$/, "Please enter a valid phone number"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  availability: z.enum(["full_time", "part_time", "exploring"]),
  incomeGoals: z.string().optional(),
  whyInterested: z.string().min(1, "Please tell us why you're interested"),
  insuranceExperience: z.enum([
    "none",
    "less_than_1_year",
    "1_to_3_years",
    "3_plus_years",
  ]),
  isLicensed: z.boolean().optional(),
  currentImoName: z.string().optional(),
  specialties: z.array(z.string()).optional(),
});

interface LeadInterestFormProps {
  recruiterSlug: string;
  onSuccess: (leadId: string) => void;
  ctaText?: string;
  primaryColor?: string;
  darkMode?: boolean;
}

// Helper to extract error message from Zod error
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
const getErrorMessage = (errors: any[]): string => {
  if (!errors || errors.length === 0) return "";
  return errors
    .map((err) => (typeof err === "string" ? err : err?.message || String(err)))
    .join(", ");
};

export function LeadInterestForm({
  recruiterSlug,
  onSuccess,
  ctaText = "Submit Your Interest",
  primaryColor,
  darkMode = false,
}: LeadInterestFormProps) {
  const submitLeadMutation = useSubmitLead();
  const [honeypot, setHoneypot] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<
    LeadSpecialty[]
  >([]);

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      availability: "exploring" as LeadAvailability,
      incomeGoals: "",
      whyInterested: "",
      insuranceExperience: "none" as LeadInsuranceExperience,
      isLicensed: false,
      currentImoName: "",
      specialties: [] as string[],
      tcpaConsent: false,
    },
    onSubmit: async ({ value }) => {
      // Honeypot check - if filled, it's likely a bot
      if (honeypot) {
        return;
      }

      // Get UTM params from URL
      const urlParams = new URLSearchParams(window.location.search);

      const result = await submitLeadMutation.mutateAsync({
        recruiterSlug,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phone: value.phone,
        city: value.city,
        state: value.state,
        availability: value.availability,
        incomeGoals: value.incomeGoals || undefined,
        whyInterested: value.whyInterested,
        insuranceExperience: value.insuranceExperience,
        utmSource: urlParams.get("utm_source") || undefined,
        utmMedium: urlParams.get("utm_medium") || undefined,
        utmCampaign: urlParams.get("utm_campaign") || undefined,
        referrerUrl: document.referrer || undefined,
        isLicensed: value.isLicensed || false,
        currentImoName: value.isLicensed ? value.currentImoName : undefined,
        specialties: value.isLicensed
          ? (selectedSpecialties as LeadSpecialty[])
          : undefined,
        // Record the exact consent disclosure the user agreed to (verbatim +
        // versioned) into the communication_consent ledger server-side.
        tcpaConsentText: TCPA_LEAD_CONSENT_TEXT,
        tcpaConsentVersion: TCPA_LEAD_CONSENT_VERSION,
      });

      if (result.success && result.lead_id) {
        onSuccess(result.lead_id);
      }
    },
  });

  const handleSpecialtyToggle = (specialty: LeadSpecialty) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty],
    );
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await form.handleSubmit();
        // Show toast + scroll to first error if validation blocked submit
        requestAnimationFrame(() => {
          const errorEl = document.querySelector("[data-field-error]");
          if (errorEl) {
            toast.error("Please fill in all required fields");
            errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      }}
      className={`space-y-3 ${darkMode ? "lead-form-dark" : ""}`}
    >
      {/* Honeypot field - hidden from real users */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input
          type="text"
          name="company_fax_ext"
          tabIndex={-1}
          autoComplete="nope"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Name Row */}
      <div className="grid grid-cols-2 gap-2">
        <form.Field
          name="firstName"
          validators={{ onChange: leadFormSchema.shape.firstName }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="John"
                variant="outlined"
                className={`h-9 text-sm bg-white text-neutral-900 placeholder:text-neutral-500 ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors &&
                field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="lastName"
          validators={{ onChange: leadFormSchema.shape.lastName }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="Doe"
                variant="outlined"
                className={`h-9 text-sm bg-white text-neutral-900 placeholder:text-neutral-500 ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors &&
                field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
            </div>
          )}
        </form.Field>
      </div>

      {/* Email */}
      <form.Field
        name="email"
        validators={{ onChange: leadFormSchema.shape.email }}
      >
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@example.com"
              variant="outlined"
              className={`h-9 text-sm bg-white text-neutral-900 placeholder:text-neutral-500 ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-xs text-destructive" data-field-error>
                {getErrorMessage(field.state.meta.errors)}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Phone */}
      <form.Field
        name="phone"
        validators={{ onChange: leadFormSchema.shape.phone }}
      >
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-medium">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              variant="outlined"
              className={`h-9 text-sm bg-white text-neutral-900 placeholder:text-neutral-500 ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-xs text-destructive" data-field-error>
                {getErrorMessage(field.state.meta.errors)}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Location Row */}
      <div className="grid grid-cols-2 gap-2">
        <form.Field
          name="city"
          validators={{ onChange: leadFormSchema.shape.city }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="city" className="text-xs font-medium">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                placeholder="New York"
                variant="outlined"
                className={`h-9 text-sm bg-white text-neutral-900 placeholder:text-neutral-500 ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors &&
                field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="state"
          validators={{ onChange: leadFormSchema.shape.state }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-xs font-medium">
                State <span className="text-destructive">*</span>
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value)}
              >
                <SelectTrigger
                  aria-label="State"
                  className={`h-9 text-sm bg-white text-neutral-900 border-2 border-border data-[placeholder]:text-neutral-500 ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
                >
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {US_STATES.map((state) => (
                    <SelectItem
                      key={state.value}
                      value={state.value}
                      className="text-sm"
                    >
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors &&
                field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
            </div>
          )}
        </form.Field>
      </div>

      {/* Availability */}
      <form.Field
        name="availability"
        validators={{ onChange: leadFormSchema.shape.availability }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Availability <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={field.state.value}
              onValueChange={(value) =>
                field.handleChange(value as LeadAvailability)
              }
              className="flex flex-wrap gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="full_time"
                  id="full_time"
                  className="border-2 border-border  bg-background"
                />
                <Label htmlFor="full_time" className="text-sm font-normal">
                  Full-time
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="part_time"
                  id="part_time"
                  className="border-2 border-border  bg-background"
                />
                <Label htmlFor="part_time" className="text-sm font-normal">
                  Part-time
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="exploring"
                  id="exploring"
                  className="border-2 border-border  bg-background"
                />
                <Label htmlFor="exploring" className="text-sm font-normal">
                  Just exploring
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </form.Field>

      {/* Income Goals */}
      <form.Field name="incomeGoals">
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="incomeGoals" className="text-xs font-medium">
              Income Goals (Optional)
            </Label>
            <Select
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
            >
              <SelectTrigger
                aria-label="Income goals"
                className="h-9 text-sm bg-white text-neutral-900 border-2 border-border data-[placeholder]:text-neutral-500"
              >
                <SelectValue placeholder="Select income goal (optional)" />
              </SelectTrigger>
              <SelectContent>
                {INCOME_GOAL_OPTIONS.filter((opt) => opt.value !== "").map(
                  (option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-sm"
                    >
                      {option.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      {/* Insurance Experience */}
      <form.Field
        name="insuranceExperience"
        validators={{ onChange: leadFormSchema.shape.insuranceExperience }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Insurance Experience <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={field.state.value}
              onValueChange={(value) =>
                field.handleChange(value as LeadInsuranceExperience)
              }
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="none"
                  id="exp_none"
                  className="border-2 border-border  bg-background"
                />
                <Label htmlFor="exp_none" className="text-sm font-normal">
                  No experience
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="less_than_1_year"
                  id="exp_less_1"
                  className="border-2 border-border  bg-background"
                />
                <Label htmlFor="exp_less_1" className="text-sm font-normal">
                  Less than 1 year
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="1_to_3_years"
                  id="exp_1_3"
                  className="border-2 border-border  bg-background"
                />
                <Label htmlFor="exp_1_3" className="text-sm font-normal">
                  1-3 years
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="3_plus_years"
                  id="exp_3_plus"
                  className="border-2 border-border  bg-background"
                />
                <Label htmlFor="exp_3_plus" className="text-sm font-normal">
                  3+ years
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </form.Field>

      {/* Licensing Section - New Fields */}
      <div className="border-t border-border pt-3 mt-3">
        <form.Field name="isLicensed">
          {(field) => (
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Do you have a life insurance license?
              </Label>
              <RadioGroup
                value={field.state.value ? "yes" : "no"}
                onValueChange={(value) => field.handleChange(value === "yes")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="yes"
                    id="licensed_yes"
                    className="border-2 border-border  bg-background"
                  />
                  <Label htmlFor="licensed_yes" className="text-sm font-normal">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="no"
                    id="licensed_no"
                    className="border-2 border-border  bg-background"
                  />
                  <Label htmlFor="licensed_no" className="text-sm font-normal">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </form.Field>

        {/* Conditional fields - only show if licensed */}
        <form.Subscribe selector={(state) => state.values.isLicensed}>
          {(isLicensed) =>
            isLicensed && (
              <div className="space-y-4 mt-4 pl-4 border-l-2 border-warning/30">
                {/* Current IMO */}
                <form.Field name="currentImoName">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="currentImoName"
                        className="text-xs font-medium"
                      >
                        Which IMO/agency are you currently with? (optional)
                      </Label>
                      <Input
                        id="currentImoName"
                        placeholder="Enter your current IMO or agency name"
                        variant="outlined"
                        className={`h-9 text-sm bg-white text-neutral-900 placeholder:text-neutral-500 ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </form.Field>

                {/* Specialties Multi-Select */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Which products do you primarily sell? (select all that
                    apply)
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPECIALTY_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`specialty_${option.value}`}
                          checked={selectedSpecialties.includes(option.value)}
                          onCheckedChange={() =>
                            handleSpecialtyToggle(option.value)
                          }
                        />
                        <Label
                          htmlFor={`specialty_${option.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          }
        </form.Subscribe>
      </div>

      {/* Why Interested */}
      <form.Field
        name="whyInterested"
        validators={{ onChange: leadFormSchema.shape.whyInterested }}
      >
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="whyInterested" className="text-xs font-medium">
              Why are you interested in a career in insurance?{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="whyInterested"
              variant="ghost"
              placeholder="Tell us a bit about yourself and what draws you to this opportunity..."
              className={`min-h-[56px] text-sm resize-none bg-white text-neutral-900 placeholder:text-neutral-500 border-2 border-border rounded-lg focus:border-foreground focus:bg-white ${field.state.meta.errors?.length ? "border-destructive" : ""}`}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-xs text-destructive" data-field-error>
                {getErrorMessage(field.state.meta.errors)}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* TCPA "prior express written consent" — REQUIRED. Hard-coded here in the
          shared form (not in the per-recruiter layout disclaimer) so a recruiter's
          custom branding can never remove it. Rendered text == recorded text. */}
      <form.Field
        name="tcpaConsent"
        validators={{
          onChange: ({ value }: { value: boolean }) =>
            value === true
              ? undefined
              : "You must agree to be contacted in order to submit this form.",
        }}
      >
        {(field) => (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5 space-y-1.5">
            <label
              htmlFor="tcpaConsent"
              className="flex items-start gap-2 cursor-pointer"
            >
              <Checkbox
                id="tcpaConsent"
                checked={field.state.value}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
                className="mt-0.5 shrink-0 border-2 border-neutral-400 bg-white"
              />
              <span className="text-[11px] leading-relaxed text-neutral-700">
                {TCPA_LEAD_CONSENT_TEXT}
              </span>
            </label>
            <p className="pl-6 text-[11px] text-neutral-600">
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-900"
              >
                Terms of Service
              </a>
              {" · "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-900"
              >
                Privacy Policy
              </a>
              {" · "}
              <a
                href="/accessibility"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-900"
              >
                Accessibility
              </a>
            </p>
            {field.state.meta.errors && field.state.meta.errors.length > 0 && (
              <p className="pl-6 text-xs text-destructive" data-field-error>
                {getErrorMessage(field.state.meta.errors)}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Submit Button - Theme-colored CTA. Disabled until TCPA consent is ticked. */}
      <form.Subscribe selector={(state) => state.values.tcpaConsent}>
        {(tcpaConsent) => (
          <Button
            type="submit"
            className={`w-full h-10 font-semibold shadow-lg hover:shadow-xl transition-all ${
              !primaryColor ? "bg-warning hover:bg-warning text-black" : ""
            }`}
            style={
              primaryColor
                ? {
                    backgroundColor: primaryColor,
                    color: "#ffffff",
                  }
                : undefined
            }
            disabled={submitLeadMutation.isPending || !tcpaConsent}
          >
            {submitLeadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              ctaText
            )}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
