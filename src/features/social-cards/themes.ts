// src/features/social-cards/themes.ts
// Shared THEME system for every social card (leaderboard / report / AOTW). An agency
// picks ONE theme and gets a consistent on-brand look across all its post types — the
// library is themes × card types. All values come from the app's own brand system
// (src/index.css): indigo #6366f1/#4f46e5/#818cf8, slate ink #0f172a, surfaces
// #1e293b/#0a0f1c/#141a2a, off-whites/grays; fonts Big Shoulders Display + Inter.
//
// A theme is a token set + a few character flags. Card components read these tokens
// instead of hardcoding, so a new theme is mostly a new token block here. Adding a
// card type = consume the same tokens. NO amber, NO invented palette.

import type { CSSProperties } from "react";

export type CardTheme = "spotlight" | "editorial" | "lift";

export const CARD_THEMES: CardTheme[] = ["spotlight", "editorial", "lift"];

export const CARD_THEME_LABEL: Record<CardTheme, string> = {
  spotlight: "Spotlight",
  editorial: "Editorial",
  lift: "Lift",
};

export const CARD_THEME_BLURB: Record<CardTheme, string> = {
  spotlight: "Dark, dramatic indigo stage with glow + depth",
  editorial: "Black & white magazine — typographic, sharp rules",
  lift: "Clean light cards, rounded, soft shadows",
};

export const BIG =
  '"Big Shoulders Display", "Arial Black", system-ui, sans-serif';
export const SANS = '"Inter", system-ui, sans-serif';

export interface CardThemeTokens {
  key: CardTheme;
  mode: "dark" | "light";

  /** Page background: a solid fill + an optional layered atmosphere image. */
  pageBg: string;
  pageBgImage?: string;

  /** Inner panel / board surface. */
  panelBg: string;
  panelBorder: string;
  panelRadius: number;
  panelShadow: string;

  /** Text. */
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  onAccent: string;

  /** Brand accent (indigo) — used sparingly. */
  accent: string;
  accentStrong: string;
  accentSoft: string;

  /** Structure. */
  hairline: string; // row dividers
  ruleStrong: string; // heavy masthead / band rule

  /** Type. */
  disp: string;
  sans: string;

  /** Ranking / highlight treatment. */
  topInk: string; // top-3 name color
  rankTopBg: string; // top-3 rank badge fill
  rankTopInk: string;
  rankBg: string; // normal rank chip fill
  rankInk: string;
  rowTopTint: string; // subtle top-3 row background

  /** Character flags. */
  sharp: boolean; // editorial = sharp corners + heavy ink rules
}

// Layered indigo atmosphere for the dark Spotlight theme (true mesh, not flat).
const SPOTLIGHT_ATMOSPHERE =
  "radial-gradient(60% 38% at 50% 0%, rgba(99,102,241,0.34), rgba(99,102,241,0) 70%)," +
  "radial-gradient(80% 40% at 100% 12%, rgba(40,52,74,0.7), rgba(40,52,74,0) 72%)," +
  "radial-gradient(90% 50% at 50% 110%, rgba(2,4,10,0.92), rgba(2,4,10,0) 60%)";

