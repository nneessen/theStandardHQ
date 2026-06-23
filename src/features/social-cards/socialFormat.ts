// src/features/leaderboard/social/socialFormat.ts
// Shared formatting for social/report graphics.

/**
 * Output formats for the social cards, with their current (2026) Instagram pixel
 * dimensions. Width is always 1080.
 *   • portrait — 4:5 feed post (1080×1350). Instagram's RECOMMENDED feed size — a
 *     vertical post takes up the most room in the feed; this is the default.
 *   • square   — 1:1 feed post (1080×1080). The older standard, still supported.
 *   • story    — 9:16 full-screen (1080×1920). Same canvas for Stories AND Reels.
 * (Landscape 1.91:1 is intentionally omitted — these data-dense cards don't fit a
 * 566px-tall canvas.)
 */
export type SocialFormat = "portrait" | "square" | "story";

/** One slide's position in a multi-card carousel (1-based). Present on a card only
 *  when the roster spills past a single page, so the card can stamp "PAGE X / N". */
export interface CardPageInfo {
  index: number;
  total: number;
}

export const FORMAT_DIMS: Record<SocialFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

/**
 * Render an agent's name as first name + last initial (privacy + house style):
 *   "Marcus Webb"       → "Marcus W."
 *   "Liam O'Connor"     → "Liam O."
 *   "Priya"             → "Priya"
 *   "Mary Jo Saunders"  → "Mary S."  (collapses middle names; last token wins)
 */
export function toLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
}

/** Whole-dollar USD, no cents. */
export const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** Up to two leading initials, uppercased ("Marcus W." → "MW", "Priya" → "P"). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
