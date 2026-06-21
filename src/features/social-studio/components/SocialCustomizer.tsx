// src/features/social-studio/components/SocialCustomizer.tsx
// Editor that drives the live preview. Phase 1: pure client state (no persistence
// yet). Caption tokens resolve server-side in Phase 2; here they're literal text
// the owner can copy when posting manually.

import type { ReactNode } from "react";
import { Sparkles, Loader2, ImagePlus, X } from "lucide-react";
import { Cap } from "@/components/board";
import { PillNav } from "@/components/v2";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SocialStudioConfig } from "../types";

const CAPTION_TOKENS = [
  "{agencyName}",
  "{network}",
  "{date}",
  "{week}",
  "{month}",
  "{topAgent}",
  "{totalAP}",
];

// ── Agent-of-the-Week style controls (Step 3) ──────────────────────────────
// Sentinel for the "use the design's signature font" option (Radix Select items
// can't carry a null value).
const FONT_DEFAULT = "__default__";
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Unbounded", value: '"Unbounded", system-ui, sans-serif' },
  { label: "Clash Display", value: '"Clash Display", system-ui, sans-serif' },
  { label: "Syne", value: '"Syne", system-ui, sans-serif' },
  { label: "Space Grotesk", value: '"Space Grotesk", system-ui, sans-serif' },
  {
    label: "Bricolage Grotesque",
    value: '"Bricolage Grotesque", system-ui, sans-serif',
  },
  { label: "Instrument Serif", value: '"Instrument Serif", Georgia, serif' },
  { label: "Satoshi", value: '"Satoshi", system-ui, sans-serif' },
  { label: "General Sans", value: '"General Sans", system-ui, sans-serif' },
];

// Background presets are filtered by the active design's text-color regime so a
// preset can never make the text illegible: dark/saturated for the light-text
// designs (aurora, noir); light "paper" tones for editorial (dark text on cream).
const BG_PRESETS_DARK: { label: string; value: string }[] = [
  { label: "Indigo", value: "linear-gradient(150deg,#1e1b4b,#4c1d95,#831843)" },
  { label: "Sunset", value: "linear-gradient(150deg,#7c2d12,#9f1239,#4c1d95)" },
  {
    label: "Emerald",
    value: "linear-gradient(150deg,#064e3b,#065f46,#0f172a)",
  },
  { label: "Ocean", value: "linear-gradient(150deg,#0c4a6e,#155e75,#1e3a8a)" },
  { label: "Charcoal", value: "#111317" },
];
const BG_PRESETS_LIGHT: { label: string; value: string }[] = [
  { label: "Off-white", value: "#faf7f0" },
  { label: "Blush", value: "#f7ece6" },
  { label: "Mint", value: "#eef3ec" },
  { label: "Slate", value: "#eceef2" },
];

interface SocialCustomizerProps {
  config: SocialStudioConfig;
  onChange: (patch: Partial<SocialStudioConfig>) => void;
  onCopyCaption: () => void;
  onGenerateCaption: () => void;
  generatingCaption: boolean;
  canUseAi: boolean;
  samplePreview: boolean;
  /** True when there is no live data, so sample can't be toggled off. */
  sampleForced: boolean;
  onSamplePreviewChange: (v: boolean) => void;
  onUploadPhoto: (file: File) => void;
  onRemovePhoto: () => void;
  uploadingPhoto: boolean;
  onUploadBgImage: (file: File) => void;
  uploadingBg: boolean;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Cap style={{ fontSize: 11 }}>{label}</Cap>
      {children}
    </div>
  );
}