export const CARD_THEME_TOKENS: Record<CardTheme, CardThemeTokens> = {
  spotlight: {
    key: "spotlight",
    mode: "dark",
    pageBg: "#0a0f1c",
    pageBgImage: SPOTLIGHT_ATMOSPHERE,
    panelBg: "#141a2a",
    panelBorder: "rgba(241,245,249,0.10)",
    panelRadius: 18,
    panelShadow: "0 18px 40px rgba(0,0,0,0.45)",
    ink: "#f1f5f9",
    inkMuted: "#94a3b8",
    inkSubtle: "#64748b",
    onAccent: "#ffffff",
    accent: "#6366f1",
    accentStrong: "#818cf8",
    accentSoft: "rgba(99,102,241,0.16)",
    hairline: "rgba(241,245,249,0.08)",
    ruleStrong: "rgba(241,245,249,0.22)",
    disp: BIG,
    sans: SANS,
    topInk: "#ffffff",
    rankTopBg: "linear-gradient(135deg, #6366f1, #4f46e5)",
    rankTopInk: "#ffffff",
    rankBg: "rgba(241,245,249,0.04)",
    rankInk: "#94a3b8",
    rowTopTint: "rgba(99,102,241,0.12)",
    sharp: false,
  },
  editorial: {
    key: "editorial",
    mode: "light",
    pageBg: "#ffffff",
    panelBg: "#ffffff",
    panelBorder: "#0f172a",
    panelRadius: 2,
    panelShadow: "none",
    ink: "#0f172a",
    inkMuted: "#64748b",
    inkSubtle: "#94a3b8",
    onAccent: "#ffffff",
    accent: "#6366f1",
    accentStrong: "#4f46e5",
    accentSoft: "rgba(99,102,241,0.10)",
    hairline: "#e2e8f0",
    ruleStrong: "#0f172a",
    disp: BIG,
    sans: SANS,
    topInk: "#0f172a",
    rankTopBg: "#0f172a",
    rankTopInk: "#ffffff",
    rankBg: "transparent",
    rankInk: "#94a3b8",
    rowTopTint: "rgba(99,102,241,0.06)",
    sharp: true,
  },
  lift: {
    key: "lift",
    mode: "light",
    pageBg: "#f8f9fb",
    panelBg: "#ffffff",
    panelBorder: "#e2e8f0",
    panelRadius: 22,
    panelShadow: "0 18px 40px rgba(15,23,42,0.10)",
    ink: "#0f172a",
    inkMuted: "#64748b",
    inkSubtle: "#94a3b8",
    onAccent: "#ffffff",
    accent: "#6366f1",
    accentStrong: "#4f46e5",
    accentSoft: "rgba(99,102,241,0.10)",
    hairline: "#eef0f3",
    ruleStrong: "#e2e8f0",
    disp: BIG,
    sans: SANS,
    topInk: "#0f172a",
    rankTopBg: "linear-gradient(135deg, #6366f1, #4f46e5)",
    rankTopInk: "#ffffff",
    rankBg: "#f1f3f7",
    rankInk: "#64748b",
    rowTopTint: "rgba(99,102,241,0.05)",
    sharp: false,
  },
};

export function resolveCardTheme(theme?: CardTheme | null): CardThemeTokens {
  return CARD_THEME_TOKENS[theme ?? "spotlight"] ?? CARD_THEME_TOKENS.spotlight;
}

/** The app theme-v2 wrapper class for a theme's mode. The cards are self-contained,
 *  so this is only belt-and-suspenders for any legacy theme-v2 consumer of the
 *  wrapper — kept in ONE place so the three render sites don't drift. */
export function cardThemeWrapperClass(theme?: CardTheme | null): string {
  return resolveCardTheme(theme).mode === "light"
    ? "theme-v2"
    : "theme-v2 dark";
}

// Legacy config values map onto the new themes (saved templates persisted
// aowDesign aurora/editorial/noir and a leaderboard theme dark/light).
export function normalizeCardTheme(v?: string | null): CardTheme {
  switch (v) {
    case "spotlight":
    case "aurora": // AOTW legacy key (dark)
    case "dark": // leaderboard/report legacy theme
      return "spotlight";
    case "editorial":
      return "editorial";
    case "lift":
    case "noir": // AOTW legacy key (was dark, now the light Lift)
    case "light": // leaderboard/report legacy theme
      return "lift";
    default:
      return "spotlight";
  }
}

/** The page-background style block for a theme (solid + layered atmosphere). */
export function themePageBackground(t: CardThemeTokens): CSSProperties {
  return t.pageBgImage
    ? { background: t.pageBg, backgroundImage: t.pageBgImage }
    : { background: t.pageBg };
}
