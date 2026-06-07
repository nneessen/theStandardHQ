// src/features/recruiting/components/wizard/AiDesignStep.tsx
//
// The wizard's "Design" step. The agent picks brand colors + uploads a logo,
// then DESCRIBES the page they want (optionally attaching reference screenshots)
// and the AI composes it. They refine by chat, watching a live preview. Each
// successful generation writes design_spec + design_prompt into the form, which
// the wizard persists on step advance.

import { useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Wand2,
  ImagePlus,
  X,
  Palette,
  Send,
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
import { useDesignComposer } from "../../hooks/useDesignComposer";
import { DesignPreviewFrame } from "./DesignPreviewFrame";

// Local shape — matches DesignReferenceImage from the service (components access
// the service only through the useDesignComposer hook, not directly).

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

export function AiDesignStep({
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
  const composer = useDesignComposer(form.design_spec ?? null);
  const [prompt, setPrompt] = useState(form.design_prompt ?? "");
  const [refineMsg, setRefineMsg] = useState("");
  const [refImages, setRefImages] = useState<RefImage[]>([]);

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
      cta_text: form.cta_text || DEFAULT_THEME.cta_text,
      calendly_url: form.calendly_url || null,
      support_phone: form.support_phone || null,
      social_links: form.social_links || {},
      disclaimer_text: form.disclaimer_text || null,
    }),
    [form],
  );

  const handleAddImages = async (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const room = MAX_REF_IMAGES - refImages.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_REF_IMAGES} reference images.`);
      return;
    }
    const toAdd = incoming.slice(0, room);
    for (const file of toAdd) {
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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the page you want first.");
      return;
    }
    const spec = await composer.run(prompt, {
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
      toast.success("Your page is ready — refine it below or continue.");
    }
  };

  // Colors are a deterministic edit — no AI call needed. If a design already
  // exists, patch its palette live (the renderer reads spec.theme.palette, not
  // form.primary_color), so the preview + saved page update immediately.
  const applyColor = (which: "primary" | "accent", c: string) => {
    updateField(which === "primary" ? "primary_color" : "accent_color", c);
    if (composer.spec) {
      const next = {
        ...composer.spec,
        theme: {
          ...composer.spec.theme,
          palette: { ...composer.spec.theme.palette, [which]: c },
        },
      };
      composer.setSpec(next);
      updateField("design_spec", next);
    }
  };

  const handleRefine = async () => {
    if (!refineMsg.trim()) return;
    const spec = await composer.run(refineMsg, { agentContext, refine: true });
    if (spec) {
      updateField("design_spec", spec);
      setRefineMsg("");
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-v2-ink">Design your page</h2>
        <p className="mt-1 text-sm text-v2-ink-muted">
          Pick your colors and logo, then describe the recruiting page you want.
          Our AI builds it for you — refine it by chatting until it&apos;s
          right.
        </p>
      </div>

      {/* Brand basics */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">Brand basics</h3>
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
            label="Logo (for dark backgrounds)"
            description="Shown on dark hero areas. PNG or SVG works best."
            value={form.logo_light_url ?? null}
            onUpload={(file) => onUpload(file, "logo_light")}
            onDelete={() => onDeleteImage("logo_light_url")}
            isUploading={uploadingType === "logo_light"}
            accept="image/png,image/svg+xml,image/webp"
          />
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

      {/* AI composer */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-semibold text-v2-ink">
            Describe your page
          </h3>
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A bold, modern page for career-changers moving into insurance. Lead with income potential, show that we provide training and leads, keep it confident but trustworthy."
          className="min-h-[110px] text-sm"
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
                    setRefImages((prev) => prev.filter((r) => r.id !== img.id))
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
                <span className="text-[10px]">Add</span>
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
          <p className="text-[11px] text-v2-ink-subtle">
            Optionally attach up to {MAX_REF_IMAGES} screenshots/photos for
            style inspiration (palette, mood, layout). The AI uses them as a
            reference — it won&apos;t copy logos or text.
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
              {composer.hasDesign ? "Regenerate" : "Build my page"}
            </>
          )}
        </Button>

        {composer.error && (
          <p className="text-xs text-destructive">{composer.error}</p>
        )}
        {composer.notes.length > 0 && (
          <p className="text-[11px] text-v2-ink-subtle">
            Adjusted automatically: {composer.notes.join(" ")}
          </p>
        )}
      </section>

      {/* Live preview + refine */}
      {composer.hasDesign && (
        <section className="space-y-3">
          <DesignPreviewFrame spec={composer.spec} theme={previewTheme} />

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-v2-ink">
                Refine by chat
              </label>
              <Input
                value={refineMsg}
                onChange={(e) => setRefineMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !composer.isGenerating) {
                    e.preventDefault();
                    void handleRefine();
                  }
                }}
                placeholder="e.g. Make the hero darker and add a testimonials section"
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
        </section>
      )}
    </div>
  );
}
