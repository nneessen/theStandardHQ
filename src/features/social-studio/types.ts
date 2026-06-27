// src/features/social-studio/types.ts
// Phase-1 client-side studio config (the editable settings that drive the live
// preview + download). Persistence (schedules/toggles) lands in Phase 2.

// Single source of truth for the output dimensions (2026 Instagram sizes).
import { normalizeCardTheme } from "@/features/social-cards";
import type { CardTheme, SocialFormat } from "@/features/social-cards";
export type { SocialFormat };

export type SocialView = "daily" | "weekly" | "monthly" | "aotw" | "newagent";

/** Where the graphic gets posted on Instagram (the user picks "post it as a post, a
 *  story, or a reel"). Drives the canvas aspect AND the publish endpoint:
 *   • post  → feed (portrait 4:5 or square 1:1), feed/carousel endpoint
 *   • story → 9:16, Stories endpoint
 *   • reel  → video-only via the IG API; disabled in the UI (no static-image reels).
 */
export type SocialPostType = "post" | "story" | "reel";

export interface SocialStudioConfig {
  view: SocialView;
  format: SocialFormat;
  /** Instagram destination — see SocialPostType. */
  postType: SocialPostType;
  /** The shared brand theme (Spotlight / Editorial / Lift). Applies to EVERY card
   *  type — one agency picks a theme and gets a consistent look across all posts. */
  cardTheme: CardTheme;
  /** How many producers to include. A number (5/10/20/50) or "all" for the whole
   *  agency. The roster is paginated across multiple cards at render (see
   *  buildPreviewPages) — "all" is JSON-safe for template persistence (unlike a
   *  numeric Infinity/0 sentinel). */
  topN: number | "all";
  /** Optional headline override; falls back to the card's default. */
  title?: string;
  /** Show the policy-count column on leaderboard cards. */
  showPolicies: boolean;
  /** Instagram caption (copy/paste in P1; auto-attached when posting in P2). */
  caption: string;
  /**
   * Agent-of-the-Week photo SOURCE the card renders — a data: URL while editing,
   * so the in-app preview AND the PNG export both capture it with zero
   * cross-origin dependency (a remote URL silently drops from the PNG on a CORS
   * miss). Null → no photo (the spotlight renders without one). (aotw only.)
   */
  aowPhotoUrl: string | null;
  /**
   * Public Supabase Storage URL of the uploaded photo (spotlight-assets bucket).
   * Kept for later Instagram posting / persistence (IG needs a public URL, not a
   * data URL); NOT what the card renders in Phase 1.
   */
  aowPhotoStorageUrl: string | null;
  /** Photo focal point as a CSS `object-position` ("x% y%") — set by dragging the
   *  photo in the preview so the face fits the frame. Default "50% 50%". (aotw only.) */
  aowPhotoPosition: string;

  // ── Agent-of-the-Week customization (Step 3) — only used when view === "aotw".
  /** CSS font-family override for the hero name; null → the design default
   *  (Big Shoulders Display). The small supporting labels stay Inter. */
  aowFontDisplay: string | null;
  /** CSS `background` override (a solid/gradient preset); null → design default.
   *  Mutually exclusive with aowBgImageUrl (setting one clears the other). */
  aowBackground: string | null;
  /** Uploaded background image as a data: URL (Spotlight / key "aurora" only — it has
   *  light text, so a scrim keeps it legible). Baked into the export, so it stays a
   *  data URL (no Storage round-trip needed, unlike the agent photo). Null → none. */
  aowBgImageUrl: string | null;
  /** Multiplier on the agent-name size (the "size" control). Default 1. */
  aowTitleScale: number;
  /** Multiplier on the agency-name size ("a lot larger"). Default 1. */
  aowAgencyScale: number;
}

export const DEFAULT_CONFIG: SocialStudioConfig = {
  view: "daily",
  format: "portrait",
  postType: "post",
  cardTheme: "spotlight",
  topN: 10,
  title: undefined,
  showPolicies: true,
  caption: "",
  aowPhotoUrl: null,
  aowPhotoStorageUrl: null,
  aowPhotoPosition: "50% 50%",
  aowFontDisplay: null,
  aowBackground: null,
  aowBgImageUrl: null,
  aowTitleScale: 1,
  aowAgencyScale: 1,
};

// Per-POST content that is never part of a reusable STYLE template: the uploaded
// agent photo, a background-image data URL, and the caption (post-specific text — a
// template must not silently overwrite the caption the owner is writing). Stripped
// before a template is saved.
const TEMPLATE_OMIT_KEYS = [
  "aowPhotoUrl",
  "aowPhotoStorageUrl",
  "aowPhotoPosition",
  "aowBgImageUrl",
  "caption",
] as const satisfies readonly (keyof SocialStudioConfig)[];

/** The reusable style subset of a config that a template stores (no post content). */
export type SocialTemplateConfig = Omit<
  SocialStudioConfig,
  (typeof TEMPLATE_OMIT_KEYS)[number]
>;

/** Extract the saveable style from a full config (drops per-post photo/bg/caption).
 *  Strips exactly TEMPLATE_OMIT_KEYS so the omitted set has a single source of truth. */
export function toTemplateConfig(c: SocialStudioConfig): SocialTemplateConfig {
  const clone: Partial<SocialStudioConfig> = { ...c };
  for (const key of TEMPLATE_OMIT_KEYS) delete clone[key];
  return clone as SocialTemplateConfig;
}

/** Resolve the theme for an applied template/preset, migrating legacy rows that
 *  stored `aowDesign` / `theme` (saved before the unified `cardTheme`) so an old
 *  template restores its intended look instead of silently keeping the current theme
 *  — or worse, yielding `undefined` and crashing the wrapper-mode lookup. */
export function resolveTemplateTheme(
  c: Partial<SocialStudioConfig>,
): CardTheme {
  const legacy = c as Record<string, unknown>;
  return normalizeCardTheme(
    (c.cardTheme ?? legacy.aowDesign ?? legacy.theme) as string | undefined,
  );
}

export const VIEW_META: Record<
  SocialView,
  { label: string; blurb: string; period: "daily" | "weekly" | "mtd" }
> = {
  daily: {
    label: "Daily Leaderboard",
    blurb: "Today's top producers by AP",
    period: "daily",
  },
  weekly: {
    label: "Weekly Leaderboard",
    blurb: "This week's top producers by AP",
    period: "weekly",
  },
  monthly: {
    label: "Monthly Report",
    blurb: "Month-to-date agency recap",
    period: "mtd",
  },
  aotw: {
    label: "Agent of the Week",
    blurb: "This week's #1 producer",
    period: "weekly",
  },
  newagent: {
    label: "New Agents",
    blurb: "Welcome your newest agents",
    period: "weekly",
  },
};
