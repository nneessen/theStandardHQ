// src/features/recruiting/components/public/LeadInterestForm.tsx
// Public interest form for the recruiting funnel — MULTI-STEP so it never
// scrolls: 4 short steps with an editorial "01 / 04" progress. High-contrast
// fields (off-white fills + defined borders) so inputs read clearly on the
// white form panel. The legally-required TCPA consent lives on the final step
// and is recorded verbatim + versioned on submit (never editable per-recruiter).

import { useId, useState, type KeyboardEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
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
import { getContrastingTextColor } from "@/lib/recruiting-theme";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack error shape
const getErrorMessage = (errors: any[]): string => {
  if (!errors || errors.length === 0) return "";
  return errors
    .map((err) => (typeof err === "string" ? err : err?.message || String(err)))
    .join(", ");
};

// Shared field styling — off-white fill + defined border so fields stand out on
// the white panel; focus picks up the recruiter's brand color.
const FIELD =
  "h-11 w-full rounded-[3px] border border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-900 shadow-sm transition-colors placeholder:text-neutral-400 focus:border-[var(--spec-primary,#1c1917)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--spec-primary,#1c1917)]";
const LABEL =
  "mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500";
const ERR =
  "border-destructive focus:border-destructive focus:ring-destructive";

const STEP_FIELDS: string[][] = [
  ["firstName", "lastName", "email", "phone"],
  ["city", "state", "availability"],
  ["insuranceExperience", "incomeGoals", "isLicensed"],
  ["whyInterested", "tcpaConsent"],
];
const STEP_TITLES = [
  "About you",
  "Location & availability",
  "Your experience",
  "Almost there",
];
const TOTAL = STEP_FIELDS.length;

const AVAILABILITY_OPTIONS: { value: LeadAvailability; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "exploring", label: "Exploring" },
];
const EXPERIENCE_OPTIONS: { value: LeadInsuranceExperience; label: string }[] =
  [
    { value: "none", label: "No experience" },
    { value: "less_than_1_year", label: "< 1 year" },
    { value: "1_to_3_years", label: "1–3 years" },
    { value: "3_plus_years", label: "3+ years" },
  ];

/**
 * Accessible segmented radio control. A proper radiogroup: named via
 * aria-labelledby, single tab stop with roving tabindex, ArrowKey navigation.
 * The selected pill ALWAYS has a visible fill (brand color, or a dark fallback
 * when no primaryColor is passed) with a contrast-aware foreground.
 */