export function SocialCustomizer({
  config,
  onChange,
  onCopyCaption,
  onGenerateCaption,
  generatingCaption,
  canUseAi,
  samplePreview,
  sampleForced,
  onSamplePreviewChange,
  onUploadPhoto,
  onRemovePhoto,
  uploadingPhoto,
  onUploadBgImage,
  uploadingBg,
}: SocialCustomizerProps) {
  const isReport = config.view === "monthly";
  const isAotw = config.view === "aotw";
  // Editorial is dark-text-on-cream, so only the light-text designs may carry a
  // photo background; their swatch sets differ for the same reason.
  const allowsBgImage = config.aowDesign !== "editorial";
  const bgPresets =
    config.aowDesign === "editorial" ? BG_PRESETS_LIGHT : BG_PRESETS_DARK;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2">
        <div>
          <Label htmlFor="samplePreview" className="text-xs">
            Preview with sample data
          </Label>
          <p className="text-[10px] text-muted-foreground">
            {sampleForced
              ? "No live data yet — sample shows until your agency has producers"
              : "Fills the layout while production is thin"}
          </p>
        </div>
        <Switch
          id="samplePreview"
          checked={samplePreview}
          disabled={sampleForced}
          onCheckedChange={onSamplePreviewChange}
        />
      </div>
      <Field label="Format">
        <PillNav
          size="sm"
          activeValue={config.format}
          onChange={(v) =>
            onChange({ format: v as SocialStudioConfig["format"] })
          }
          items={[
            { label: "Portrait 4:5", value: "portrait" },
            { label: "Square 1:1", value: "square" },
            { label: "Story / Reel 9:16", value: "story" },
          ]}
        />
      </Field>
      {/* The AOTW hero has self-contained palettes per design and ignores the app
          theme, so the Dark/Light toggle is dead there — hide it. */}
      {!isAotw && (
        <Field label="Theme">
          <PillNav
            size="sm"
            activeValue={config.theme}
            onChange={(v) =>
              onChange({ theme: v as SocialStudioConfig["theme"] })
            }
            items={[
              { label: "Dark", value: "dark" },
              { label: "Light", value: "light" },
            ]}
          />
        </Field>
      )}

      {isAotw && (
        <Field label="Design">
          <PillNav
            size="sm"
            activeValue={config.aowDesign}
            onChange={(v) =>
              // Reset the background when switching design: a background is tied to
              // the design's text-color regime (a dark preset picked on noir would be
              // illegible under editorial's dark text). Font + sizes are regime-
              // agnostic, so they persist.
              onChange({
                aowDesign: v as SocialStudioConfig["aowDesign"],
                aowBackground: null,
                aowBgImageUrl: null,
              })
            }
            items={[
              { label: "Aurora", value: "aurora" },
              { label: "Editorial", value: "editorial" },
              { label: "Noir", value: "noir" },
            ]}
          />
        </Field>
      )}

      {isAotw && (
        <Field label="Agent photo">
          {config.aowPhotoUrl ? (
            <div className="flex items-center gap-2">
              <img
                src={config.aowPhotoUrl}
                alt="Agent"
                className="h-12 w-12 rounded-md border border-border object-cover"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRemovePhoto}
              >
                Remove
              </Button>
              <span className="text-[10px] text-muted-foreground">
                Renders in the spotlight.
              </span>
            </div>
          ) : (
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground ${
                uploadingPhoto ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {uploadingPhoto ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="h-3.5 w-3.5" /> Upload photo
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadPhoto(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </Field>
      )}

      {/* ── Style controls (AOTW) — font, background, sizes ──────────────── */}
      {isAotw && (
        <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
          <Cap style={{ fontSize: 11 }}>Style</Cap>

          <Field label="Font">
            <Select
              value={config.aowFontDisplay ?? FONT_DEFAULT}
              onValueChange={(v) =>
                onChange({ aowFontDisplay: v === FONT_DEFAULT ? null : v })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FONT_DEFAULT}>Design default</SelectItem>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem
                    key={f.label}
                    value={f.value}
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Background">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Design default */}
              <button
                type="button"
                title="Design default"
                onClick={() =>
                  onChange({ aowBackground: null, aowBgImageUrl: null })
                }
                className={`flex h-7 w-7 items-center justify-center rounded-md border text-[9px] font-semibold text-muted-foreground ${
                  !config.aowBackground && !config.aowBgImageUrl
                    ? "border-accent ring-2 ring-accent"
                    : "border-border"
                }`}
                style={{
                  background:
                    "repeating-conic-gradient(#d4d4d8 0% 25%, #fafafa 0% 50%) 50% / 10px 10px",
                }}
              >
                ✕
              </button>
              {/* Presets (filtered by design text-color regime) */}
              {bgPresets.map((p) => {
                const active =
                  config.aowBackground === p.value && !config.aowBgImageUrl;
                return (
                  <button
                    key={p.label}
                    type="button"
                    title={p.label}
                    onClick={() =>
                      onChange({ aowBackground: p.value, aowBgImageUrl: null })
                    }
                    className={`h-7 w-7 rounded-md border ${
                      active
                        ? "border-accent ring-2 ring-accent"
                        : "border-border"
                    }`}
                    style={{ background: p.value }}
                  />
                );
              })}
              {/* Image upload (light-text designs only) */}
              {allowsBgImage &&
                (config.aowBgImageUrl ? (
                  <div className="relative">
                    <div
                      className="h-7 w-7 rounded-md border border-accent ring-2 ring-accent"
                      style={{
                        background: `url("${config.aowBgImageUrl}") center / cover`,
                      }}
                    />
                    <button
                      type="button"
                      title="Remove background image"
                      onClick={() =>
                        onChange({ aowBgImageUrl: null, aowBackground: null })
                      }
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <label
                    title="Upload a background image"
                    className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-accent hover:text-foreground ${
                      uploadingBg ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {uploadingBg ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingBg}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadBgImage(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ))}
            </div>
            {allowsBgImage && (
              <p className="pt-1 text-[10px] text-muted-foreground">
                Image backgrounds get a dark overlay so the text stays readable.
              </p>
            )}
          </Field>

          <Field label={`Name size · ${config.aowTitleScale.toFixed(2)}×`}>
            <Slider
              value={[config.aowTitleScale]}
              min={0.7}
              max={1.4}
              step={0.05}
              onValueChange={(v) => onChange({ aowTitleScale: v[0] })}
            />
          </Field>

          {/* Capped at 2× — "a lot larger" without colliding with the editorial
              portrait / the noir network label at extreme scales (review finding). */}
          <Field
            label={`Agency name size · ${config.aowAgencyScale.toFixed(1)}×`}
          >
            <Slider
              value={[config.aowAgencyScale]}
              min={1}
              max={2}
              step={0.1}
              onValueChange={(v) => onChange({ aowAgencyScale: v[0] })}
            />
          </Field>
        </div>
      )}

      {!isReport && !isAotw && (
        <>
          <Field label="Show top">
            <PillNav
              size="sm"
              activeValue={String(config.topN)}
              onChange={(v) => onChange({ topN: Number(v) })}
              items={[
                { label: "Top 5", value: "5" },
                { label: "Top 10", value: "10" },
                { label: "Top 20", value: "20" },
              ]}
            />
          </Field>

          <Field label="Headline">
            <Input
              value={config.title ?? ""}
              placeholder={`TOP ${config.topN} AGENTS`}
              onChange={(e) => onChange({ title: e.target.value || undefined })}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label htmlFor="showPolicies" className="text-xs">
              Show policy count
            </Label>
            <Switch
              id="showPolicies"
              checked={config.showPolicies}
              onCheckedChange={(c) => onChange({ showPolicies: c })}
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Cap style={{ fontSize: 11 }}>Instagram caption</Cap>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onGenerateCaption}
            disabled={generatingCaption || !canUseAi || samplePreview}
            title={
              !canUseAi
                ? "AI features aren't enabled for this account"
                : samplePreview
                  ? "Switch off sample preview to caption your real numbers"
                  : "Draft a caption from this card's data"
            }
          >
            {generatingCaption ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Generate with AI
              </>
            )}
          </Button>
        </div>
        <Textarea
          value={config.caption}
          rows={4}
          maxLength={2200}
          placeholder="Write your caption, generate one with AI, or use the tokens below."
          onChange={(e) => onChange({ caption: e.target.value })}
        />
        <div className="flex flex-wrap gap-1 pt-1">
          {CAPTION_TOKENS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                onChange({
                  caption: `${config.caption}${config.caption ? " " : ""}${t}`,
                })
              }
              className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            {config.caption.length}/2200
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCopyCaption}
            disabled={!config.caption}
          >
            Copy caption
          </Button>
        </div>
      </div>
    </div>
  );
}
