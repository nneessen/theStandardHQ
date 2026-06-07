// Recruiting → Your Page: one guided, step-by-step setup flow for the agent's
// public recruiting page. Built for non-technical users — one decision per
// screen, big inputs, a clickable step rail, autosave on every step, and a
// truthful "Preview my page" button that opens the real live page.
//
// Steps: Your link → About you → Look & feel → Booking & contact →
// What visitors see → Custom domain (optional) → Review & publish.
//
// Data access goes through useRecruitingPageEditor (feature hook). Branding
// steps are gated behind the custom_branding entitlement; the link itself is
// free for everyone.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Link2,
  Globe,
  Copy,
  Check,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  Eye,
  PartyPopper,
  LayoutGrid,
  Palette,
  Image as ImageIcon,
  Share2,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { useFeatureAccess } from "@/hooks/subscription";
import { useAuth } from "@/contexts/AuthContext";
import { subdomainUrl } from "@/lib/hostname";
import { isValidHexColor, isValidSafeUrl } from "@/lib/recruiting-validation";
import {
  ColorPicker,
  ImageUpload,
  CustomDomainManager,
} from "@/features/settings";
import type {
  RecruitingPageSettingsInput,
  SocialLinks,
  EnabledFeatures,
} from "@/types/recruiting-theme.types";
import {
  COLOR_PRESETS,
  DEFAULT_THEME,
  LOGO_SIZE_MAP,
} from "@/types/recruiting-theme.types";
import { useRecruitingPageEditor } from "../hooks/useRecruitingPageEditor";

/* ───────────────────────────── steps ───────────────────────────── */

type StepId =
  | "link"
  | "about"
  | "look"
  | "booking"
  | "visitors"
  | "domain"
  | "review";

const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: "link", label: "Your link", hint: "Pick your web address" },
  { id: "about", label: "About you", hint: "Name & message" },
  { id: "look", label: "Look & feel", hint: "Layout, colors, logo" },
  {
    id: "booking",
    label: "Booking & contact",
    hint: "How prospects reach you",
  },
  { id: "visitors", label: "What visitors see", hint: "Sections & options" },
  { id: "domain", label: "Custom domain", hint: "Optional — your own URL" },
  { id: "review", label: "Review & publish", hint: "You're all set" },
];

const BRANDING_STEPS: StepId[] = ["about", "look", "booking", "visitors"];

/* ─────────────────────────── helpers ───────────────────────────── */

function emptyToNull(v: string | null | undefined): string | null {
  return v && v.trim() !== "" ? v : null;
}

function cleanBrandingInput(
  form: RecruitingPageSettingsInput,
): RecruitingPageSettingsInput {
  const sl = form.social_links ?? {};
  const cleanedSocial: SocialLinks = {};
  if (sl.facebook?.trim()) cleanedSocial.facebook = sl.facebook.trim();
  if (sl.instagram?.trim()) cleanedSocial.instagram = sl.instagram.trim();
  if (sl.twitter?.trim()) cleanedSocial.twitter = sl.twitter.trim();
  if (sl.youtube?.trim()) cleanedSocial.youtube = sl.youtube.trim();

  return {
    ...form,
    display_name: emptyToNull(form.display_name),
    headline: emptyToNull(form.headline),
    subheadline: emptyToNull(form.subheadline),
    about_text: emptyToNull(form.about_text),
    cta_text: emptyToNull(form.cta_text),
    calendly_url: emptyToNull(form.calendly_url),
    support_phone: emptyToNull(form.support_phone),
    disclaimer_text: emptyToNull(form.disclaimer_text),
    default_city: emptyToNull(form.default_city),
    default_state: emptyToNull(form.default_state),
    social_links: cleanedSocial,
  };
}

function validateSlug(value: string): string | null {
  if (!value.trim()) return "Please enter a link.";
  if (value.length < 3) return "Use at least 3 characters.";
  if (value.length > 50) return "Keep it under 50 characters.";
  if (!/^[a-z0-9-]+$/.test(value))
    return "Only lowercase letters, numbers, and hyphens.";
  if (value.startsWith("-") || value.endsWith("-"))
    return "Can't start or end with a hyphen.";
  return null;
}