function SegmentedRadio({
  label,
  options,
  value,
  onChange,
  primaryColor,
  columns = 3,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  primaryColor?: string;
  columns?: 2 | 3;
}) {
  const labelId = useId();
  const selectedBg = primaryColor || "#1c1917";
  const selectedFg = getContrastingTextColor(selectedBg);
  const hasSelection = options.some((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    e.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      ?.[next]?.focus();
  };

  return (
    <div>
      <span id={labelId} className={LABEL}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}
      >
        {options.map((opt, i) => {
          const selected = value === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!hasSelection && i === 0) ? 0 : -1}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`rounded-[3px] border px-2 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-transparent"
                  : "border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-neutral-400"
              }`}
              style={
                selected
                  ? { backgroundColor: selectedBg, color: selectedFg }
                  : undefined
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [step, setStep] = useState(0);

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
      if (honeypot) return; // bot
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
      if (result.success && result.lead_id) onSuccess(result.lead_id);
    },
  });

  const handleSpecialtyToggle = (specialty: LeadSpecialty) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty],
    );
  };

  const goNext = async () => {
    const fields = STEP_FIELDS[step];
    const results = await Promise.all(
      fields.map((f) => form.validateField(f as never, "change")),
    );
    const hasError = results.some((e) => Array.isArray(e) && e.length > 0);
    if (hasError) {
      toast.error("Please complete the highlighted fields.");
      requestAnimationFrame(() => {
        document
          .querySelector("[data-field-error]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // Contrast-aware foreground so CTAs stay readable on a light brand color.
  const accentStyle = primaryColor
    ? {
        backgroundColor: primaryColor,
        color: getContrastingTextColor(primaryColor),
      }
    : undefined;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await form.handleSubmit();
        requestAnimationFrame(() => {
          const errorEl = document.querySelector("[data-field-error]");
          if (errorEl) {
            toast.error("Please fill in all required fields");
            errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      }}
      className={`flex flex-col ${darkMode ? "lead-form-dark" : ""}`}
    >
      {/* Honeypot — hidden from real users */}
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

      {/* Editorial progress — announced to screen readers on each step change */}
      <div className="mb-5">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500"
        >
          <span>{STEP_TITLES[step]}</span>
          <span className="tabular-nums">
            {String(step + 1).padStart(2, "0")}
            <span className="opacity-40">
              {" "}
              / {String(TOTAL).padStart(2, "0")}
            </span>
          </span>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((step + 1) / TOTAL) * 100}%`,
              background: primaryColor || "#1c1917",
            }}
          />
        </div>
      </div>

      {/* ─────────── STEP 1 — About you ─────────── */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <form.Field
              name="firstName"
              validators={{ onChange: leadFormSchema.shape.firstName }}
            >
              {(field) => (
                <div>
                  <Label htmlFor="firstName" className={LABEL}>
                    First name
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    className={`${FIELD} ${field.state.meta.errors?.length ? ERR : ""}`}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors?.length > 0 && (
                    <p
                      className="mt-1 text-xs text-destructive"
                      data-field-error
                    >
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
                <div>
                  <Label htmlFor="lastName" className={LABEL}>
                    Last name
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    className={`${FIELD} ${field.state.meta.errors?.length ? ERR : ""}`}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors?.length > 0 && (
                    <p
                      className="mt-1 text-xs text-destructive"
                      data-field-error
                    >
                      {getErrorMessage(field.state.meta.errors)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field
            name="email"
            validators={{ onChange: leadFormSchema.shape.email }}
          >
            {(field) => (
              <div>
                <Label htmlFor="email" className={LABEL}>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  className={`${FIELD} ${field.state.meta.errors?.length ? ERR : ""}`}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors?.length > 0 && (
                  <p className="mt-1 text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="phone"
            validators={{ onChange: leadFormSchema.shape.phone }}
          >
            {(field) => (
              <div>
                <Label htmlFor="phone" className={LABEL}>
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className={`${FIELD} ${field.state.meta.errors?.length ? ERR : ""}`}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors?.length > 0 && (
                  <p className="mt-1 text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </div>
      )}

      {/* ─────────── STEP 2 — Location & availability ─────────── */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <form.Field
              name="city"
              validators={{ onChange: leadFormSchema.shape.city }}
            >
              {(field) => (
                <div>
                  <Label htmlFor="city" className={LABEL}>
                    City
                  </Label>
                  <Input
                    id="city"
                    placeholder="New York"
                    className={`${FIELD} ${field.state.meta.errors?.length ? ERR : ""}`}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors?.length > 0 && (
                    <p
                      className="mt-1 text-xs text-destructive"
                      data-field-error
                    >
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
                <div>
                  <Label htmlFor="state" className={LABEL}>
                    State
                  </Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger
                      aria-label="State"
                      className={`${FIELD} data-[placeholder]:text-neutral-400 ${field.state.meta.errors?.length ? ERR : ""}`}
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[220px]">
                      {US_STATES.map((s) => (
                        <SelectItem
                          key={s.value}
                          value={s.value}
                          className="text-sm"
                        >
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors?.length > 0 && (
                    <p
                      className="mt-1 text-xs text-destructive"
                      data-field-error
                    >
                      {getErrorMessage(field.state.meta.errors)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field
            name="availability"
            validators={{ onChange: leadFormSchema.shape.availability }}
          >
            {(field) => (
              <SegmentedRadio
                label="Availability"
                columns={3}
                primaryColor={primaryColor}
                value={field.state.value}
                onChange={(v) => field.handleChange(v as LeadAvailability)}
                options={AVAILABILITY_OPTIONS}
              />
            )}
          </form.Field>
        </div>
      )}

      {/* ─────────── STEP 3 — Experience ─────────── */}
      {step === 2 && (
        <div className="space-y-3">
          <form.Field
            name="insuranceExperience"
            validators={{ onChange: leadFormSchema.shape.insuranceExperience }}
          >
            {(field) => (
              <SegmentedRadio
                label="Insurance experience"
                columns={2}
                primaryColor={primaryColor}
                value={field.state.value}
                onChange={(v) =>
                  field.handleChange(v as LeadInsuranceExperience)
                }
                options={EXPERIENCE_OPTIONS}
              />
            )}
          </form.Field>

          <form.Field name="incomeGoals">
            {(field) => (
              <div>
                <Label htmlFor="incomeGoals" className={LABEL}>
                  Income goal (optional)
                </Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <SelectTrigger
                    aria-label="Income goal"
                    className={`${FIELD} data-[placeholder]:text-neutral-400`}
                  >
                    <SelectValue placeholder="Select (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_GOAL_OPTIONS.filter((o) => o.value !== "").map(
                      (o) => (
                        <SelectItem
                          key={o.value}
                          value={o.value}
                          className="text-sm"
                        >
                          {o.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="isLicensed">
            {(field) => (
              <SegmentedRadio
                label="Do you have a life insurance license?"
                columns={2}
                primaryColor={primaryColor}
                value={field.state.value ? "yes" : "no"}
                onChange={(v) => field.handleChange(v === "yes")}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.isLicensed}>
            {(isLicensed) =>
              isLicensed && (
                <div className="space-y-3 border-l-2 border-neutral-200 pl-3">
                  <form.Field name="currentImoName">
                    {(field) => (
                      <div>
                        <Label htmlFor="currentImoName" className={LABEL}>
                          Current IMO / agency (optional)
                        </Label>
                        <Input
                          id="currentImoName"
                          placeholder="Your current IMO or agency"
                          className={FIELD}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>
                  <div>
                    <Label className={LABEL}>Products you sell</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SPECIALTY_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700"
                        >
                          <Checkbox
                            checked={selectedSpecialties.includes(opt.value)}
                            onCheckedChange={() =>
                              handleSpecialtyToggle(opt.value)
                            }
                            className="border-neutral-400"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )
            }
          </form.Subscribe>
        </div>
      )}

      {/* ─────────── STEP 4 — Why + consent ─────────── */}
      {step === 3 && (
        <div className="space-y-3">
          <form.Field
            name="whyInterested"
            validators={{ onChange: leadFormSchema.shape.whyInterested }}
          >
            {(field) => (
              <div>
                <Label htmlFor="whyInterested" className={LABEL}>
                  Why are you interested?
                </Label>
                <Textarea
                  id="whyInterested"
                  placeholder="Tell us a bit about yourself and what draws you to this opportunity…"
                  className={`min-h-[88px] w-full resize-none rounded-[3px] border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 shadow-sm transition-colors placeholder:text-neutral-400 focus:border-[var(--spec-primary,#1c1917)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--spec-primary,#1c1917)] ${field.state.meta.errors?.length ? ERR : ""}`}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors?.length > 0 && (
                  <p className="mt-1 text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* TCPA "prior express written consent" — REQUIRED. Hard-coded here so a
              recruiter's branding can never remove it. Rendered text == recorded text. */}
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
              <div className="space-y-1.5 rounded-[3px] border border-neutral-200 bg-neutral-50 p-2.5">
                <label
                  htmlFor="tcpaConsent"
                  className="flex cursor-pointer items-start gap-2"
                >
                  <Checkbox
                    id="tcpaConsent"
                    checked={field.state.value}
                    onCheckedChange={(c) => field.handleChange(c === true)}
                    className="mt-0.5 shrink-0 border-neutral-400 bg-white"
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
                {field.state.meta.errors?.length > 0 && (
                  <p className="pl-6 text-xs text-destructive" data-field-error>
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </div>
      )}

      {/* ─────────── Footer nav ─────────── */}
      <div className="mt-5 flex items-center gap-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            className="h-11 border-neutral-300 px-4 text-neutral-700"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
        )}
        {step < TOTAL - 1 ? (
          <Button
            type="button"
            onClick={goNext}
            className="h-11 flex-1 font-semibold"
            style={accentStyle}
          >
            Continue
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <form.Subscribe selector={(s) => s.values.tcpaConsent}>
            {(tcpaConsent) => (
              <Button
                type="submit"
                disabled={submitLeadMutation.isPending || !tcpaConsent}
                className={`h-11 flex-1 font-semibold ${!primaryColor ? "bg-neutral-900 text-white hover:bg-neutral-800" : ""}`}
                style={accentStyle}
              >
                {submitLeadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  ctaText
                )}
              </Button>
            )}
          </form.Subscribe>
        )}
      </div>
    </form>
  );
}
