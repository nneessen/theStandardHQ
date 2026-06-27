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
import {
  CARD_THEMES,
  CARD_THEME_LABEL,
  RECRUITING_COPY,
  WELCOME_COPY,
  LEADERBOARD_COPY,
  MONTHLY_COPY,
  AOTW_COPY,
} from "@/features/social-cards";
import type {
  RecruitingVariant,
  WelcomeVariant,
  CopyField,
} from "@/features/social-cards";
import type { SocialStudioConfig } from "../types";

// The welcome designs for the New Agents view (own celebratory palette).
const WELCOME_VARIANTS: { v: WelcomeVariant; label: string }[] = [
  { v: "celebration", label: "Celebration" },
  { v: "badge", label: "New-Agent Badge" },
  { v: "marquee", label: "Big Welcome" },
];

// The recruiting template set (each a distinct design + its own palette). Order = the
// picker order; labels are plain-English (no jargon).
const RECRUITING_VARIANTS: { v: RecruitingVariant; label: string }[] = [
  { v: "manifesto", label: "No-Grind Manifesto" },
  { v: "hours", label: "Bankers' Hours" },
  { v: "seal", label: "Inbound-Only Seal" },
  { v: "lifeback", label: "Get Your Life Back" },
  { v: "compare", label: "Them vs Us" },
];

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
// Spotlight (key "aurora"); light "paper" tones for the dark-text Editorial + Lift.
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
  /** The "New Agents" picker (+ photo manager in C-B), rendered only for the newagent
   *  view. Supplied by the page so this editor stays agnostic of the agent data shape. */
  newAgentPicker?: ReactNode;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Cap style={{ fontSize: 11 }}>{label}</Cap>
      {children}
    </div>
  );
}

/** Editable-copy panel: one input per text slot of the active template variant. Blank =
 *  the design's built-in default (shown as the placeholder). Overrides are stored on
 *  config.templateCopy under `${variant}.${field}`. */