const INITIAL_FORM: RecruitingPageSettingsInput = {
  layout_variant: "split-panel",
  logo_size: "medium",
  display_name: "",
  headline: "",
  subheadline: "",
  about_text: "",
  primary_color: DEFAULT_THEME.primary_color,
  accent_color: DEFAULT_THEME.accent_color,
  logo_light_url: null,
  logo_dark_url: null,
  hero_image_url: null,
  cta_text: DEFAULT_THEME.cta_text,
  calendly_url: "",
  support_phone: "",
  social_links: {},
  disclaimer_text: "",
  default_city: "",
  default_state: "",
  enabled_features: DEFAULT_THEME.enabled_features,
};

/* ─────────────────────── small presentational ──────────────────── */

function StepHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-v2-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-v2-ink-muted">{desc}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wide text-v2-ink-subtle">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-v2-ink-subtle">{hint}</p>}
    </div>
  );
}

function UrlField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const invalid = value.trim() !== "" && !isValidSafeUrl(value);
  return (
    <Field label={label} hint={!invalid ? hint : undefined}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-11 text-base ${
          invalid ? "border-destructive focus-visible:ring-destructive" : ""
        }`}
      />
      {invalid && (
        <p className="text-[11px] text-destructive">
          Must start with http:// or https://
        </p>
      )}
    </Field>
  );
}

/* ───────────────────────────── wizard ──────────────────────────── */

export function RecruitingPageWizard() {
  const { user } = useAuth();
  const { hasAccess: canBrand } = useFeatureAccess("custom_branding");
  const {
    settings,
    isLoading,
    saveBranding,
    uploadAsset,
    deleteAsset,
    saveSlug,
  } = useRecruitingPageEditor();

  const [step, setStep] = useState<StepId>("link");
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // Branding form state — seeded once from settings.
  const [form, setForm] = useState<RecruitingPageSettingsInput>(INITIAL_FORM);
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || isLoading) return;
    if (settings) {
      setForm({
        layout_variant: settings.layout_variant || "split-panel",
        logo_size: settings.logo_size || "medium",
        display_name: settings.display_name || "",
        headline: settings.headline || "",
        subheadline: settings.subheadline || "",
        about_text: settings.about_text || "",
        primary_color: settings.primary_color || DEFAULT_THEME.primary_color,
        accent_color: settings.accent_color || DEFAULT_THEME.accent_color,
        logo_light_url: settings.logo_light_url,
        logo_dark_url: settings.logo_dark_url,
        hero_image_url: settings.hero_image_url,
        cta_text: settings.cta_text || DEFAULT_THEME.cta_text,
        calendly_url: settings.calendly_url || "",
        support_phone: settings.support_phone || "",
        social_links: settings.social_links || {},
        disclaimer_text: settings.disclaimer_text || "",
        default_city: settings.default_city || "",
        default_state: settings.default_state || "",
        enabled_features:
          settings.enabled_features || DEFAULT_THEME.enabled_features,
      });
    }
    seededRef.current = true;
  }, [settings, isLoading]);

  const updateField = useCallback(
    <K extends keyof RecruitingPageSettingsInput>(
      field: K,
      value: RecruitingPageSettingsInput[K],
    ) => setForm((prev) => ({ ...prev, [field]: value })),
    [],
  );
  const updateSocial = useCallback(
    (platform: keyof SocialLinks, url: string) =>
      setForm((prev) => ({
        ...prev,
        social_links: { ...prev.social_links, [platform]: url },
      })),
    [],
  );
  const updateFeature = useCallback(
    (feature: keyof EnabledFeatures, value: boolean) =>
      setForm((prev) => ({
        ...prev,
        enabled_features: { ...prev.enabled_features, [feature]: value },
      })),
    [],
  );

  // Slug state
  const [slug, setSlug] = useState(user?.recruiter_slug ?? "");
  const [currentSlug, setCurrentSlug] = useState(user?.recruiter_slug ?? "");
  const [slugError, setSlugError] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);

  // Save feedback
  const [savingBranding, setSavingBranding] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [uploadingType, setUploadingType] = useState<
    "logo_light" | "logo_dark" | "hero" | null
  >(null);
  const [published, setPublished] = useState(false);

  const hasBrandingErrors = useMemo(() => {
    if (form.primary_color && !isValidHexColor(form.primary_color)) return true;
    if (form.accent_color && !isValidHexColor(form.accent_color)) return true;
    if (form.calendly_url && !isValidSafeUrl(form.calendly_url)) return true;
    for (const url of Object.values(form.social_links ?? {})) {
      if (url && !isValidSafeUrl(url)) return true;
    }
    return false;
  }, [form]);

  const persistBranding = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      setSavingBranding(true);
      try {
        await saveBranding(cleanBrandingInput(form));
        setSavedTick(true);
        window.setTimeout(() => setSavedTick(false), 2200);
        return true;
      } catch (e) {
        if (!opts?.silent) {
          toast.error(
            e instanceof Error ? e.message : "Couldn't save your changes.",
          );
        }
        return false;
      } finally {
        setSavingBranding(false);
      }
    },
    [form, saveBranding],
  );

  const handleUpload = useCallback(
    async (file: File, type: "logo_light" | "logo_dark" | "hero") => {
      setUploadingType(type);
      try {
        const url = await uploadAsset(file, type);
        const map = {
          logo_light: "logo_light_url",
          logo_dark: "logo_dark_url",
          hero: "hero_image_url",
        } as const;
        updateField(map[type], url);
        toast.success("Image uploaded.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUploadingType(null);
      }
    },
    [uploadAsset, updateField],
  );

  const handleDeleteImage = useCallback(
    async (field: "logo_light_url" | "logo_dark_url" | "hero_image_url") => {
      const url = form[field];
      if (!url) return;
      try {
        await deleteAsset(url);
        updateField(field, null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't remove image.");
      }
    },
    [form, deleteAsset, updateField],
  );

  // Persist the current step. Returns false to block forward navigation.
  const commitCurrentStep = useCallback(async (): Promise<boolean> => {
    if (step === "link") {
      if (slug === currentSlug && currentSlug) return true; // unchanged
      const err = validateSlug(slug);
      if (err) {
        setSlugError(err);
        return false;
      }
      setSlugSaving(true);
      const res = await saveSlug(slug, user?.id ?? "");
      setSlugSaving(false);
      if (!res.ok) {
        setSlugError(res.error);
        return false;
      }
      setSlugError("");
      setCurrentSlug(slug);
      return true;
    }
    if (BRANDING_STEPS.includes(step) && canBrand) {
      if (hasBrandingErrors) {
        toast.error("Please fix the highlighted fields first.");
        return false;
      }
      return persistBranding();
    }
    return true;
  }, [
    step,
    slug,
    currentSlug,
    saveSlug,
    user?.id,
    canBrand,
    hasBrandingErrors,
    persistBranding,
  ]);

  const goTo = useCallback(
    async (targetIdx: number) => {
      if (targetIdx === stepIndex) return;
      if (targetIdx > stepIndex) {
        const ok = await commitCurrentStep();
        if (!ok) return;
      }
      setStep(STEPS[targetIdx].id);
    },
    [stepIndex, commitCurrentStep],
  );

  const handleFinish = useCallback(async () => {
    if (!currentSlug) {
      setStep("link");
      setSlugError("Choose your link to publish your page.");
      return;
    }
    if (canBrand) {
      if (hasBrandingErrors) {
        toast.error("Please fix the highlighted fields first.");
        return;
      }
      const ok = await persistBranding();
      if (!ok) return;
    }
    setPublished(true);
    toast.success("Your recruiting page is published!");
  }, [currentSlug, canBrand, hasBrandingErrors, persistBranding]);

  const previewUrl = currentSlug ? subdomainUrl(currentSlug) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const isLast = step === "review";

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar: progress note + saved indicator + preview */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-v2-ink-muted">
          <span className="font-medium text-v2-ink">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          {savingBranding ? (
            <span className="flex items-center gap-1 text-v2-ink-subtle">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : savedTick ? (
            <span className="flex items-center gap-1 text-success">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!previewUrl}
          onClick={() =>
            previewUrl && window.open(previewUrl, "_blank", "noopener")
          }
          className="h-9"
          title={
            previewUrl
              ? "Open your live recruiting page"
              : "Pick your link first"
          }
        >
          <Eye className="mr-1.5 h-4 w-4" />
          Preview my page
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[230px_1fr]">
        {/* Step rail */}
        <StepRail currentIdx={stepIndex} onJump={goTo} />

        {/* Content */}
        <main className="min-w-0">
          {step === "link" && (
            <LinkStep
              slug={slug}
              currentSlug={currentSlug}
              error={slugError}
              onChange={(v) => {
                setSlug(v);
                if (slugError) setSlugError("");
              }}
            />
          )}

          {step === "about" && (
            <FeatureGate feature="custom_branding" promptVariant="card">
              <AboutStep form={form} updateField={updateField} />
            </FeatureGate>
          )}

          {step === "look" && (
            <FeatureGate feature="custom_branding" promptVariant="card">
              <LookStep
                form={form}
                updateField={updateField}
                onUpload={handleUpload}
                onDeleteImage={handleDeleteImage}
                uploadingType={uploadingType}
              />
            </FeatureGate>
          )}

          {step === "booking" && (
            <FeatureGate feature="custom_branding" promptVariant="card">
              <BookingStep
                form={form}
                updateField={updateField}
                updateSocial={updateSocial}
              />
            </FeatureGate>
          )}

          {step === "visitors" && (
            <FeatureGate feature="custom_branding" promptVariant="card">
              <VisitorsStep
                form={form}
                updateField={updateField}
                updateFeature={updateFeature}
              />
            </FeatureGate>
          )}

          {step === "domain" && (
            <DomainStep currentSlug={currentSlug} previewUrl={previewUrl} />
          )}

          {step === "review" && (
            <ReviewStep
              form={form}
              currentSlug={currentSlug}
              previewUrl={previewUrl}
              published={published}
              canBrand={canBrand}
              onEditLink={() => setStep("link")}
            />
          )}

          {/* Footer nav */}
          <div className="mt-10 flex items-center justify-between border-t border-v2-ring pt-5">
            <Button
              type="button"
              variant="ghost"
              disabled={stepIndex === 0}
              onClick={() => setStep(STEPS[stepIndex - 1].id)}
              className="h-10"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>

            {isLast ? (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={savingBranding}
                className="h-10 px-5"
              >
                {savingBranding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                {published ? "Saved" : "Finish & publish"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => goTo(stepIndex + 1)}
                disabled={slugSaving || savingBranding}
                className="h-10 px-5"
              >
                {slugSaving || savingBranding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {step === "domain" ? "Continue" : "Save & continue"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ───────────────────────────── rail ────────────────────────────── */

function StepRail({
  currentIdx,
  onJump,
}: {
  currentIdx: number;
  onJump: (idx: number) => void;
}) {
  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <ol className="flex gap-3 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <li key={s.id} className="lg:pb-5">
              <button
                type="button"
                onClick={() => onJump(i)}
                className="flex items-start gap-3 text-left"
              >
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                      done
                        ? "border-success bg-success text-success-foreground"
                        : current
                          ? "border-info bg-info/15 text-info"
                          : "border-v2-ring text-v2-ink-subtle"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      className={`mt-1 hidden h-7 w-px lg:block ${
                        done ? "bg-success" : "bg-v2-ring"
                      }`}
                    />
                  )}
                </div>
                <span className="min-w-0 pt-0.5">
                  <span
                    className={`block whitespace-nowrap text-sm font-medium lg:whitespace-normal ${
                      current
                        ? "text-v2-ink"
                        : done
                          ? "text-v2-ink-muted"
                          : "text-v2-ink-subtle"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="hidden text-[11px] text-v2-ink-subtle lg:block">
                    {s.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/* ────────────────────────── step 1: link ───────────────────────── */

function CopyRow({
  value,
  display,
  tone = "muted",
}: {
  value: string;
  display: string;
  tone?: "success" | "muted";
}) {
  const [copied, setCopied] = useState(false);
  const success = tone === "success";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
        success ? "border-success/30 bg-success/10" : "border-v2-ring"
      }`}
    >
      <span
        className={`flex min-w-0 items-center gap-2 font-mono text-sm ${
          success ? "font-medium text-success" : "text-v2-ink-muted"
        }`}
      >
        <Globe className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{display}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        }}
        className={`flex flex-shrink-0 items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-medium ${
          success
            ? "border-success/40 text-success hover:bg-success/15"
            : "border-v2-ring text-v2-ink-muted hover:bg-v2-ring hover:text-v2-ink"
        }`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function LinkStep({
  slug,
  currentSlug,
  error,
  onChange,
}: {
  slug: string;
  currentSlug: string;
  error: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="max-w-xl">
      <StepHeader
        title="Pick your link"
        desc="This is the web address you'll share with prospects. Keep it short — your name or agency works great. It powers your free page instantly, no setup needed."
      />

      <Field label="Your link">
        <div className="flex items-stretch overflow-hidden rounded-md border border-v2-ring focus-within:ring-2 focus-within:ring-info">
          <Input
            value={slug}
            onChange={(e) =>
              onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            placeholder="john-smith"
            className="h-12 flex-1 border-0 bg-transparent text-base focus-visible:ring-0"
          />
          <span className="flex items-center whitespace-nowrap border-l border-v2-ring bg-v2-card px-3 font-mono text-sm text-v2-ink-muted">
            .thestandardhq.com
          </span>
        </div>
        {error ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-v2-ink-subtle">
            Lowercase letters, numbers, and hyphens only.
          </p>
        )}
      </Field>

      {currentSlug && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-v2-ink-subtle">
            Your page is live at
          </p>
          <CopyRow
            tone="success"
            value={subdomainUrl(currentSlug)}
            display={`${currentSlug}.thestandardhq.com`}
          />
          <CopyRow
            value={`https://www.thestandardhq.com/join-${currentSlug}`}
            display={`www.thestandardhq.com/join-${currentSlug}`}
          />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── step 2: about ──────────────────────── */

function AboutStep({
  form,
  updateField,
}: {
  form: RecruitingPageSettingsInput;
  updateField: <K extends keyof RecruitingPageSettingsInput>(
    f: K,
    v: RecruitingPageSettingsInput[K],
  ) => void;
}) {
  return (
    <div className="max-w-xl space-y-6">
      <StepHeader
        title="Tell prospects who you are"
        desc="This is the headline and message visitors see first. Make it personal and inviting."
      />
      <Field label="Display name" hint="Your agency or team name.">
        <Input
          value={form.display_name || ""}
          onChange={(e) => updateField("display_name", e.target.value)}
          placeholder="The Standard — Tampa"
          className="h-11 text-base"
        />
      </Field>
      <Field label="Headline">
        <Input
          value={form.headline || ""}
          onChange={(e) => updateField("headline", e.target.value)}
          placeholder="Join Our Team"
          className="h-11 text-base"
        />
      </Field>
      <Field label="Subheadline">
        <Textarea
          value={form.subheadline || ""}
          onChange={(e) => updateField("subheadline", e.target.value)}
          placeholder="Build your career in insurance"
          className="min-h-[70px] text-sm"
        />
      </Field>
      <Field
        label="About you (optional)"
        hint="A short paragraph about your agency and what makes it a great place to work."
      >
        <Textarea
          value={form.about_text || ""}
          onChange={(e) => updateField("about_text", e.target.value)}
          placeholder="Tell prospects about your agency, your culture, and the opportunity…"
          className="min-h-[110px] text-sm"
        />
      </Field>
    </div>
  );
}

/* ────────────────────────── step 3: look ───────────────────────── */

const LAYOUTS: {
  id: NonNullable<RecruitingPageSettingsInput["layout_variant"]>;
  name: string;
  desc: string;
}[] = [
  { id: "split-panel", name: "Split panel", desc: "Hero left, form right" },
  { id: "centered-card", name: "Centered card", desc: "Clean & minimal" },
  { id: "hero-slide", name: "Hero slide", desc: "Full-screen + slide form" },
  {
    id: "multi-section",
    name: "Multi-section",
    desc: "Scrolling landing page",
  },
];

function LayoutPreview({ id, color }: { id: string; color: string }) {
  const base = "h-16 overflow-hidden rounded border border-border/60";
  if (id === "split-panel") {
    return (
      <div className={`${base} flex`}>
        <div className="flex w-1/2 flex-col justify-end gap-1 bg-foreground/90 p-1.5">
          <div className="h-1 w-8 rounded-full bg-white/60" />
          <div
            className="h-1.5 w-5 rounded"
            style={{ backgroundColor: color }}
          />
        </div>
        <div className="flex w-1/2 flex-col justify-center gap-1 bg-background p-1.5">
          <div className="h-1 w-full rounded bg-muted" />
          <div className="h-1 w-full rounded bg-muted" />
          <div
            className="h-1.5 w-full rounded"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    );
  }
  if (id === "centered-card") {
    return (
      <div
        className={`${base} flex items-center justify-center bg-gradient-to-br from-background to-muted/50`}
      >
        <div className="w-12 space-y-1 rounded border border-border/60 bg-card p-1.5 shadow-sm">
          <div className="h-1 w-full rounded bg-muted" />
          <div
            className="h-1.5 w-full rounded"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    );
  }
  if (id === "hero-slide") {
    return (
      <div
        className={`${base} relative flex flex-col items-center justify-center bg-foreground/90 p-1.5`}
      >
        <div className="h-1.5 w-12 rounded-full bg-white/60" />
        <div
          className="mt-1 h-2 w-6 rounded"
          style={{ backgroundColor: color }}
        />
        <div className="absolute bottom-1 right-1 top-1 w-4 rounded-l border-l border-border/60 bg-background/90" />
      </div>
    );
  }
  return (
    <div className={`${base} flex flex-col`}>
      <div className="flex h-5 items-center justify-center bg-foreground/90">
        <div className="h-1 w-8 rounded-full bg-white/50" />
      </div>
      <div
        className="flex flex-1 items-center justify-center gap-1"
        style={{ backgroundColor: `${color}14` }}
      >
        <div
          className="h-2 w-2 rounded"
          style={{ backgroundColor: `${color}55` }}
        />
        <div
          className="h-2 w-2 rounded"
          style={{ backgroundColor: `${color}55` }}
        />
        <div
          className="h-2 w-2 rounded"
          style={{ backgroundColor: `${color}55` }}
        />
      </div>
      <div className="h-2 bg-foreground/90" />
    </div>
  );
}

function LookStep({
  form,
  updateField,
  onUpload,
  onDeleteImage,
  uploadingType,
}: {
  form: RecruitingPageSettingsInput;
  updateField: <K extends keyof RecruitingPageSettingsInput>(
    f: K,
    v: RecruitingPageSettingsInput[K],
  ) => void;
  onUpload: (file: File, type: "logo_light" | "logo_dark" | "hero") => void;
  onDeleteImage: (
    field: "logo_light_url" | "logo_dark_url" | "hero_image_url",
  ) => void;
  uploadingType: "logo_light" | "logo_dark" | "hero" | null;
}) {
  const color = form.primary_color || DEFAULT_THEME.primary_color;
  return (
    <div className="max-w-2xl space-y-8">
      <StepHeader
        title="Make it yours"
        desc="Choose a layout, your brand colors, and upload your logo. Everything updates on your live page."
      />

      {/* Layout */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Page layout</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {LAYOUTS.map((l) => {
            const selected = form.layout_variant === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => updateField("layout_variant", l.id)}
                className={`relative rounded-lg border-2 p-2.5 text-left transition-all ${
                  selected
                    ? "border-info bg-info/5"
                    : "border-v2-ring hover:border-info/50"
                }`}
              >
                {selected && (
                  <Check className="absolute right-2 top-2 h-4 w-4 text-info" />
                )}
                <LayoutPreview id={l.id} color={color} />
                <p className="mt-2 text-xs font-medium text-v2-ink">{l.name}</p>
                <p className="text-[10px] text-v2-ink-subtle">{l.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Colors */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Brand colors</h3>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ColorPicker
            label="Primary color"
            value={form.primary_color || DEFAULT_THEME.primary_color}
            onChange={(c) => updateField("primary_color", c)}
            presets={COLOR_PRESETS.primary}
          />
          <ColorPicker
            label="Accent color"
            value={form.accent_color || DEFAULT_THEME.accent_color}
            onChange={(c) => updateField("accent_color", c)}
            presets={COLOR_PRESETS.accent}
          />
        </div>
      </section>

      {/* Logo size */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Logo size</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["small", "medium", "large", "xlarge"] as const).map((size) => {
            const selected = form.logo_size === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => updateField("logo_size", size)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-5 py-3 transition-all ${
                  selected
                    ? "border-info bg-info/5"
                    : "border-v2-ring hover:border-info/50"
                }`}
              >
                <div
                  className="flex items-center justify-center rounded"
                  style={{
                    width: LOGO_SIZE_MAP[size].desktop * 0.5,
                    height: LOGO_SIZE_MAP[size].desktop * 0.5,
                    backgroundColor: color,
                  }}
                />
                <span className="text-xs font-medium capitalize text-v2-ink">
                  {size}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Images */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">
            Logo & hero image
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ImageUpload
            label="Logo (for dark backgrounds)"
            description="Shown on dark areas. PNG or SVG works best."
            value={form.logo_light_url ?? null}
            onUpload={(file) => onUpload(file, "logo_light")}
            onDelete={() => onDeleteImage("logo_light_url")}
            isUploading={uploadingType === "logo_light"}
            accept="image/png,image/svg+xml,image/webp"
          />
          <ImageUpload
            label="Logo (for light backgrounds)"
            description="Shown on light areas. PNG or SVG works best."
            value={form.logo_dark_url ?? null}
            onUpload={(file) => onUpload(file, "logo_dark")}
            onDelete={() => onDeleteImage("logo_dark_url")}
            isUploading={uploadingType === "logo_dark"}
            accept="image/png,image/svg+xml,image/webp"
          />
        </div>
        <ImageUpload
          label="Hero image (optional)"
          description="A background image for the hero section. JPG or PNG."
          value={form.hero_image_url ?? null}
          onUpload={(file) => onUpload(file, "hero")}
          onDelete={() => onDeleteImage("hero_image_url")}
          isUploading={uploadingType === "hero"}
          accept="image/jpeg,image/png,image/webp"
        />
      </section>
    </div>
  );
}

/* ───────────────────────── step 4: booking ─────────────────────── */

function BookingStep({
  form,
  updateField,
  updateSocial,
}: {
  form: RecruitingPageSettingsInput;
  updateField: <K extends keyof RecruitingPageSettingsInput>(
    f: K,
    v: RecruitingPageSettingsInput[K],
  ) => void;
  updateSocial: (platform: keyof SocialLinks, url: string) => void;
}) {
  return (
    <div className="max-w-xl space-y-6">
      <StepHeader
        title="How prospects reach you"
        desc="Set the button text, add a booking link, and connect your socials. All optional — fill in what you use."
      />
      <Field label="Button text" hint="The call-to-action on your page.">
        <Input
          value={form.cta_text || ""}
          onChange={(e) => updateField("cta_text", e.target.value)}
          placeholder="Apply Now"
          className="h-11 text-base"
        />
      </Field>
      <UrlField
        label="Booking link (Calendly)"
        value={form.calendly_url || ""}
        onChange={(v) => updateField("calendly_url", v)}
        placeholder="https://calendly.com/your-link"
        hint="Prospects can book a call straight from your page."
      />
      <Field label="Support phone (optional)">
        <Input
          value={form.support_phone || ""}
          onChange={(e) => updateField("support_phone", e.target.value)}
          placeholder="+1 (555) 123-4567"
          className="h-11 text-base"
        />
      </Field>

      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Social links</h3>
        </div>
        <UrlField
          label="Facebook"
          value={form.social_links?.facebook || ""}
          onChange={(v) => updateSocial("facebook", v)}
          placeholder="https://facebook.com/…"
        />
        <UrlField
          label="Instagram"
          value={form.social_links?.instagram || ""}
          onChange={(v) => updateSocial("instagram", v)}
          placeholder="https://instagram.com/…"
        />
        <UrlField
          label="YouTube"
          value={form.social_links?.youtube || ""}
          onChange={(v) => updateSocial("youtube", v)}
          placeholder="https://youtube.com/…"
        />
      </div>
    </div>
  );
}

/* ──────────────────────── step 5: visitors ─────────────────────── */

function Toggle({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-v2-ring p-3 hover:bg-v2-ring/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
      />
      <span>
        <span className="block text-sm font-medium text-v2-ink">{title}</span>
        <span className="block text-[11px] text-v2-ink-subtle">{desc}</span>
      </span>
    </label>
  );
}

function VisitorsStep({
  form,
  updateField,
  updateFeature,
}: {
  form: RecruitingPageSettingsInput;
  updateField: <K extends keyof RecruitingPageSettingsInput>(
    f: K,
    v: RecruitingPageSettingsInput[K],
  ) => void;
  updateFeature: (feature: keyof EnabledFeatures, value: boolean) => void;
}) {
  const ef = form.enabled_features ?? {};
  return (
    <div className="max-w-xl space-y-6">
      <StepHeader
        title="What visitors see"
        desc="Turn page sections on or off and add a few finishing touches."
      />

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Page sections</h3>
        </div>
        <Toggle
          checked={ef.show_display_name !== false}
          onChange={(v) => updateFeature("show_display_name", v)}
          title="Show display-name heading"
          desc="Display your agency name next to your logo."
        />
        <Toggle
          checked={ef.show_stats !== false}
          onChange={(v) => updateFeature("show_stats", v)}
          title="Show earnings highlight"
          desc='The "$20,000+ average monthly commissions" callout.'
        />
        <Toggle
          checked={ef.show_about !== false}
          onChange={(v) => updateFeature("show_about", v)}
          title="Show About section"
          desc="Display the about text you wrote earlier."
        />
        <Toggle
          checked={ef.collect_phone !== false}
          onChange={(v) => updateFeature("collect_phone", v)}
          title="Collect phone number"
          desc="Ask prospects for a phone number on the form."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Default city (optional)">
          <Input
            value={form.default_city || ""}
            onChange={(e) => updateField("default_city", e.target.value)}
            placeholder="Tampa"
            className="h-11 text-base"
          />
        </Field>
        <Field label="Default state (optional)">
          <Input
            value={form.default_state || ""}
            onChange={(e) => updateField("default_state", e.target.value)}
            placeholder="FL"
            maxLength={2}
            className="h-11 text-base"
          />
        </Field>
      </div>

      <Field
        label="Footer disclaimer (optional)"
        hint="Shown in small print at the bottom of your page."
      >
        <Textarea
          value={form.disclaimer_text || ""}
          onChange={(e) => updateField("disclaimer_text", e.target.value)}
          placeholder="By submitting, you agree to be contacted about career opportunities."
          className="min-h-[70px] text-sm"
        />
      </Field>
    </div>
  );
}

/* ──────────────────────── step 6: domain ───────────────────────── */

function DomainStep({
  currentSlug,
  previewUrl,
}: {
  currentSlug: string;
  previewUrl: string | null;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <StepHeader
        title="Use your own domain (optional)"
        desc="Your page already works on your free address. If you own a domain, you can connect it for a fully branded link — we walk you through it step by step."
      />

      {currentSlug && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            Your free address is ready
          </div>
          <a
            href={previewUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block truncate font-mono text-sm text-success hover:underline"
          >
            {currentSlug}.thestandardhq.com
          </a>
          <p className="mt-1.5 text-xs text-v2-ink-muted">
            Most agents just use this — nothing to set up. A custom domain is
            purely optional.
          </p>
        </div>
      )}

      <FeatureGate feature="custom_branding" promptVariant="card">
        <div className="rounded-lg border border-v2-ring bg-v2-card p-4">
          <CustomDomainManager />
        </div>
      </FeatureGate>
    </div>
  );
}

/* ──────────────────────── step 7: review ───────────────────────── */

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-v2-ring py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-v2-ink-subtle">
        {label}
      </span>
      <span className="min-w-0 truncate text-sm text-v2-ink">{value}</span>
    </div>
  );
}

function ReviewStep({
  form,
  currentSlug,
  previewUrl,
  published,
  canBrand,
  onEditLink,
}: {
  form: RecruitingPageSettingsInput;
  currentSlug: string;
  previewUrl: string | null;
  published: boolean;
  canBrand: boolean;
  onEditLink: () => void;
}) {
  return (
    <div className="max-w-xl space-y-6">
      <StepHeader
        title="Review & publish"
        desc="Here's a quick summary. Open your live page to see exactly what prospects will see."
      />

      {published && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm font-medium text-success">
          <PartyPopper className="h-5 w-5" />
          Your recruiting page is published and live!
        </div>
      )}

      {!currentSlug && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <div className="flex items-start gap-2 text-xs text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>You still need to pick your link before publishing.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onEditLink}
            className="h-8"
          >
            Pick link
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-v2-ring bg-v2-card p-4">
        <SummaryRow
          label="Your link"
          value={currentSlug ? `${currentSlug}.thestandardhq.com` : "Not set"}
        />
        {canBrand && (
          <>
            <SummaryRow
              label="Display name"
              value={form.display_name?.trim() || "—"}
            />
            <SummaryRow label="Headline" value={form.headline?.trim() || "—"} />
            <SummaryRow
              label="Layout"
              value={
                LAYOUTS.find((l) => l.id === form.layout_variant)?.name ||
                "Split panel"
              }
            />
            <SummaryRow
              label="Button text"
              value={form.cta_text?.trim() || "Apply Now"}
            />
          </>
        )}
      </div>

      {previewUrl && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 p-3 hover:bg-success/15"
        >
          <span className="flex min-w-0 items-center gap-2 font-mono text-sm font-medium text-success">
            <Globe className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{currentSlug}.thestandardhq.com</span>
          </span>
          <span className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-success">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </span>
        </a>
      )}

      <p className="flex items-center gap-1.5 text-xs text-v2-ink-subtle">
        <Link2 className="h-3.5 w-3.5" />
        Changes save automatically as you go. Click{" "}
        <strong className="text-v2-ink-muted">Finish &amp; publish</strong> when
        you're happy.
      </p>
    </div>
  );
}
