// src/features/recruiting/components/wizard/DesignStep.tsx
//
// The wizard's "Design" step — TEMPLATE-FIRST. The agent picks one of 8 pre-built
// professional designs, then edits its text, photo, and colors directly. They can
// optionally refine the result with AI by chatting. An "advanced" path still lets
// them start from a blank AI prompt instead of a template.
//
// SINGLE SOURCE OF TRUTH: the working design lives in `composer.spec` (seeded once
// from form.design_spec at mount). EVERY edit — colors, text, add/remove, adopting
// a template, and the AI refine result — flows through one write funnel
// (writeSpec/mutateSpec) that does `composer.setSpec(next)` + `updateField(
// "design_spec", next)` together. Because manual edits live in composer.spec, an
// AI refine reads them (refine preserves manual edits); because the refine result
// is set back via the same funnel, the editor + preview reflect it. The preview
// renders validateDesignSpec(composer.spec).spec — validation is used ONLY for the
// preview/save, never as the typing state (so clearing a required field doesn't
// wipe the input mid-keystroke; it just drops that section from the preview).

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Wand2,
  ImagePlus,
  X,
  Palette,
  Send,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ColorPicker, ImageUpload } from "@/features/settings";
import {
  COLOR_PRESETS,
  DEFAULT_THEME,
  type RecruitingPageSettingsInput,
  type RecruitingPageTheme,
} from "@/types/recruiting-theme.types";
import {
  SPEC_CAPS,
  type RecruitingDesignSpec,
  type DesignBlock,
  type HeroBlock,
  type StatsBlock,
  type ValueGridBlock,
  type AboutBlock,
  type TestimonialBlock,
  type FormBlock,
  type CtaBlock,
} from "@/types/recruiting-design-spec.types";
import { validateDesignSpec } from "@/lib/recruiting-design-spec";
import { RECRUITING_TEMPLATES, type RecruitingTemplate } from "../../templates";
import { useDesignComposer } from "../../hooks/useDesignComposer";
import { DesignPreviewFrame } from "./DesignPreviewFrame";

/* ───────────────────────── reference-image helpers ─────────────────────── */

const MAX_REF_IMAGES = 4;
const MAX_REF_BYTES = 4 * 1024 * 1024; // ~4MB/image
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface RefImage {
  id: string;
  media_type: string;
  data: string;
  dataUrl: string;
}