function CopyEditor({
  fields,
  variant,
  templateCopy,
  onChange,
}: {
  fields: CopyField[];
  variant: string;
  templateCopy: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const set = (key: string, value: string) => {
    const k = `${variant}.${key}`;
    const next = { ...templateCopy };
    if (value.trim() === "") delete next[k];
    else next[k] = value;
    onChange(next);
  };
  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-card/40 p-3">
      <Cap style={{ fontSize: 11 }}>Wording — edit any line</Cap>
      {fields.map((f) => {
        const val = templateCopy[`${variant}.${f.key}`] ?? "";
        return (
          <div key={f.key} className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground">
              {f.label}
            </span>
            {f.multiline || f.list ? (
              <Textarea
                value={val}
                placeholder={f.default}
                rows={
                  f.list ? Math.min(7, f.default.split("\n").length + 1) : 2
                }
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <Input
                value={val}
                placeholder={f.default}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.list && (
              <span className="text-[9px] text-muted-foreground">
                One item per line.
              </span>
            )}
          </div>
        );
      })}
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
  newAgentPicker,
}: SocialCustomizerProps) {
  const isReport = config.view === "monthly";
  const isAotw = config.view === "aotw";
  const isNewAgent = config.view === "newagent";
  const isRecruiting = config.view === "recruiting";
  // Only the dark Spotlight theme has light text, so only it may carry a photo
  // background (with a legibility scrim). Editorial + Lift are dark-text on a light
  // surface, so they get light "paper" presets and no photo background.
  const allowsBgImage = config.cardTheme === "spotlight";
  const bgPresets =
    config.cardTheme === "spotlight" ? BG_PRESETS_DARK : BG_PRESETS_LIGHT;

  return (
    <div className="space-y-4">
      {/* Recruiting templates carry no live data, so the sample toggle is irrelevant there. */}
      {!isRecruiting && (
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
      )}
      {/* How it posts to Instagram — Post (feed), Story, or Reel. Reels are video-only
          via the IG API, so a static graphic can't post as one (disabled). Choosing
          Story locks the canvas to 9:16; Post exposes the feed shape sub-control. */}
      <Field label="Post type">
        <div className="flex gap-1">
          {(
            [
              { v: "post", label: "Post" },
              { v: "story", label: "Story" },
              { v: "reel", label: "Reel" },
            ] as const
          ).map((o) => {
            const active = config.postType === o.v;
            const disabled = o.v === "reel";
            return (
              <Button
                key={o.v}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={disabled}
                title={
                  disabled
                    ? "Reels need a video — a static graphic can't post as a reel"
                    : undefined
                }
                className="flex-1"
                onClick={() =>
                  onChange(
                    o.v === "story"
                      ? { postType: "story", format: "story" }
                      : {
                          postType: "post",
                          format:
                            config.format === "story"
                              ? "portrait"
                              : config.format,
                        },
                  )
                }
              >
                {o.label}
              </Button>
            );
          })}
        </div>
      </Field>

      {config.postType === "post" && (
        <Field label="Shape">
          <PillNav
            size="sm"
            activeValue={config.format}
            onChange={(v) =>
              onChange({ format: v as SocialStudioConfig["format"] })
            }
            items={[
              { label: "Portrait 4:5", value: "portrait" },
              { label: "Square 1:1", value: "square" },
            ]}
          />
        </Field>
      )}
      {/* ONE shared brand theme drives EVERY card type — pick a look once and it
          applies to daily / weekly / monthly / AOTW alike. Switching theme clears any
          AOTW background tied to the old theme's text-color regime (a dark preset would
          be illegible on the light themes); font + sizes are regime-agnostic, so persist.
          Recruiting templates have their OWN palette per design, so the theme doesn't apply. */}
      {!isRecruiting && (
        <Field label="Theme">
          <PillNav
            size="sm"
            activeValue={config.cardTheme}
            onChange={(v) =>
              onChange({
                cardTheme: v as SocialStudioConfig["cardTheme"],
                aowBackground: null,
                aowBgImageUrl: null,
              })
            }
            items={CARD_THEMES.map((th) => ({
              label: CARD_THEME_LABEL[th],
              value: th,
            }))}
          />
        </Field>
      )}

      {/* Recruiting view: pick a template design + optional headline override. */}
      {isRecruiting && (
        <>
          <Field label="Template">
            <div className="grid grid-cols-2 gap-1.5">
              {RECRUITING_VARIANTS.map((r) => {
                const active = config.recruitingVariant === r.v;
                return (
                  <Button
                    key={r.v}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="justify-start text-xs"
                    onClick={() => onChange({ recruitingVariant: r.v })}
                  >
                    {r.label}
                  </Button>
                );
              })}
            </div>
          </Field>
          <CopyEditor
            fields={RECRUITING_COPY[config.recruitingVariant]}
            variant={config.recruitingVariant}
            templateCopy={config.templateCopy}
            onChange={(tc) => onChange({ templateCopy: tc })}
          />
        </>
      )}

      {/* New Agents view: pick the welcome design + which agents to feature. */}
      {isNewAgent && (
        <Field label="Welcome design">
          <div className="grid grid-cols-3 gap-1.5">
            {WELCOME_VARIANTS.map((w) => {
              const active = config.welcomeVariant === w.v;
              return (
                <Button
                  key={w.v}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="text-[11px]"
                  onClick={() => onChange({ welcomeVariant: w.v })}
                >
                  {w.label}
                </Button>
              );
            })}
          </div>
        </Field>
      )}
      {isNewAgent && (
        <CopyEditor
          fields={WELCOME_COPY[config.welcomeVariant]}
          variant={config.welcomeVariant}
          templateCopy={config.templateCopy}
          onChange={(tc) => onChange({ templateCopy: tc })}
        />
      )}
      {isNewAgent && newAgentPicker}

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

      {/* Show-top applies to every ranked view INCLUDING the monthly report (its roster
          paginates across continuation slides). "All" posts the whole agency. */}
      {!isAotw && !isNewAgent && (
        <Field label="Show top">
          <PillNav
            size="sm"
            activeValue={
              typeof config.topN === "number" ? String(config.topN) : "all"
            }
            onChange={(v) =>
              onChange({ topN: v === "all" ? "all" : Number(v) })
            }
            items={[
              { label: "Top 5", value: "5" },
              { label: "Top 10", value: "10" },
              { label: "Top 20", value: "20" },
              { label: "Top 50", value: "50" },
              { label: "All", value: "all" },
            ]}
          />
        </Field>
      )}

      {!isReport && !isAotw && !isNewAgent && (
        <>
          <Field label="Headline">
            <Input
              value={config.title ?? ""}
              placeholder={
                config.topN === "all"
                  ? "AGENCY LEADERBOARD"
                  : `TOP ${config.topN} AGENTS`
              }
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

      {/* Data-card wording — labels/headings editable (the live numbers stay live). */}
      {(config.view === "daily" || config.view === "weekly") && (
        <CopyEditor
          fields={LEADERBOARD_COPY}
          variant="leaderboard"
          templateCopy={config.templateCopy}
          onChange={(tc) => onChange({ templateCopy: tc })}
        />
      )}
      {isReport && (
        <CopyEditor
          fields={MONTHLY_COPY}
          variant="monthly"
          templateCopy={config.templateCopy}
          onChange={(tc) => onChange({ templateCopy: tc })}
        />
      )}
      {isAotw && (
        <CopyEditor
          fields={AOTW_COPY}
          variant="aotw"
          templateCopy={config.templateCopy}
          onChange={(tc) => onChange({ templateCopy: tc })}
        />
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
