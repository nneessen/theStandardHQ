// Shared character caps for AI-drafted marketing carousel copy (review #14).
//
// The server (supabase/functions/_shared/social-copy.ts → COPY_CAPS) is AUTHORITATIVE — it
// sanitizes + truncates every drafted field to these lengths. This module mirrors the same
// numbers for the editor `maxLength` attributes and the export stress harness, so the UI
// limit can't silently drift from what the server enforces. The Deno/Vite runtime split
// prevents a single literal shared import, so keep this in sync with the edge function.
//
// Raised from the original tight set (headline 40 / body 160), which truncated the AI's
// copy mid-thought. New fields below back the richer layout archetypes.
export const MARKETING_COPY_CAPS = {
  text: 180,
  attribution: 56,
  headline: 64,
  body: 240,
  eyebrow: 28,
  subheadline: 130,
  itemLabel: 48,
  itemDetail: 96,
  bullet: 72,
  stat: 14,
  statLabel: 44,
  compareTitle: 28,
  compareItem: 44,
  ctaAction: 40,
} as const;

/** Count caps for array fields — mirrors the server's LIST_CAPS. */
export const MARKETING_LIST_CAPS = {
  items: 5,
  bullets: 6,
  compareItems: 4,
} as const;