function fileToRefImage(file: File): Promise<RefImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const comma = dataUrl.indexOf(",");
      resolve({
        id: `${file.name}-${file.size}`,
        media_type: file.type,
        data: dataUrl.slice(comma + 1),
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

/* ───────────────────────── plain-English section names ─────────────────── */
// User-facing labels for each design section. NO jargon ("block"/"spec"/"hero").
const SECTION_LABELS: Record<DesignBlock["type"], string> = {
  hero: "Top of page",
  stats: "Quick highlights",
  value_grid: "Why join us",
  about: "About you",
  testimonial: "Quote",
  form: "Sign-up form",
  cta: "Closing call-out",
  contact: "Contact & socials",
  footer: "Footer",
};

/* ───────────────────────────────── component ───────────────────────────── */

type Mode = "gallery" | "editor";

export function DesignStep({
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
  onUpload: (
    file: File,
    type: "logo_light" | "logo_dark" | "hero" | "headshot",
  ) => void;
  onDeleteImage: (
    field:
      | "logo_light_url"
      | "logo_dark_url"
      | "hero_image_url"
      | "headshot_url",
  ) => void;
  uploadingType: "logo_light" | "logo_dark" | "hero" | "headshot" | null;
}) {
  // composer.spec IS the working design (seeded once from form.design_spec).
  const composer = useDesignComposer(form.design_spec ?? null);

  // Start in the editor if a design already exists; otherwise show the gallery.
  const [mode, setMode] = useState<Mode>(
    form.design_spec ? "editor" : "gallery",
  );

  // Gallery state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    RECRUITING_TEMPLATES[0]?.id ?? null,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState(form.design_prompt ?? "");
  const [refImages, setRefImages] = useState<RefImage[]>([]);

  // Editor state
  const [refineMsg, setRefineMsg] = useState("");

  const agentContext = useMemo(
    () => ({
      primary_color: form.primary_color || DEFAULT_THEME.primary_color,
      accent_color: form.accent_color || DEFAULT_THEME.accent_color,
      display_name: form.display_name || null,
      headline: form.headline || null,
      subheadline: form.subheadline || null,
      calendly_url: form.calendly_url || null,
    }),
    [form],
  );

  // The agent's real identity flows into EVERY preview (gallery + editor) so the
  // chosen template renders with their logo / name / calendar, not placeholders.
  const previewTheme = useMemo<Partial<RecruitingPageTheme>>(
    () => ({
      display_name: form.display_name || DEFAULT_THEME.display_name,
      headline: form.headline || DEFAULT_THEME.headline,
      subheadline: form.subheadline || DEFAULT_THEME.subheadline,
      about_text: form.about_text || null,
      primary_color: form.primary_color || DEFAULT_THEME.primary_color,
      accent_color: form.accent_color || DEFAULT_THEME.accent_color,
      logo_light_url: form.logo_light_url ?? null,
      logo_dark_url: form.logo_dark_url ?? null,
      hero_image_url: form.hero_image_url ?? null,
      headshot_url: form.headshot_url ?? null,
      cta_text: form.cta_text || DEFAULT_THEME.cta_text,
      calendly_url: form.calendly_url || null,
      support_phone: form.support_phone || null,
      social_links: form.social_links || {},
      disclaimer_text: form.disclaimer_text || null,
    }),
    [form],
  );

  // ── WRITE FUNNEL — the only way the working design changes ──────────────
  // Push a complete next spec to BOTH the composer (so AI refine + preview see
  // it) and the form (so the wizard persists it on save).
  const writeSpec = (next: RecruitingDesignSpec) => {
    composer.setSpec(next);
    updateField("design_spec", next);
  };

  // Deep-clone + mutate the current working spec, then write it. No-op if there's
  // no design yet (gallery hasn't adopted anything).
  const mutateSpec = (mutate: (draft: RecruitingDesignSpec) => void) => {
    if (!composer.spec) return;
    const next = structuredClone(composer.spec);
    mutate(next);
    writeSpec(next);
  };

  // Colors are a deterministic edit (no AI). Keep the form color fields and the
  // spec palette in lockstep so the ColorPickers and the rendered page agree.
  const applyColor = (which: "primary" | "accent", c: string) => {
    updateField(which === "primary" ? "primary_color" : "accent_color", c);
    mutateSpec((draft) => {
      draft.theme.palette[which] = c;
    });
  };

  // Adopt a template = deep copy its spec, sync the form colors to its palette,
  // then jump into the editor. NEVER mutate the imported template object.
  const adoptTemplate = (template: RecruitingTemplate) => {
    const next = structuredClone(template.spec);
    writeSpec(next);
    updateField("primary_color", next.theme.palette.primary);
    updateField("accent_color", next.theme.palette.accent);
    setMode("editor");
    toast.success(`"${template.name}" is ready — make it yours below.`);
  };

  // The editor preview is DEBOUNCED: the iframe re-renders the whole page on each
  // spec change, so posting on every keystroke flickers. We update the preview
  // ~300ms after the agent stops typing (changes still feel live, no flicker).
  const [debouncedSpec, setDebouncedSpec] =
    useState<RecruitingDesignSpec | null>(composer.spec);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSpec(composer.spec), 300);
    return () => window.clearTimeout(id);
  }, [composer.spec]);

  // The validated, render-safe spec for the live preview ONLY. Memoized so we
  // don't hand the iframe a new object identity (and re-post) every render.
  const previewSpec = useMemo<RecruitingDesignSpec | null>(
    () => (debouncedSpec ? validateDesignSpec(debouncedSpec).spec : null),
    [debouncedSpec],
  );

  /* ── reference images (advanced AI path) ── */
  const handleAddImages = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_REF_IMAGES - refImages.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_REF_IMAGES} reference images.`);
      return;
    }
    for (const file of Array.from(files).slice(0, room)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Unsupported image type: ${file.type}`);
        continue;
      }
      if (file.size > MAX_REF_BYTES) {
        toast.error(`${file.name} is too large (max 4MB).`);
        continue;
      }
      try {
        const ref = await fileToRefImage(file);
        setRefImages((prev) =>
          prev.some((r) => r.id === ref.id) ? prev : [...prev, ref],
        );
      } catch {
        toast.error("Couldn't read that image.");
      }
    }
  };

  // Advanced path: build from a blank prompt (no template). On success, jump to
  // the editor so the agent customizes from there.
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the page you want first.");
      return;
    }
    const { spec, error } = await composer.run(prompt, {
      images: refImages.map((r) => ({
        media_type: r.media_type,
        data: r.data,
      })),
      agentContext,
      refine: false,
    });
    if (spec) {
      updateField("design_spec", spec);
      updateField("design_prompt", prompt.trim());
      setMode("editor");
      toast.success("Your page is ready — make it yours below.");
    } else if (error) {
      toast.error(error);
    }
  };

  // Refine the CURRENT working design with AI. Reads composer.spec (which already
  // holds the manual edits) and writes the result back through the funnel.
  const handleRefine = async () => {
    if (!refineMsg.trim()) return;
    const { spec, error } = await composer.run(refineMsg, {
      agentContext,
      refine: true,
    });
    if (spec) {
      updateField("design_spec", spec);
      setRefineMsg("");
      toast.success("Design updated — check the preview.");
    } else if (error) {
      toast.error(error);
    }
  };

  const switchTemplate = () => {
    const ok = window.confirm(
      "Choosing a different design replaces your current one, including any text changes. Continue?",
    );
    if (ok) setMode("gallery");
  };

  /* ─────────────────────────────── render ──────────────────────────────── */

  if (mode === "gallery") {
    const selected =
      RECRUITING_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null;
    return (
      <div className="max-w-5xl space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-v2-ink">
            Pick a starting design
          </h2>
          <p className="mt-1 text-sm text-v2-ink-muted">
            Choose a design you like. You can change any text, your photo, and
            your colors after — and tweak it with AI if you want.
          </p>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RECRUITING_TEMPLATES.map((t) => {
            const active = t.id === selectedTemplateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplateId(t.id)}
                aria-pressed={active}
                className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? "border-info bg-info/5 ring-1 ring-info"
                    : "border-v2-ring hover:border-info/50 hover:bg-v2-card-tinted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-v2-ink">
                    {t.name}
                  </span>
                  {active && (
                    <Check className="h-4 w-4 flex-shrink-0 text-info" />
                  )}
                </div>
                <p className="text-xs leading-snug text-v2-ink-muted">
                  {t.blurb}
                </p>
                <div className="mt-auto flex items-center gap-1.5 pt-1">
                  <span
                    className="h-4 w-4 rounded-full border border-v2-ring"
                    style={{ backgroundColor: t.spec.theme.palette.primary }}
                    title="Primary color"
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-v2-ring"
                    style={{ backgroundColor: t.spec.theme.palette.accent }}
                    title="Accent color"
                  />
                  <span className="ml-1 text-[11px] text-v2-ink-subtle">
                    Color theme
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Single large live preview of the selected template */}
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-v2-ink">
                Preview: {selected.name}
              </h3>
              <Button
                type="button"
                onClick={() => adoptTemplate(selected)}
                className="h-10"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Use this design
              </Button>
            </div>
            <DesignPreviewFrame spec={selected.spec} theme={previewTheme} />
          </div>
        )}

        {/* Advanced: blank AI prompt path */}
        <div className="rounded-lg border border-v2-ring">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-v2-ink-muted" />
              <span className="text-sm font-medium text-v2-ink">
                Or describe your own page and let AI build it
              </span>
            </span>
            {showAdvanced ? (
              <ChevronDown className="h-4 w-4 text-v2-ink-subtle" />
            ) : (
              <ChevronRight className="h-4 w-4 text-v2-ink-subtle" />
            )}
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-t border-v2-ring p-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A bold, modern page for career-changers moving into insurance. Lead with growth and training, keep it confident but trustworthy."
                className="min-h-[100px] text-sm"
                maxLength={4000}
              />

              {/* Reference images */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {refImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative h-16 w-16 overflow-hidden rounded border border-v2-ring"
                    >
                      <img
                        src={img.dataUrl}
                        alt="reference"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRefImages((prev) =>
                            prev.filter((r) => r.id !== img.id),
                          )
                        }
                        aria-label="Remove reference image"
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {refImages.length < MAX_REF_IMAGES && (
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-v2-ring text-v2-ink-subtle hover:border-info/50 hover:text-info">
                      <ImagePlus className="h-4 w-4" />
                      <span className="text-xs">Add</span>
                      <input
                        type="file"
                        accept={ALLOWED_TYPES.join(",")}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void handleAddImages(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                <p className="text-sm text-v2-ink-subtle">
                  Optionally attach up to {MAX_REF_IMAGES} photos for style
                  inspiration. AI uses them as a reference — it won&apos;t copy
                  logos or text.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={composer.isGenerating || !prompt.trim()}
                className="h-10"
              >
                {composer.isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Building your page…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Build my page
                  </>
                )}
              </Button>
              {composer.error && (
                <p className="text-xs text-destructive">{composer.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── EDITOR ── */
  const spec = composer.spec;
  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-v2-ink">Make it yours</h2>
          <p className="mt-1 text-sm text-v2-ink-muted">
            Change any text, swap your photo and colors, then tweak it with AI
            if you&apos;d like. Your changes save as you go.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={switchTemplate}
          className="h-9"
        >
          <Pencil className="mr-1.5 h-4 w-4" />
          Choose a different design
        </Button>
      </div>

      {/* Live preview of the current working design */}
      <DesignPreviewFrame spec={previewSpec} theme={previewTheme} />

      {/* Brand basics */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Colors & photos</h3>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ColorPicker
            label="Primary color"
            value={form.primary_color || DEFAULT_THEME.primary_color}
            onChange={(c) => applyColor("primary", c)}
            presets={COLOR_PRESETS.primary}
          />
          <ColorPicker
            label="Accent color"
            value={form.accent_color || DEFAULT_THEME.accent_color}
            onChange={(c) => applyColor("accent", c)}
            presets={COLOR_PRESETS.accent}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ImageUpload
            label="Your headshot / photo"
            description="Many designs feature your photo. A clear, friendly headshot works best."
            value={form.headshot_url ?? null}
            onUpload={(file) => onUpload(file, "headshot")}
            onDelete={() => onDeleteImage("headshot_url")}
            isUploading={uploadingType === "headshot"}
            accept="image/png,image/jpeg,image/webp"
          />
          <ImageUpload
            label="Logo (for dark backgrounds)"
            description="Shown on dark hero areas. PNG or SVG works best."
            value={form.logo_light_url ?? null}
            onUpload={(file) => onUpload(file, "logo_light")}
            onDelete={() => onDeleteImage("logo_light_url")}
            isUploading={uploadingType === "logo_light"}
            accept="image/png,image/svg+xml,image/webp"
          />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ImageUpload
            label="Logo (for light backgrounds)"
            description="Shown on the form panel. PNG or SVG works best."
            value={form.logo_dark_url ?? null}
            onUpload={(file) => onUpload(file, "logo_dark")}
            onDelete={() => onDeleteImage("logo_dark_url")}
            isUploading={uploadingType === "logo_dark"}
            accept="image/png,image/svg+xml,image/webp"
          />
        </div>
      </section>

      {/* Your content — structured per-section text editor */}
      {spec && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-v2-ink">Your text</h3>
          <p className="text-sm text-v2-ink-muted">
            Edit every piece of wording on your page. Empty required fields are
            hidden in the preview until you fill them in.
          </p>
          <div className="space-y-4">
            {spec.blocks.map((block, idx) => (
              <SectionEditor
                key={block.id}
                block={block}
                index={idx}
                mutateSpec={mutateSpec}
              />
            ))}
          </div>
        </section>
      )}

      {/* Refine with AI */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Tweak with AI</h3>
        </div>
        <p className="text-sm text-v2-ink-muted">
          Describe a change in plain English and AI updates your page — it keeps
          the edits you&apos;ve already made.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={refineMsg}
              onChange={(e) => setRefineMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !composer.isGenerating) {
                  e.preventDefault();
                  void handleRefine();
                }
              }}
              placeholder="e.g. Make the top section darker and add a short quote from a teammate"
              disabled={composer.isGenerating}
              className="h-10 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRefine}
            disabled={composer.isGenerating || !refineMsg.trim()}
            className="h-10"
          >
            {composer.isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {composer.error && (
          <p className="text-xs text-destructive">{composer.error}</p>
        )}
        {composer.notes.length > 0 && (
          <p className="text-sm text-v2-ink-subtle">
            Adjusted automatically: {composer.notes.join(" ")}
          </p>
        )}
      </section>
    </div>
  );
}

/* ──────────────────────── per-section text editors ──────────────────────── */
// Each editor binds directly to composer.spec (via mutateSpec) so typing is
// tolerant — required-but-empty values stay in the input and only disappear from
// the (validated) preview. React keys: outer = block.id (stable, never re-keyed);
// inner list rows = array index (stable across keystrokes — typing never reorders).

type MutateFn = (mutate: (draft: RecruitingDesignSpec) => void) => void;

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card-tinted p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-v2-ink-subtle">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-v2-ink-subtle">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="h-10 text-sm"
      />
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-v2-ink-subtle">
        {label}
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-[80px] text-sm"
      />
    </div>
  );
}

function SectionEditor({
  block,
  index,
  mutateSpec,
}: {
  block: DesignBlock;
  index: number;
  mutateSpec: MutateFn;
}) {
  const cap = SPEC_CAPS.text;
  const title = SECTION_LABELS[block.type];

  // Helper to patch a field on the block at this index, narrowed by type.
  const patch = <T extends DesignBlock>(fn: (b: T) => void) =>
    mutateSpec((draft) => {
      const target = draft.blocks[index];
      if (target && target.type === block.type) fn(target as T);
    });

  switch (block.type) {
    case "hero": {
      const b = block as HeroBlock;
      return (
        <SectionShell title={title}>
          <TextField
            label="Small line above the headline"
            value={b.eyebrow ?? ""}
            onChange={(v) => patch<HeroBlock>((x) => (x.eyebrow = v))}
            maxLength={cap.eyebrow}
            placeholder="Now hiring"
          />
          <TextField
            label="Headline"
            value={b.headline}
            onChange={(v) => patch<HeroBlock>((x) => (x.headline = v))}
            maxLength={cap.headline}
            placeholder="Build a career that moves with you"
          />
          <AreaField
            label="Sub-headline"
            value={b.subhead ?? ""}
            onChange={(v) => patch<HeroBlock>((x) => (x.subhead = v))}
            maxLength={cap.subhead}
            placeholder="A short, welcoming line about the opportunity."
          />
          <TextField
            label="Button text"
            value={b.primary_cta ?? ""}
            onChange={(v) => patch<HeroBlock>((x) => (x.primary_cta = v))}
            maxLength={cap.ctaText}
            placeholder="Apply now"
          />
        </SectionShell>
      );
    }
    case "stats": {
      const b = block as StatsBlock;
      const canAdd = b.items.length < SPEC_CAPS.maxStatsItems;
      return (
        <SectionShell title={title}>
          {b.items.map((item, i) => (
            <div
              key={i}
              className="space-y-2 rounded border border-v2-ring/60 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-v2-ink-subtle">
                  Highlight {i + 1}
                </span>
                {b.items.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove highlight"
                    onClick={() =>
                      patch<StatsBlock>((x) => x.items.splice(i, 1))
                    }
                    className="text-v2-ink-subtle hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <TextField
                label="Number / short value"
                value={item.value}
                onChange={(v) =>
                  patch<StatsBlock>((x) => (x.items[i].value = v))
                }
                maxLength={cap.statValue}
                placeholder="Day 1"
              />
              <TextField
                label="Label"
                value={item.label}
                onChange={(v) =>
                  patch<StatsBlock>((x) => (x.items[i].label = v))
                }
                maxLength={cap.statLabel}
                placeholder="Training begins"
              />
            </div>
          ))}
          {canAdd && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                patch<StatsBlock>((x) => x.items.push({ value: "", label: "" }))
              }
              className="h-8"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add highlight
            </Button>
          )}
        </SectionShell>
      );
    }
    case "value_grid": {
      const b = block as ValueGridBlock;
      const canAdd = b.items.length < SPEC_CAPS.maxValueGridItems;
      return (
        <SectionShell title={title}>
          <TextField
            label="Section heading"
            value={b.heading ?? ""}
            onChange={(v) => patch<ValueGridBlock>((x) => (x.heading = v))}
            maxLength={cap.heading}
            placeholder="Why people join us"
          />
          {b.items.map((item, i) => (
            <div
              key={i}
              className="space-y-2 rounded border border-v2-ring/60 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-v2-ink-subtle">
                  Reason {i + 1}
                </span>
                {b.items.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove reason"
                    onClick={() =>
                      patch<ValueGridBlock>((x) => x.items.splice(i, 1))
                    }
                    className="text-v2-ink-subtle hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <TextField
                label="Title"
                value={item.title}
                onChange={(v) =>
                  patch<ValueGridBlock>((x) => (x.items[i].title = v))
                }
                maxLength={cap.itemTitle}
                placeholder="Real training"
              />
              <AreaField
                label="Description"
                value={item.body ?? ""}
                onChange={(v) =>
                  patch<ValueGridBlock>((x) => (x.items[i].body = v))
                }
                maxLength={cap.itemBody}
                placeholder="A short sentence about this benefit."
              />
            </div>
          ))}
          {canAdd && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                patch<ValueGridBlock>((x) => x.items.push({ title: "" }))
              }
              className="h-8"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add reason
            </Button>
          )}
        </SectionShell>
      );
    }
    case "about": {
      const b = block as AboutBlock;
      return (
        <SectionShell title={title}>
          <TextField
            label="Heading"
            value={b.heading ?? ""}
            onChange={(v) => patch<AboutBlock>((x) => (x.heading = v))}
            maxLength={cap.heading}
            placeholder="About"
          />
          <AreaField
            label="Your story"
            value={b.body}
            onChange={(v) => patch<AboutBlock>((x) => (x.body = v))}
            maxLength={cap.body}
            placeholder="Tell prospects about you, your team, and the opportunity."
          />
        </SectionShell>
      );
    }
    case "testimonial": {
      const b = block as TestimonialBlock;
      return (
        <SectionShell title={title}>
          <AreaField
            label="Quote"
            value={b.quote}
            onChange={(v) => patch<TestimonialBlock>((x) => (x.quote = v))}
            maxLength={cap.quote}
            placeholder="“Joining this team changed my career.”"
          />
          <TextField
            label="Who said it"
            value={b.attribution ?? ""}
            onChange={(v) =>
              patch<TestimonialBlock>((x) => (x.attribution = v))
            }
            maxLength={cap.attribution}
            placeholder="Jordan, agent since 2023"
          />
        </SectionShell>
      );
    }
    case "form": {
      const b = block as FormBlock;
      return (
        <SectionShell title={title}>
          <TextField
            label="Small line above the heading"
            value={b.eyebrow ?? ""}
            onChange={(v) => patch<FormBlock>((x) => (x.eyebrow = v))}
            maxLength={cap.eyebrow}
            placeholder="Express interest"
          />
          <TextField
            label="Heading"
            value={b.heading ?? ""}
            onChange={(v) => patch<FormBlock>((x) => (x.heading = v))}
            maxLength={cap.heading}
            placeholder="Let's see if this is a fit"
          />
          <AreaField
            label="Short description"
            value={b.subcopy ?? ""}
            onChange={(v) => patch<FormBlock>((x) => (x.subcopy = v))}
            maxLength={cap.subhead}
            placeholder="Tell us a little about yourself and we'll reach out."
          />
          <TextField
            label="Button text"
            value={b.cta_text ?? ""}
            onChange={(v) => patch<FormBlock>((x) => (x.cta_text = v))}
            maxLength={cap.ctaText}
            placeholder="Submit"
          />
        </SectionShell>
      );
    }
    case "cta": {
      const b = block as CtaBlock;
      return (
        <SectionShell title={title}>
          <TextField
            label="Headline"
            value={b.headline}
            onChange={(v) => patch<CtaBlock>((x) => (x.headline = v))}
            maxLength={cap.headline}
            placeholder="Ready to take the next step?"
          />
          <TextField
            label="Button text"
            value={b.button_text ?? ""}
            onChange={(v) => patch<CtaBlock>((x) => (x.button_text = v))}
            maxLength={cap.ctaText}
            placeholder="Apply now"
          />
        </SectionShell>
      );
    }
    // contact / footer carry no editable text — nothing to show here.
    default:
      return null;
  }
}
