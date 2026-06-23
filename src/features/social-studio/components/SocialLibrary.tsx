// src/features/social-studio/components/SocialLibrary.tsx
// Template library for the Spotlight studio: save the current card style, and pick
// from built-in starters or your saved templates. Each tile is a REAL scaled card
// (sample data) so the preview is exactly the component the studio renders.

import { useState } from "react";
import { Loader2, Trash2, Save } from "lucide-react";
import { Cap } from "@/components/board";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FORMAT_DIMS,
  CARD_THEMES,
  CARD_THEME_LABEL,
  cardThemeWrapperClass,
} from "@/features/social-cards";
import { SocialCardSwitch } from "./SocialPreview";
import { buildPreviewData } from "../previewModel";
import {
  DEFAULT_CONFIG,
  toTemplateConfig,
  resolveTemplateTheme,
  type SocialStudioConfig,
  type SocialTemplateConfig,
} from "../types";
import {
  useSocialTemplates,
  useCreateSocialTemplate,
  useDeleteSocialTemplate,
} from "../hooks/useSocialTemplates";

// Built-in starting points (read-only). Each resets the style to a design's clean
// look — the per-post photo (aowPhotoUrl) is intentionally NOT included, so applying
// a starter keeps any uploaded photo.
const CLEAN_STYLE = {
  aowFontDisplay: null,
  aowBackground: null,
  aowBgImageUrl: null,
  aowTitleScale: 1,
  aowAgencyScale: 1,
} as const;

const VIEW_LABEL: Record<SocialStudioConfig["view"], string> = {
  aotw: "Agent of Week",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// The library = every card type × every brand theme, so an agency can browse the
// full set and pick a consistent look. Each starter resets the AOTW style to clean.
const BUILTIN_PRESETS: {
  key: string;
  name: string;
  config: Partial<SocialStudioConfig>;
}[] = (["aotw", "daily", "weekly", "monthly"] as const).flatMap((view) =>
  CARD_THEMES.map((th) => ({
    key: `${view}-${th}`,
    name: `${VIEW_LABEL[view]} · ${CARD_THEME_LABEL[th]}`,
    config: { view, cardTheme: th, ...CLEAN_STYLE },
  })),
);

const THUMB_W = 150;

// Static sample labels for the thumbnails — the library shows the LOOK, not live
// data (the date never matters here, so it's fixed rather than "now").
const THUMB_LABELS = {
  dateLabel: "JUN 20, 2026",
  monthLabel: "JUNE 2026",
  weekRange: "JUN 14–20",
};

/** A faithful miniature: the actual card the studio renders, built from the SAME
 *  buildPreviewData + SocialCardSwitch as the live preview (with sample data),
 *  scaled down — so a thumbnail can never drift from the real card. */
function TemplateThumb({
  config,
  agencyName,
  network,
}: {
  config: Partial<SocialStudioConfig>;
  agencyName: string;
  network?: string;
}) {
  const c: SocialStudioConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    // Migrate legacy saved templates (aowDesign/theme) → cardTheme so the thumbnail
    // reflects the saved look, not the default.
    cardTheme: resolveTemplateTheme(config),
  };
  const dims = FORMAT_DIMS[c.format];
  const scale = THUMB_W / dims.w;
  const themeClass = cardThemeWrapperClass(c.cardTheme);
  const data = buildPreviewData({
    config: c,
    producers: [],
    isSample: true,
    labels: THUMB_LABELS,
  });

  return (
    <div
      style={{ width: THUMB_W, height: Math.round(dims.h * scale) }}
      className="overflow-hidden rounded-md bg-card"
    >
      <div
        className={themeClass}
        style={{
          width: dims.w,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <SocialCardSwitch
          data={data}
          format={c.format}
          agencyName={agencyName}
          network={network}
          showPolicies={c.showPolicies}
        />
      </div>
    </div>
  );
}

function TemplateTile({
  name,
  config,
  agencyName,
  network,
  onApply,
  onDelete,
  deleting,
}: {
  name: string;
  config: Partial<SocialStudioConfig>;
  agencyName: string;
  network?: string;
  onApply: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="group relative" style={{ width: THUMB_W }}>
      <button
        type="button"
        onClick={onApply}
        title={`Apply "${name}"`}
        className="block overflow-hidden rounded-lg border border-border transition-colors hover:border-accent"
      >
        <TemplateThumb
          config={config}
          agencyName={agencyName}
          network={network}
        />
        <div className="border-t border-border px-2 py-1 text-left">
          <div className="truncate text-[11px] font-medium text-foreground">
            {name}
          </div>
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="Delete template"
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

interface SocialLibraryProps {
  config: SocialStudioConfig;
  onApply: (patch: Partial<SocialStudioConfig>) => void;
  agencyName: string;
  network?: string;
  imoId: string | null;
  agencyId: string | null;
}

export function SocialLibrary({
  config,
  onApply,
  agencyName,
  network,
  imoId,
  agencyId,
}: SocialLibraryProps) {
  const [name, setName] = useState("");
  const { data: saved = [], isLoading, isError } = useSocialTemplates();
  const createMut = useCreateSocialTemplate();
  const deleteMut = useDeleteSocialTemplate();

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || !imoId) return;
    createMut.mutate(
      {
        name: trimmed,
        config: toTemplateConfig(config) as SocialTemplateConfig,
        imoId,
        agencyId,
      },
      { onSuccess: () => setName("") },
    );
  };

  return (
    <div className="space-y-4">
      {/* Save current */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          maxLength={60}
          placeholder="Name this style…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          className="h-8 max-w-[240px] text-xs"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!name.trim() || !imoId || createMut.isPending}
          title={
            !imoId
              ? "Loading your agency…"
              : "Save the current card style as a reusable template"
          }
        >
          {createMut.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" /> Save current style
            </>
          )}
        </Button>
        <span className="text-[10px] text-muted-foreground">
          Saves the look (design, font, background, sizes) — not the photo.
        </span>
      </div>

      {/* Built-in starters */}
      <div className="space-y-2">
        <Cap style={{ fontSize: 11 }}>Starters</Cap>
        <div className="flex flex-wrap gap-3">
          {BUILTIN_PRESETS.map((p) => (
            <TemplateTile
              key={p.key}
              name={p.name}
              config={p.config}
              agencyName={agencyName}
              network={network}
              onApply={() => onApply(p.config)}
            />
          ))}
        </div>
      </div>

      {/* Saved templates */}
      <div className="space-y-2">
        <Cap style={{ fontSize: 11 }}>Saved templates</Cap>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : isError ? (
          <p className="text-[11px] text-destructive">
            Couldn't load your templates — refresh to try again.
          </p>
        ) : saved.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No saved templates yet. Style a card above, then “Save current
            style”.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {saved.map((t) => (
              <TemplateTile
                key={t.id}
                name={t.name}
                config={t.config}
                agencyName={agencyName}
                network={network}
                onApply={() => onApply(t.config)}
                onDelete={() => deleteMut.mutate(t.id)}
                deleting={deleteMut.isPending && deleteMut.variables === t.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
