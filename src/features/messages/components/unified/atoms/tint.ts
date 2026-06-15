// src/features/messages/components/unified/atoms/tint.ts
// Accent-tint helpers for the unified inbox atoms. Mirrors the handoff's
// "accent at N% alpha for soft backgrounds, solid accent for text/icon" rule.
// Values lifted verbatim from the board tokens (T.blue/violet/amber/red/green).

import { T } from "@/components/board/tokens";

export type AccentTone = "blue" | "violet" | "amber" | "red" | "green" | "mut";

// RGB triplets for the accent hexes so we can build rgba() tints at any alpha.
const RGB: Record<Exclude<AccentTone, "mut">, string> = {
  blue: "91,155,255", // #5b9bff
  violet: "182,155,255", // #b69bff
  amber: "244,180,58", // #f4b43a
  red: "255,106,93", // #ff6a5d
  green: "95,208,138", // #5fd08a
};

/** Soft tinted background/ring: accent (or white for `mut`) at the given alpha. */
export function tint(tone: AccentTone, alpha: number): string {
  if (tone === "mut") return `rgba(255,255,255,${alpha})`;
  return `rgba(${RGB[tone]},${alpha})`;
}

/** Solid accent color for text/icons. */
export function toneColor(tone: AccentTone): string {
  switch (tone) {
    case "blue":
      return T.blue;
    case "violet":
      return T.violet;
    case "amber":
      return T.amber;
    case "red":
      return T.red;
    case "green":
      return T.green;
    case "mut":
    default:
      return T.mut;
  }
}
