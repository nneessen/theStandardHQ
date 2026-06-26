// supabase/functions/_shared/social-copy.ts
// Shared text sanitization + length caps for the Social Studio AI copy functions:
//   • social-marketing-copy   — drafts ONE marketing slide's copy
//   • social-carousel-compose — drafts a whole deck (slides + caption)
// One home so the two functions can never diverge on cleanup rules or caps (review #14).

/** SERVER-AUTHORITATIVE per-field caps. Mirrors the frontend src/features/social-studio/
 *  marketingCopyCaps.ts (component maxLength + export harness) — keep the two in sync. */
export const COPY_CAPS = {
  text: 140,
  attribution: 40,
  headline: 40,
  body: 160,
} as const;

/** Instagram's caption limit. */
export const CAPTION_CAP = 2200;

// ── Deterministic cleanup (feedback_ai_toggle_determinism) ────────────────────

/** For short single-line SLIDE fields (headline/body/quote text/attribution): strip markdown
 *  emphasis/fences/headings, strip surrounding quotes, and collapse ALL whitespace to single
 *  spaces. NOTE: this strips '#', so it must NOT be used on captions (hashtags are valid). */
export function clean(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/[*_`#]+/g, "") // markdown emphasis / fences / headings
    .replace(/^\s*["'“”']+|["'“”']+\s*$/g, "") // surrounding quotes
    .replace(/\s+/g, " ")
    .trim();
}

/** For CAPTIONS: like clean() but KEEPS '#' (hashtags are valid) and PRESERVES line breaks
 *  (captions put hashtags on their own line). Still strips markdown emphasis/code fences and
 *  surrounding quotes. (review #1: compose-mode used clean() and lost hashtags; caption-mode
 *  used neither and leaked markdown — both go through this now.) */
export function cleanCaption(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/[*_`]+/g, "") // markdown emphasis / code — keep '#' for hashtags
    .replace(/^\s*["'“”']+|["'“”']+\s*$/g, "") // surrounding quotes
    .replace(/[ \t]+/g, " ") // collapse spaces/tabs but keep newlines
    .replace(/\n{3,}/g, "\n\n") // cap consecutive blank lines
    .trim();
}

/** Hard length cap, trimmed at the last word boundary so we never cut mid-word, and never
 *  leaving a dangling UTF-16 high surrogate (which would corrupt an emoji at the boundary —
 *  review #13). */
export function capWords(s: string, max: number): string {
  if (s.length <= max) return s;
  let slice = s.slice(0, max);
  const last = slice.charCodeAt(slice.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) slice = slice.slice(0, -1); // drop lone high surrogate
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
}
