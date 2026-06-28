// supabase/functions/_shared/social-copy.ts
// Shared text sanitization + length caps for the Social Studio AI copy functions:
//   • social-marketing-copy   — drafts ONE marketing slide's copy
//   • social-carousel-compose — drafts a whole deck (slides + caption)
// One home so the two functions can never diverge on cleanup rules or caps (review #14).

/** SERVER-AUTHORITATIVE per-field caps. Mirrors the frontend src/features/social-studio/
 *  marketingCopyCaps.ts (component maxLength + export harness) — keep the two in sync.
 *
 *  Raised from the original tight set (headline 40 / body 160) — those caused the AI's
 *  "1–2 sentences" to be truncated mid-thought server-side, which read as the "incomplete
 *  sentences" complaint. Copy is now written to FIT these by the model; the cap is only a
 *  safety backstop, not the intended length. New fields below power the richer layout
 *  archetypes (hook / list / checklist / stat / compare). */
export const COPY_CAPS = {
  text: 180, // pull-quote line
  attribution: 56,
  headline: 64,
  body: 240,
  // ── richer-archetype fields ──
  eyebrow: 28, // hook kicker / small label
  subheadline: 130, // hook supporting line
  itemLabel: 48, // numbered-list item title
  itemDetail: 96, // numbered-list item supporting line
  bullet: 72, // checklist line
  stat: 14, // big-stat hero value (e.g. "$1.2M", "65%")
  statLabel: 44, // big-stat caption
  compareTitle: 28, // compare column header
  compareItem: 44, // compare column line
  ctaAction: 40, // closing-slide action phrase
} as const;

/** Count caps for array fields (clamped server-side after per-item length capping). */
export const LIST_CAPS = {
  items: 5, // numbered-list rows
  bullets: 6, // checklist rows
  compareItems: 4, // lines per compare column
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

/** clean() + capWords() in one — the standard sanitize+truncate for a single slide field. */
export function capLine(s: unknown, max: number): string {
  return capWords(clean(s), max);
}

/** Sanitize + cap an array of short string lines (checklist / compare column): clean each,
 *  drop empties, length-cap each to `maxLen`, then clamp the count to `maxItems`. Returns []
 *  for any non-array input so a malformed field never throws. */
export function cleanList(
  raw: unknown,
  maxItems: number,
  maxLen: number,
): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const line = capLine(v, maxLen);
    if (line) out.push(line);
    if (out.length >= maxItems) break;
  }
  return out;
}
